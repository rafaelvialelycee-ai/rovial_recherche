import { Link } from 'react-router-dom'

export default function Footer() {
    return (
        <footer className="border-t border-zinc-200/60 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl mt-auto">
            <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-2.5">
                    <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
                        <rect width="32" height="32" rx="8" className="fill-zinc-900 dark:fill-zinc-100" />
                        <circle cx="16" cy="16" r="5.5" stroke="#6366f1" strokeWidth="2"/>
                        <path d="M16 10.5V5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M16 21.5V27" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M10.5 16H5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M21.5 16H27" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="font-black tracking-tighter text-zinc-800 dark:text-zinc-200 text-sm">
                        ROVIAL <span className="text-indigo-500">Recherche</span>
                    </span>
                </div>

                <div className="flex items-center gap-6 text-xs font-semibold text-zinc-400 dark:text-zinc-500 tracking-widest uppercase">
                    <Link to="/verificateur" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Vérificateur</Link>
                    <Link to="/chercheur"    className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Chercheur</Link>
                    <Link to="/about"        className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">À propos</Link>
                    <Link to="/privacy"      className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Confidentialité</Link>
                    <a href="https://rovial.fr" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">rovial.fr ↗</a>
                </div>

                <p className="text-xs text-zinc-400 dark:text-zinc-600">
                    © {new Date().getFullYear()} ROVIAL — Usage professionnel responsable
                </p>
            </div>
        </footer>
    )
}
