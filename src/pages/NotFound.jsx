import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { springAnim } from '../lib/animations'

export default function NotFound() {
    return (
        <div className="flex-grow flex flex-col items-center justify-center text-center px-6 py-32">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springAnim }} className="space-y-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">Erreur 404</p>
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100">Page introuvable</h1>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-md">Cette page n'existe pas ou a été déplacée.</p>
                <Link to="/" className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold py-3.5 px-8 rounded-full transition-all duration-200 uppercase text-[11px] tracking-widest">
                    ← Retour à l'accueil
                </Link>
            </motion.div>
        </div>
    )
}
