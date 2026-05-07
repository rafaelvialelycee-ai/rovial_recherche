import { motion } from 'framer-motion'
import { springAnim } from '../lib/animations'
import { Shield, Eye, Database, Trash2, Mail, Lock, AlertTriangle } from 'lucide-react'

const gradientColors = 'bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-500'

const sections = [
    {
        icon: Database,
        title: 'Données collectées',
        content: [
            { label: 'Adresses e-mail saisies', detail: 'Utilisées uniquement pour la vérification ou la déduction en temps réel. Non stockées après traitement.' },
            { label: 'Prénom, nom, domaine', detail: 'Transmis au moteur de déduction pour générer des patterns. Supprimés immédiatement après la réponse.' },
            { label: 'Logs techniques', detail: 'Adresse IP, horodatage et code de statut HTTP conservés 7 jours à des fins de sécurité et débogage, puis supprimés automatiquement.' },
        ],
    },
    {
        icon: Eye,
        title: 'Finalités du traitement',
        content: [
            { label: 'Vérification SMTP', detail: "Connexion directe aux serveurs de messagerie du domaine cible pour confirmer l'existence d'une boîte mail. Aucune donnée tiers impliquée." },
            { label: 'Déduction de format', detail: "Génération et test de patterns d'adresse e-mail professionnelle basés sur les informations fournies." },
            { label: 'Amélioration du service', detail: 'Statistiques agrégées et anonymisées sur la fiabilité des résultats, sans aucune donnée personnelle identifiable.' },
        ],
    },
    {
        icon: Lock,
        title: 'Base légale (RGPD)',
        content: [
            { label: 'Intérêt légitime (Art. 6.1.f)', detail: "Le traitement est justifié par l'intérêt légitime de l'utilisateur à valider des contacts B2B dans un cadre professionnel." },
            { label: "Responsabilité de l'utilisateur", detail: "L'utilisateur s'engage à n'utiliser cet outil que pour des contacts professionnels (domaines d'entreprise) et non pour des adresses personnelles." },
            { label: 'Pas de profilage', detail: "ROVIAL Recherche ne crée aucun profil utilisateur, n'utilise aucun cookie de traçage et ne revend aucune donnée à des tiers." },
        ],
    },
    {
        icon: Trash2,
        title: 'Rétention & suppression',
        content: [
            { label: 'Données de vérification', detail: 'Supprimées immédiatement après retour de la réponse API. Aucune persistance en base de données.' },
            { label: 'Logs techniques', detail: 'Rotation automatique sous 7 jours. Non partagés avec des tiers.' },
            { label: "Droit à l'effacement", detail: "Compte tenu de la nature éphémère du traitement, aucune donnée personnelle n'est conservée au-delà du délai de log. Aucune action manuelle n'est requise." },
        ],
    },
    {
        icon: Shield,
        title: 'Sécurité',
        content: [
            { label: 'Transit chiffré', detail: 'Toutes les communications entre votre navigateur et nos serveurs utilisent TLS 1.3.' },
            { label: 'Isolation des requêtes', detail: 'Chaque requête de vérification est traitée en isolation. Aucune donnée ne transite entre utilisateurs.' },
            { label: 'Accès restreint', detail: "L'accès à l'infrastructure de traitement est limité aux équipes techniques ROVIAL via authentification forte." },
        ],
    },
    {
        icon: Mail,
        title: 'Vos droits',
        content: [
            { label: 'Droit d\'accès & rectification', detail: "Vous pouvez demander l'accès aux données vous concernant. Compte tenu de la nature éphémère du traitement, aucune donnée identifiable ne devrait subsister." },
            { label: 'Droit à la portabilité', detail: "Non applicable : aucune donnée personnelle n'est stockée de manière persistante." },
            { label: 'Contact DPO', detail: 'Pour toute question relative à la protection de vos données : privacy@rovial.fr' },
        ],
    },
]

export default function Privacy() {
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
                    Confidentialité · RGPD
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.2 }}
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter max-w-5xl leading-[1.05] mb-12 text-zinc-900 dark:text-zinc-50"
                >
                    Politique de<br />
                    <span className={`${gradientColors} bg-clip-text text-transparent animate-gradient-text`}>
                        confidentialité.
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.3 }}
                    className="text-zinc-500 dark:text-zinc-400 max-w-xl text-lg md:text-xl leading-relaxed mb-6 tracking-tight"
                >
                    ROVIAL Recherche est conçu avec une philosophie <strong className="text-zinc-700 dark:text-zinc-300">privacy by design</strong>. Aucune donnée personnelle n'est stockée au-delà du traitement immédiat.
                </motion.p>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springAnim, delay: 0.35 }}
                    className="text-xs text-zinc-400 dark:text-zinc-600 mb-20"
                >
                    Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </motion.p>
            </section>

            {/* ─── SECTIONS ─── */}
            <section className="relative max-w-4xl mx-auto px-8 pb-20 z-10">
                <div className="space-y-6">
                    {sections.map(({ icon: Icon, title, content }, i) => (
                        <motion.div
                            key={title}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ ...springAnim, delay: i * 0.06 }}
                            className="border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none p-10 rounded-[2rem]"
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <Icon size={18} className="text-indigo-500" />
                                </div>
                                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
                            </div>
                            <div className="space-y-5">
                                {content.map(({ label, detail }) => (
                                    <div key={label} className="flex gap-4 items-start">
                                        <span className="mt-1.5 w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full shrink-0" />
                                        <div>
                                            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label} — </span>
                                            <span className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{detail}</span>
                                        </div>
                                    </div>
                                ))}
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
                    <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                        <strong>Responsabilité de l'utilisateur.</strong> L'utilisation de ROVIAL Recherche pour vérifier des adresses e-mail personnelles (hors contexte B2B) ou sans base légale appropriée engage la responsabilité exclusive de l'utilisateur. ROVIAL ne saurait être tenu responsable d'un usage non conforme au RGPD.
                    </p>
                </div>
            </motion.section>
        </div>
    )
}
