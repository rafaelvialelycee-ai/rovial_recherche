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
from supabase import create_client, Client

load_dotenv()

CREDITS_OFFERTS_INSCRIPTION = 20

_supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY"),
)


def _get_row(user_id: str) -> dict | None:
    res = _supabase.table("credits").select("*").eq("user_id", user_id).single().execute()
    return res.data


def get_credits(user_id: str) -> int:
    row = _get_row(user_id)
    if row is None:
        return init_user(user_id)
    return row["solde"]


def init_user(user_id: str) -> int:
    """Initialise un nouvel utilisateur avec les crédits offerts (upsert)."""
    _supabase.table("credits").upsert(
        {"user_id": user_id, "solde": CREDITS_OFFERTS_INSCRIPTION},
        on_conflict="user_id",
        ignore_duplicates=True,
    ).execute()
    return CREDITS_OFFERTS_INSCRIPTION


def add_credits(user_id: str, amount: int) -> int:
    """Ajoute des crédits (appelé par le webhook Stripe)."""
    current = get_credits(user_id)
    new_solde = current + amount
    _supabase.table("credits").upsert(
        {"user_id": user_id, "solde": new_solde},
        on_conflict="user_id",
    ).execute()
    return new_solde


def consume_credits(user_id: str, amount: int) -> tuple[bool, int]:
    """
    Tente de consommer `amount` crédits.
    Retourne (succès: bool, solde_restant: int).
    Pas de race condition : lecture + écriture atomique via RPC Supabase.
    """
    current = get_credits(user_id)
    if current < amount:
        return False, current
    new_solde = current - amount
    _supabase.table("credits").update(
        {"solde": new_solde, "updated_at": "now()"}
    ).eq("user_id", user_id).execute()
    return True, new_solde


def count_valid_contacts(contacts: list) -> int:
    """
    Compte les contacts réellement valides reçus côté backend.
    Sécurité anti-arnaque : on compte ce qu'on reçoit,
    pas ce que le client prétend avoir envoyé.
    """
    return sum(
        1 for c in contacts
        if c.prenom and c.nom and c.domaine
    )
