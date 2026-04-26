import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springAnim } from '../lib/animations'
import { Search, Loader2, Download, Upload, CheckCircle, XCircle, AlertCircle, Sparkles } from 'lucide-react'
import { api } from '../lib/api'

const gradientColors = 'bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-500'

const STEPS_PATTERNS = [
    'Normalisation des caractères (accents, casse)…',
    'Génération de la matrice de patterns…',
    'Test furtif des 7 combinaisons…',
    'Validation de la correspondance trouvée…',
]

function ResultCard({ email, statut }) {
    const isValid   = statut === 'Valide'
    const isInvalid = statut === 'Invalide'
    const isWarn    = statut === 'Incertain'
    const isFound   = isValid || isWarn

    return (
        <div className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${
            isValid   ? 'bg-emerald-500/5 border-emerald-200 dark:border-emerald-800' :
            isWarn    ? 'bg-amber-500/5 border-amber-200 dark:border-amber-800' :
            isInvalid ? 'bg-red-500/5 border-red-200 dark:border-red-800' :
                        'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
        }`}>
            <span className="text-sm font-mono font-semibold text-zinc-800 dark:text-zinc-200">{email}</span>
            <span className={`text-xs font-bold flex items-center gap-1 ${
                isValid   ? 'text-emerald-600 dark:text-emerald-400' :
                isWarn    ? 'text-amber-600 dark:text-amber-400' :
                isInvalid ? 'text-red-500 dark:text-red-400' :
                            'text-zinc-400'
            }`}>
                {isValid && <CheckCircle size={11}/>}
                {isWarn  && <AlertCircle size={11}/>}
                {isInvalid && <XCircle size={11}/>}
                {statut || 'Non testé'}
            </span>
        </div>
    )
}

export default function Chercheur() {
    const [mode, setMode]       = useState('unit')
    const [prenom, setPrenom]   = useState('')
    const [nom, setNom]         = useState('')
    const [domaine, setDomaine] = useState('')
    const [running, setRunning] = useState(false)
    const [step, setStep]       = useState(-1)
    const [done, setDone]       = useState(false)
    const [result, setResult]   = useState(null)   // { patterns, trouve, incertain, fiable }
    const [error, setError]     = useState(null)
    const [csvData, setCsvData] = useState(null)
    const [csvResult, setCsvResult] = useState([])
    const [csvProgress, setCsvProgress] = useState(0)
    const fileRef = useRef()

    async function runSearch() {
        if (!prenom || !nom || !domaine) return
        setRunning(true); setResult(null); setError(null); setDone(false); setStep(0)

        const ticker = setInterval(() => {
            setStep(prev => {
                if (prev < STEPS_PATTERNS.length - 2) return prev + 1
                clearInterval(ticker)
                return prev
            })
        }, 700)

        try {
            const data = await api.chercher(prenom, nom, domaine)
            clearInterval(ticker)
            setStep(STEPS_PATTERNS.length - 1)
            await new Promise(r => setTimeout(r, 300))
            setResult(data)
        } catch (err) {
            clearInterval(ticker)
            setError(err.message)
        } finally {
            setDone(true); setRunning(false)
        }
    }

    function handleFileChange(e) {
        const file = e.target.files[0]; if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean)
            const parsed = lines.map(line => {
                const parts = line.split(';')
                return { prenom: parts[0] || '', nom: parts[1] || '', domaine: parts[2] || '' }
            })
            setCsvData(parsed)
        }
        reader.readAsText(file)
    }

    async function runBulk() {
        if (!csvData) return
        setRunning(true); setCsvResult([]); setCsvProgress(0); setError(null)
        try {
            const data = await api.chercherBulk(csvData)
            setCsvResult(data.resultats)
            setCsvProgress(100)
        } catch (err) {
            setError(err.message)
        } finally {
            setRunning(false)
        }
    }

    function downloadCSV() {
        if (!csvResult.length) return
        const csv = ['prenom;nom;domaine;email_trouve;statut;fiable',
            ...csvResult.map(r => `${r.prenom};${r.nom};${r.domaine};${r.email};${r.statut};${r.fiable ? 'oui' : 'non'}`)
        ].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export_enrichi.csv'; a.click()
    }

    // Construit un tableau de patterns avec leur statut réel depuis la réponse API
    function buildPatternRows(data) {
        if (!data?.patterns) return []
        return data.patterns.map(email => {
            if (data.trouve?.email === email) return { email, statut: 'Valide' }
            if (data.incertain?.email === email) return { email, statut: 'Incertain' }
            return { email, statut: 'Invalide' }
        })
    }

    const foundEmail = result?.trouve || result?.incertain || null
    const isReliable = result?.fiable === true

    return (
        <div className="min-h-screen relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <motion.div animate={{ rotate: -360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} style={{ willChange: 'transform' }}
                    className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springAnim }} className="mb-12">
                    <div className="inline-block border border-blue-500/20 dark:border-indigo-400/20 bg-blue-500/5 dark:bg-indigo-500/10 rounded-full px-5 py-2 text-[10px] font-bold text-blue-600 dark:text-indigo-400 mb-6 tracking-[0.25em] uppercase backdrop-blur-sm">
                        Module 02 · Déduction
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 mb-4">
                        <span className={`${gradientColors} bg-clip-text text-transparent animate-gradient-text`}>Chercheur</span> d'E-mail
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-xl leading-relaxed">
                        Déduisez l'adresse professionnelle de vos prospects à partir de leur prénom, nom et domaine d'entreprise.
                    </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springAnim, delay: 0.1 }}
                    className="flex gap-2 mb-8 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl w-fit"
                >
                    {[['unit', 'Recherche unitaire'], ['bulk', 'Import fichier']].map(([m, label]) => (
                        <button key={m} onClick={() => { setMode(m); setResult(null); setDone(false); setStep(-1); setError(null) }}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                                mode === m ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                        >{label}</button>
                    ))}
                </motion.div>

                <AnimatePresence mode="wait">
                    {mode === 'unit' ? (
                        <motion.div key="unit" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
                            className="border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] p-10 space-y-8"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { val: prenom,  set: setPrenom,  ph: 'Jean',             label: 'Prénom' },
                                    { val: nom,     set: setNom,     ph: 'Dupont',           label: 'Nom' },
                                    { val: domaine, set: setDomaine, ph: 'entreprise.com',   label: 'Domaine' }
                                ].map(({ val, set, ph, label }) => (
                                    <div key={label}>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">{label}</label>
                                        <input value={val} onChange={e => set(e.target.value)}
                                            placeholder={ph}
                                            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                ))}
                            </div>

                            <button onClick={runSearch} disabled={running || !prenom || !nom || !domaine}
                                className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 text-white dark:text-zinc-900 font-bold py-4 px-8 rounded-2xl transition-all duration-200 uppercase text-[11px] tracking-widest flex items-center gap-2"
                            >
                                {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                Lancer l'algorithme
                            </button>

                            <AnimatePresence>
                                {(running || done) && (
                                    <motion.div key="steps" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        <div className="font-mono text-xs bg-zinc-950 rounded-2xl p-5 space-y-1 border border-zinc-800">
                                            {STEPS_PATTERNS.map((s, i) => (
                                                <div key={i} className={`flex items-center gap-2 ${
                                                    i < step ? 'text-emerald-400' :
                                                    i === step && !done ? 'text-zinc-100' :
                                                    'text-zinc-600'
                                                }`}>
                                                    <span className="text-zinc-600">{'>'}</span>
                                                    {i < step || done ? <CheckCircle size={10} className="text-emerald-400" /> : i === step ? <Loader2 size={10} className="animate-spin text-zinc-300" /> : <span className="w-2.5 h-2.5 rounded-full border border-zinc-700" />}
                                                    {s}
                                                </div>
                                            ))}
                                            {done && <div className="text-emerald-400 mt-2">{'>'} Analyse terminée.</div>}
                                        </div>
                                    </motion.div>
                                )}

                                {error && (
                                    <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold"
                                    >
                                        <XCircle size={16} className="shrink-0" />
                                        {error}
                                    </motion.div>
                                )}

                                {done && result && !error && (
                                    <motion.div key="patterns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Patterns testés ({result.total_patterns})</span>
                                        <div className="grid grid-cols-1 gap-2">
                                            {buildPatternRows(result).map((row, i) => (
                                                <ResultCard key={i} email={row.email} statut={row.statut} />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {done && foundEmail && !error && (
                                    <motion.div key="found" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                        className={`border rounded-2xl px-6 py-5 flex items-center gap-4 ${
                                            isReliable
                                                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-500/5'
                                                : 'border-amber-200 dark:border-amber-800 bg-amber-500/5'
                                        }`}
                                    >
                                        {isReliable
                                            ? <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                                            : <AlertCircle size={20} className="text-amber-500 shrink-0" />
                                        }
                                        <div>
                                            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                                                isReliable ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                            }`}>
                                                {isReliable ? 'E-mail confirmé' : 'E-mail incertain — à vérifier'}
                                            </p>
                                            <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-lg">{foundEmail.email}</p>
                                            <p className="text-xs text-zinc-500 mt-1">{foundEmail.confiance}% confiance · {foundEmail.methode}</p>
                                        </div>
                                    </motion.div>
                                )}

                                {done && !foundEmail && !error && (
                                    <motion.div key="notfound" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm font-semibold"
                                    >
                                        <XCircle size={16} className="shrink-0" />
                                        Aucun e-mail trouvé pour ce contact — serveur impénétrable ou domaine invalide.
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div key="bulk" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                            className="border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] p-10 space-y-8"
                        >
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Fichier CSV (prenom;nom;domaine)</label>
                                <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all group">
                                    <Upload size={24} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                                    <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{csvData ? `${csvData.length} contacts chargés` : 'Cliquez pour importer'}</span>
                                    <span className="text-xs text-zinc-400">Format attendu : prenom;nom;domaine.com</span>
                                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
                                </div>
                            </div>

                            {csvData && (
                                <button onClick={runBulk} disabled={running}
                                    className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 text-white dark:text-zinc-900 font-bold py-3.5 px-8 rounded-2xl transition-all duration-200 uppercase text-[11px] tracking-widest flex items-center gap-2"
                                >
                                    {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    Enrichir ({csvData.length} contacts)
                                </button>
                            )}

                            {running && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-zinc-500">
                                        <span>Enrichissement en cours…</span>
                                        <span>{csvProgress}%</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <motion.div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" animate={{ width: `${csvProgress}%` }} transition={{ duration: 0.3 }} />
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold">
                                    <XCircle size={16} className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            {csvResult.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{csvResult.length} contacts enrichis</span>
                                        <button onClick={downloadCSV} className="flex items-center gap-2 text-xs font-bold text-indigo-500 hover:text-indigo-400 transition-colors">
                                            <Download size={12} /> Exporter CSV
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                        {csvResult.map((r, i) => (
                                            <div key={i} className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{r.prenom} {r.nom}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">{r.email}</span>
                                                    {!r.fiable && r.email !== 'Non trouvé' && (
                                                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">Incertain</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
