import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springAnim } from '../lib/animations'
import { CheckCircle, Zap, TrendingUp, Rocket, Building2, Loader2, AlertCircle, Gift } from 'lucide-react'
import { api } from '../lib/api'
import { useCredits } from '../lib/credits'
import { useSearchParams } from 'react-router-dom'

const ICONS = {
    starter:    Zap,
    growth:     TrendingUp,
    scale:      Rocket,
    enterprise: Building2,
}

const FEATURES = {
    starter:    ['100 recherches ou vérifs', 'Recherche unitaire', 'Import CSV', 'Export résultats'],
    growth:     ['500 crédits', 'Tout Starter', 'Détection format dominant', 'Support email'],
    scale:      ['2 000 crédits', 'Tout Growth', 'Bulk jusqu\'à 200 contacts', 'Accès API direct'],
    enterprise: ['10 000 crédits', 'Tout Scale', 'Priorité de traitement', 'Support dédié'],
}

export default function Tarifs() {
    const [plans, setPlans]       = useState(null)
    const [loading, setLoading]   = useState(true)
    const [purchasing, setPurchasing] = useState(null)
    const [error, setError]       = useState(null)
    const { solde, refresh }      = useCredits()
    const [searchParams]          = useSearchParams()

    const success   = searchParams.get('success') === 'true'
    const cancelled = searchParams.get('cancelled') === 'true'

    useEffect(() => {
        api.getPlans()
            .then(d => setPlans(d.plans))
            .catch(() => setError('Impossible de charger les formules.'))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (success) refresh()
    }, [success, refresh])

    async function handleBuy(planId) {
        setPurchasing(planId)
        setError(null)
        try {
            const session = await api.checkout(planId)
            if (session.stub) {
                // Mode dev : simuler l'achat
                alert(`[DEV STUB] Paiement simulé pour le plan "${planId}".\nEn prod, tu serais redirigé vers Stripe.\nURL générée : ${session.url}`)
                refresh()
            } else if (session.url) {
                window.location.href = session.url
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setPurchasing(null)
        }
    }

    return (
        <div className="min-h-screen relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none z-0">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/4 dark:bg-indigo-500/8 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={springAnim} className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 border border-blue-500/20 bg-blue-500/5 rounded-full px-5 py-2 text-[10px] font-bold text-blue-600 dark:text-indigo-400 mb-6 tracking-[0.25em] uppercase">
                        <Gift size={11} /> 20 crédits offerts à l'inscription
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 mb-4">
                        Rechargez vos <span className="bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 bg-clip-text text-transparent">crédits</span>
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-xl mx-auto">
                        1 crédit = 1 vérification ou 1 contact enrichi. Pas d'abonnement, pas de surprise.
                    </p>
                    {solde !== null && (
                        <div className="mt-6 inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-full px-5 py-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                            Votre solde : <span className="text-blue-600 dark:text-indigo-400">{solde} crédits</span>
                        </div>
                    )}
                </motion.div>

                {/* Banners */}
                <AnimatePresence>
                    {success && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mb-8 flex items-center gap-3 px-6 py-4 rounded-2xl bg-emerald-500/5 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 font-semibold"
                        >
                            <CheckCircle size={18} /> Paiement confirmé — vos crédits ont été ajoutés !
                        </motion.div>
                    )}
                    {cancelled && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mb-8 flex items-center gap-3 px-6 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 font-semibold"
                        >
                            <AlertCircle size={18} /> Paiement annulé. Vos crédits n'ont pas été débités.
                        </motion.div>
                    )}
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mb-8 flex items-center gap-3 px-6 py-4 rounded-2xl bg-red-500/5 border border-red-200 dark:border-red-800 text-red-500 font-semibold"
                        >
                            <AlertCircle size={18} /> {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Plans grid */}
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-zinc-400" /></div>
                ) : plans ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Object.entries(plans).map(([id, plan], i) => {
                            const Icon = ICONS[id] || Zap
                            const features = FEATURES[id] || []
                            const isBuying = purchasing === id
                            return (
                                <motion.div key={id}
                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ ...springAnim, delay: i * 0.07 }}
                                    className={`relative flex flex-col rounded-[2rem] border p-7 transition-all ${
                                        plan.popular
                                            ? 'border-blue-400/60 dark:border-indigo-500/60 bg-gradient-to-b from-blue-500/5 to-indigo-500/5 dark:from-indigo-500/10 dark:to-blue-500/5 shadow-lg shadow-blue-500/10'
                                            : 'border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40'
                                    } backdrop-blur-xl`}
                                >
                                    {plan.popular && (
                                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                                            Populaire
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                                            plan.popular ? 'bg-blue-500/10 text-blue-600 dark:text-indigo-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                        }`}>
                                            <Icon size={18} />
                                        </div>
                                        <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 mb-1">{plan.label}</h3>
                                        <div className="flex items-end gap-1">
                                            <span className="text-4xl font-black text-zinc-900 dark:text-zinc-50">{plan.price_eur}€</span>
                                            <span className="text-zinc-400 text-sm mb-1">one-shot</span>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-1 font-medium">
                                            {plan.credits.toLocaleString('fr-FR')} crédits · {(plan.price_eur / plan.credits * 100).toFixed(1)}c€/crédit
                                        </p>
                                    </div>

                                    <ul className="space-y-2.5 flex-grow mb-8">
                                        {features.map((f, j) => (
                                            <li key={j} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                                <CheckCircle size={13} className={plan.popular ? 'text-blue-500' : 'text-emerald-500'} />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>

                                    <button onClick={() => handleBuy(id)} disabled={isBuying}
                                        className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                                            plan.popular
                                                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md shadow-blue-500/20'
                                                : 'bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900'
                                        } disabled:opacity-50`}
                                    >
                                        {isBuying ? <Loader2 size={14} className="animate-spin" /> : null}
                                        {isBuying ? 'Redirection...' : 'Acheter'}
                                    </button>
                                </motion.div>
                            )
                        })}
                    </div>
                ) : null}

                {/* Note bas de page */}
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="text-center text-xs text-zinc-400 mt-12">
                    Paiement sécurisé par Stripe · Les crédits n'expirent pas · Aucun abonnement
                </motion.p>
            </div>
        </div>
    )
}
