import dns.resolver
import smtplib
import time
import socket
import random
import string
import requests
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

# ── Cache DNS (TTL 1h) ────────────────────────────────────────────────────────
_dns_cache: dict = {}
DNS_CACHE_TTL = 3600

# ── Cache Sniper par domaine (TTL 10 min) ─────────────────────────────────────
# { domaine: (duree_faux_ref, timestamp) }
_sniper_cache: dict = {}
SNIPER_CACHE_TTL = 600

resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
resolver.timeout = 2
resolver.lifetime = 2

SMTP_TIMEOUT           = 8
SNIPER_DELTA_VALIDE    = 0.5
SNIPER_DELTA_INCERTAIN = 0.2
# Seuil delta negatif abaisse a -0.4s pour absorber la variance warm-up TCP.
# Un delta entre -0.4s et 0 est un signal trop faible => Incertain.
# En dessous de -0.4s : rejet interne avere => Invalide.
SNIPER_DELTA_NEGATIF   = -0.4

MOTS_GENERIQUES = {
    'contact', 'info', 'hello', 'bonjour', 'admin',
    'support', 'webmaster', 'direction', 'noreply', 'no-reply'
}

CODES_TEMPORAIRES = {421, 450, 451, 452}
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
            return None
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


def _ping_smtp_dual(serveur_mx: str, email_cible: str, domaine: str) -> tuple:
    """
    FIX warm-up TCP : mesure faux ET vrai dans la MEME session SMTP ouverte a froid.
    On envoie d'abord RCPT TO faux (pour absorber le warm-up), puis RCPT TO vrai
    dans la meme connexion. Les deux mesures sont donc sur le meme plan thermique.
    Retourne (code_faux, duree_faux, code_vrai, duree_vrai, erreur).
    """
    faux_email = generer_faux_email(domaine)
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_ping_dual_interne, serveur_mx, faux_email, email_cible)
            return future.result(timeout=SMTP_TIMEOUT * 2 + 2)
    except (FuturesTimeout, Exception) as e:
        return None, None, None, None, str(e)


def _ping_dual_interne(serveur_mx: str, faux_email: str, email_cible: str) -> tuple:
    """Ouvre une connexion SMTP et mesure successivement faux puis vrai."""
    try:
        serveur = smtplib.SMTP(timeout=SMTP_TIMEOUT)
        serveur.connect(serveur_mx)
        serveur.helo('verify.rovial.fr')
        serveur.mail('noreply@rovial.fr')

        # Mesure faux
        t0 = time.perf_counter()
        code_faux, _ = serveur.rcpt(faux_email)
        duree_faux = time.perf_counter() - t0

        # RSET pour remettre la session en etat MAIL (certains serveurs l'exigent)
        try:
            serveur.rset()
            serveur.mail('noreply@rovial.fr')
        except Exception:
            pass

        # Mesure vrai
        t1 = time.perf_counter()
        code_vrai, _ = serveur.rcpt(email_cible)
        duree_vrai = time.perf_counter() - t1

        try:
            serveur.quit()
        except Exception:
            pass

        return code_faux, duree_faux, code_vrai, duree_vrai, "OK"

    except smtplib.SMTPConnectError as e:
        return None, None, None, None, f"Connexion refusee: {e}"
    except smtplib.SMTPServerDisconnected as e:
        return None, None, None, None, f"Deconnexion: {e}"
    except socket.timeout:
        return None, None, None, None, "Timeout SMTP"
    except Exception as e:
        return None, None, None, None, str(e)


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

    # Etape 1 : DNS/MX
    serveur_mx, erreur_dns = obtenir_serveur_mx(domaine)
    if not serveur_mx:
        return {'email': email, 'statut': 'Erreur', 'confiance': 0, 'methode': 'DNS', 'detail': erreur_dns}

    # Etape 2 : API Microsoft
    if 'protection.outlook.com' in serveur_mx.lower() or 'outlook' in serveur_mx.lower():
        resultat_api = verifier_via_api_microsoft(email)
        if resultat_api is True:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'API Microsoft', 'detail': 'Compte confirme'}

    # Etape 3 : Ping simple pour detecter le comportement du serveur (catch-all ou non)
    # On fait un seul ping faux pour savoir le code retourne
    faux_email_sonde = generer_faux_email(domaine)
    code_sonde, _, err_sonde = ping_smtp_rapide(serveur_mx, faux_email_sonde)

    if code_sonde is None:
        return {'email': email, 'statut': 'Incertain', 'confiance': 30, 'methode': 'SMTP', 'detail': f'Serveur inaccessible ou trop lent: {err_sonde}'}

    # Codes temporaires
    if code_sonde in CODES_TEMPORAIRES:
        return {'email': email, 'statut': 'Incertain', 'confiance': 70, 'methode': 'SMTP', 'detail': f'Code temporaire {code_sonde} (greylisting / surcharge serveur)'}

    # Serveur rejette les inconnus => pas catch-all => test direct classique
    if code_sonde in CODES_REJET:
        code_vrai, _, _ = ping_smtp_rapide(serveur_mx, email)
        if code_vrai == 250:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'SMTP Classique', 'detail': f'RCPT TO 250 (faux={code_sonde})'}
        if code_vrai in CODES_REJET:
            return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'SMTP Classique', 'detail': f'RCPT TO rejete ({code_vrai})'}
        if code_vrai == 554:
            return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'SMTP Classique', 'detail': 'Rejet permanent 554'}
        return {'email': email, 'statut': 'Incertain', 'confiance': 40, 'methode': 'SMTP Classique', 'detail': f'Code inattendu: {code_vrai}'}

    # Etape 4 : Catch-all detecte (code_sonde == 250)
    # On utilise le ping DUAL dans la meme session pour eliminer le biais warm-up TCP
    if code_sonde == 250:
        code_faux, duree_faux, code_vrai, duree_vrai, err_dual = _ping_smtp_dual(serveur_mx, email, domaine)

        if code_faux is None or duree_faux is None:
            return {'email': email, 'statut': 'Incertain', 'confiance': 20, 'methode': 'SMTP Sniper', 'detail': f'Session dual echouee: {err_dual}'}

        # Mise en cache de duree_faux pour le bulk (protection anti-blacklist)
        _sniper_cache[domaine] = (duree_faux, time.time())

        if code_vrai is None or duree_vrai is None:
            return {'email': email, 'statut': 'Incertain', 'confiance': 20, 'methode': 'SMTP Sniper', 'detail': 'Ping vrai echoue dans session dual'}

        delta = duree_vrai - duree_faux

        # Delta tres negatif : rejet interne avere MEME dans la meme session
        if delta <= SNIPER_DELTA_NEGATIF:
            return {
                'email': email,
                'statut': 'Invalide',
                'confiance': 0,
                'methode': 'Sniper',
                'detail': f'Delta negatif fort ({delta:.3f}s) : rejet interne serveur'
            }

        # Delta entre -0.4s et 0 : signal faible, on ne conclut pas Invalide
        if delta < 0:
            return {
                'email': email,
                'statut': 'Incertain',
                'confiance': 20,
                'methode': 'Sniper',
                'detail': f'Delta negatif faible ({delta:.3f}s) : variance reseau'
            }

        if delta >= SNIPER_DELTA_VALIDE:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 90, 'methode': 'Sniper', 'detail': f'Delta: +{delta:.3f}s'}

        if delta >= SNIPER_DELTA_INCERTAIN:
            return {'email': email, 'statut': 'Incertain', 'confiance': 50, 'methode': 'Sniper', 'detail': f'Delta: +{delta:.3f}s'}

        return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'Sniper', 'detail': f'Delta insuffisant: {delta:.3f}s'}

    return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'Inconnu', 'detail': f'Code SMTP inattendu: {code_sonde}'}
