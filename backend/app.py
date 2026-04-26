# =============================================================================
# ROVIAL Recherche — API backend FastAPI
# Exposer les moteurs de vérification et de recherche via une API REST.
# Ce fichier remplace l'ancienne interface Streamlit par une architecture
# découplée : le frontend React consomme cette API via fetch().
# =============================================================================

import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from moteur_verif import verifier_email
from moteur_chercheur import generer_patterns, deduire_format_dominant

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ROVIAL Recherche API",
    description="API d'enrichissement et de vérification B2B",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# En production, restreindre aux domaines autorisés via la variable d'env ALLOWED_ORIGINS
# Exemple : ALLOWED_ORIGINS="https://rovial.fr,https://app.rovial.fr"
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if _raw_origins:
    allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
else:
    # Fallback développement uniquement
    allowed_origins = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ─── Schémas ─────────────────────────────────────────────────────────────────

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


# ─── Routes Vérificateur ─────────────────────────────────────────────────────

@app.post("/api/verifier", summary="Vérifie un e-mail unique")
@limiter.limit("30/minute")
def verifier(request: Request, req: EmailRequest):
    """
    Vérifie l'existence réseau d'une adresse e-mail.
    Retourne un objet avec statut, confiance (0-100), méthode et détail.
    """
    return verifier_email(req.email)


@app.post("/api/verifier/bulk", summary="Vérifie une liste d'e-mails")
@limiter.limit("10/minute")
def verifier_bulk(request: Request, req: BulkEmailRequest):
    """Vérifie une liste d'e-mails en cascade."""
    if len(req.emails) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 e-mails par requête.")
    resultats = [verifier_email(email) for email in req.emails]
    return {"resultats": resultats, "total": len(resultats)}


# ─── Routes Chercheur ────────────────────────────────────────────────────────

@app.post("/api/chercher", summary="Déduit l'e-mail d'un contact")
@limiter.limit("20/minute")
def chercher(request: Request, req: ChercheurRequest):
    """
    Génère les patterns probables et tente de valider le premier.
    Seul le statut 'Valide' est retourné comme résultat fiable.
    'Incertain' est signalé séparément pour ne pas induire en erreur.
    """
    patterns = generer_patterns(req.prenom, req.nom, req.domaine)
    if not patterns:
        raise HTTPException(status_code=422, detail="Paramètres insuffisants.")

    trouve_valide = None
    meilleur_incertain = None

    for email in patterns:
        resultat = verifier_email(email)
        if resultat['statut'] == 'Valide':
            trouve_valide = resultat
            break
        elif resultat['statut'] == 'Incertain' and meilleur_incertain is None:
            meilleur_incertain = resultat

    return {
        "patterns": patterns,
        "total_patterns": len(patterns),
        "trouve": trouve_valide,
        "incertain": meilleur_incertain,
        "fiable": trouve_valide is not None,
    }


@app.post("/api/chercher/bulk", summary="Enrichit une liste de contacts")
@limiter.limit("5/minute")
def chercher_bulk(request: Request, req: BulkChercheurRequest):
    """Enrichit une liste de contacts avec leur e-mail déduit."""
    if len(req.contacts) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 contacts par requête.")

    resultats = []
    for contact in req.contacts:
        patterns = generer_patterns(contact.prenom, contact.nom, contact.domaine)
        email_gagnant = None
        statut_final = "Échec"
        fiable = False

        for email in patterns:
            r = verifier_email(email)
            if r['statut'] == 'Valide':
                email_gagnant = r['email']
                statut_final = f"Valide ({r['confiance']}% | {r['methode']})"
                fiable = True
                break
            elif r['statut'] == 'Incertain' and email_gagnant is None:
                # Garder comme fallback mais marquer non-fiable
                email_gagnant = r['email']
                statut_final = f"Incertain ({r['confiance']}% | {r['methode']})"
                fiable = False

        resultats.append({
            "prenom":  contact.prenom,
            "nom":     contact.nom,
            "domaine": contact.domaine,
            "email":   email_gagnant or "Non trouvé",
            "statut":  statut_final,
            "fiable":  fiable,
        })

    return {"resultats": resultats, "total": len(resultats)}


# ─── Health check ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ROVIAL Recherche API v1.0"}
