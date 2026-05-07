import dns.resolver
import smtplib
import time
import socket
import random
import string
import requests
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
import functools

# ── Cache DNS (TTL 1h) ────────────────────────────────────────────────────────
_dns_cache: dict = {}   # { domaine: (serveur_mx, timestamp) }
DNS_CACHE_TTL = 3600

# ── Cache Sniper par domaine (TTL 10 min) ─────────────────────────────────────
# Evite de re-mesurer duree_faux sur le meme serveur OVH en bulk
# { domaine: (duree_faux_ref, timestamp) }
_sniper_cache: dict = {}
SNIPER_CACHE_TTL = 600   # 10 minutes

resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
resolver.timeout = 2
resolver.lifetime = 2

SMTP_TIMEOUT           = 6
SNIPER_DELTA_VALIDE    = 0.5
SNIPER_DELTA_INCERTAIN = 0.2
# FIX #1 — seuil delta negatif : en dessous de -0.15s le serveur a rejecte
# l'adresse reelle AVANT de chercher => signal Invalide tres fiable
SNIPER_DELTA_NEGATIF   = -0.15

MOTS_GENERIQUES = {
    'contact', 'info', 'hello', 'bonjour', 'admin',
    'support', 'webmaster', 'direction', 'noreply', 'no-reply'
}

# Codes SMTP temporaires (serveur sature, greylisting)
CODES_TEMPORAIRES = {421, 450, 451, 452}
# Codes SMTP de rejet definitif
CODES_REJET       = {550, 551, 552, 553, 554}


def generer_faux_email(domaine: str) -> str:
    aleatoire = ''.join(random.choice(string.ascii_lowercase) for _ in range(12))
    return f"test_{aleatoire}@{domaine}"


def obtenir_serveur_mx(domaine: str) -> tuple:
    cached = _dns_cache.get(domaine)
    if cached and time.time() - cached[1] < DNS_CACHE_TTL:
        return cached[0], "cache"
    try:
        enregistrements = resolver.resolve(domaine, 'MX')
        serveur_mx = str(sorted(enregistrements, key=lambda r: r.preference)[0].exchange)
        _dns_cache[domaine] = (serveur_mx, time.time())
        return serveur_mx, "OK"
    except Exception as e:
        return None, str(e)


def verifier_via_api_microsoft(email: str) -> bool | None:
    url = "https://login.microsoftonline.com/common/GetCredentialType"
    try:
        reponse = requests.post(url, json={"Username": email}, timeout=3).json()
        code = reponse.get("IfExistsResult")
        if code == 0:
            return True
        if code == 1:
            return None  # tenant prive, laisser SMTP trancher
    except Exception:
        pass
    return None


def ping_smtp_rapide(serveur_mx: str, email_cible: str) -> tuple:
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_ping_smtp_interne, serveur_mx, email_cible)
            return future.result(timeout=SMTP_TIMEOUT + 1)
    except (FuturesTimeout, Exception) as e:
        return None, None, str(e)


def _ping_smtp_interne(serveur_mx: str, email_cible: str) -> tuple:
    try:
        serveur = smtplib.SMTP(timeout=SMTP_TIMEOUT)
        serveur.connect(serveur_mx)
        serveur.helo('verify.rovial.fr')
        serveur.mail('noreply@rovial.fr')
        debut = time.perf_counter()
        code, message = serveur.rcpt(email_cible)
        duree = time.perf_counter() - debut
        try:
            serveur.quit()
        except Exception:
            pass
        return code, duree, "OK"
    except smtplib.SMTPConnectError as e:
        return None, None, f"Connexion refusee: {e}"
    except smtplib.SMTPServerDisconnected as e:
        return None, None, f"Deconnexion: {e}"
    except socket.timeout:
        return None, None, "Timeout SMTP"
    except Exception as e:
        return None, None, str(e)


def _marquer_generique(email: str, statut: str) -> str:
    prefixe = email.split('@')[0]
    if prefixe.lower() in MOTS_GENERIQUES:
        return f"{statut} (Adresse generique)"
    return statut


def _ping_smtp_moyenne(serveur_mx: str, email: str, essais: int = 2) -> tuple:
    durees = []
    dernier_code = None
    for _ in range(essais):
        code, duree, err = ping_smtp_rapide(serveur_mx, email)
        if code is not None and duree is not None:
            durees.append(duree)
            dernier_code = code
    if not durees:
        return None, None, "Tous les pings ont echoue"
    return sum(durees) / len(durees), dernier_code, "OK"


def _obtenir_duree_faux_ref(serveur_mx: str, domaine: str) -> tuple:
    """
    FIX #3 — Cache Sniper par domaine.
    Retourne (duree_faux_ref, depuis_cache).
    On mesure le faux email UNE SEULE FOIS par domaine sur 10 min.
    Evite 50 requetes inutiles sur le meme serveur OVH en bulk.
    """
    cached = _sniper_cache.get(domaine)
    if cached and time.time() - cached[1] < SNIPER_CACHE_TTL:
        return cached[0], True

    faux_email = generer_faux_email(domaine)
    code_faux, duree_faux, err_smtp = ping_smtp_rapide(serveur_mx, faux_email)
    if code_faux == 250 and duree_faux is not None:
        _sniper_cache[domaine] = (duree_faux, time.time())
        return duree_faux, False
    # Retourner le code et duree tels quels pour traitement en amont
    return (code_faux, duree_faux, err_smtp), False


def verifier_email(email_brut: str) -> dict:
    if not isinstance(email_brut, str) or '@' not in email_brut:
        return {'email': email_brut, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Format', 'detail': 'Format invalide'}

    email = email_brut.strip().lower()
    domaine = email.split('@')[1]

    # Etape 1 : DNS/MX
    serveur_mx, erreur_dns = obtenir_serveur_mx(domaine)
    if not serveur_mx:
        return {'email': email, 'statut': 'Erreur', 'confiance': 0, 'methode': 'DNS', 'detail': erreur_dns}

    # Etape 2 : API Microsoft (Office 365 / Outlook)
    if 'protection.outlook.com' in serveur_mx.lower() or 'outlook' in serveur_mx.lower():
        resultat_api = verifier_via_api_microsoft(email)
        if resultat_api is True:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'API Microsoft', 'detail': 'Compte confirme'}

    # Etape 3 : Faux email / detection catch-all
    # On utilise le cache Sniper pour ne pas re-mesurer sur le meme domaine
    cache_result = _sniper_cache.get(domaine)
    if cache_result and time.time() - cache_result[1] < SNIPER_CACHE_TTL:
        # Cache hit : on a deja la duree de reference, on fait juste le ping reel
        duree_faux = cache_result[0]
        # On a besoin du code faux pour savoir si catch-all
        # On refait un ping faux leger pour obtenir le code (rapide, serveur deja connu)
        faux_email = generer_faux_email(domaine)
        code_faux, _, err_smtp = ping_smtp_rapide(serveur_mx, faux_email)
    else:
        faux_email = generer_faux_email(domaine)
        code_faux, duree_faux, err_smtp = ping_smtp_rapide(serveur_mx, faux_email)

    if code_faux is None:
        return {'email': email, 'statut': 'Incertain', 'confiance': 30, 'methode': 'SMTP', 'detail': f'Serveur inaccessible ou trop lent: {err_smtp}'}

    # FIX #2 — Codes SMTP specifiques
    if code_faux in CODES_TEMPORAIRES:
        return {'email': email, 'statut': 'Incertain', 'confiance': 70, 'methode': 'SMTP', 'detail': f'Code temporaire {code_faux} (greylisting / surcharge serveur)'}

    if code_faux in CODES_REJET or code_faux == 550:
        # Serveur rejette les inconnus => pas catch-all => test direct
        code_vrai, _, _ = ping_smtp_rapide(serveur_mx, email)
        if code_vrai == 250:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'SMTP Classique', 'detail': f'RCPT TO 250 (faux={code_faux})'}
        if code_vrai in CODES_REJET:
            return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'SMTP Classique', 'detail': f'RCPT TO rejete ({code_vrai})'}
        # 554 specifique : rejet permanent non-conformite
        if code_vrai == 554:
            return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'SMTP Classique', 'detail': 'Rejet permanent 554'}
        return {'email': email, 'statut': 'Incertain', 'confiance': 40, 'methode': 'SMTP Classique', 'detail': f'Code inattendu: {code_vrai}'}

    # Etape 4 : Sniper de latence (catch-all detecte, code_faux == 250)
    if code_faux == 250:
        # Mise en cache de la duree de reference si pas encore fait
        if not (cache_result and time.time() - cache_result[1] < SNIPER_CACHE_TTL):
            if duree_faux is not None:
                _sniper_cache[domaine] = (duree_faux, time.time())

        if duree_faux is None:
            return {'email': email, 'statut': 'Incertain', 'confiance': 20, 'methode': 'SMTP Sniper', 'detail': 'Duree faux non disponible'}

        duree_vrai_moy, code_vrai, err2 = _ping_smtp_moyenne(serveur_mx, email, essais=2)
        if duree_vrai_moy is None:
            return {'email': email, 'statut': 'Incertain', 'confiance': 20, 'methode': 'SMTP Sniper', 'detail': f'Erreur: {err2}'}

        delta = duree_vrai_moy - duree_faux

        # FIX #1 — Delta negatif fort = rejet interne avant lookup => Invalide
        if delta <= SNIPER_DELTA_NEGATIF:
            return {
                'email': email,
                'statut': 'Invalide',
                'confiance': 0,
                'methode': 'Sniper',
                'detail': f'Delta negatif ({delta:.2f}s) : rejet interne serveur'
            }

        if delta >= SNIPER_DELTA_VALIDE:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 90, 'methode': 'Sniper', 'detail': f'Delta moy: +{delta:.2f}s'}

        if delta >= SNIPER_DELTA_INCERTAIN:
            return {'email': email, 'statut': 'Incertain', 'confiance': 50, 'methode': 'Sniper', 'detail': f'Delta moy: +{delta:.2f}s'}

        # Delta entre SNIPER_DELTA_NEGATIF et SNIPER_DELTA_INCERTAIN : signal trop faible
        return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'Sniper', 'detail': f'Delta insuffisant: {delta:.2f}s'}

    return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'Inconnu', 'detail': f'Code SMTP inattendu: {code_faux}'}
