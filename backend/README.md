# ROVIAL Recherche — Backend

API FastAPI exposant les deux moteurs Python.

## Lancement

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
```

L'API sera disponible sur `http://localhost:8000`.

Documentation auto-générée : `http://localhost:8000/docs`

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/verifier` | Vérifie un e-mail unique |
| POST | `/api/verifier/bulk` | Vérifie jusqu'à 500 e-mails |
| POST | `/api/chercher` | Déduit l'e-mail d'un contact |
| POST | `/api/chercher/bulk` | Enrichit jusqu'à 200 contacts |
| GET | `/api/health` | Statut de l'API |
