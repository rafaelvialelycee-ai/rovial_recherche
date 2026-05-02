import dns.resolver
import smtplib
import time
import socket
import random
import string
import requests
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
import functools

# Cache DNS en memoire avec TTL (evite de re-resoudre le meme domaine indefiniment)
_dns_cache: dict = {}  # { domaine: (serveur_mx, timestamp) }
DNS_CACHE_TTL = 3600   # 1 heure

resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
resolver.timeout = 2
resolver.lifetime = 2

# FIX #2 — Seuils Sniper relevés pour compenser la latence réseau en production
SMTP_TIMEOUT = 6          # était 3s — augmenté pour prod Railway/Europe
SNIPER_DELTA_VALIDE    = 0.5   # était 0.3 — moins de faux positifs en prod
SNIPER_DELTA_INCERTAIN = 0.2   # était 0.1 — marge réseau suffisante

MOTS_GENERIQUES = {
    'contact', 'info', 'hello', 'bonjour', 'admin',
    'support', 'webmaster', 'direction', 'noreply', 'no-reply'
}


def generer_faux_email(domaine: str) -> str:
    aleatoire = ''.join(random.choice(string.ascii_lowercase) for _ in range(12))
    return f"test_{aleatoire}@{domaine}"


def obtenir_serveur_mx(domaine: str) -> tuple:
    # FIX #7 — Cache DNS avec TTL pour éviter les entrées obsolètes en prod longue durée
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
            # FIX #3 — Ne pas conclure "Invalide" ici : les tenants privés
            # renvoient 1 pour des comptes existants. On retourne None pour
            # laisser le SMTP trancher.
            return None
    except Exception:
        pass
    return None


def ping_smtp_rapide(serveur_mx: str, email_cible: str) -> tuple:
    """
    Connexion SMTP avec timeout court. Retourne (code, duree, erreur).
    """
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
    """
    FIX #2 — Moyenne de plusieurs pings SMTP pour réduire le bruit réseau.
    Retourne (duree_moyenne, dernier_code, erreur).
    """
    durees = []
    dernier_code = None
    for _ in range(essais):
        code, duree, err = ping_smtp_rapide(serveur_mx, email)
        if code is not None and duree is not None:
            durees.append(duree)
            dernier_code = code
    if not durees:
        return None, None, "Tous les pings ont échoué"
    return sum(durees) / len(durees), dernier_code, "OK"


def verifier_email(email_brut: str) -> dict:
    if not isinstance(email_brut, str) or '@' not in email_brut:
        return {'email': email_brut, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Format', 'detail': 'Format invalide'}

    email = email_brut.strip().lower()
    domaine = email.split('@')[1]

    # Etape 1: DNS/MX (avec cache TTL)
    serveur_mx, erreur_dns = obtenir_serveur_mx(domaine)
    if not serveur_mx:
        return {'email': email, 'statut': 'Erreur', 'confiance': 0, 'methode': 'DNS', 'detail': erreur_dns}

    # Etape 2: API Microsoft rapide (Office 365 / Outlook)
    # FIX #3 — code 1 ne retourne plus False mais None (SMTP tranche à la place)
    if 'protection.outlook.com' in serveur_mx.lower() or 'outlook' in serveur_mx.lower():
        resultat_api = verifier_via_api_microsoft(email)
        if resultat_api is True:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'API Microsoft', 'detail': 'Compte confirme'}
        # resultat_api is False ou None → on continue vers SMTP

    # Etape 3: Faux email pour detecter catch-all (avec timeout court)
    faux_email = generer_faux_email(domaine)
    code_faux, duree_faux, err_smtp = ping_smtp_rapide(serveur_mx, faux_email)

    if code_faux is None:
        return {'email': email, 'statut': 'Incertain', 'confiance': 30, 'methode': 'SMTP', 'detail': f'Serveur inaccessible ou trop lent: {err_smtp}'}

    if code_faux in (450, 451, 421):
        return {'email': email, 'statut': 'Incertain', 'confiance': 70, 'methode': 'SMTP', 'detail': 'Greylisting detecte'}

    if code_faux == 550:
        # Pas de catch-all → test direct
        code_vrai, _, _ = ping_smtp_rapide(serveur_mx, email)
        if code_vrai == 250:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'SMTP Classique', 'detail': 'RCPT TO 250'}
        return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'SMTP Classique', 'detail': 'RCPT TO rejete'}

    # Etape 4: Sniper de latence (catch-all detecte)
    # FIX #2 — Utiliser une moyenne de 2 pings pour réduire le bruit réseau en prod
    if code_faux == 250:
        duree_vrai_moy, code_vrai, err2 = _ping_smtp_moyenne(serveur_mx, email, essais=2)
        if duree_vrai_moy is None:
            return {'email': email, 'statut': 'Incertain', 'confiance': 20, 'methode': 'SMTP Sniper', 'detail': f'Erreur: {err2}'}

        delta = duree_vrai_moy - duree_faux
        if delta >= SNIPER_DELTA_VALIDE:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 90, 'methode': 'Sniper', 'detail': f'Delta moy: +{delta:.2f}s'}
        if delta >= SNIPER_DELTA_INCERTAIN:
            return {'email': email, 'statut': 'Incertain', 'confiance': 50, 'methode': 'Sniper', 'detail': f'Delta moy: +{delta:.2f}s'}
        return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'Sniper', 'detail': f'Delta insuffisant: {delta:.2f}s'}

    return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'Inconnu', 'detail': f'Code SMTP inattendu: {code_faux}'}
