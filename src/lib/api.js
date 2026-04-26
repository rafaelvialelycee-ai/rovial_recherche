// Point d'entrée unique pour les appels API.
// Configurer VITE_API_URL dans .env (dev) ou dans les variables d'env de déploiement.
// Exemple .env : VITE_API_URL=https://api.rovial.fr

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        let message = `Erreur ${res.status}`
        try {
            const data = await res.json()
            message = data?.detail || message
        } catch {}
        throw new Error(message)
    }

    return res.json()
}

export const api = {
    verifier:      (email)         => request('/api/verifier',        { email }),
    verifierBulk:  (emails)        => request('/api/verifier/bulk',   { emails }),
    chercher:      (prenom, nom, domaine) => request('/api/chercher', { prenom, nom, domaine }),
    chercherBulk:  (contacts)      => request('/api/chercher/bulk',   { contacts }),
    health:        ()              => fetch(`${BASE_URL}/api/health`).then(r => r.json()),
}
