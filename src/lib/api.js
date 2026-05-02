const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Identifiant utilisateur temporaire (remplacer par JWT Supabase en prod)
function getUserId() {
    let uid = sessionStorage.getItem('rovial_uid')
    if (!uid) {
        uid = 'dev_' + Math.random().toString(36).slice(2, 10)
        sessionStorage.setItem('rovial_uid', uid)
    }
    return uid
}

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': getUserId(),
            ...options.headers,
        },
        ...options,
    })

    if (res.status === 402) {
        const data = await res.json()
        // Dispatcher un event global pour que le modal crédits s'ouvre
        window.dispatchEvent(new CustomEvent('rovial:credits_insuffisants', { detail: data.detail }))
        throw new Error('credits_insuffisants')
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Erreur ${res.status}`)
    }

    return res.json()
}

export const api = {
    verifier:      (email)            => request('/api/verifier',        { method: 'POST', body: JSON.stringify({ email }) }),
    verifierBulk:  (emails)           => request('/api/verifier/bulk',   { method: 'POST', body: JSON.stringify({ emails }) }),
    chercher:      (prenom, nom, domaine, emails_connus = null) =>
        request('/api/chercher', { method: 'POST', body: JSON.stringify({ prenom, nom, domaine, emails_connus }) }),
    chercherBulk:  (contacts)         => request('/api/chercher/bulk',   { method: 'POST', body: JSON.stringify({ contacts }) }),
    getCredits:    ()                  => request('/api/credits'),
    getPlans:      ()                  => request('/api/plans'),
    checkout:      (plan_id)           => request('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan_id }) }),
}
