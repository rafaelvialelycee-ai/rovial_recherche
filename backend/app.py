# =============================================================================
# ROVIAL Recherche — API backend FastAPI
# Exposer les moteurs de vérification et de recherche via une API REST.
# Ce fichier remplace l'ancienne interface Streamlit par une architecture
# découplée : le frontend React consomme cette API via fetch().
# =============================================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
import pandas as pd
import io

from moteur_verif import verifier_email
from moteur_chercheur import generer_patterns, deduire_format_dominant

app = FastAPI(
    title="ROVIAL Recherche API",
    description="API d'enrichissement et de vérification B2B",
    version="1.0.0",
)

# CORS — à restreindre en production à votre domaine Vercel / Netlify
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
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
def verifier(req: EmailRequest):
    """
    Vérifie l'existence réseau d'une adresse e-mail.
    Retourne un objet avec statut, confiance (0-100), méthode et détail.
    """
    return verifier_email(req.email)


@app.post("/api/verifier/bulk", summary="Vérifie une liste d'e-mails")
def verifier_bulk(req: BulkEmailRequest):
    """Vérifie une liste d'e-mails en cascade."""
    if len(req.emails) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 e-mails par requête.")
    resultats = [verifier_email(email) for email in req.emails]
    return {"resultats": resultats, "total": len(resultats)}


# ─── Routes Chercheur ────────────────────────────────────────────────────────

@app.post("/api/chercher", summary="Déduit l'e-mail d'un contact")
def chercher(req: ChercheurRequest):
    """
    Génère les patterns probables et tente de valider le premier.
    Retourne la liste des patterns et le meilleur candidat trouvé.
    """
    patterns = generer_patterns(req.prenom, req.nom, req.domaine)
    if not patterns:
        raise HTTPException(status_code=422, detail="Paramètres insuffisants.")

    trouve = None
    for email in patterns:
        resultat = verifier_email(email)
        if resultat['statut'] in ('Valide', 'Incertain'):
            trouve = resultat
            break

    return {
        "patterns": patterns,
        "trouve": trouve,
        "total_patterns": len(patterns),
    }


@app.post("/api/chercher/bulk", summary="Enrichit une liste de contacts")
def chercher_bulk(req: BulkChercheurRequest):
    """Enrichit une liste de contacts avec leur e-mail déduit."""
    if len(req.contacts) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 contacts par requête.")

    resultats = []
    for contact in req.contacts:
        patterns = generer_patterns(contact.prenom, contact.nom, contact.domaine)
        email_gagnant = None
        statut_final = "Échec"

        for email in patterns:
            r = verifier_email(email)
            if r['statut'] in ('Valide', 'Incertain'):
                email_gagnant = r['email']
                statut_final  = f"{r['statut']} ({r['confiance']}% | {r['methode']})"
                break

        resultats.append({
            "prenom":  contact.prenom,
            "nom":     contact.nom,
            "domaine": contact.domaine,
            "email":   email_gagnant or "Non trouvé",
            "statut":  statut_final,
        })

    return {"resultats": resultats, "total": len(resultats)}


# ─── Health check ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ROVIAL Recherche API v1.0"}
