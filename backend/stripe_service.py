"""
stripe_service.py — Pre-branchement Stripe ROVIAL

Pour activer :
  1. pip install stripe
  2. Renseigner STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET dans .env
  3. Créer les Price IDs dans le dashboard Stripe et les mettre dans PLANS
  4. Décommenter les vrais appels stripe.* (ils sont stubés pour l'instant)
"""

import os
import hashlib
from typing import Optional

STRIPE_SECRET_KEY    = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Formules : { plan_id: { credits, price_eur, stripe_price_id } }
PLANS = {
    "starter": {
        "label":          "Starter",
        "credits":        100,
        "price_eur":      9,
        "stripe_price_id": os.getenv("STRIPE_PRICE_STARTER", ""),
        "popular":        False,
    },
    "growth": {
        "label":          "Growth",
        "credits":        500,
        "price_eur":      29,
        "stripe_price_id": os.getenv("STRIPE_PRICE_GROWTH", ""),
        "popular":        True,
    },
    "scale": {
        "label":          "Scale",
        "credits":        2000,
        "price_eur":      79,
        "stripe_price_id": os.getenv("STRIPE_PRICE_SCALE", ""),
        "popular":        False,
    },
    "enterprise": {
        "label":          "Enterprise",
        "credits":        10000,
        "price_eur":      299,
        "stripe_price_id": os.getenv("STRIPE_PRICE_ENTERPRISE", ""),
        "popular":        False,
    },
}


def create_checkout_session(plan_id: str, user_id: str, success_url: str, cancel_url: str) -> dict:
    """
    Crée une session Stripe Checkout.
    STUB : retourne une fausse session tant que STRIPE_SECRET_KEY n'est pas branché.
    Décommenter le bloc stripe.* pour activer.
    """
    plan = PLANS.get(plan_id)
    if not plan:
        raise ValueError(f"Plan inconnu : {plan_id}")

    # --- STUB (remplacer par le bloc commenté ci-dessous quand Stripe est branché) ---
    if not STRIPE_SECRET_KEY:
        fake_session_id = hashlib.md5(f"{user_id}{plan_id}".encode()).hexdigest()
        return {
            "session_id": fake_session_id,
            "url": f"{success_url}?session_id={fake_session_id}&plan={plan_id}&stub=true",
            "stub": True,
        }

    # --- STRIPE RÉEL (décommenter quand STRIPE_SECRET_KEY est renseigné) ---
    # import stripe
    # stripe.api_key = STRIPE_SECRET_KEY
    # session = stripe.checkout.Session.create(
    #     payment_method_types=["card"],
    #     line_items=[{"price": plan["stripe_price_id"], "quantity": 1}],
    #     mode="payment",
    #     success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
    #     cancel_url=cancel_url,
    #     metadata={"user_id": user_id, "plan_id": plan_id, "credits": plan["credits"]},
    # )
    # return {"session_id": session.id, "url": session.url, "stub": False}
    return {"error": "Stripe non configuré"}


def handle_webhook(payload: bytes, sig_header: str) -> Optional[dict]:
    """
    Vérifie la signature du webhook Stripe et extrait l'événement.
    Retourne None si la signature est invalide.
    STUB : si STRIPE_WEBHOOK_SECRET vide, accepte tout (dev only).
    """
    if not STRIPE_WEBHOOK_SECRET:
        # Dev stub — ne jamais laisser en prod
        import json
        try:
            return json.loads(payload)
        except Exception:
            return None

    # --- STRIPE RÉEL ---
    # import stripe
    # try:
    #     event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    #     return event
    # except stripe.error.SignatureVerificationError:
    #     return None
    return None
