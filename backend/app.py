import os
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from moteur_verif import verifier_email
from moteur_chercheur import generer_patterns, deduire_format_dominant
from credits import get_credits, init_user, add_credits, consume_credits, count_valid_contacts
from stripe_service import create_checkout_session, handle_webhook, PLANS

_executor = ThreadPoolExecutor(max_workers=20)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ROVIAL Recherche API",
    description="API d'enrichissement et de vérification B2B",
    version="3.0.0",
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


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_user_id(request: Request) -> str:
    """
    Identifiant utilisateur extrait du header X-User-Id.
    En prod : remplacer par la vérification JWT Supabase.
    En dev : utilise l'IP comme fallback pour ne pas bloquer.
    """
    uid = request.headers.get("X-User-Id")
    if not uid:
        uid = request.client.host or "anonymous"
    init_user(uid)
    return uid


def _check_and_consume(user_id: str, amount: int):
    """Lève une HTTPException 402 si crédits insuffisants, sinon consomme."""
    ok, remaining = consume_credits(user_id, amount)
    if not ok:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "credits_insuffisants",
                "message": f"Crédits insuffisants. Solde : {remaining}, requis : {amount}.",
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


# ── Routes Vérificateur ───────────────────────────────────────────────────────

@app.post("/api/verifier")
@limiter.limit("60/minute")
def verifier(request: Request, req: EmailRequest):
    user_id = _get_user_id(request)
    _check_and_consume(user_id, 1)
    return verifier_email(req.email)


@app.post("/api/verifier/bulk")
@limiter.limit("10/minute")
def verifier_bulk(request: Request, req: BulkEmailRequest):
    if len(req.emails) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 e-mails par requête.")
    user_id = _get_user_id(request)
    # Compte les emails réels reçus (anti-arnaque)
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
        raise HTTPException(status_code=422, detail="Paramètres insuffisants.")

    format_dominant = deduire_format_dominant(req.emails_connus) if req.emails_connus else None
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
        resultats_par_email.get(email, {'email': email, 'statut': 'Non testé', 'confiance': 0, 'methode': '-', 'detail': ''})
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
        raise HTTPException(status_code=400, detail="Maximum 200 contacts par requête.")

    user_id = _get_user_id(request)
    # SÉCURITÉ ANTI-ARNAQUE : on compte les contacts valides côté backend
    nb_valides = count_valid_contacts(req.contacts)
    if nb_valides == 0:
        raise HTTPException(status_code=422, detail="Aucun contact valide dans la liste.")
    _check_and_consume(user_id, nb_valides)

    def traiter_contact(contact):
        patterns_bruts = generer_patterns(contact.prenom, contact.nom, contact.domaine)
        if not patterns_bruts:
            return {"prenom": contact.prenom, "nom": contact.nom, "domaine": contact.domaine, "email": "Données insuffisantes", "statut": "Erreur", "fiable": False}
        format_dominant = deduire_format_dominant(contact.emails_connus) if contact.emails_connus else None
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
            "email": gagnant['email'] if gagnant else "Non trouvé",
            "statut": gagnant['statut'] if gagnant else "Échec",
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


# ── Routes Crédits ────────────────────────────────────────────────────────────

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
    return {"status": "ok", "service": "ROVIAL Recherche API v3.0"}
