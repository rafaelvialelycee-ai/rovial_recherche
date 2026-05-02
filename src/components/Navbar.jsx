import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, CheckCircle, Zap, Menu, X, CreditCard } from 'lucide-react'
import { useCredits } from '../lib/credits'

const navLinks = [
    { to: '/',             label: 'Accueil',      icon: Zap },
    { to: '/verificateur', label: 'Vérificateur', icon: CheckCircle },
    { to: '/chercheur',    label: 'Chercheur',    icon: Search },
    { to: '/tarifs',       label: 'Tarifs',       icon: CreditCard },
]

export default function Navbar() {
    const { pathname } = useLocation()
    const [mobileOpen, setMobileOpen] = useState(false)
    const { solde, loading, flash }   = useCredits()

    const toggleMobile = () => setMobileOpen(prev => !prev)
    const closeMobile  = () => setMobileOpen(false)

    return (
        <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="sticky top-0 z-50 w-full border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl"
        >
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" onClick={closeMobile} className="flex items-center gap-2.5 group">
                    <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-label="ROVIAL Recherche">
                        <rect width="32" height="32" rx="8" className="fill-zinc-900 dark:fill-zinc-100" />
                        <circle cx="16" cy="16" r="5.5" stroke="#6366f1" strokeWidth="2"/>
                        <path d="M16 10.5V5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M16 21.5V27" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M10.5 16H5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M21.5 16H27" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="font-black tracking-tighter text-zinc-900 dark:text-zinc-100 text-lg">
                        ROVIAL <span className="text-indigo-500 font-bold">Recherche</span>
                    </span>
                </Link>

                {/* Nav desktop */}
                <nav className="hidden md:flex items-center gap-1">
                    {navLinks.map(({ to, label, icon: Icon }) => {
                        const active = pathname === to
                        return (
                            <Link key={to} to={to}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                                    active
                                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                                }`}
                            >
                                <Icon size={14} />
                                {label}
                            </Link>
                        )
                    })}
                </nav>

                {/* Droite : solde + CTA + hamburger */}
                <div className="flex items-center gap-3">

                    {/* Badge solde crédits */}
                    {!loading && solde !== null && (
                        <Link to="/tarifs"
                            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-300 ${
                                flash
                                    ? 'bg-amber-500/10 border-amber-400/60 text-amber-600 dark:text-amber-400 scale-105'
                                    : solde <= 5
                                        ? 'bg-red-500/5 border-red-300/60 dark:border-red-800/60 text-red-500 dark:text-red-400'
                                        : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-indigo-400/60 hover:text-indigo-500'
                            }`}
                        >
                            <Zap size={10} className={solde <= 5 ? 'text-red-400' : ''} />
                            <motion.span key={solde} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ duration: 0.2 }}>
                                {solde}
                            </motion.span>
                            <span className="opacity-60">cr.</span>
                        </Link>
                    )}

                    <a href="https://rovial.fr" target="_blank" rel="noopener noreferrer"
                        className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-full transition-all duration-200 text-xs tracking-widest uppercase shadow-lg shadow-indigo-500/20"
                    >
                        rovial.fr
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M3.75 2h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.5 9.25V6.56l-4.97 4.97-1.06-1.06L9.19 5.5H3.75a.25.25 0 0 1-.25-.25V3.75c0-.138.112-.25.25-.25h8.5c.138 0 .25.112.25.25v8.5a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25z"/></svg>
                    </a>

                    <button onClick={toggleMobile} aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen}
                        className="md:hidden flex items-center justify-center w-10 h-10 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Menu mobile */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.nav key="mobile-menu"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="md:hidden overflow-hidden border-t border-zinc-200/60 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl"
                    >
                        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-2">
                            {navLinks.map(({ to, label, icon: Icon }) => {
                                const active = pathname === to
                                return (
                                    <Link key={to} to={to} onClick={closeMobile}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                            active
                                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        <Icon size={16} />
                                        {label}
                                        {/* Solde en ligne sur mobile pour /tarifs */}
                                        {to === '/tarifs' && solde !== null && (
                                            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                                                solde <= 5
                                                    ? 'bg-red-500/10 text-red-500'
                                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                                            }`}>
                                                {solde} cr.
                                            </span>
                                        )}
                                    </Link>
                                )
                            })}
                            <a href="https://rovial.fr" target="_blank" rel="noopener noreferrer" onClick={closeMobile}
                                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-5 rounded-xl transition-all duration-200 text-xs tracking-widest uppercase mt-2"
                            >
                                rovial.fr
                                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M3.75 2h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.5 9.25V6.56l-4.97 4.97-1.06-1.06L9.19 5.5H3.75a.25.25 0 0 1-.25-.25V3.75c0-.138.112-.25.25-.25h8.5c.138 0 .25.112.25.25v8.5a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25z"/></svg>
                            </a>
                        </div>
                    </motion.nav>
                )}
            </AnimatePresence>
        </motion.header>
    )
}
