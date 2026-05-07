import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense } from 'react'
import ScrollToTop from './ScrollToTop'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import CreditsModal from './components/CreditsModal'
import { CreditsProvider } from './lib/credits'

const Home         = lazy(() => import('./pages/Home'))
const Verificateur = lazy(() => import('./pages/Verificateur'))
const Chercheur    = lazy(() => import('./pages/Chercheur'))
const Tarifs       = lazy(() => import('./pages/Tarifs'))
const About        = lazy(() => import('./pages/About'))
const Privacy      = lazy(() => import('./pages/Privacy'))
const NotFound     = lazy(() => import('./pages/NotFound'))

function PageSkeleton() {
    return (
        <div className="flex-grow flex items-center justify-center min-h-[60vh]">
            <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
        </div>
    )
}

function AnimatedRoutes() {
    const location = useLocation()
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex-grow flex flex-col"
            >
                <Suspense fallback={<PageSkeleton />}>
                    <Routes location={location}>
                        <Route path="/"             element={<Home />} />
                        <Route path="/verificateur" element={<Verificateur />} />
                        <Route path="/chercheur"    element={<Chercheur />} />
                        <Route path="/tarifs"       element={<Tarifs />} />
                        <Route path="/about"        element={<About />} />
                        <Route path="/privacy"      element={<Privacy />} />
                        <Route path="*"             element={<NotFound />} />
                    </Routes>
                </Suspense>
            </motion.div>
        </AnimatePresence>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <CreditsProvider>
                <ScrollToTop />
                <div className="flex flex-col min-h-screen">
                    <Navbar />
                    <main className="flex-grow flex flex-col">
                        <ErrorBoundary>
                            <AnimatedRoutes />
                        </ErrorBoundary>
                    </main>
                    <Footer />
                </div>
                {/* Modal global crédits insuffisants (déclenché par api.js 402) */}
                <CreditsModal />
            </CreditsProvider>
        </BrowserRouter>
    )
}
