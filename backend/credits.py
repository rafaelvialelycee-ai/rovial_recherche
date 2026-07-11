"""
credits.py — Gestionnaire de crédits ROVIAL
Persistance Supabase : table `credits` (user_id, solde, updated_at)

Règles de consommation :
  - 1 vérification unitaire  = 1 crédit
  - 1 contact bulk           = 1 crédit (compté sur les lignes VALIDES du CSV)
  - Inscription              = 20 crédits offerts
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions

load_dotenv()

CREDITS_OFFERTS_INSCRIPTION = 20

_supabase_client: Client | None = None

def _get_client() -> Client | None:
    """Lazy init : instancie le client Supabase au premier appel. Retourne None si les vars manquent."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    _supabase_client = create_client(url, key, options=ClientOptions(postgrest_client_timeout=10))
    return _supabase_client


def _get_row(user_id: str) -> dict | None:
    sb = _get_client()
    if sb is None:
        return None
    try:
        res = sb.table("credits").select("*").eq("user_id", user_id).single().execute()
        return res.data
    except Exception:
        return None


def get_credits(user_id: str) -> int:
    row = _get_row(user_id)
    if row is None:
        return init_user(user_id)
    return row["solde"]


def init_user(user_id: str) -> int:
    """Initialise un nouvel utilisateur avec les crédits offerts (upsert)."""
    sb = _get_client()
    if sb is None:
        return CREDITS_OFFERTS_INSCRIPTION
    try:
        sb.table("credits").upsert(
            {"user_id": user_id, "solde": CREDITS_OFFERTS_INSCRIPTION},
            on_conflict="user_id",
            ignore_duplicates=True,
        ).execute()
    except Exception:
        pass
    return CREDITS_OFFERTS_INSCRIPTION


def add_credits(user_id: str, amount: int) -> int:
    """Ajoute des crédits (appelé par le webhook Stripe)."""
    current = get_credits(user_id)
    new_solde = current + amount
    sb = _get_client()
    if sb is None:
        return new_solde
    try:
        sb.table("credits").upsert(
            {"user_id": user_id, "solde": new_solde},
            on_conflict="user_id",
        ).execute()
    except Exception:
        pass
    return new_solde


def consume_credits(user_id: str, amount: int) -> tuple[bool, int]:
    """
    Tente de consommer `amount` crédits.
    Retourne (succès: bool, solde_restant: int).
    """
    current = get_credits(user_id)
    if current < amount:
        return False, current
    new_solde = current - amount
    sb = _get_client()
    if sb is None:
        return True, new_solde
    try:
        sb.table("credits").update(
            {"solde": new_solde, "updated_at": "now()"}
        ).eq("user_id", user_id).execute()
    except Exception:
        pass
    return True, new_solde


def count_valid_contacts(contacts: list) -> int:
    """
    Compte les contacts réellement valides reçus côté backend.
    Sécurité anti-arnaque : on compte ce qu’on reçoit,
    pas ce que le client prétend avoir envoyé.
    """
    return sum(
        1 for c in contacts
        if c.prenom and c.nom and c.domaine
    )
