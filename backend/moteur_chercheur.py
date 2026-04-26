import unicodedata
import re
from typing import Optional


def normaliser(texte: str) -> str:
    """
    Normalise un texte : minuscules, suppression des accents et des
    caractères non-alphabétiques (tirets conservés).
    """
    if not isinstance(texte, str):
        return ''
    texte = texte.lower().strip()
    texte = unicodedata.normalize('NFKD', texte).encode('ASCII', 'ignore').decode()
    texte = re.sub(r'[^a-z-]', '', texte)
    return texte


def generer_patterns(prenom_brut: str, nom_brut: str, domaine_brut: str) -> list[str]:
    """
    Génère une liste ordonnée d'adresses e-mail probables,
    du pattern le plus courant au moins courant.

    Ordre statistique (B2B européen) :
        1. prenom.nom@         (thomas.dubois@)
        2. pnom@               (tdubois@)
        3. prenom@             (thomas@)
        4. p.nom@              (t.dubois@)
        5. prenomnom@          (thomasdubois@)
        6. nom.prenom@         (dubois.thomas@)
        7. nomp@               (duboiSt@)
    """
    prenom = normaliser(prenom_brut)
    nom    = normaliser(nom_brut)
    domaine = domaine_brut.lower().strip().lstrip('www.')

    if not prenom or not nom or not domaine:
        return []

    p0 = prenom[0]   # initiale prénom
    n0 = nom[0]      # initiale nom
    # Prénom sans tiret (pour les prénoms composés)
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
    le format de convention le plus utilisé.

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
            pass  # initiales seules, peu fiables
        elif len(prefixe) <= 8:
            compteurs['pnom'] += 1
        else:
            compteurs['prenom'] += 1

    if not any(compteurs.values()):
        return None

    return max(compteurs, key=lambda k: compteurs[k])
