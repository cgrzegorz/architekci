import { useMemo } from 'react'
import { data, formatDate } from '../analysis.js'
import DataGrid from './DataGrid.jsx'
import { Empty } from './ui.jsx'

/* Projektanci sanitarni – z zespołów we wnioskach GUNB (pole „sanitarny”, liczone w scripts/build_data.py). */

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase()
const nameKey = (s) => (fold(s).match(/[a-z]+/g) || []).sort().join(' ')
const OSOBY = new Map(data.osoby.map((o) => [nameKey(o.imie_nazwisko), o]))
const PODSTAWA = new Map((data.sanitarni || []).map((s) => [s.osoba, s]))
const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])

function zbierz(wnioski) {
  const by = new Map()
  for (const w of wnioski) {
    if (!w.sanitarny) continue
    let s = by.get(w.sanitarny)
    if (!s) {
      const o = OSOBY.get(nameKey(w.sanitarny)) || {}
      const p = PODSTAWA.get(w.sanitarny) || {}
      s = { osoba: w.sanitarny, pewnosc: w.sanitarny_pewnosc, podstawa: p.podstawa, n: 0, ostatni: '', arch: new Map(), pow: new Map(),
            telefon: o.telefon, email: o.email, firma: o.firma, www: o.www }
      by.set(w.sanitarny, s)
    }
    s.n += 1
    if ((w.data_zlozenia || '') > s.ostatni) s.ostatni = w.data_zlozenia
    if (w.projektant && w.projektant !== '(nie wpisano)') s.arch.set(w.projektant, (s.arch.get(w.projektant) || 0) + 1)
    if (w.powiat) s.pow.set(w.powiat, (s.pow.get(w.powiat) || 0) + 1)
  }
  return [...by.values()].map((s) => ({ ...s, arch: top(s.arch), pow: top(s.pow) })).sort((a, b) => b.n - a.n)
}

export default function Sanitarni({ wnioski }) {
  const rows = useMemo(() => zbierz(wnioski), [wnioski])
  const columns = useMemo(
    () => [
      { key: 'osoba', label: 'Projektant sanitarny', filter: 'text', fixed: true, width: 190, get: (s) => s.osoba, render: (s) => <span className="font-semibold text-slate-900">{s.osoba}</span> },
      {
        key: 'pewnosc', label: 'Rozpoznanie', filter: 'enum', width: 130, get: (s) => s.pewnosc, search: (s) => s.podstawa || '',
        render: (s) => <span className="text-xs" title={s.podstawa}>{s.pewnosc}{s.podstawa ? <span className="block text-slate-400">{s.podstawa.length > 40 ? 'stare uprawnienia' : s.podstawa}</span> : null}</span>,
      },
      { key: 'n', label: 'Wnioski', filter: 'number', num: true, width: 90, firstDir: 'desc', get: (s) => s.n },
      { key: 'ostatni', label: 'Ostatni wniosek', filter: 'date', width: 120, firstDir: 'desc', get: (s) => s.ostatni, render: (s) => formatDate(s.ostatni) },
      {
        key: 'arch', label: 'Pracuje z architektami', filter: 'text', width: 300, wrap: true,
        get: (s) => s.arch.map(([k]) => k), csv: (s) => s.arch.map(([k, c]) => `${k} (${c})`).join(', '),
        render: (s) => <span className="text-xs">{s.arch.length ? s.arch.slice(0, 5).map(([k, c]) => `${k} (${c})`).join(', ') + (s.arch.length > 5 ? ` +${s.arch.length - 5}` : '') : <Empty />}</span>,
      },
      { key: 'pow', label: 'Powiaty', filter: 'enum', width: 160, get: (s) => s.pow.map(([k]) => k), csv: (s) => s.pow.map(([k, c]) => `${k} (${c})`).join(', '),
        render: (s) => <span className="text-xs">{s.pow.map(([k, c]) => `${k} (${c})`).join(', ')}</span> },
      { key: 'firma', label: 'Firma', filter: 'text', width: 200, hidden: false, get: (s) => s.firma || '', render: (s) => <span className="text-xs">{s.firma || <Empty />}</span> },
      {
        key: 'telefon', label: 'Telefon', filter: 'enum', options: ['jest', 'brak'], width: 130, stop: true,
        get: (s) => (s.telefon ? 'jest' : 'brak'), search: (s) => s.telefon || '', csv: (s) => s.telefon || '',
        render: (s) => (s.telefon ? <a href={'tel:' + s.telefon.split(',')[0].replace(/\s/g, '')}>{s.telefon}</a> : <Empty />),
      },
      {
        key: 'email', label: 'E-mail', filter: 'enum', options: ['jest', 'brak'], width: 160, stop: true,
        get: (s) => (s.email ? 'jest' : 'brak'), search: (s) => s.email || '', csv: (s) => s.email || '',
        render: (s) => (s.email ? <a className="text-xs" href={'mailto:' + s.email}>{s.email}</a> : <Empty />),
      },
    ],
    [],
  )

  return <DataGrid columns={columns} rows={rows} rowKey={(s) => s.osoba} noun="projektantów" />
}
