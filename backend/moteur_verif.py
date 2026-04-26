import dns.resolver
import smtplib
import time
import socket
import random
import string
import requests

resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8']

MOTS_GENERIQUES = [
    'contact', 'info', 'hello', 'bonjour', 'admin',
    'support', 'webmaster', 'direction'
]


def generer_faux_email(domaine: str) -> str:
    """Génère un e-mail aléatoire sur le domaine cible pour détecter le catch-all."""
    aleatoire = ''.join(random.choice(string.ascii_lowercase) for _ in range(12))
    return f"test_{aleatoire}@{domaine}"


def obtenir_serveur_mx(domaine: str) -> tuple[str | None, str]:
    """Résout le serveur MX prioritaire du domaine."""
    try:
        enregistrements = resolver.resolve(domaine, 'MX')
        serveur_mx = str(enregistrements[0].exchange)
        return serveur_mx, "OK"
    except Exception as e:
        return None, str(e)


def verifier_via_api_microsoft(email: str) -> bool | None:
    """
    Interroge le point d'API public Microsoft GetCredentialType.
    Retourne True si le compte existe, False sinon, None en cas d'erreur.
    Note : cet endpoint est documenté publiquement par Microsoft.
    """
    url = "https://login.microsoftonline.com/common/GetCredentialType"
    try:
        reponse = requests.post(url, json={"Username": email}, timeout=3).json()
        if reponse.get("IfExistsResult") == 0:
            return True
        if reponse.get("IfExistsResult") == 1:
            return False
    except Exception:
        pass
    return None


def ping_smtp(serveur_mx: str, email_cible: str) -> tuple[int | None, float | None, str]:
    """
    Ouvre une connexion SMTP et teste la réception via RCPT TO.
    Retourne (code_retour, durée_rcpt, message_erreur).
    """
    try:
        serveur = smtplib.SMTP(timeout=5)
        serveur.connect(serveur_mx)
        serveur.helo(serveur.local_hostname)

        # Tentative VRFY (serveurs permissifs uniquement)
        code_vrfy, _ = serveur.docmd('VRFY', email_cible)
        if code_vrfy == 250:
            serveur.quit()
            return 250, 0.0, "VRFY OK"

        # Protocole RCPT standard
        serveur.mail('verif@rovial.fr')
        debut = time.perf_counter()
        code, message = serveur.rcpt(email_cible)
        duree = time.perf_counter() - debut
        serveur.quit()
        return code, duree, "OK"
    except Exception as e:
        return None, None, str(e)


def _marquer_generique(email: str, statut: str) -> str:
    """Ajoute un avertissement si le préfixe est un mot générique."""
    prefixe = email.split('@')[0]
    if prefixe in MOTS_GENERIQUES:
        return f"{statut} ⚠️ (Adresse générique)"
    return statut


def verifier_email(email_brut: str) -> dict:
    """
    Vérifie l'existence réseau d'un e-mail en cascade.

    Retourne un dictionnaire :
        {
          'email':      str,
          'statut':     'Valide' | 'Invalide' | 'Incertain' | 'Erreur',
          'confiance':  int (0-100),
          'methode':    str,
          'detail':     str
        }
    """
    if not isinstance(email_brut, str) or '@' not in email_brut:
        return {'email': email_brut, 'statut': 'Erreur', 'confiance': 0, 'methode': 'Format', 'detail': 'Format invalide'}

    email = email_brut.strip().lower()
    domaine = email.split('@')[1]

    # — Étape 1 : DNS / MX —
    serveur_mx, erreur_dns = obtenir_serveur_mx(domaine)
    if not serveur_mx:
        return {'email': email, 'statut': 'Erreur', 'confiance': 0, 'methode': 'DNS', 'detail': erreur_dns}

    # — Étape 2 : API Microsoft (Outlook / Office 365) —
    if 'protection.outlook.com' in serveur_mx.lower():
        resultat_api = verifier_via_api_microsoft(email)
        if resultat_api is True:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'API Microsoft', 'detail': 'Compte confirmé'}
        if resultat_api is False:
            return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'API Microsoft', 'detail': 'Compte inexistant'}

    # — Étape 3 : Détection Catch-All —
    faux_email = generer_faux_email(domaine)
    code_faux, duree_faux, err_smtp = ping_smtp(serveur_mx, faux_email)

    if code_faux is None:
        return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'SMTP', 'detail': f'Serveur inaccessible : {err_smtp}'}

    if code_faux in (450, 451, 421):
        return {'email': email, 'statut': 'Incertain', 'confiance': 80, 'methode': 'SMTP', 'detail': 'Greylisting détecté — réessayer plus tard'}

    if code_faux == 550:
        # Serveur classique : pas de catch-all
        code_vrai, _, _ = ping_smtp(serveur_mx, email)
        if code_vrai == 250:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 100, 'methode': 'SMTP Classique', 'detail': 'RCPT TO 250'}
        return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'SMTP Classique', 'detail': 'RCPT TO rejeté'}

    # — Étape 4 : Sniper (analyse de latence) —
    if code_faux == 250:
        code_vrai, duree_vrai, err2 = ping_smtp(serveur_mx, email)
        if duree_vrai is None:
            return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'SMTP Sniper', 'detail': f'Erreur : {err2}'}

        delta = duree_vrai - duree_faux
        if delta >= 0.4:
            s = _marquer_generique(email, 'Valide')
            return {'email': email, 'statut': s, 'confiance': 90, 'methode': 'Sniper', 'detail': f'Delta latence : +{delta:.2f}s'}
        if delta >= 0.15:
            return {'email': email, 'statut': 'Incertain', 'confiance': 50, 'methode': 'Sniper', 'detail': f'Delta latence : +{delta:.2f}s'}
        return {'email': email, 'statut': 'Invalide', 'confiance': 0, 'methode': 'Sniper', 'detail': f'Delta latence insuffisant : {delta:.2f}s'}

    return {'email': email, 'statut': 'Incertain', 'confiance': 0, 'methode': 'Inconnu', 'detail': f'Code SMTP inattendu : {code_faux}'}
