import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springAnim } from '../lib/animations'
import { CheckCircle, XCircle, AlertCircle, Upload, Terminal, Download, Loader2 } from 'lucide-react'

const gradientColors = 'bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-500'

const STEPS = [
    'Résolution DNS & extraction MX…',
    'Détection du fournisseur (Microsoft / Google / Custom)…',
    'Analyse du comportement Catch-All…',
    'Test de greylisting SMTP…',
    'Analyse de latence (Sniper)…',
    'Calcul du score de confiance…',
]

function StatusBadge({ result }) {
    if (!result) return null
    const isValid   = result.includes('Valide')
    const isInvalid = result.includes('Invalide')
    const isWarn    = result.includes('Incertain') || result.includes('Bloqué') || result.includes('Greylisting')

    if (isValid)   return <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-bold border border-emerald-200 dark:border-emerald-800"><CheckCircle size={14}/> {result}</span>
    if (isInvalid) return <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-800"><XCircle size={14}/> {result}</span>
    if (isWarn)    return <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-bold border border-amber-200 dark:border-amber-800"><AlertCircle size={14}/> {result}</span>
    return <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-bold"><AlertCircle size={14}/> {result}</span>
}

function TerminalBlock({ steps, current, done }) {
    return (
        <div className="font-mono text-xs bg-zinc-950 rounded-2xl p-5 space-y-1 border border-zinc-800">
            {steps.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 transition-all duration-300 ${
                    i < current ? 'text-emerald-400' :
                    i === current && !done ? 'text-zinc-100' :
                    'text-zinc-600'
                }`}>
                    <span className="text-zinc-600">{'>'}</span>
                    {i < current || done ? <CheckCircle size={10} className="text-emerald-400 shrink-0"/> : i === current ? <Loader2 size={10} className="animate-spin shrink-0 text-zinc-300"/> : <span className="w-2.5 h-2.5 rounded-full border border-zinc-700 shrink-0"/>}
                    {s}
                </div>
            ))}
            {done && <div className="text-emerald-400 mt-2">{'>'} Diagnostic terminé.</div>}
        </div>
    )
}

export default function Verificateur() {
    const [mode, setMode]       = useState('unit')
    const [email, setEmail]     = useState('')
    const [running, setRunning] = useState(false)
    const [step, setStep]       = useState(-1)
    const [done, setDone]       = useState(false)
    const [result, setResult]   = useState(null)
    const [csvData, setCsvData] = useState(null)
    const [csvResult, setCsvResult] = useState([])
    const [csvProgress, setCsvProgress] = useState(0)
    const fileRef = useRef()

    // Simulate the cascade verification (Python backend call placeholder)
    async function runVerification(emailToCheck) {
        setRunning(true); setDone(false); setResult(null); setStep(0)
        for (let i = 0; i < STEPS.length; i++) {
            setStep(i)
            await new Promise(r => setTimeout(r, 300 + Math.random() * 400))
        }
        // Placeholder result — plug your Python API here
        const fakeResult = emailToCheck.includes('@') ? 'Valide (100% | API Simulée)' : 'Format Invalide'
        setResult(fakeResult); setDone(true); setRunning(false)
    }

    function handleFileChange(e) {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean)
            setCsvData(lines)
        }
        reader.readAsText(file)
    }

    async function runBulk() {
        if (!csvData) return
        setRunning(true); setCsvResult([]); setCsvProgress(0)
        const results = []
        for (let i = 0; i < csvData.length; i++) {
            const em = csvData[i]
            await new Promise(r => setTimeout(r, 200 + Math.random() * 300))
            const res = em.includes('@') ? 'Valide (simulation)' : 'Format Invalide'
            results.push({ email: em, result: res })
            setCsvResult([...results])
            setCsvProgress(Math.round(((i + 1) / csvData.length) * 100))
        }
        setRunning(false)
    }

    function downloadCSV() {
        if (!csvResult.length) return
        const csv = ['email;resultat', ...csvResult.map(r => `${r.email};${r.result}`)].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export_verifie.csv'; a.click()
    }

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} style={{ willChange: 'transform' }}
                    className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springAnim }} className="mb-12">
                    <div className="inline-block border border-blue-500/20 dark:border-indigo-400/20 bg-blue-500/5 dark:bg-indigo-500/10 rounded-full px-5 py-2 text-[10px] font-bold text-blue-600 dark:text-indigo-400 mb-6 tracking-[0.25em] uppercase backdrop-blur-sm">
                        Module 01 · Validation
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 mb-4">
                        <span className={`${gradientColors} bg-clip-text text-transparent animate-gradient-text`}>Vérificateur</span> d'E-mail
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-xl leading-relaxed">
                        Validation réseau avec contournement Catch-All, greylisting et bypass API Microsoft.
                    </p>
                </motion.div>

                {/* Mode toggle */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springAnim, delay: 0.1 }}
                    className="flex gap-2 mb-8 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl w-fit"
                >
                    {[['unit', 'Saisie unitaire'], ['bulk', 'Import fichier']].map(([m, label]) => (
                        <button key={m} onClick={() => { setMode(m); setResult(null); setDone(false); setStep(-1) }}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                                mode === m ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </motion.div>

                <AnimatePresence mode="wait">
                    {mode === 'unit' ? (
                        <motion.div key="unit" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
                            className="border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] p-10 space-y-8"
                        >
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Adresse e-mail à vérifier</label>
                                <div className="flex gap-3">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !running && email && runVerification(email)}
                                        placeholder="prenom.nom@entreprise.com"
                                        className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                    />
                                    <button
                                        onClick={() => email && runVerification(email)}
                                        disabled={running || !email}
                                        className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 text-white dark:text-zinc-900 font-bold py-4 px-8 rounded-2xl transition-all duration-200 uppercase text-[11px] tracking-widest flex items-center gap-2"
                                    >
                                        {running ? <Loader2 size={14} className="animate-spin" /> : <Terminal size={14} />}
                                        Analyser
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence>
                                {(running || done) && (
                                    <motion.div key="terminal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                                        <TerminalBlock steps={STEPS} current={step} done={done} />
                                    </motion.div>
                                )}
                                {done && result && (
                                    <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                                        className="flex items-center gap-3"
                                    >
                                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Résultat :</span>
                                        <StatusBadge result={result} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div key="bulk" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                            className="border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] p-10 space-y-8"
                        >
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Fichier CSV (1 e-mail par ligne)</label>
                                <div
                                    onClick={() => fileRef.current?.click()}
                                    className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all group"
                                >
                                    <Upload size={24} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                                    <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{csvData ? `${csvData.length} e-mails chargés` : 'Cliquez pour importer un fichier CSV'}</span>
                                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
                                </div>
                            </div>

                            {csvData && (
                                <button onClick={runBulk} disabled={running}
                                    className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 text-white dark:text-zinc-900 font-bold py-3.5 px-8 rounded-2xl transition-all duration-200 uppercase text-[11px] tracking-widest flex items-center gap-2"
                                >
                                    {running ? <Loader2 size={14} className="animate-spin" /> : <Terminal size={14} />}
                                    Lancer le traitement ({csvData.length} e-mails)
                                </button>
                            )}

                            {running && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-zinc-500">
                                        <span>Traitement en cours…</span>
                                        <span>{csvProgress}%</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <motion.div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" animate={{ width: `${csvProgress}%` }} transition={{ duration: 0.3 }} />
                                    </div>
                                </div>
                            )}

                            {csvResult.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{csvResult.length} résultats</span>
                                        <button onClick={downloadCSV} className="flex items-center gap-2 text-xs font-bold text-indigo-500 hover:text-indigo-400 transition-colors">
                                            <Download size={12} /> Exporter CSV
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                        {csvResult.map((r, i) => (
                                            <div key={i} className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                                <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[50%]">{r.email}</span>
                                                <StatusBadge result={r.result} />
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
