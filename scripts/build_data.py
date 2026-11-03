"""Buduje src/data/baza.json z:
  1) data/baza_zlecenia.xlsx        – baza główna (wnioski opisane ręcznie, osoby, biura, rozmowy)
  2) data/powiaty/gunb_*.md         – surowe pliki od agenta, po jednym na powiat

Wnioski z plików .md są dopisywane, jeśli ich gunb_id nie ma jeszcze w bazie (xlsx ma pierwszeństwo).
Projektant z .md jest ujednolicany (dopasowanie do znanych osób po nr uprawnień / nazwisku).

Elektryk w zespole jest wyznaczany WYŁĄCZNIE z zapisu zespołu w GUNB (ręczne kolumny i role z xlsx są ignorowane):
  1. kod specjalności w nowych uprawnieniach: …/PWBE/…, …/POOE/… = elektryczna, …S/ = sanitarna, …K/ = konstrukcyjna,
  2. opis specjalności w zapisie („…elektrycznych”, „…sieci sanitarnych”, „konstrukcyjno-budowlana”),
  3. eliminacja dla starych uprawnień (np. „955/91”): zespół domu to zwykle konstruktor + sanitarny + elektryk.
     Dla każdego wniosku liczymy, której z tych ról brakuje po odjęciu osób o znanej specjalności, i zbieramy
     „głosy” dla osoby bez kodu. Kto w większości swoich zespołów (≥ 60% głosów) zajmuje miejsce elektryka,
     jest elektrykiem „wywnioskowanym” (elektryk_prawdopodobny). Kilka przebiegów – wnioski z jednego zespołu
     pomagają rozpoznać osoby w kolejnych.

Użycie: python3 -I scripts/build_data.py [--check]
  --check  porównuje automatyczne wyznaczanie elektryków z ręcznym opisem w xlsx (test parsera)
"""
import json, os, re, sys, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from xlsx2json import read_xlsx  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]  # katalog repozytorium
XLSX = ROOT / 'data' / 'baza_zlecenia.xlsx'
KONTAKTY = ROOT / 'data' / 'kontakty.csv'  # ręcznie/agentem zebrane kontakty do projektantów (separator ;)
MD_DIR = Path(os.environ.get('POWIATY_DIR', ROOT / 'data' / 'powiaty'))
OUT = Path(os.environ.get('BAZA_OUT', Path(__file__).resolve().parents[1] / 'src' / 'data' / 'baza.json'))

MD_COLS = ['gunb_id', 'powiat', 'nr_wniosku', 'stan', 'data_zlozenia', 'data_decyzji', 'miejscowosc',
           'kod_pocztowy', 'kubatura_m3', 'rodzaj_zamierzenia', 'zamierzenie', 'projektant_zapis',
           'nr_uprawnien', 'zespol_zapis', 'link']

# --- normalizacja ---------------------------------------------------------------------------------

def fold(s):
    s = unicodedata.normalize('NFKD', s.replace('ł', 'l').replace('Ł', 'L'))
    return ''.join(c for c in s if not unicodedata.combining(c)).lower()


def name_key(name):
    """Klucz niezależny od kolejności: 'Uram Jacek' == 'Jacek Uram'."""
    return ' '.join(sorted(re.findall(r'[a-z]+', fold(name or ''))))


def upr_key(nr):
    nr = re.sub(r'^\s*(upr\w*\.?\s*)?(nr\.?\s*)?', '', fold(nr or ''))  # „upr. nr B.P.IV-…” = „B.P.IV-…”
    return re.sub(r'[^0-9a-z]', '', nr)


RE_CAPS = re.compile(r'(?<![/\w])([A-ZĄĆĘŁŃÓŚŹŻ]{2,}(?:-[A-ZĄĆĘŁŃÓŚŹŻ]{2,})?)(?![/\w])')
# „NAZWISKO Imię” / „NAZWISKO imię” (np. powiat oleski) – nazwisko wielkimi przed imieniem
RE_CAPS_FIRST = re.compile(r'(?<![/\w])([A-ZĄĆĘŁŃÓŚŹŻ]{2,}(?:-[A-ZĄĆĘŁŃÓŚŹŻ]{2,})?)\s+'
                           r'([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż][a-ząćęłńóśźż]+)(?![/\w])')


def fix_case(s):
    """„Aneta MOSTOWSKA” → „Aneta Mostowska”; „DITTMANN Natalia” → „Natalia Dittmann”. Kody przy ukośnikach bez zmian."""
    if not s:
        return s
    cap = lambda t: '-'.join(p.capitalize() for p in t.split('-'))
    s = RE_CAPS_FIRST.sub(lambda m: f'{m.group(2).capitalize()} {cap(m.group(1))}', s)
    return RE_CAPS.sub(lambda m: cap(m.group(1)), s)


# Kod specjalności w nowych uprawnieniach: LOD/4121/PWBE/19, KUP/0090/POE/20, DOŚ/0478/PBE/19 …
RE_E_CODE = re.compile(r'\b[A-ZĄĆĘŁŃÓŚŹŻ]{2,4}\s*/\s*\d{2,5}\s*/\s*P[A-Z]{0,3}E\s*/\s*\d{2}\b')
RE_E_TEXT = re.compile(r'elektry|elektroenerget', re.I)
NAME_TOKEN = r'[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:-[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)?'
RE_NAME = re.compile(rf'(?<![/\w])({NAME_TOKEN})\s+({NAME_TOKEN})')
STOP = {'Nr', 'Upr', 'Bud', 'Specjalność', 'Decyzja', 'Uprawnień', 'Uprawnienia', 'Budowlanych', 'Stwierdzeniu'}


def split_people(zespol):
    """Dzieli „Pozostali projektanci” na fragmenty, każdy zaczyna się od imienia i nazwiska."""
    if not zespol or zespol.strip().lower() in ('brak', '-'):
        return []
    # „PAWEŁ ROSIAK, 955/91” → „Paweł Rosiak, 955/91” (kody uprawnień przy ukośnikach zostają bez zmian)
    zespol = fix_case(zespol)
    starts = [m for m in RE_NAME.finditer(zespol) if m.group(1) not in STOP and m.group(2) not in STOP]
    # odrzuć dopasowania wewnątrz opisu specjalności (np. „Nr. 937/90, - Jarosław …” jest OK, „Sieci Sanitarnych” nie)
    starts = [m for m in starts if not re.search(r'(specjalno|zakres|instalac|urządze|sieci)\S*\s*$', zespol[max(0, m.start() - 25):m.start()], re.I)]
    chunks = []
    for i, m in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(zespol)
        chunks.append((m.group(0), zespol[m.start():end]))
    return chunks


# Format „opisowy” (tabela z polskimi nagłówkami, np. gunb_wieruszowski.md) – kolumny rozpoznawane po nazwie
HDR_MAP = {
    'nr wniosku': 'nr_wniosku', 'stan': 'stan', 'data zlozenia': 'data_zlozenia', 'data decyzji': 'data_decyzji',
    'miejscowosc': 'miejscowosc', 'kubatura': 'kubatura_m3', 'kubatura m3': 'kubatura_m3', 'zamierzenie': 'zamierzenie',
    'glowny projektant': 'projektant_zapis', 'projektant': 'projektant_zapis', 'nr uprawnien': 'nr_uprawnien',
    'pozostali projektanci': 'zespol_zapis', 'link': 'link', 'rodzaj obiektu': 'rodzaj_obiektu',
}
RODZAJ = [('rozbudow', 'rozbudowa'), ('nadbudow', 'nadbudowa'), ('budowa nowego', 'budowa'), ('przebudow', 'przebudowa')]
RE_UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')


def header_key(cell):
    return re.sub(r'[^a-z0-9 ]', '', fold(cell)).strip()


def row_from_named(r):
    """Ujednolica wiersz z tabeli opisowej do pól MD_COLS."""
    r = {k: (None if v is None or fold(v) in ('', 'brak', '-', '- -', '—') else v) for k, v in r.items()}
    if r.get('link'):
        m = RE_UUID.search(r['link'])
        r['gunb_id'] = m.group(0) if m else None
    if r.get('miejscowosc'):
        m = re.match(r'^(.*?)\s*\((\d{2}-\d{3})\)\s*$', r['miejscowosc'])
        if m:
            r['miejscowosc'], r['kod_pocztowy'] = m.group(1), m.group(2)
    if r.get('zamierzenie'):
        m = re.match(r'^(.*)\s*\(([^()]*obiekt[^()]*|wykonanie robót[^()]*)\)\s*$', r['zamierzenie'])
        if m:
            r['zamierzenie'] = m.group(1).strip()
            low = fold(m.group(2))
            r['rodzaj_zamierzenia'] = next((v for k, v in RODZAJ if k in low), 'inne')
    if r.get('nr_wniosku'):
        r['nr_wniosku'] = re.sub(r'^As\.', 'AS.', r['nr_wniosku'])
    return r


def load_md(path):
    """Czyta plik od agenta. Obsługuje dwa formaty:
    a) tabela z kolumnami MD_COLS (gunb_id | powiat | …),
    b) opisowy: sekcja „Tabela wniosków” z polskimi nagłówkami (Nr wniosku, Stan, …, Link) oraz
       opcjonalna tabela „Wnioski pominięte”; pozostałe tabele (zestawienia) są pomijane."""
    meta = {'plik': path.name, 'pominiete': []}
    rows, warnings = [], []
    lines = path.read_text(encoding='utf-8').splitlines()
    in_skipped = False
    section = ''        # fold() ostatniego nagłówka „## …”
    header = None       # lista pól dla bieżącej tabeli opisowej (None = format MD_COLS albo tabela ignorowana)
    table_kind = None   # 'cols' | 'named' | 'skipped' | 'ignore'
    for ln in lines:
        s = ln.strip()
        low = fold(s)
        if not s.startswith('|'):
            table_kind = None
            if s.startswith('#'):
                section = low
                m = re.search(r'powiat\s+([a-ząćęłńóśźż]+)', s, re.I)
                if s.startswith('# ') and m and not meta.get('powiat'):
                    meta['powiat'] = m.group(1).lower()
            if 'zakres' in low and re.search(r'\d{4}-\d{2}-\d{2}', s) and 'zakres_od' not in meta:
                d = re.findall(r'\d{4}-\d{2}-\d{2}', s)
                meta['zakres_od'], meta['zakres_do'] = d[0], (d[1] if len(d) > 1 else d[0])
            elif 'data pobrania' in low or ('pobrano' in low and 'data_pobrania' not in meta):
                # „Data pobrania danych: …” ma pierwszeństwo; „pobrano” w uwagach (np. „pobrano dwa wyszukiwania:
                # 2026-01-01–…”) to zakres wyszukiwania, nie data pobrania – nie może jej nadpisać
                d = re.findall(r'\d{4}-\d{2}-\d{2}', s)
                if d and ('data pobrania' in low or 'data_pobrania' not in meta):
                    meta['data_pobrania'] = d[0]
            elif re.match(r'^\W*liczba', low) and re.search(r'\d+', s):
                meta['liczba_deklarowana'] = int(re.search(r'\d+', s.split(':')[-1] or s).group())
            if s.startswith('#'):
                in_skipped = False
                continue
            if 'pomini' in low and not s.startswith('-'):
                in_skipped = True
                rest = s.split(':', 1)[1].strip() if ':' in s else ''
                if rest and fold(rest) not in ('brak', 'brak.', '-', 'nie', '0'):
                    meta['pominiete'].append(rest)
                continue
            if in_skipped and re.match(r'^[-*]\s+', s):
                meta['pominiete'].append(re.sub(r'^[-*]\s+', '', s))
            elif s:
                in_skipped = False
            continue
        cells = [c.strip() for c in s.strip('|').split('|')]
        if set(s) <= set('|-: '):
            continue
        if table_kind is None:  # pierwszy wiersz tabeli = nagłówek
            keys = [header_key(c) for c in cells]
            if cells[0] == 'gunb_id':
                table_kind = 'cols'
                continue
            if 'link' in keys and 'nr wniosku' in keys:
                header = [HDR_MAP.get(k) for k in keys]
                table_kind = 'skipped' if 'pomini' in section else 'named'
                continue
            if keys and keys[0] in ('czesc', 'okres'):
                table_kind = 'ignore'  # tabela podsumowania zakresu – bierzemy z niej tylko „razem”
                continue
            if 'gunb_id' not in s and len(cells) != len(MD_COLS):
                table_kind = 'ignore'
                continue
            table_kind = 'cols'  # tabela MD_COLS bez nagłówka
        if table_kind == 'ignore':
            # tabela podsumowania („Część/Okres | Zakres daty złożenia | …”): zakres = od najwcześniejszej do najpóźniejszej daty
            d = re.findall(r'\d{4}-\d{2}-\d{2}', cells[1]) if len(cells) > 1 else []
            if len(d) >= 2:
                t = meta.setdefault('_zakres_tab', [d[0], d[1]])
                t[0], t[1] = min(t[0], d[0]), max(t[1], d[1])
            if fold(cells[0]) == 'razem':
                m = re.search(r'\*\*(\d+)\*\*', cells[-1]) or re.search(r'\d+', cells[-1])
                if m:
                    meta['liczba_deklarowana'] = int(m.group(1) if m.re.groups else m.group(0))
            continue
        if table_kind in ('named', 'skipped'):
            if len(cells) != len(header):
                warnings.append(f'{path.name}: wiersz ma {len(cells)} kolumn zamiast {len(header)} – pominięty: {s[:80]}…')
                continue
            r = row_from_named({k: v for k, v in zip(header, cells) if k})
            if table_kind == 'skipped':
                opis = ' – '.join(x for x in (r.get('nr_wniosku'), r.get('rodzaj_obiektu'), r.get('zamierzenie')) if x)
                meta['pominiete'].append(opis + (f" ({r['projektant_zapis']})" if r.get('projektant_zapis') else ''))
                continue
            r = {k: r.get(k) for k in MD_COLS}
        else:
            if len(cells) != len(MD_COLS):
                warnings.append(f'{path.name}: wiersz ma {len(cells)} kolumn zamiast {len(MD_COLS)} – pominięty: {s[:80]}…')
                continue
            r = {k: (v if v not in ('', '—', '-') else None) for k, v in zip(MD_COLS, cells)}
        if not r['gunb_id']:
            continue
        r['gunb_id'] = r['gunb_id'].strip('/')
        if r['kubatura_m3'] and isinstance(r['kubatura_m3'], str):
            try:
                r['kubatura_m3'] = float(r['kubatura_m3'].replace(',', '.').replace(' ', ''))
                if r['kubatura_m3'].is_integer():
                    r['kubatura_m3'] = int(r['kubatura_m3'])
            except ValueError:
                pass
        rows.append(r)
    t = meta.pop('_zakres_tab', None)
    if t and 'zakres_od' not in meta:  # brak linii „Zakres: …” → zakres z tabeli podsumowania
        meta['zakres_od'], meta['zakres_do'] = t
    return meta, rows, warnings


# --- wyznaczanie projektanta i elektryka ----------------------------------------------------------

class People:
    def __init__(self, wnioski, osoby):
        self.by_name, self.by_upr = {}, {}
        for w in wnioski:
            if w.get('projektant') and w['projektant'] != '(nie wpisano)':
                self.by_name.setdefault(name_key(w['projektant']), w['projektant'])
                if w.get('nr_uprawnien'):
                    self.by_upr.setdefault(upr_key(w['nr_uprawnien']), w['projektant'])
        for o in osoby:  # tylko do ujednolicenia zapisu nazwisk
            n = o.get('imie_nazwisko')
            if n:
                self.by_name.setdefault(name_key(n), n)

    def canonical(self, name, upr=None):
        if upr and upr_key(upr) in self.by_upr:
            return self.by_upr[upr_key(upr)]
        k = name_key(name)
        if k in self.by_name:
            return self.by_name[k]
        # nieznana osoba: zapis „Nazwisko Imię” zostawiamy jak jest, ale rejestrujemy, żeby kolejne zapisy się łączyły
        clean = re.sub(r'\s+', ' ', re.sub(r'(?<!\w)(mgr|inż|arch|dr|tech|bud)\.?(?!\w)|,', ' ', fix_case(name) or '', flags=re.I)).strip()
        self.by_name[k] = clean
        if upr:
            self.by_upr[upr_key(upr)] = clean
        return clean



# --- specjalności w zespole: kod uprawnień → opis → eliminacja ---------------------------------------

RE_CODE = re.compile(r'\b[A-ZĄĆĘŁŃÓŚŹŻ]{2,4}\s*/\s*\d{2,5}\s*/\s*([A-Za-z]{2,6})\s*/\s*\d{2}\b'
                     # starsza kolejność: ŁOD/IE/3664/03, OPL/IS/1563/01 (specjalność przed numerem)
                     r'|\b[A-ZĄĆĘŁŃÓŚŹŻ]{2,4}\s*/\s*([A-Za-z]{2,6})\s*/\s*\d{2,5}\s*/\s*\d{2}\b')
ROLE_TXT = [
    ('E', re.compile(r'elektry|elektroenerget', re.I)),
    ('S', re.compile(r'sanitar|ciepln|wentyl|gazow|wodoci|kanaliz', re.I)),
    ('K', re.compile(r'konstrukc', re.I)),
]
RE_INST_INZ = re.compile(r'instalacyjno\s*-?\s*in[zż]ynieryjn', re.I)  # stara specjalność: sanitarna LUB elektryczna
ROLES = ('K', 'S', 'E')
PROG_ELIMINACJI = 0.6


def code_role(token):
    t = token.upper()
    if t.endswith('KB') or t.endswith('K'):
        return 'K'
    for r in ('S', 'E', 'A'):
        if t.endswith(r):
            return r
    return None


def chunk_role(chunk):
    """Rola osoby wprost z jej fragmentu zapisu: ('E', 'kod LOD/4121/PWBE/19') albo (None, None)."""
    for m in RE_CODE.finditer(chunk):
        r = code_role(m.group(1) or m.group(2))
        if r:
            return r, 'kod ' + re.sub(r'\s', '', m.group(0))
    for role, rx in ROLE_TXT:
        if rx.search(chunk):
            return role, 'opis specjalności'
    return None, None


def assign_electricians(wnioski, people):
    """Ustawia elektryk_pewny / elektryk_prawdopodobny oraz sanitarny / sanitarny_pewnosc we wszystkich wnioskach;
    zwraca (lista elektryków, lista sanitarnych)."""
    from collections import Counter, defaultdict
    teams, explicit, basis, constraint, display = [], defaultdict(Counter), {}, defaultdict(set), {}
    for w in wnioski:
        team = []
        for name, chunk in split_people(w.get('zespol_zapis')):
            k = name_key(name)
            if not k or k in team:
                continue
            display.setdefault(k, people.by_name.get(k) or name)
            role, why = chunk_role(chunk)
            if role:
                explicit[k][role] += 1
                basis.setdefault((k, role), why)
            elif RE_INST_INZ.search(chunk):
                constraint[k] |= {'S', 'E'}
            team.append(k)
        teams.append(team)

    known = {k: c.most_common(1)[0][0] for k, c in explicit.items()}
    inferred, votes = {}, {}
    for _ in range(4):
        role_of = lambda k: known.get(k) or inferred.get(k)
        votes = defaultdict(Counter)
        for team in teams:
            for u in team:
                if u in known:
                    continue
                others = {role_of(o) for o in team if o != u and role_of(o)}
                missing = set(ROLES) - others
                allowed = (missing & constraint[u]) if constraint[u] else missing
                if not allowed:
                    votes[u]['?'] += 1
                    continue
                for r in allowed:
                    votes[u][r] += 1 / len(allowed)
        new = {}
        for u, v in votes.items():
            total = sum(v.values())
            best = max(ROLES, key=lambda r: v[r])
            if total >= 1 and v[best] / total >= PROG_ELIMINACJI:
                new[u] = best
        if new == inferred:
            break
        inferred = new

    for w, team in zip(wnioski, teams):
        pewny = next((display[k] for k in team if known.get(k) == 'E'), None)
        prawd = None if pewny else next((display[k] for k in team if inferred.get(k) == 'E'), None)
        w['elektryk_pewny'], w['elektryk_prawdopodobny'] = pewny, prawd
        san = next((k for k in team if known.get(k) == 'S'), None) or next((k for k in team if inferred.get(k) == 'S'), None)
        w['sanitarny'] = display[san] if san else None
        w['sanitarny_pewnosc'] = (('pewny' if known.get(san) == 'S' else 'wywnioskowany') if san else None)
        # Czy „brak elektryka” jest wiarygodny? Tylko gdy urząd wpisał branżystów (konstruktor / sanitarny),
        # a elektryka wśród nich nie ma. Pusty zespół albo sam współautor-architekt = nie wiadomo
        # (niektóre starostwa, np. wieruszowskie, wpisują tylko głównego projektanta).
        if pewny or prawd:
            w['zespol_status'] = 'elektryk'
        elif any((known.get(k) or inferred.get(k)) in ('K', 'S') for k in team):
            w['zespol_status'] = 'bez_elektryka'
        else:
            w['zespol_status'] = 'nieznany'

    count = Counter(k for t in teams for k in t)
    opis = {'E': ('elektryka', 'konstruktora/sanitarnego', 'elektryka'), 'S': ('sanitarnego', 'konstruktora/elektryka', 'sanitarnego')}

    def lista(role):
        out = []
        for k, r in known.items():
            if r == role:
                out.append({'osoba': display[k], 'pewnosc': 'pewny', 'podstawa': basis[(k, role)], 'wnioski': count[k]})
        for k, r in inferred.items():
            if r == role:
                v = votes[k]
                tot = sum(v.values())
                miejsce, obok, inny = opis[role]
                out.append({'osoba': display[k], 'pewnosc': 'wywnioskowany', 'wnioski': count[k],
                            'podstawa': f'stare uprawnienia; w {round(100 * v[role] / tot)}% swoich zespołów zajmuje miejsce {miejsce} '
                                        f'(obok {obok}, bez innego {inny})'})
        return sorted(out, key=lambda e: -e['wnioski'])

    return lista('E'), lista('S')


# --- kontakty -----------------------------------------------------------------------------------

def merge_contacts(data, people, warnings):
    """Dopisuje do kart „osoby” kontakty z data/kontakty.csv (telefon, e-mail, www, firma, adres, źródło).
    Pola wypełnione w xlsx mają pierwszeństwo; brakującą osobę zakłada jako projektanta głównego."""
    import csv
    if not KONTAKTY.exists():
        return
    by_key = {name_key(o.get('imie_nazwisko')): o for o in data['osoby'] if o.get('imie_nazwisko')}
    with KONTAKTY.open(encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f, delimiter=';'):
            row = {k: (v or '').strip() or None for k, v in row.items() if k}
            if not row.get('projektant'):
                continue
            name = people.canonical(row['projektant'])
            o = by_key.get(name_key(name))
            if o is None:
                o = {'osoba_id': re.sub(r'[^a-z0-9]+', '-', fold(name)).strip('-'), 'imie_nazwisko': name,
                     'rola': 'projektant główny'}
                data['osoby'].append(o)
                by_key[name_key(name)] = o
            for k in ('firma', 'telefon', 'email', 'www', 'adres'):
                if row.get(k) and not o.get(k):
                    o[k] = row[k]
            if row.get('zrodlo'):
                o['zrodlo_kontaktu'] = o.get('zrodlo_kontaktu') or row['zrodlo']
            o['pewnosc_kontaktu'] = row.get('pewnosc')
            if row.get('pewnosc') == 'niepewne':
                o['uwagi_kontakt'] = row.get('zrodlo')


# --- główny przebieg -----------------------------------------------------------------------------

def main():
    check = '--check' in sys.argv
    data = read_xlsx(XLSX)
    wnioski = data['wnioski']
    people = People(wnioski, data['osoby'])

    if check:
        import copy
        auto = copy.deepcopy(wnioski)
        assign_electricians(auto, people)
        ok = bad = 0
        for w, a in zip(wnioski, auto):
            p, pr = a['elektryk_pewny'], a['elektryk_prawdopodobny']
            exp = (w.get('elektryk_pewny'), w.get('elektryk_prawdopodobny'))
            if (p or pr) == (exp[0] or exp[1]):
                ok += 1
            else:
                bad += 1
                print(f'RÓŻNICA {w["nr_wniosku"]}: auto={p, pr} ręcznie={exp}\n   {w.get("zespol_zapis")}')
        print(f'zgodnych {ok}/{ok + bad}')
        return

    for w in wnioski:
        w['zrodlo'] = 'xlsx'
    known = {w['gunb_id'] for w in wnioski}
    src_powiat = {}
    for w in wnioski:
        src_powiat.setdefault(w.get('powiat'), w.get('data_pobrania'))

    powiaty_meta, warnings = {}, []
    md_files = sorted(MD_DIR.glob('gunb_*.md')) if MD_DIR.exists() else []
    for f in md_files:
        meta, rows, warn = load_md(f)
        warnings += warn
        added = dup = 0
        for r in rows:
            if r['gunb_id'] in known:
                dup += 1
                continue
            known.add(r['gunb_id'])
            r['powiat'] = r.get('powiat') or meta.get('powiat') or f.stem.replace('gunb_', '')
            r['projektant'] = people.canonical(r.get('projektant_zapis'), r.get('nr_uprawnien')) if r.get('projektant_zapis') else '(nie wpisano)'
            r['data_pobrania'] = meta.get('data_pobrania')
            r['zrodlo'] = f.name
            wnioski.append(r)
            added += 1
        for p in {r['powiat'] for r in rows if r.get('powiat')} or {meta.get('powiat') or f.stem.replace('gunb_', '')}:
            m = powiaty_meta.setdefault(p, {'powiat': p, 'pliki': [], 'pominiete': []})
            m['pliki'].append(f.name)
            m['pominiete'] += meta['pominiete']
            for k in ('zakres_od', 'zakres_do', 'data_pobrania', 'liczba_deklarowana'):
                if meta.get(k):
                    m[k] = meta[k]
        if meta.get('liczba_deklarowana') is not None and meta['liczba_deklarowana'] != len(rows):
            warnings.append(f'{f.name}: nagłówek mówi {meta["liczba_deklarowana"]} wniosków, w tabeli jest {len(rows)}')
        print(f'{f.name}: {len(rows)} wierszy, dopisano {added}, już w bazie {dup}')

    # metadane powiatów z xlsx (źródło w karcie info)
    info = data.get('info', {}).get('Źródło') or ''
    for p, dp in src_powiat.items():
        if not p:
            continue
        m = powiaty_meta.setdefault(p, {'powiat': p, 'pliki': [], 'pominiete': []})
        m.setdefault('data_pobrania', dp)
        d = re.findall(r'\d{4}-\d{2}-\d{2}', info)
        if len(d) >= 2 and p.lower()[:5] in fold(info):
            m.setdefault('zakres_od', d[0])
            m.setdefault('zakres_do', d[1])
        if 'baza_zlecenia.xlsx' not in m['pliki']:
            m['pliki'].insert(0, 'baza_zlecenia.xlsx')
    data['elektrycy'], data['sanitarni'] = assign_electricians(wnioski, people)
    merge_contacts(data, people, warnings)
    for p, m in powiaty_meta.items():
        lista = [w for w in wnioski if w.get('powiat') == p]
        m['wnioski'] = len(lista)
        z_proj = [w for w in lista if w.get('projektant') and w['projektant'] != '(nie wpisano)']
        znane = sum(1 for w in z_proj if w['zespol_status'] != 'nieznany')
        # jaka część wniosków ma zespół wpisany na tyle pełno, że wiadomo, czy jest elektryk
        m['pelnosc_zespolow'] = round(znane / len(z_proj), 3) if z_proj else None
        if z_proj and znane / len(z_proj) < 0.5:
            warnings.append(f'powiat {p}: tylko {znane} z {len(z_proj)} wniosków ma wpisanych branżystów – '
                            f'brak elektryka w zespole NIE oznacza tu wolnego miejsca (traktowane jako „nie wiadomo”)')
    data['powiaty'] = sorted(powiaty_meta.values(), key=lambda m: m['powiat'])
    data['ostrzezenia'] = warnings
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    print('powiaty: ' + ', '.join(f'{m["powiat"]} ({m["wnioski"]})' for m in data['powiaty']))
    print(f'razem wniosków: {len(wnioski)} → {OUT}')
    for w in warnings:
        print('UWAGA:', w)


if __name__ == '__main__':
    main()
