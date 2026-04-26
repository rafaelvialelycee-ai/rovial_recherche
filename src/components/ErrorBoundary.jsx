import { Component } from 'react'
import { Link } from 'react-router-dom'

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info)
    }

    render() {
        if (!this.state.hasError) return this.props.children

        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
                <div className="mb-6">
                    <svg viewBox="0 0 48 48" width="48" height="48" fill="none" className="mx-auto mb-4 text-zinc-400">
                        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2"/>
                        <path d="M24 14v12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                        <circle cx="24" cy="33" r="1.5" fill="currentColor"/>
                    </svg>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                        Une erreur inattendue s'est produite
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto text-sm">
                        Quelque chose s'est mal passé sur cette page. Veuillez recharger ou revenir à l'accueil.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-80 transition-opacity"
                    >
                        Réessayer
                    </button>
                    <Link
                        to="/"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-5 py-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Accueil
                    </Link>
                </div>
            </div>
        )
    }
}
