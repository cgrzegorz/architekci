"""Czytnik xlsx (moduł używany przez build_data.py). Samodzielnie: konwertuje baza_zlecenia.xlsx -> src/data/baza.json (tylko biblioteka standardowa).
Użycie: python3 -I scripts/xlsx2json.py data/baza_zlecenia.xlsx src/data/baza.json"""
import json, re, sys, zipfile, datetime
import xml.etree.ElementTree as ET

M = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS = {'m': M, 'r': R}
DATE_COLS = {'data_zlozenia', 'data_decyzji', 'data_pobrania', 'data', 'przypomnienie'}
SHEETS = {'wnioski', 'osoby', 'biura', 'rozmowy', 'slowniki', 'info'}


def col_idx(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def to_date(v):
    if isinstance(v, (int, float)):
        return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v))).isoformat()
    return v


def read_xlsx(src):
    z = zipfile.ZipFile(src)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % M)))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    out = {}
    for sh in wb.find('m:sheets', NS):
        name = sh.get('name')
        if name not in SHEETS:
            continue
        target = rels[sh.get('{%s}id' % R)].lstrip('/')
        if not target.startswith('xl/'):
            target = 'xl/' + target
        rows = []
        for row in ET.fromstring(z.read(target)).iter('{%s}row' % M):
            r = {}
            for c in row.findall('m:c', NS):
                v, t = c.find('m:v', NS), c.get('t')
                if t == 's' and v is not None:
                    val = ss[int(v.text)]
                elif t == 'inlineStr':
                    val = ''.join(x.text or '' for x in c.iter('{%s}t' % M))
                elif v is not None:
                    val = v.text
                    try:
                        f = float(val)
                        val = int(f) if f.is_integer() else f
                    except ValueError:
                        pass
                else:
                    val = None
                if isinstance(val, str):
                    val = val.strip() or None
                r[col_idx(c.get('r'))] = val
            if any(x is not None for x in r.values()):
                rows.append([r.get(i) for i in range(max(r) + 1)])
        if name == 'info':
            out[name] = {r[0]: (r[1] if len(r) > 1 else None) for r in rows if r and r[0]}
            continue
        head = [h for h in rows[0]] if rows else []
        recs = []
        for r in rows[1:]:
            rec = {}
            for i, h in enumerate(head):
                if not h:
                    continue
                v = r[i] if i < len(r) else None
                rec[h] = to_date(v) if h in DATE_COLS else v
            recs.append(rec)
        out[name] = recs
    return out


def main(src, dst):
    out = read_xlsx(src)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(' · '.join(f'{k}: {len(v)}' for k, v in out.items()))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
