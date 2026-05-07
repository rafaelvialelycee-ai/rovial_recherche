import os
import io
import time
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import pandas as pd

from moteur_verif import verifier_email
from moteur_chercheur import generer_patterns, deduire_format_dominant, detecter_format_dominant_osint
from credits import get_credits, init_user, add_credits, consume_credits, count_valid_contacts
from stripe_service import create_checkout_session, handle_webhook, PLANS

_executor = ThreadPoolExecutor(max_workers=20)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ROVIAL Recherche API",
    description="API d'enrichissement et de verification B2B",
    version="3.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins \
    else ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Colonnes acceptees pour le CSV/XLSX bulk
BULK_COL_EMAIL  = ['email', 'e-mail', 'mail', 'adresse', 'address']
BULK_COL_PRENOM = ['prenom', 'prénom', 'first_name', 'firstname', 'first']
BULK_COL_NOM    = ['nom', 'last_name', 'lastname', 'last', 'surname']
BULK_COL_DOMAINE= ['domaine', 'domain', 'entreprise', 'company']
BULK_MAX_LIGNES = 500


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_user_id(request: Request) -> str:
    uid = request.headers.get("X-User-Id")
    if not uid:
        uid = request.client.host or "anonymous"
    init_user(uid)
    return uid


def _check_and_consume(user_id: str, amount: int):
    ok, remaining = consume_credits(user_id, amount)
    if not ok:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "credits_insuffisants",
                "message": f"Credits insuffisants. Solde : {remaining}, requis : {amount}.",
                "solde": remaining,
                "requis": amount,
            }
        )
    return remaining


def _prioritiser_patterns(patterns: list[str], format_dominant: Optional[str]) -> list[str]:
    if not format_dominant:
        return patterns
    FORMAT_VERS_INDEX = {'prenom.nom': 0, 'pnom': 1, 'prenom': 2, 'p.nom': 3}
    idx = FORMAT_VERS_INDEX.get(format_dominant)
    if idx is None or idx >= len(patterns):
        return patterns
    dominant = patterns[idx]
    return [dominant] + [p for i, p in enumerate(patterns) if i != idx]


def _normaliser_colonnes(df: pd.DataFrame, candidats: list[str]) -> Optional[str]:
    """Trouve le nom de colonne dans df parmi les candidats (insensible a la casse)."""
    df_cols_lower = {c.lower().strip(): c for c in df.columns}
    for c in candidats:
        if c.lower() in df_cols_lower:
            return df_cols_lower[c.lower()]
    return None


def _lire_fichier_bulk(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Lit un fichier CSV ou XLSX et retourne un DataFrame propre."""
    ext = filename.rsplit('.', 1)[-1].lower()
    if ext == 'csv':
        # Essai UTF-8 puis latin-1
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding='utf-8')
        except Exception:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding='latin-1')
    elif ext in ('xlsx', 'xls'):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        raise ValueError(f"Format non supporte : {ext}. Utiliser CSV ou XLSX.")
    return df


# ── Schemas ───────────────────────────────────────────────────────────────────

class EmailRequest(BaseModel):
    email: str

class BulkEmailRequest(BaseModel):
    emails: list[str]

class ChercheurRequest(BaseModel):
    prenom: str
    nom: str
    domaine: str
    emails_connus: Optional[list[str]] = None

class BulkChercheurRequest(BaseModel):
    contacts: list[ChercheurRequest]

class CheckoutRequest(BaseModel):
    plan_id: str


# ── Routes Verificateur ───────────────────────────────────────────────────────

@app.post("/api/verifier")
@limiter.limit("60/minute")
def verifier(request: Request, req: EmailRequest):
    user_id = _get_user_id(request)
    _check_and_consume(user_id, 1)
    return verifier_email(req.email)


@app.post("/api/verifier/bulk")
@limiter.limit("10/minute")
def verifier_bulk(request: Request, req: BulkEmailRequest):
    if len(req.emails) > BULK_MAX_LIGNES:
        raise HTTPException(status_code=400, detail=f"Maximum {BULK_MAX_LIGNES} e-mails par requete.")
    user_id = _get_user_id(request)
    nb = len(req.emails)
    _check_and_consume(user_id, nb)

    resultats = [None] * nb
    futures = {_executor.submit(verifier_email, email): i for i, email in enumerate(req.emails)}
    for future in as_completed(futures):
        idx = futures[future]
        try:
            resultats[idx] = future.result()
        except Exception as e:
            resultats[idx] = {'email': req.emails[idx], 'statut': 'Erreur', 'confiance': 0, 'methode': 'Exception', 'detail': str(e)}

    return {"resultats": resultats, "total": nb}


# ── Routes Chercheur ──────────────────────────────────────────────────────────

@app.post("/api/chercher")
@limiter.limit("30/minute")
def chercher(request: Request, req: ChercheurRequest):
    user_id = _get_user_id(request)
    _check_and_consume(user_id, 1)

    patterns_bruts = generer_patterns(req.prenom, req.nom, req.domaine)
    if not patterns_bruts:
        raise HTTPException(status_code=422, detail="Parametres insuffisants.")

    # OSINT d'abord, emails_connus en fallback
    format_dominant = None
    if req.emails_connus:
        format_dominant = deduire_format_dominant(req.emails_connus)
    if not format_dominant:
        format_dominant = detecter_format_dominant_osint(req.domaine)

    patterns = _prioritiser_patterns(patterns_bruts, format_dominant)

    resultats_par_email: dict = {}
    futures = {_executor.submit(verifier_email, email): email for email in patterns}
    for future in as_completed(futures):
        email = futures[future]
        try:
            resultats_par_email[email] = future.result()
        except Exception as e:
            resultats_par_email[email] = {'email': email, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Exception', 'detail': str(e)}

    trouve_valide = None
    meilleur_incertain = None
    for email in patterns:
        r = resultats_par_email.get(email)
        if not r:
            continue
        if r['statut'] == 'Valide' and trouve_valide is None:
            trouve_valide = r
        elif r['statut'] == 'Incertain' and meilleur_incertain is None:
            meilleur_incertain = r

    resultats_detail = [
        resultats_par_email.get(email, {'email': email, 'statut': 'Non teste', 'confiance': 0, 'methode': '-', 'detail': ''})
        for email in patterns
    ]

    return {
        "patterns": patterns,
        "total_patterns": len(patterns),
        "resultats_detail": resultats_detail,
        "format_dominant_detecte": format_dominant,
        "trouve": trouve_valide,
        "incertain": meilleur_incertain,
        "fiable": trouve_valide is not None,
    }


@app.post("/api/chercher/bulk")
@limiter.limit("5/minute")
def chercher_bulk(request: Request, req: BulkChercheurRequest):
    if len(req.contacts) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 contacts par requete.")

    user_id = _get_user_id(request)
    nb_valides = count_valid_contacts(req.contacts)
    if nb_valides == 0:
        raise HTTPException(status_code=422, detail="Aucun contact valide dans la liste.")
    _check_and_consume(user_id, nb_valides)

    def traiter_contact(contact):
        patterns_bruts = generer_patterns(contact.prenom, contact.nom, contact.domaine)
        if not patterns_bruts:
            return {"prenom": contact.prenom, "nom": contact.nom, "domaine": contact.domaine, "email": "Donnees insuffisantes", "statut": "Erreur", "fiable": False}
        format_dominant = None
        if contact.emails_connus:
            format_dominant = deduire_format_dominant(contact.emails_connus)
        if not format_dominant:
            format_dominant = detecter_format_dominant_osint(contact.domaine)
        patterns = _prioritiser_patterns(patterns_bruts, format_dominant)
        resultats_par_email = {}
        futs = {_executor.submit(verifier_email, e): e for e in patterns}
        for f in as_completed(futs):
            em = futs[f]
            try:
                resultats_par_email[em] = f.result()
            except Exception:
                resultats_par_email[em] = {'email': em, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Exception', 'detail': ''}
        trouve_valide = None
        meilleur_incertain = None
        for email in patterns:
            r = resultats_par_email.get(email, {})
            if r.get('statut') == 'Valide' and not trouve_valide:
                trouve_valide = r
            elif r.get('statut') == 'Incertain' and not meilleur_incertain:
                meilleur_incertain = r
        gagnant = trouve_valide or meilleur_incertain
        return {
            "prenom": contact.prenom, "nom": contact.nom, "domaine": contact.domaine,
            "email": gagnant['email'] if gagnant else "Non trouve",
            "statut": gagnant['statut'] if gagnant else "Echec",
            "fiable": trouve_valide is not None,
        }

    resultats = [None] * len(req.contacts)
    contact_futures = {_executor.submit(traiter_contact, c): i for i, c in enumerate(req.contacts)}
    for future in as_completed(contact_futures):
        idx = contact_futures[future]
        try:
            resultats[idx] = future.result()
        except Exception:
            c = req.contacts[idx]
            resultats[idx] = {"prenom": c.prenom, "nom": c.nom, "domaine": c.domaine, "email": "Erreur", "statut": "Erreur", "fiable": False}

    return {"resultats": resultats, "total": len(resultats)}


# ── Route Bulk CSV/XLSX ───────────────────────────────────────────────────────

@app.post("/api/bulk")
@limiter.limit("3/minute")
async def bulk_upload(request: Request, file: UploadFile = File(...)):
    """
    Endpoint d'upload CSV ou XLSX pour traitement en masse.

    Colonnes acceptees (insensible a la casse) :
      Mode Verificateur : email / e-mail / mail
      Mode Chercheur    : prenom, nom, domaine

    Retourne un CSV de resultats en streaming.
    Limite : 500 lignes max. Rate limit : 3 req/min.
    """
    user_id = _get_user_id(request)

    filename = file.filename or "upload.csv"
    file_bytes = await file.read()

    if len(file_bytes) > 5 * 1024 * 1024:  # 5 MB max
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 5 MB).")

    try:
        df = _lire_fichier_bulk(file_bytes, filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Impossible de lire le fichier : {e}")

    if len(df) == 0:
        raise HTTPException(status_code=422, detail="Le fichier est vide.")
    if len(df) > BULK_MAX_LIGNES:
        raise HTTPException(status_code=400, detail=f"Maximum {BULK_MAX_LIGNES} lignes par fichier.")

    # Detection du mode : Verificateur (colonne email) ou Chercheur (prenom+nom+domaine)
    col_email   = _normaliser_colonnes(df, BULK_COL_EMAIL)
    col_prenom  = _normaliser_colonnes(df, BULK_COL_PRENOM)
    col_nom     = _normaliser_colonnes(df, BULK_COL_NOM)
    col_domaine = _normaliser_colonnes(df, BULK_COL_DOMAINE)

    mode_verif    = col_email is not None
    mode_chercheur = col_prenom and col_nom and col_domaine

    if not mode_verif and not mode_chercheur:
        raise HTTPException(
            status_code=422,
            detail="Colonnes non reconnues. Fournir 'email' (mode verificateur) ou 'prenom'+'nom'+'domaine' (mode chercheur)."
        )

    nb_lignes = len(df)
    _check_and_consume(user_id, nb_lignes)

    # ── Rate limiting par domaine : max 10 req/domaine/seconde en bulk ──────
    # On group les jobs par domaine et on insere un delai entre groupes
    resultats_rows = [None] * nb_lignes

    if mode_verif:
        # ── MODE VERIFICATEUR ────────────────────────────────────────────────
        emails = df[col_email].fillna('').astype(str).tolist()

        # Regroupement par domaine pour rate limiting
        domaine_to_indices: dict[str, list] = {}
        for i, email in enumerate(emails):
            d = email.split('@')[-1].lower() if '@' in email else '__invalid__'
            domaine_to_indices.setdefault(d, []).append(i)

        for domaine, indices in domaine_to_indices.items():
            group_emails = [(i, emails[i]) for i in indices]
            # Traitement concurrent dans le groupe, puis delai inter-domaine
            futs = {_executor.submit(verifier_email, em): (i, em) for i, em in group_emails}
            for f in as_completed(futs):
                idx, em = futs[f]
                try:
                    res = f.result()
                except Exception as e:
                    res = {'email': em, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Exception', 'detail': str(e)}
                resultats_rows[idx] = {
                    'email': res.get('email', em),
                    'statut': res.get('statut', ''),
                    'confiance': res.get('confiance', 0),
                    'methode': res.get('methode', ''),
                    'detail': res.get('detail', ''),
                }
            # Pause legere entre groupes de domaines pour eviter blacklisting
            if len(indices) >= 5:
                time.sleep(0.3)

    else:
        # ── MODE CHERCHEUR ───────────────────────────────────────────────────
        prenoms  = df[col_prenom].fillna('').astype(str).tolist()
        noms     = df[col_nom].fillna('').astype(str).tolist()
        domaines = df[col_domaine].fillna('').astype(str).tolist()

        # Regroupement par domaine
        domaine_to_indices: dict[str, list] = {}
        for i, d in enumerate(domaines):
            domaine_to_indices.setdefault(d.lower().strip(), []).append(i)

        for domaine_grp, indices in domaine_to_indices.items():
            # OSINT une seule fois par domaine (cache 24h dans moteur_chercheur)
            format_dominant = detecter_format_dominant_osint(domaine_grp)

            def traiter_ligne(idx):
                prenom  = prenoms[idx]
                nom     = noms[idx]
                domaine = domaines[idx]
                patterns_bruts = generer_patterns(prenom, nom, domaine)
                if not patterns_bruts:
                    return idx, {'prenom': prenom, 'nom': nom, 'domaine': domaine,
                                 'email': 'Donnees insuffisantes', 'statut': 'Erreur',
                                 'confiance': 0, 'fiable': False}
                patterns = _prioritiser_patterns(patterns_bruts, format_dominant)
                # Test en cascade : on s'arrete au premier Valide
                trouve = None
                incertain = None
                for email in patterns:
                    res = verifier_email(email)
                    if res.get('statut') == 'Valide':
                        trouve = res
                        break
                    if res.get('statut') == 'Incertain' and not incertain:
                        incertain = res
                gagnant = trouve or incertain
                return idx, {
                    'prenom': prenom, 'nom': nom, 'domaine': domaine,
                    'email': gagnant['email'] if gagnant else 'Non trouve',
                    'statut': gagnant['statut'] if gagnant else 'Echec',
                    'confiance': gagnant.get('confiance', 0) if gagnant else 0,
                    'fiable': trouve is not None,
                }

            futs = {_executor.submit(traiter_ligne, i): i for i in indices}
            for f in as_completed(futs):
                try:
                    idx, row = f.result()
                    resultats_rows[idx] = row
                except Exception as e:
                    i = futs[f]
                    resultats_rows[i] = {
                        'prenom': prenoms[i], 'nom': noms[i], 'domaine': domaines[i],
                        'email': 'Erreur', 'statut': 'Erreur', 'confiance': 0, 'fiable': False
                    }
            if len(indices) >= 5:
                time.sleep(0.3)

    # ── Export CSV en streaming ───────────────────────────────────────────────
    df_out = pd.DataFrame([r for r in resultats_rows if r is not None])
    output = io.StringIO()
    df_out.to_csv(output, index=False, encoding='utf-8-sig')  # utf-8-sig pour Excel
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=rovial_resultats.csv"}
    )


# ── Routes Credits ────────────────────────────────────────────────────────────

@app.get("/api/credits")
def credits_solde(request: Request):
    user_id = _get_user_id(request)
    return {"user_id": user_id, "solde": get_credits(user_id)}


@app.get("/api/plans")
def get_plans():
    return {"plans": PLANS}


@app.post("/api/stripe/checkout")
@limiter.limit("10/minute")
def stripe_checkout(request: Request, req: CheckoutRequest):
    user_id = _get_user_id(request)
    try:
        session = create_checkout_session(
            plan_id=req.plan_id,
            user_id=user_id,
            success_url=f"{FRONTEND_URL}/tarifs?success=true",
            cancel_url=f"{FRONTEND_URL}/tarifs?cancelled=true",
        )
        return session
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    event = handle_webhook(payload, sig_header)
    if event is None:
        raise HTTPException(status_code=400, detail="Signature webhook invalide.")

    if event.get("type") == "checkout.session.completed":
        meta = event.get("data", {}).get("object", {}).get("metadata", {})
        user_id = meta.get("user_id")
        credits = int(meta.get("credits", 0))
        if user_id and credits > 0:
            nouveau_solde = add_credits(user_id, credits)
            return {"status": "ok", "user_id": user_id, "credits_ajoutes": credits, "nouveau_solde": nouveau_solde}

    return {"status": "ignored"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ROVIAL Recherche API v3.1"}
