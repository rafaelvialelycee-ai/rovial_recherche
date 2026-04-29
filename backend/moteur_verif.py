import dns.resolver
import smtplib
import time
import socket
import random
import string
import requests
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
import functools

# Cache DNS en memoire (evite de re-resoudre le meme domaine)
_dns_cache: dict = {}

resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
resolver.timeout = 2
resolver.lifetime = 2

SMTP_TIMEOUT = 3  # secondes max par connexion SMTP
SNIPER_DELTA_VALIDE = 0.3   # seuil valide (abaisse de 0.4 a 0.3)
SNIPER_DELTA_INCERTAIN = 0.1  # seuil incertain (abaisse de 0.15 a 0.1)

MOTS_GENERIQUES = {
    'contact', 'info', 'hello', 'bonjour', 'admin',
    'support', 'webmaster', 'direction', 'noreply', 'no-reply'
}


def generer_faux_email(domaine: str) -> str:
    aleatoire = ''.join(random.choice(string.ascii_lowercase) for _ in range(12))
    return f"test_{aleatoire}@{domaine}"


def obtenir_serveur_mx(domaine: str) -> tuple:
    if domaine in _dns_cache:
        return _dns_cache[domaine], "cache"
    try:
        enregistrements = resolver.resolve(domaine, 'MX')
        serveur_mx = str(sorted(enregistrements, key=lambda r: r.preference)[0].exchange)
        _dns_cache[domaine] = serveur_mx
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
            return False
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


def verifier_email(email_brut: str) -> dict:
    if not isinstance(email_brut, str) or '@' not in email_brut:
        return {'email': email_brut, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Format', 'detail': 'Format invalide'}

    email = email_brut.strip().lower()
    domaine = email.split('@')[1]

    # Etape 1: DNS/MX (avec cache)
    serveur_mx, erreur_dns = obtenir_serveur_mx(domaine)
    if not serveur_mx:
        return {'email': email, 'statut': 'Erreur', 'confiance': 0, 'methode': 'DNS', 'detail': erreur_dns}

    # Etape 2: API Microsoft rapide (Office 365 / Outlook)
    if 'protection.outlook.com' in serveur_mx.lower() or 'outlook' in serveur_mx.lower():
        resultat_api = verifier_via_api_microsoft(email)
        if resultat_api is True:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'API Microsoft', 'detail': 'Compte confirme'}
        if resultat_api is False:
            return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'API Microsoft', 'detail': 'Compte inexistant'}

    # Etape 3: Faux email pour detecter catch-all (avec timeout court)
    faux_email = generer_faux_email(domaine)
    code_faux, duree_faux, err_smtp = ping_smtp_rapide(serveur_mx, faux_email)

    if code_faux is None:
        # Serveur SMTP inaccessible ou trop lent -> Incertain sans bloquer
        return {'email': email, 'statut': 'Incertain', 'confiance': 30, 'methode': 'SMTP', 'detail': f'Serveur inaccessible ou trop lent: {err_smtp}'}

    if code_faux in (450, 451, 421):
        return {'email': email, 'statut': 'Incertain', 'confiance': 70, 'methode': 'SMTP', 'detail': 'Greylisting detecte'}

    if code_faux == 550:
        # Pas de catch-all -> test direct
        code_vrai, _, _ = ping_smtp_rapide(serveur_mx, email)
        if code_vrai == 250:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'SMTP Classique', 'detail': 'RCPT TO 250'}
        return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'SMTP Classique', 'detail': 'RCPT TO rejete'}

    # Etape 4: Sniper de latence (catch-all detecte)
    if code_faux == 250:
        code_vrai, duree_vrai, err2 = ping_smtp_rapide(serveur_mx, email)
        if duree_vrai is None:
            return {'email': email, 'statut': 'Incertain', 'confiance': 20, 'methode': 'SMTP Sniper', 'detail': f'Erreur: {err2}'}

        delta = duree_vrai - duree_faux
        if delta >= SNIPER_DELTA_VALIDE:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 90, 'methode': 'Sniper', 'detail': f'Delta: +{delta:.2f}s'}
        if delta >= SNIPER_DELTA_INCERTAIN:
            return {'email': email, 'statut': 'Incertain', 'confiance': 50, 'methode': 'Sniper', 'detail': f'Delta: +{delta:.2f}s'}
        return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'Sniper', 'detail': f'Delta insuffisant: {delta:.2f}s'}

    return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'Inconnu', 'detail': f'Code SMTP inattendu: {code_faux}'}
