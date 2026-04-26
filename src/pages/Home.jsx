import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { springAnim } from '../lib/animations'
import { CheckCircle, Search, ArrowRight, Zap, Shield, BarChart3 } from 'lucide-react'

const gradientColors = 'bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-500'

const modules = [
    {
        num: '01',
        icon: CheckCircle,
        category: 'Validation',
        title: 'Vérificateur d\'E-mail',
        desc: 'Validez l\'existence réseau d\'un e-mail professionnel avec contournement Catch-All, analyse SMTP et détection Microsoft.',
        features: ['Résolution DNS & MX', 'Bypass anti-spam avancé', 'Score de confiance'],
        to: '/verificateur',
        cta: 'Accéder au vérificateur',
    },
    {
        num: '02',
        icon: Search,
        category: 'Déduction',
        title: 'Chercheur d\'E-mail',
        desc: 'Déduisez l\'adresse e-mail professionnelle d\'un contact à partir de son prénom, nom et domaine d\'entreprise.',
        features: ['Patterns probabilistes', 'Vérification en cascade', 'Export CSV'],
        to: '/chercheur',
        cta: 'Accéder au chercheur',
    },
]

const stats = [
    { icon: Zap,       label: 'Patterns testés',    value: '7+' },
    { icon: Shield,    label: 'Méthodes de bypass', value: '4' },
    { icon: BarChart3, label: 'Score de confiance',  value: '0–100%' },
]

export default function Home() {
    return (
        <div className="min-h-screen relative overflow-hidden">

            {/* ─── HERO ─── */}
            <main className="flex flex-col items-center justify-center text-center px-4 mt-32 md:mt-40 relative z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.1 }}
                    className="inline-block border border-blue-500/20 dark:border-indigo-400/20 bg-blue-500/5 dark:bg-indigo-500/10 rounded-full px-5 py-2 text-[10px] font-bold text-blue-600 dark:text-indigo-400 mb-12 tracking-[0.25em] uppercase backdrop-blur-sm"
                >
                    Enrichissement B2B · ROVIAL Tools
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.2 }}
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter max-w-5xl leading-[1.05] mb-12 text-zinc-900 dark:text-zinc-50"
                >
                    Vérifiez & déduisez<br />
                    <span className={`${gradientColors} bg-clip-text text-transparent animate-gradient-text`}>
                        vos leads B2B.
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.3 }}
                    className="text-zinc-500 dark:text-zinc-400 max-w-xl text-lg md:text-xl leading-relaxed mb-14 tracking-tight"
                >
                    Deux modules complémentaires pour valider l\'existence d\'un e-mail et reconstituer l\'adresse professionnelle de vos prospects.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.4 }}
                    className="flex flex-col sm:flex-row gap-5 relative z-10"
                >
                    <Link to="/verificateur" className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold py-4 px-10 rounded-full transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] uppercase text-[11px] tracking-[0.15em] text-center flex items-center gap-2">
                        <CheckCircle size={14} /> Vérifier un e-mail
                    </Link>
                    <Link to="/chercheur" className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold py-4 px-10 rounded-full transition-all duration-300 uppercase text-[11px] tracking-[0.15em] text-center flex items-center gap-2">
                        <Search size={14} /> Chercher un e-mail
                    </Link>
                </motion.div>
            </main>

            {/* ─── STATS ─── */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...springAnim, delay: 0.1 }}
                className="max-w-3xl mx-auto px-8 py-20 grid grid-cols-3 gap-8 relative z-10"
            >
                {stats.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-2 text-center">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
                            <Icon size={18} className="text-indigo-500" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">{value}</span>
                        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{label}</span>
                    </div>
                ))}
            </motion.section>

            {/* ─── MODULES ─── */}
            <section className="relative max-w-7xl mx-auto px-8 py-20">
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-40">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} style={{ willChange: 'transform' }}
                        className="absolute w-[400px] h-[400px] bg-blue-500/20 dark:bg-indigo-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/4" />
                    <motion.div animate={{ rotate: -360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} style={{ willChange: 'transform' }}
                        className="absolute w-[500px] h-[500px] bg-cyan-400/20 dark:bg-purple-500/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/4" />
                </div>

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {modules.map(({ num, icon: Icon, category, title, desc, features, to, cta }) => (
                        <motion.div
                            key={num}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-100px' }}
                            transition={{ ...springAnim }}
                        >
                            <div className="group border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none p-12 rounded-[2.5rem] transition-colors duration-500 overflow-hidden h-full relative flex flex-col">
                                <div className="absolute top-0 right-0 p-10 text-6xl font-black text-zinc-100 dark:text-zinc-800/30 group-hover:text-blue-50 dark:group-hover:text-indigo-500/10 transition-colors duration-500 pointer-events-none">{num}</div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
                                        <Icon size={18} className="text-indigo-500" />
                                    </div>
                                    <span className={`font-bold tracking-[0.2em] text-[10px] uppercase ${gradientColors} bg-clip-text text-transparent animate-gradient-text`}>{category}</span>
                                </div>
                                <h2 className="text-3xl font-bold mb-5 tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
                                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm relative z-10 flex-grow">{desc}</p>
                                <ul className="mt-8 space-y-3 text-sm text-zinc-500 dark:text-zinc-400 font-medium relative z-10 mb-8">
                                    {features.map(f => (
                                        <li key={f} className="flex items-center gap-3">
                                            <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full"></span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link to={to} className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold py-3 px-7 rounded-full transition-all duration-300 uppercase text-[11px] tracking-[0.15em] w-fit">
                                    {cta} <ArrowRight size={12} />
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

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
                        <strong>Usage responsable.</strong> Cet outil est conçu pour un usage B2B professionnel. La vérification d\'e-mails doit respecter le RGPD et les conditions d\'utilisation des serveurs cibles. ROVIAL décline toute responsabilité en cas d\'usage abusif.
                    </p>
                </div>
            </motion.section>
        </div>
    )
}
