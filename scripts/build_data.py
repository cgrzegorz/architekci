"""Buduje src/data/baza.json z:
  1) data/baza_zlecenia.xlsx        – baza główna (wnioski opisane ręcznie, osoby, biura, rozmowy)
  2) data/powiaty/gunb_*.md         – surowe pliki od agenta, po jednym na powiat

Wnioski z plików .md są dopisywane, jeśli ich gunb_id nie ma jeszcze w bazie (xlsx ma pierwszeństwo).
Dla nich skrypt sam wyznacza:
  - projektant          – ujednolicone imię i nazwisko (dopasowanie do znanych osób po nr uprawnień / nazwisku)
  - elektryk_pewny      – osoba z zespołu z uprawnieniami elektrycznymi (kod …E/ w numerze lub opis specjalności)
  - elektryk_prawdopodobny – znany z bazy elektryk ze starymi uprawnieniami (instalacyjno-inżynieryjne)

Użycie: python3 -I scripts/build_data.py [--check]
  --check  porównuje automatyczne wyznaczanie elektryków z ręcznym opisem w xlsx (test parsera)
"""
import json, os, re, sys, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from xlsx2json import read_xlsx  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]  # katalog repozytorium
XLSX = ROOT / 'data' / 'baza_zlecenia.xlsx'
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
    return re.sub(r'[^0-9a-z]', '', fold(nr or ''))


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
    zespol = re.sub(r'(?<![/\w])([A-ZĄĆĘŁŃÓŚŹŻ]{2,}(?:-[A-ZĄĆĘŁŃÓŚŹŻ]{2,})?)(?![/\w])',
                    lambda m: '-'.join(p.capitalize() for p in m.group(1).split('-')), zespol)
    starts = [m for m in RE_NAME.finditer(zespol) if m.group(1) not in STOP and m.group(2) not in STOP]
    # odrzuć dopasowania wewnątrz opisu specjalności (np. „Nr. 937/90, - Jarosław …” jest OK, „Sieci Sanitarnych” nie)
    starts = [m for m in starts if not re.search(r'(specjalno|zakres|instalac|urządze|sieci)\S*\s*$', zespol[max(0, m.start() - 25):m.start()], re.I)]
    chunks = []
    for i, m in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(zespol)
        chunks.append((m.group(0), zespol[m.start():end]))
    return chunks


def load_md(path):
    meta = {'plik': path.name, 'pominiete': []}
    rows, warnings = [], []
    lines = path.read_text(encoding='utf-8').splitlines()
    in_skipped = False
    for ln in lines:
        s = ln.strip()
        low = fold(s)
        if not s.startswith('|'):
            if 'zakres' in low and re.search(r'\d{4}-\d{2}-\d{2}', s):
                d = re.findall(r'\d{4}-\d{2}-\d{2}', s)
                meta['zakres_od'], meta['zakres_do'] = d[0], d[-1]
            elif 'data pobrania' in low or 'pobrano' in low:
                d = re.findall(r'\d{4}-\d{2}-\d{2}', s)
                if d:
                    meta['data_pobrania'] = d[0]
            elif 'liczba' in low and re.search(r'\d+', s):
                meta['liczba_deklarowana'] = int(re.search(r'\d+', s.split(':')[-1] or s).group())
            if 'pomini' in low:
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
        if cells[0] in ('gunb_id',) or set(s) <= set('|-: '):
            continue
        if len(cells) != len(MD_COLS):
            warnings.append(f'{path.name}: wiersz ma {len(cells)} kolumn zamiast {len(MD_COLS)} – pominięty: {s[:80]}…')
            continue
        r = {k: (v if v not in ('', '—', '-') else None) for k, v in zip(MD_COLS, cells)}
        if not r['gunb_id']:
            continue
        r['gunb_id'] = r['gunb_id'].strip('/')
        if r['kubatura_m3']:
            try:
                r['kubatura_m3'] = float(r['kubatura_m3'].replace(',', '.').replace(' ', ''))
                if r['kubatura_m3'].is_integer():
                    r['kubatura_m3'] = int(r['kubatura_m3'])
            except ValueError:
                pass
        rows.append(r)
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
        self.el_pewni, self.el_prawdop = {}, {}
        for o in osoby:
            n = o.get('imie_nazwisko')
            if not n:
                continue
            self.by_name.setdefault(name_key(n), n)
            if o.get('rola') == 'elektryk':
                (self.el_pewni if o.get('pewnosc_specjalnosci') == 'pewne' else self.el_prawdop)[name_key(n)] = n

    def canonical(self, name, upr=None):
        if upr and upr_key(upr) in self.by_upr:
            return self.by_upr[upr_key(upr)]
        k = name_key(name)
        if k in self.by_name:
            return self.by_name[k]
        # nieznana osoba: zapis „Nazwisko Imię” zostawiamy jak jest, ale rejestrujemy, żeby kolejne zapisy się łączyły
        clean = re.sub(r'\s+', ' ', re.sub(r'(mgr|inż\.?|arch\.?|dr|,)', ' ', name or '', flags=re.I)).strip()
        self.by_name[k] = clean
        if upr:
            self.by_upr[upr_key(upr)] = clean
        return clean

    def electricians(self, zespol):
        pewny = prawdop = None
        for name, chunk in split_people(zespol):
            k = name_key(name)
            if RE_E_CODE.search(chunk) or RE_E_TEXT.search(chunk) or k in self.el_pewni:
                pewny = pewny or self.el_pewni.get(k) or self.by_name.get(k) or name
            elif k in self.el_prawdop:
                prawdop = prawdop or self.el_prawdop[k]
        if pewny:
            prawdop = None
        return pewny, prawdop


# --- główny przebieg -----------------------------------------------------------------------------

def main():
    check = '--check' in sys.argv
    data = read_xlsx(XLSX)
    wnioski = data['wnioski']
    people = People(wnioski, data['osoby'])

    if check:
        ok = bad = 0
        for w in wnioski:
            p, pr = people.electricians(w.get('zespol_zapis'))
            exp = (w.get('elektryk_pewny'), w.get('elektryk_prawdopodobny'))
            if (p, pr) == exp:
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
            r['powiat'] = r.get('powiat') or f.stem.replace('gunb_', '')
            r['projektant'] = people.canonical(r.get('projektant_zapis'), r.get('nr_uprawnien')) if r.get('projektant_zapis') else '(nie wpisano)'
            r['elektryk_pewny'], r['elektryk_prawdopodobny'] = people.electricians(r.get('zespol_zapis'))
            r['data_pobrania'] = meta.get('data_pobrania')
            r['zrodlo'] = f.name
            wnioski.append(r)
            added += 1
        for p in {r['powiat'] for r in rows if r.get('powiat')} or {f.stem.replace('gunb_', '')}:
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
    for p, m in powiaty_meta.items():
        m['wnioski'] = sum(1 for w in wnioski if w.get('powiat') == p)

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
