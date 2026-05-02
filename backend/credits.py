"""
credits.py — Gestionnaire de crédits ROVIAL
In-memory pour dev/staging. Supabase-ready : remplacer le dict _store
par des appels Supabase quand auth branché.

Règles de consommation :
  - 1 vérification unitaire  = 1 crédit
  - 1 contact bulk           = 1 crédit (compté sur les lignes VALIDES du CSV côté backend)
  - Inscription              = 20 crédits offerts
"""

from threading import Lock
from typing import Optional

CREDITS_OFFERTS_INSCRIPTION = 20

# Structure : { user_id: int }
_store: dict[str, int] = {}
_lock = Lock()


def get_credits(user_id: str) -> int:
    with _lock:
        return _store.get(user_id, 0)


def init_user(user_id: str) -> int:
    """Initialise un nouvel utilisateur avec les crédits offerts."""
    with _lock:
        if user_id not in _store:
            _store[user_id] = CREDITS_OFFERTS_INSCRIPTION
        return _store[user_id]


def add_credits(user_id: str, amount: int) -> int:
    """Ajoute des crédits (appelé par le webhook Stripe)."""
    with _lock:
        _store[user_id] = _store.get(user_id, 0) + amount
        return _store[user_id]


def consume_credits(user_id: str, amount: int) -> tuple[bool, int]:
    """
    Tente de consommer `amount` crédits.
    Retourne (succès: bool, solde_restant: int).
    """
    with _lock:
        current = _store.get(user_id, 0)
        if current < amount:
            return False, current
        _store[user_id] = current - amount
        return True, _store[user_id]


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
