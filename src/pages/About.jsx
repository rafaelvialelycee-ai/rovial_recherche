import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { springAnim } from '../lib/animations'
import { Zap, Shield, Search, CheckCircle, ArrowRight, ExternalLink } from 'lucide-react'

const gradientColors = 'bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-500'

const timeline = [
    {
        step: '01',
        title: 'Résolution DNS & MX',
        desc: "On interroge les serveurs DNS du domaine pour obtenir ses enregistrements MX — les portes d'entrée du courrier entrant.",
    },
    {
        step: '02',
        title: 'Connexion SMTP directe',
        desc: "Une connexion SMTP est ouverte sans envoyer d'e-mail réel. On teste l'existence de la boîte via les commandes RCPT TO.",
    },
    {
        step: '03',
        title: 'Détection Catch-All & Microsoft',
        desc: "Certains serveurs acceptent tout par défaut (Catch-All). On neutralise ce biais avec un e-mail leurre et des signatures Microsoft 365 / Google Workspace.",
    },
    {
        step: '04',
        title: 'Score de confiance',
        desc: "Le résultat final combine les signaux SMTP, DNS, délai de réponse et historique pour produire un score de confiance entre 0 et 100 %.",
    },
]

const values = [
    {
        icon: Shield,
        title: 'RGPD by design',
        desc: "Aucune donnée n'est stockée après traitement. Chaque requête est éphémère. Vous restez propriétaire de vos données.",
    },
    {
        icon: Zap,
        title: 'Infrastructure temps réel',
        desc: "Hébergé sur des serveurs dédiés haute disponibilité. Chaque vérification est traitée en moins de 3 secondes.",
    },
    {
        icon: Search,
        title: 'Heuristiques évolutives',
        desc: "7 patterns de déduction d'e-mail mis à jour régulièrement sur la base des formats dominants détectés par domaine.",
    },
    {
        icon: CheckCircle,
        title: 'Usage B2B uniquement',
        desc: "Conçu exclusivement pour les équipes sales, growth et recrutement opérant dans un cadre professionnel et légal.",
    },
]

export default function About() {
    return (
        <div className="min-h-screen relative overflow-hidden">

            {/* ─── HERO ─── */}
            <section className="flex flex-col items-center justify-center text-center px-4 mt-32 md:mt-40 relative z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.1 }}
                    className="inline-block border border-blue-500/20 dark:border-indigo-400/20 bg-blue-500/5 dark:bg-indigo-500/10 rounded-full px-5 py-2 text-[10px] font-bold text-blue-600 dark:text-indigo-400 mb-12 tracking-[0.25em] uppercase backdrop-blur-sm"
                >
                    À propos · ROVIAL Recherche
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.2 }}
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter max-w-5xl leading-[1.05] mb-12 text-zinc-900 dark:text-zinc-50"
                >
                    Comment ça<br />
                    <span className={`${gradientColors} bg-clip-text text-transparent animate-gradient-text`}>
                        fonctionne vraiment.
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.3 }}
                    className="text-zinc-500 dark:text-zinc-400 max-w-xl text-lg md:text-xl leading-relaxed mb-14 tracking-tight"
                >
                    ROVIAL Recherche est un outil d'enrichissement B2B développé par ROVIAL. Voici la mécanique derrière chaque vérification.
                </motion.p>
            </section>

            {/* ─── PIPELINE ─── */}
            <section className="relative max-w-4xl mx-auto px-8 py-20 z-10">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ ...springAnim }}
                    className="text-xs font-bold tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500 mb-12 text-center"
                >
                    Pipeline de vérification
                </motion.h2>

                <div className="relative">
                    <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/30 via-blue-500/20 to-transparent hidden md:block" />
                    <div className="space-y-8">
                        {timeline.map(({ step, title, desc }, i) => (
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ ...springAnim, delay: i * 0.08 }}
                                className="flex gap-8 items-start"
                            >
                                <div className="shrink-0 w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center font-black text-indigo-500 text-sm tracking-tighter">
                                    {step}
                                </div>
                                <div className="pt-2">
                                    <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-sm max-w-lg">{desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── VALEURS ─── */}
            <section className="relative max-w-7xl mx-auto px-8 py-20">
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-30">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} style={{ willChange: 'transform' }}
                        className="absolute w-[400px] h-[400px] bg-blue-500/20 dark:bg-indigo-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/4" />
                    <motion.div animate={{ rotate: -360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} style={{ willChange: 'transform' }}
                        className="absolute w-[500px] h-[500px] bg-cyan-400/20 dark:bg-purple-500/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/4" />
                </div>

                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ ...springAnim }}
                    className="text-xs font-bold tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500 mb-12 text-center relative z-10"
                >
                    Principes
                </motion.h2>

                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {values.map(({ icon: Icon, title, desc }, i) => (
                        <motion.div
                            key={title}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ ...springAnim, delay: i * 0.07 }}
                            className="border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none p-8 rounded-[2rem] flex flex-col gap-4"
                        >
                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
                                <Icon size={18} className="text-indigo-500" />
                            </div>
                            <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed flex-grow">{desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ─── BLOC ROVIAL ─── */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...springAnim }}
                className="max-w-4xl mx-auto px-8 py-20 relative z-10"
            >
                <div className="border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none p-12 rounded-[2.5rem] flex flex-col md:flex-row gap-10 items-start">
                    <div className="shrink-0">
                        <svg viewBox="0 0 32 32" width="48" height="48" fill="none">
                            <rect width="32" height="32" rx="8" className="fill-zinc-900 dark:fill-zinc-100" />
                            <circle cx="16" cy="16" r="5.5" stroke="#6366f1" strokeWidth="2"/>
                            <path d="M16 10.5V5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M16 21.5V27" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M10.5 16H5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M21.5 16H27" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
                            ROVIAL <span className="text-indigo-500">Recherche</span> est un produit ROVIAL
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                            ROVIAL développe des outils B2B pour les équipes commerciales et marketing. ROVIAL Recherche est la brique d'enrichissement email de l'écosystème ROVIAL, conçue pour s'intégrer dans vos workflows de prospection de manière fiable et conforme.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <a
                                href="https://rovial.fr"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold py-3 px-7 rounded-full transition-all duration-300 uppercase text-[11px] tracking-[0.15em]"
                            >
                                Visiter rovial.fr <ExternalLink size={12} />
                            </a>
                            <Link
                                to="/tarifs"
                                className="inline-flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold py-3 px-7 rounded-full transition-all duration-300 uppercase text-[11px] tracking-[0.15em]"
                            >
                                Voir les tarifs <ArrowRight size={12} />
                            </Link>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* ─── DISCLAIMER ─── */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...springAnim }}
                className="max-w-4xl mx-auto px-8 pb-32 relative z-10"
            >
                <div className="border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10 rounded-3xl px-8 py-6 flex items-start gap-4">
                    <Shield size={18} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                        <strong>Usage responsable.</strong> Cet outil est conçu pour un usage B2B professionnel. La vérification d'e-mails doit respecter le RGPD et les conditions d'utilisation des serveurs cibles. ROVIAL décline toute responsabilité en cas d'usage abusif.
                    </p>
                </div>
            </motion.section>
        </div>
    )
}
