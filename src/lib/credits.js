/**
 * credits.js — Hook et utilitaires crédits côté frontend
 * Le solde est maintenu en mémoire + synchronisé avec l'API.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { api } from './api'

const CreditsContext = createContext(null)

export function CreditsProvider({ children }) {
    const [solde, setSolde]       = useState(null)   // null = pas encore chargé
    const [loading, setLoading]   = useState(true)
    const [flash, setFlash]       = useState(false)  // animation quand ça descend

    const refresh = useCallback(async () => {
        try {
            const data = await api.getCredits()
            setSolde(prev => {
                if (prev !== null && data.solde < prev) setFlash(true)
                return data.solde
            })
        } catch (_) {
            // silencieux si pas auth
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
        // Rafraîchit toutes les 30 secondes pour rester synchro
        const id = setInterval(refresh, 30_000)
        return () => clearInterval(id)
    }, [refresh])

    useEffect(() => {
        if (!flash) return
        const t = setTimeout(() => setFlash(false), 1000)
        return () => clearTimeout(t)
    }, [flash])

    return (
        <CreditsContext.Provider value={{ solde, loading, flash, refresh }}>
            {children}
        </CreditsContext.Provider>
    )
}

export function useCredits() {
    const ctx = useContext(CreditsContext)
    if (!ctx) throw new Error('useCredits must be used inside CreditsProvider')
    return ctx
}
