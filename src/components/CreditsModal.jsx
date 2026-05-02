import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * Modal crédits insuffisants — s'ouvre automatiquement quand l'API retourne 402.
 * Branché sur l'event global 'rovial:credits_insuffisants' dispatché par api.js.
 */
export default function CreditsModal() {
    const [open, setOpen]       = useState(false)
    const [detail, setDetail]   = useState(null)
    const navigate              = useNavigate()

    useEffect(() => {
        function onInsuffisant(e) {
            setDetail(e.detail)
            setOpen(true)
        }
        window.addEventListener('rovial:credits_insuffisants', onInsuffisant)
        return () => window.removeEventListener('rovial:credits_insuffisants', onInsuffisant)
    }, [])

    function goTarifs() {
        setOpen(false)
        navigate('/tarifs')
    }

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={() => setOpen(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4"
                    >
                        <div className="pointer-events-auto w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl">
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                    <Zap size={22} className="text-amber-500" />
                                </div>
                                <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-2">Crédits insuffisants</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                                Il vous faut <strong className="text-zinc-700 dark:text-zinc-300">{detail?.requis ?? '?'} crédit{(detail?.requis ?? 0) > 1 ? 's' : ''}</strong> pour cette opération.
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                                Solde actuel : <strong className="text-zinc-700 dark:text-zinc-300">{detail?.solde ?? 0} crédit{(detail?.solde ?? 0) > 1 ? 's' : ''}</strong>
                            </p>
                            <div className="flex flex-col gap-3">
                                <button onClick={goTarifs}
                                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-sm transition-all"
                                >
                                    Recharger mes crédits
                                </button>
                                <button onClick={() => setOpen(false)}
                                    className="w-full py-3 rounded-2xl text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
