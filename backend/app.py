import os
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from moteur_verif import verifier_email
from moteur_chercheur import generer_patterns

# ThreadPool partage pour la parallelisation
_executor = ThreadPoolExecutor(max_workers=20)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ROVIAL Recherche API",
    description="API d'enrichissement et de verification B2B",
    version="2.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if _raw_origins:
    allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
else:
    allowed_origins = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# Schemas
class EmailRequest(BaseModel):
    email: str

class BulkEmailRequest(BaseModel):
    emails: list[str]

class ChercheurRequest(BaseModel):
    prenom: str
    nom: str
    domaine: str

class BulkChercheurRequest(BaseModel):
    contacts: list[ChercheurRequest]


# Routes Verificateur
@app.post("/api/verifier")
@limiter.limit("60/minute")
def verifier(request: Request, req: EmailRequest):
    return verifier_email(req.email)


@app.post("/api/verifier/bulk")
@limiter.limit("10/minute")
def verifier_bulk(request: Request, req: BulkEmailRequest):
    if len(req.emails) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 e-mails par requete.")

    resultats = [None] * len(req.emails)
    futures = {
        _executor.submit(verifier_email, email): i
        for i, email in enumerate(req.emails)
    }
    for future in as_completed(futures):
        idx = futures[future]
        try:
            resultats[idx] = future.result()
        except Exception as e:
            resultats[idx] = {'email': req.emails[idx], 'statut': 'Erreur', 'confiance': 0, 'methode': 'Exception', 'detail': str(e)}

    return {"resultats": resultats, "total": len(resultats)}


# Routes Chercheur
@app.post("/api/chercher")
@limiter.limit("30/minute")
def chercher(request: Request, req: ChercheurRequest):
    patterns = generer_patterns(req.prenom, req.nom, req.domaine)
    if not patterns:
        raise HTTPException(status_code=422, detail="Parametres insuffisants.")

    # FIX #1 — Paralleliser les 7 patterns et conserver TOUS les resultats detailles
    resultats_par_email: dict = {}
    futures = {
        _executor.submit(verifier_email, email): email
        for email in patterns
    }
    for future in as_completed(futures):
        email = futures[future]
        try:
            resultats_par_email[email] = future.result()
        except Exception as e:
            resultats_par_email[email] = {'email': email, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Exception', 'detail': str(e)}

    # Choisir le meilleur resultat en respectant l'ordre des patterns
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

    # FIX #1 — Retourner le detail complet de chaque pattern dans l'ordre
    resultats_detail = [
        resultats_par_email.get(email, {'email': email, 'statut': 'Non teste', 'confiance': 0, 'methode': '-', 'detail': ''})
        for email in patterns
    ]

    return {
        "patterns": patterns,
        "total_patterns": len(patterns),
        "resultats_detail": resultats_detail,
        "trouve": trouve_valide,
        "incertain": meilleur_incertain,
        "fiable": trouve_valide is not None,
    }


@app.post("/api/chercher/bulk")
@limiter.limit("5/minute")
def chercher_bulk(request: Request, req: BulkChercheurRequest):
    if len(req.contacts) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 contacts par requete.")

    def traiter_contact(contact):
        patterns = generer_patterns(contact.prenom, contact.nom, contact.domaine)
        if not patterns:
            return {"prenom": contact.prenom, "nom": contact.nom, "domaine": contact.domaine, "email": "Donnees insuffisantes", "statut": "Erreur", "fiable": False}

        resultats_par_email: dict = {}
        futures = {_executor.submit(verifier_email, e): e for e in patterns}
        for future in as_completed(futures):
            email = futures[future]
            try:
                resultats_par_email[email] = future.result()
            except Exception:
                resultats_par_email[email] = {'email': email, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Exception', 'detail': ''}

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
            "prenom": contact.prenom,
            "nom": contact.nom,
            "domaine": contact.domaine,
            "email": gagnant['email'] if gagnant else "Non trouve",
            "statut": gagnant['statut'] if gagnant else "Echec",
            "fiable": trouve_valide is not None,
        }

    resultats = [None] * len(req.contacts)
    contact_futures = {
        _executor.submit(traiter_contact, contact): i
        for i, contact in enumerate(req.contacts)
    }
    for future in as_completed(contact_futures):
        idx = contact_futures[future]
        try:
            resultats[idx] = future.result()
        except Exception as e:
            c = req.contacts[idx]
            resultats[idx] = {"prenom": c.prenom, "nom": c.nom, "domaine": c.domaine, "email": "Erreur", "statut": "Erreur", "fiable": False}

    return {"resultats": resultats, "total": len(resultats)}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ROVIAL Recherche API v2.1"}
