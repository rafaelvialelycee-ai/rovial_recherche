#!/bin/bash
# =============================================================================
# ROVIAL Recherche — Démarrage local en 1 commande
# Usage : bash start.sh
# =============================================================================

set -e

echo ""
echo "🚀  ROVIAL Recherche — Démarrage..."
echo ""

# ─── Backend ───────────────────────────────────
echo "⚙️  Installation des dépendances Python..."
cd backend

# Vérifier si un venv existe déjà
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

echo "✅  Backend prêt — démarrage sur http://localhost:8000"
export $(cat .env | xargs) 2>/dev/null || true
uvicorn app:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd ..

# ─── Frontend ──────────────────────────────────
echo "📦  Installation des dépendances Node..."
npm install --silent

echo "✅  Frontend prêt — démarrage sur http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

# ─── Nettoyage à l'arrêt (Ctrl+C) ────────────────────────
trap "echo ''; echo '🛑  Arrêt...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" SIGINT SIGTERM

echo ""
echo "✨  Tout est lancé :"
echo "   Frontend → http://localhost:5173"
echo "   Backend  → http://localhost:8000"
echo "   API docs → http://localhost:8000/docs"
echo ""
echo "   Ctrl+C pour tout arrêter"
echo ""

wait
