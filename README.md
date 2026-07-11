# ROVIAL Recherche

> Plateforme d'enrichissement & de vérification d'e-mails B2B — by [ROVIAL](https://rovial.fr)

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4 + Framer Motion |
| Backend | FastAPI + Python 3.11 + Supabase |
| Paiements | Stripe Checkout |
| Moteurs | DNS / SMTP / API Microsoft / Sniper latence |

## Structure

```
rovial_recherche/
├── src/                    # Frontend React
│   ├── pages/
│   │   ├── Home.jsx         # Landing page des modules
│   │   ├── Verificateur.jsx # Module 01 — Vérificateur
│   │   ├── Chercheur.jsx    # Module 02 — Chercheur
│   │   └── Tarifs.jsx       # Module 03 — Tarifs & crédits
│   └── components/
│       ├── Navbar.jsx
│       ├── Footer.jsx
│       └── CreditsModal.jsx
└── backend/                # API Python
    ├── app.py               # FastAPI — routes REST
    ├── moteur_verif.py      # Moteur de vérification en cascade
    ├── moteur_chercheur.py  # Moteur de déduction de patterns
    ├── credits.py           # Gestion crédits via Supabase
    ├── stripe_service.py    # Intégration Stripe Checkout
    └── requirements.txt
```

## Démarrage

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
```

## Variables d'environnement

Copier `.env.example` en `.env` et renseigner :

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_SCALE=
STRIPE_PRICE_ENTERPRISE=
ALLOWED_ORIGINS=
FRONTEND_URL=
VITE_API_URL=
```

## Notes

- Usage B2B responsable uniquement. Respecter le RGPD.

---

*© 2026 ROVIAL — [rovial.fr](https://rovial.fr)*
