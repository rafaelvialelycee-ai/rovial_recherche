import unicodedata
import re
import time
import random
from typing import Optional

try:
    import requests as _requests
    _REQUESTS_OK = True
except ImportError:
    _REQUESTS_OK = False


# ── Cache OSINT par domaine (TTL 24h) ─────────────────────────────────────────
# On ne scrape Google qu'une fois par domaine et par session
# { domaine: (format_dominant, timestamp) }
_osint_cache: dict = {}
OSINT_CACHE_TTL = 86400   # 24 heures

# Nombre d'emails LinkedIn a scraper max pour deduire le format
OSINT_MAX_RESULTS = 10
# Timeout HTTP pour le scrape OSINT (non bloquant)
OSINT_HTTP_TIMEOUT = 4


def normaliser(texte: str) -> str:
    """
    Normalise un texte : minuscules, suppression des accents et des
    caracteres non-alphabetiques (tirets conserves).
    """
    if not isinstance(texte, str):
        return ''
    texte = texte.lower().strip()
    texte = unicodedata.normalize('NFKD', texte).encode('ASCII', 'ignore').decode()
    texte = re.sub(r'[^a-z-]', '', texte)
    return texte


def generer_patterns(prenom_brut: str, nom_brut: str, domaine_brut: str) -> list[str]:
    """
    Genere une liste ordonnee d'adresses e-mail probables,
    du pattern le plus courant au moins courant.

    Ordre statistique (B2B europeen) :
        1. prenom.nom@         (thomas.dubois@)
        2. pnom@               (tdubois@)
        3. prenom@             (thomas@)
        4. p.nom@              (t.dubois@)
        5. prenomnom@          (thomasdubois@)
        6. nom.prenom@         (dubois.thomas@)
        7. nomp@               (duboiSt@)
    """
    prenom  = normaliser(prenom_brut)
    nom     = normaliser(nom_brut)
    domaine = domaine_brut.lower().strip().lstrip('www.')

    if not prenom or not nom or not domaine:
        return []

    p0 = prenom[0]
    prenom_simple = prenom.replace('-', '')

    return [
        f"{prenom}.{nom}@{domaine}",
        f"{p0}{nom}@{domaine}",
        f"{prenom}@{domaine}",
        f"{p0}.{nom}@{domaine}",
        f"{prenom_simple}{nom}@{domaine}",
        f"{nom}.{prenom}@{domaine}",
        f"{nom}{p0}@{domaine}",
    ]


def deduire_format_dominant(emails_connus: list[str]) -> Optional[str]:
    """
    Analyse une liste d'e-mails connus sur un domaine pour identifier
    le format de convention le plus utilise.
    Retourne l'un de : 'prenom.nom', 'pnom', 'prenom', 'p.nom' ou None.
    """
    compteurs: dict[str, int] = {
        'prenom.nom': 0,
        'pnom':       0,
        'prenom':     0,
        'p.nom':      0,
    }

    GENERIQUES = {'contact', 'info', 'hello', 'admin', 'support', 'presse', 'webmaster'}

    for email in emails_connus:
        if '@' not in email:
            continue
        prefixe = email.split('@')[0].lower()
        if prefixe in GENERIQUES:
            continue
        if '.' in prefixe:
            parties = prefixe.split('.')
            if len(parties[0]) == 1:
                compteurs['p.nom'] += 1
            else:
                compteurs['prenom.nom'] += 1
        elif len(prefixe) <= 2:
            pass
        elif len(prefixe) <= 8:
            compteurs['pnom'] += 1
        else:
            compteurs['prenom'] += 1

    if not any(compteurs.values()):
        return None
    return max(compteurs, key=lambda k: compteurs[k])


def _extraire_emails_du_texte(texte: str, domaine: str) -> list[str]:
    """
    Extrait les adresses email correspondant au domaine depuis un bloc de texte brut.
    """
    pattern = re.compile(
        r'[a-zA-Z0-9._%+\-]+@' + re.escape(domaine),
        re.IGNORECASE
    )
    return list(set(pattern.findall(texte)))


def _scrape_osint_google(domaine: str) -> list[str]:
    """
    Scrape leger Google (user-agent rotatif) pour trouver des emails
    @domaine indexes sur LinkedIn.
    Retourne une liste d'emails trouves (peut etre vide).
    IMPORTANT : non-bloquant, timeout court, echoue silencieusement.
    """
    if not _REQUESTS_OK:
        return []

    # Requete Google : on cherche des pages LinkedIn mentionnant @domaine
    query = f'site:linkedin.com "@{domaine}"'
    url = "https://www.google.com/search"
    params = {"q": query, "num": OSINT_MAX_RESULTS, "hl": "fr"}

    # Rotation basique de user-agents pour eviter le blocage immediat
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    ]
    headers = {
        "User-Agent": random.choice(user_agents),
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
    }

    try:
        resp = _requests.get(url, params=params, headers=headers, timeout=OSINT_HTTP_TIMEOUT)
        if resp.status_code != 200:
            return []
        return _extraire_emails_du_texte(resp.text, domaine)
    except Exception:
        return []


def detecter_format_dominant_osint(domaine: str) -> Optional[str]:
    """
    Tente de deduire le format email dominant d'un domaine via OSINT Google/LinkedIn.
    Utilise un cache 24h pour ne pas re-scraper le meme domaine.
    Echoue silencieusement : si OSINT ne trouve rien, retourne None
    et les 7 patterns statistiques classiques s'appliquent.
    """
    # Cache hit
    cached = _osint_cache.get(domaine)
    if cached and time.time() - cached[1] < OSINT_CACHE_TTL:
        return cached[0]

    emails_trouves = _scrape_osint_google(domaine)

    if not emails_trouves:
        # On cache None pour eviter de re-scraper en cas d'echec
        _osint_cache[domaine] = (None, time.time())
        return None

    format_dominant = deduire_format_dominant(emails_trouves)
    _osint_cache[domaine] = (format_dominant, time.time())
    return format_dominant
