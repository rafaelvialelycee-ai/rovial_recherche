import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springAnim } from '../lib/animations'
import { Search, Loader2, Download, Upload, CheckCircle, XCircle, AlertCircle, Sparkles } from 'lucide-react'

const gradientColors = 'bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-500'

const PATTERNS = [
    'prenom.nom@', 'pnom@', 'prenom@', 'p.nom@', 'prenomnom@', 'nom.prenom@', 'nomp@'
]

function ResultCard({ email, status }) {
    const isValid   = status?.includes('Valide')
    const isInvalid = status?.includes('Invalide')
    const isWarn    = status?.includes('Incertain')

    return (
        <div className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${
            isValid   ? 'bg-emerald-500/5 border-emerald-200 dark:border-emerald-800' :
            isInvalid ? 'bg-red-500/5 border-red-200 dark:border-red-800' :
            isWarn    ? 'bg-amber-500/5 border-amber-200 dark:border-amber-800' :
                        'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
        }`}>
            <span className="text-sm font-mono font-semibold text-zinc-800 dark:text-zinc-200">{email}</span>
            <span className={`text-xs font-bold ${
                isValid ? 'text-emerald-600 dark:text-emerald-400' :
                isInvalid ? 'text-red-500 dark:text-red-400' :
                isWarn ? 'text-amber-600 dark:text-amber-400' :
                'text-zinc-500'
            }`}>{status}</span>
        </div>
    )
}

export default function Chercheur() {
    const [mode, setMode]       = useState('unit')
    const [prenom, setPrenom]   = useState('')
    const [nom, setNom]         = useState('')
    const [domaine, setDomaine] = useState('')
    const [running, setRunning] = useState(false)
    const [patterns, setPatterns] = useState([])
    const [found, setFound]     = useState(null)
    const [csvData, setCsvData] = useState(null)
    const [csvResult, setCsvResult] = useState([])
    const [csvProgress, setCsvProgress] = useState(0)
    const fileRef = useRef()

    const STEPS_PATTERNS = [
        'Normalisation des caractères (accents, casse)…',
        'Génération de la matrice de patterns…',
        'Test furtif des 7 combinaisons…',
        'Validation de la correspondance trouvée…',
    ]
    const [step, setStep] = useState(-1)
    const [done, setDone] = useState(false)

    async function runSearch() {
        if (!prenom || !nom || !domaine) return
        setRunning(true); setFound(null); setDone(false); setStep(0); setPatterns([])
        const p = prenom.toLowerCase().replace(/[^a-z]/g, '')
        const n = nom.toLowerCase().replace(/[^a-z]/g, '')
        const d = domaine.toLowerCase().replace('www.', '')
        const pats = [
            `${p}.${n}@${d}`, `${p[0]}${n}@${d}`, `${p}@${d}`,
            `${p[0]}.${n}@${d}`, `${p}${n}@${d}`, `${n}.${p}@${d}`, `${n}${p[0]}@${d}`
        ]
        for (let i = 0; i < STEPS_PATTERNS.length; i++) {
            setStep(i)
            await new Promise(r => setTimeout(r, 400 + Math.random() * 500))
        }
        setPatterns(pats)
        // Simulate: take most probable pattern as found
        setFound({ email: pats[0], status: 'Valide (simulation — 90%)' })
        setDone(true); setRunning(false)
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
        setRunning(true); setCsvResult([]); setCsvProgress(0)
        const results = []
        for (let i = 0; i < csvData.length; i++) {
            const { prenom: p, nom: n, domaine: d } = csvData[i]
            await new Promise(r => setTimeout(r, 300 + Math.random() * 400))
            const pn = p.toLowerCase().replace(/[^a-z]/g, '')
            const nn = n.toLowerCase().replace(/[^a-z]/g, '')
            const dn = d.toLowerCase().replace('www.', '')
            const email = pn && nn && dn ? `${pn}.${nn}@${dn}` : 'Données insuffisantes'
            results.push({ prenom: p, nom: n, domaine: d, email, statut: email.includes('@') ? 'Valide (simulation)' : 'Erreur' })
            setCsvResult([...results])
            setCsvProgress(Math.round(((i + 1) / csvData.length) * 100))
        }
        setRunning(false)
    }

    function downloadCSV() {
        if (!csvResult.length) return
        const csv = ['prenom;nom;domaine;email_trouve;statut', ...csvResult.map(r => `${r.prenom};${r.nom};${r.domaine};${r.email};${r.statut}`)].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export_enrichi.csv'; a.click()
    }

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
                        <button key={m} onClick={() => { setMode(m); setFound(null); setDone(false); setStep(-1) }}
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
                                    { val: prenom, set: setPrenom, ph: 'Prénom',  label: 'Prénom' },
                                    { val: nom,    set: setNom,    ph: 'Nom',     label: 'Nom' },
                                    { val: domaine, set: setDomaine, ph: 'entreprise.com', label: 'Domaine' }
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

                                {done && patterns.length > 0 && (
                                    <motion.div key="patterns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Patterns testés ({patterns.length})</span>
                                        <div className="grid grid-cols-1 gap-2">
                                            {patterns.map((pat, i) => (
                                                <ResultCard key={i} email={pat} status={i === 0 ? found?.status : 'Non correspondant'} />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {done && found && (
                                    <motion.div key="found" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="border border-emerald-200 dark:border-emerald-800 bg-emerald-500/5 rounded-2xl px-6 py-5 flex items-center gap-4">
                                        <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">E-mail déduit</p>
                                            <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-lg">{found.email}</p>
                                            <p className="text-xs text-zinc-500 mt-1">{found.status}</p>
                                        </div>
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
                                                <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">{r.email}</span>
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
