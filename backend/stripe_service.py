"""
stripe_service.py — Stripe ROVIAL

Pour activer :
  1. pip install stripe
  2. Renseigner STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET dans .env
  3. Les Price IDs doivent être renseignés dans PLANS via les variables d'env
"""

import os
import stripe
from typing import Optional

STRIPE_SECRET_KEY     = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Formules : { plan_id: { credits, price_eur, stripe_price_id } }
PLANS = {
    "starter": {
        "label":           "Starter",
        "credits":         100,
        "price_eur":       9,
        "stripe_price_id": os.getenv("STRIPE_PRICE_STARTER", ""),
        "popular":         False,
    },
    "growth": {
        "label":           "Growth",
        "credits":         500,
        "price_eur":       29,
        "stripe_price_id": os.getenv("STRIPE_PRICE_GROWTH", ""),
        "popular":         True,
    },
    "scale": {
        "label":           "Scale",
        "credits":         2000,
        "price_eur":       79,
        "stripe_price_id": os.getenv("STRIPE_PRICE_SCALE", ""),
        "popular":         False,
    },
    "enterprise": {
        "label":           "Enterprise",
        "credits":         10000,
        "price_eur":       299,
        "stripe_price_id": os.getenv("STRIPE_PRICE_ENTERPRISE", ""),
        "popular":         False,
    },
}


def create_checkout_session(plan_id: str, user_id: str, success_url: str, cancel_url: str) -> dict:
    """
    Crée une session Stripe Checkout.
    Si STRIPE_SECRET_KEY est absent (dev local), retourne un stub.
    """
    plan = PLANS.get(plan_id)
    if not plan:
        raise ValueError(f"Plan inconnu : {plan_id}")

    # --- STUB dev (aucune clé configurée) ---
    if not STRIPE_SECRET_KEY:
        import hashlib
        fake_session_id = hashlib.md5(f"{user_id}{plan_id}".encode()).hexdigest()
        return {
            "session_id": fake_session_id,
            "url": f"{success_url}?session_id={fake_session_id}&plan={plan_id}&stub=true",
            "stub": True,
        }

    # --- STRIPE RÉEL ---
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": plan["stripe_price_id"], "quantity": 1}],
        mode="payment",
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        metadata={
            "user_id": user_id,
            "plan_id": plan_id,
            "credits": str(plan["credits"]),
        },
    )
    return {"session_id": session.id, "url": session.url, "stub": False}


def handle_webhook(payload: bytes, sig_header: str) -> Optional[dict]:
    """
    Vérifie la signature du webhook Stripe et retourne l'événement.
    Retourne None si la signature est invalide.
    Si STRIPE_WEBHOOK_SECRET est absent (dev local), accepte tout.
    """
    if not STRIPE_WEBHOOK_SECRET:
        # Dev stub — ne jamais laisser en prod
        import json
        try:
            return json.loads(payload)
        except Exception:
            return None

    # --- STRIPE RÉEL ---
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        return event
    except stripe.errors.SignatureVerificationError:
        return None
