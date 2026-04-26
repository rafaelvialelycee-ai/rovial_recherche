# ROVIAL Recherche

> Plateforme d'enrichissement & de vérification d'e-mails B2B — by [ROVIAL](https://rovial.fr)

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4 + Framer Motion |
| Backend | FastAPI + Python 3.11 |
| Moteurs | DNS / SMTP / API Microsoft / Sniper latence |

## Structure

```
rovial_recherche/
├── src/                    # Frontend React
│   ├── pages/
│   │   ├── Home.jsx         # Landing page des modules
│   │   ├── Verificateur.jsx # Module 01 — Vérificateur
│   │   └── Chercheur.jsx    # Module 02 — Chercheur
│   └── components/
│       ├── Navbar.jsx
│       └── Footer.jsx
└── backend/                # API Python
    ├── app.py               # FastAPI — routes REST
    ├── moteur_verif.py      # Moteur de vérification en cascade
    ├── moteur_chercheur.py  # Moteur de déduction de patterns
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

## Notes

- Le frontend React simule les appels API en local (mode démo).
- En production, connecter le frontend aux endpoints `/api/*` du backend FastAPI.
- Usage B2B responsable uniquement. Respecter le RGPD.

---

*© 2026 ROVIAL — [rovial.fr](https://rovial.fr)*
