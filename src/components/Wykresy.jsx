import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'
import { useMemo, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { data, formatDate, liczbaDomow, statusZespolu, topMiejscowosci, udzialElektrykow, wnioskiMiesiecznie } from '../analysis.js'

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip)
ChartJS.defaults.font.family = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
ChartJS.defaults.color = '#5b6472'

export const C = { staly: '#a3acb9', inny: '#f0a83a', brak: '#1f9d6b', nieznany: '#c4b5fd', main: '#2f6fdb', grid: '#e7eaef' }
const PALETA = ['#2f6fdb', '#f0a83a', '#8e5bd6', '#e0576b', '#16a3b8', '#7a8b2e', '#c46d2b', '#a3acb9']
const MIES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

const grid = { grid: { color: C.grid }, border: { display: false } }

export default function Wykresy({ ranking, wnioski, wybranyPowiat, onSelect }) {
  const mies = wnioskiMiesiecznie(wnioski)
  const el = udzialElektrykow(wnioski)
  const osoby = el.filter(([k]) => !k.startsWith('brak') && !k.startsWith('nie wiadomo'))
  const elTop = osoby.slice(0, 7)
  const elReszta = osoby.slice(7).reduce((s, [, n]) => s + n, 0)
  const elNiezn = el.find(([k]) => k.startsWith('nie wiadomo'))?.[1] || 0
  const elBrak = el.find(([k]) => k.startsWith('brak'))?.[1] || 0
  const miejsc = topMiejscowosci(wnioski)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TopWgPowiatu ranking={ranking} onSelect={onSelect} />
      <Powiaty wybrany={wybranyPowiat} />
      <ArchitektLupa ranking={ranking} onSelect={onSelect} />

      <div className="card p-5">
        <h3 className="h-section">Wnioski miesięcznie</h3>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">Ile pracy przychodzi na rynek i ile z niej trafia bez elektryka w zespole.</p>
        <div className="relative" style={{ height: 280 }}>
          <Bar
            data={{
              labels: mies.map(([k]) => `${MIES[+k.slice(5) - 1]} ${k.slice(2, 4)}`),
              datasets: [
                { label: 'bez elektryka', data: mies.map(([, v]) => v.brak), backgroundColor: C.brak },
                { label: 'z elektrykiem', data: mies.map(([, v]) => v.z), backgroundColor: C.staly },
                { label: 'nie wiadomo (zespół niewpisany)', data: mies.map(([, v]) => v.nieznany), backgroundColor: C.nieznany },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top', align: 'start' } },
              scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ...grid } },
            }}
          />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="h-section">Konkurencja: kto robi elektrykę</h3>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">Udział elektryków we wszystkich wnioskach (pewni + prawdopodobni).</p>
        <div className="relative" style={{ height: 280 }}>
          <Doughnut
            data={{
              labels: [...elTop.map(([k]) => k), ...(elReszta ? ['pozostali'] : []), 'brak elektryka', ...(elNiezn ? ['nie wiadomo'] : [])],
              datasets: [
                {
                  data: [...elTop.map(([, n]) => n), ...(elReszta ? [elReszta] : []), elBrak, ...(elNiezn ? [elNiezn] : [])],
                  backgroundColor: [...PALETA.slice(0, elTop.length), ...(elReszta ? ['#cfd5dd'] : []), C.brak, ...(elNiezn ? [C.nieznany] : [])],
                  borderColor: '#fff',
                  borderWidth: 2,
                },
              ],
            }}
            options={{ maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } }}
          />
        </div>
      </div>

      <div className="card p-5 lg:col-span-2">
        <h3 className="h-section">Gdzie się buduje – top miejscowości</h3>
        <div className="relative" style={{ height: 260 }}>
          <Bar
            data={{ labels: miejsc.map(([k]) => k), datasets: [{ label: 'wnioski', data: miejsc.map(([, n]) => n), backgroundColor: C.main, borderRadius: 4 }] }}
            options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { ...grid } } }}
          />
        </div>
      </div>
    </div>
  )
}

/* --- powiaty ------------------------------------------------------------------------------------ */

// Kolor przypisany na stałe do powiatu (nie do pozycji na liście) – nowy powiat nie przemalowuje starych.
// Paleta sprawdzona walidatorem (CVD, kontrast) w kolejności alfabetycznej, w jakiej powiaty leżą w słupkach.
// Nowy powiat bez koloru = szary; dopisz go tutaj i sprawdź walidatorem.
const KOL_POW = { kłobucki: '#5e7d1f', oleski: '#2f6fdb', pajęczański: '#c27a12', wieluński: '#8e5bd6', wieruszowski: '#00899e' }
const kolorPowiatu = (p) => KOL_POW[p] || '#a3acb9'

const ym = (iso) => iso.slice(0, 7)
const etykieta = (k) => `${MIES[+k.slice(5) - 1]} ${k.slice(2, 4)}`
function miesiace(od, doo) {
  const out = []
  let [y, m] = od.slice(0, 7).split('-').map(Number)
  const [y2, m2] = doo.slice(0, 7).split('-').map(Number)
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    if (++m > 12) { m = 1; y++ }
  }
  return out
}
const dniMies = (od, doo) => Math.max(1, (new Date(doo) - new Date(od)) / (1000 * 60 * 60 * 24 * 30.44))
const fmt1 = (x) => x.toLocaleString('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const proc = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '–')

function zakres(p, lista) {
  const daty = lista.map((w) => w.data_zlozenia).filter(Boolean).sort()
  return { od: p.zakres_od || daty[0], do: p.zakres_do || daty[daty.length - 1] }
}

function Kafel({ label, value, sub }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function Powiaty({ wybrany }) {
  const st = useMemo(
    () =>
      data.powiaty.map((p) => {
        const lista = data.wnioski.filter((w) => w.powiat === p.powiat && w.data_zlozenia)
        const z = zakres(p, lista)
        const mies = dniMies(z.od, z.do)
        const domy = lista.reduce((s, w) => s + liczbaDomow(w.zamierzenie), 0)
        const ile = (t) => lista.filter((w) => statusZespolu(w) === t).length
        const znane = ile('elektryk') + ile('bez_elektryka')
        const perMies = new Map()
        for (const w of lista) perMies.set(ym(w.data_zlozenia), (perMies.get(ym(w.data_zlozenia)) || 0) + 1)
        return {
          powiat: p.powiat, ...z, n: lista.length, domy, mies, perMies,
          architekci: new Set(lista.map((w) => w.projektant).filter((x) => x && x !== '(nie wpisano)')).size,
          bez: ile('bez_elektryka'), znane,
        }
      }),
    [],
  )
  const osX = miesiace(st.reduce((m, p) => (p.od < m ? p.od : m), '9999'), st.reduce((m, p) => (p.do > m ? p.do : m), '0000'))

  return (
    <div className="card p-5 lg:col-span-2">
      <h3 className="h-section">Który powiat więcej buduje</h3>
      <p className="mb-4 mt-0.5 text-sm text-slate-500">
        Wszystkie powiaty, niezależnie od wyboru u góry. Bazy obejmują różne okresy, dlatego porównujemy średnią na miesiąc, a nie sumę.
        „Domy” liczone z opisu zamierzenia („budowa 3 budynków…” = 3).
      </p>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {[...st].sort((a, b) => b.n / b.mies - a.n / a.mies).map((p) => (
          <div key={p.powiat} className={`rounded-xl border p-4 ${p.powiat === wybrany ? 'border-brand ring-1 ring-brand' : 'border-slate-200'}`}>
            <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
              <i className="dot" style={{ background: kolorPowiatu(p.powiat) }} /> pow. {p.powiat}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Kafel label="wniosków / mies." value={fmt1(p.n / p.mies)} sub={`${p.n} w ${Math.round(p.mies)} mies.`} />
              <Kafel label="domów / mies." value={fmt1(p.domy / p.mies)} sub={`${p.domy} razem`} />
              <Kafel label="architektów" value={p.architekci} sub={`${fmt1(p.n / Math.max(1, p.architekci))} wniosku na os.`} />
              <Kafel label="bez elektryka" value={proc(p.bez, p.znane)} sub={`zespół wpisany: ${proc(p.znane, p.n)}`} />
            </div>
            <div className="mt-2 text-xs text-slate-400">{formatDate(p.od)} – {formatDate(p.do)}</div>
          </div>
        ))}
      </div>
      <h4 className="mb-2 text-sm font-semibold text-slate-700">Wnioski miesięcznie w powiatach</h4>
      <div className="relative" style={{ height: 300 }}>
        <Line
          data={{
            labels: osX.map(etykieta),
            datasets: st.map((p) => ({
              label: `pow. ${p.powiat}`,
              // poza zakresem pobranych danych – przerwa, nie zero
              data: osX.map((k) => (k >= ym(p.od) && k <= ym(p.do) ? p.perMies.get(k) || 0 : null)),
              borderColor: kolorPowiatu(p.powiat),
              backgroundColor: kolorPowiatu(p.powiat),
              borderWidth: p.powiat === wybrany ? 3 : 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              tension: 0.25,
            })),
          }}
          options={{
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { position: 'top', align: 'start', labels: { boxWidth: 12 } },
              tooltip: { callbacks: { footer: () => 'Pierwszy i ostatni miesiąc mogą być niepełne.' } },
            },
            scales: { x: { grid: { display: false } }, y: { ...grid, beginAtZero: true, title: { display: true, text: 'wnioski' } } },
          }}
        />
      </div>
    </div>
  )
}

/* --- architekci wg powiatu ---------------------------------------------------------------------- */

// Okno czasu wspólne dla wszystkich powiatów – bazy mają różne zakresy dat, więc liczymy w tym samym oknie.
const OKRESY = [
  ['wspolny', null], // etykieta z datami – liczona z danych
  ['6', 'ostatnie 6 mies.'],
  ['3', 'ostatnie 3 mies.'],
]
function minusMies(iso, m) {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() - m)
  return d.toISOString().slice(0, 10)
}
/** {powiat: [od, do]} dla wybranego okresu + długość okna w miesiącach. */
function oknoOkresu(okres) {
  const pw = data.powiaty.filter((p) => p.zakres_do)
  if (okres === 'wspolny') {
    const od = pw.reduce((m, p) => (p.zakres_od > m ? p.zakres_od : m), '')
    const doo = pw.reduce((m, p) => (p.zakres_do < m ? p.zakres_do : m), '9999')
    return { okna: Object.fromEntries(pw.map((p) => [p.powiat, [od, doo]])), mies: dniMies(od, doo), opis: `${formatDate(od)} – ${formatDate(doo)}` }
  }
  const n = +okres
  // każdy powiat liczony wstecz od własnej daty końca danych, żeby nie karać powiatu pobranego kilka dni wcześniej
  return { okna: Object.fromEntries(pw.map((p) => [p.powiat, [minusMies(p.zakres_do, n), p.zakres_do]])), mies: n, opis: `${n} mies. wstecz od daty pobrania` }
}

function TopWgPowiatu({ ranking, onSelect }) {
  const [okres, setOkres] = useState('wspolny')
  const wspolny = useMemo(() => oknoOkresu('wspolny'), [])
  const { okna, mies, opis } = useMemo(() => oknoOkresu(okres), [okres])
  const top = useMemo(
    () =>
      ranking
        .map((r) => {
          const per = new Map()
          for (const w of r.wnioski) {
            const o = okna[w.powiat]
            if (o && w.data_zlozenia > o[0] && w.data_zlozenia <= o[1]) per.set(w.powiat, (per.get(w.powiat) || 0) + 1)
          }
          return { r, per, n: [...per.values()].reduce((a, b) => a + b, 0) }
        })
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 15),
    [ranking, okna],
  )
  const powiaty = data.powiaty.map((p) => p.powiat).filter((p) => top.some((x) => x.per.has(p)))
  return (
    <div className="card p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="h-section">Najaktywniejsi architekci – gdzie składają</h3>
          <p className="mb-3 mt-0.5 text-sm text-slate-500">
            15 architektów z największą liczbą wniosków (bez wycofanych) w tym samym oknie czasu dla każdego powiatu: <b className="text-slate-700">{opis}</b>.
            Podpowiedź pokazuje też średnią na miesiąc. Kliknij słupek, żeby zobaczyć szczegóły.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          {OKRESY.map(([k, label]) => (
            <button key={k} onClick={() => setOkres(k)} className={`rounded-md px-2.5 py-1 ${okres === k ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {label || `maks. wspólny okres (${wspolny.opis})`}
            </button>
          ))}
        </div>
      </div>
      {top.length ? (
        <div className="relative" style={{ height: 60 + top.length * 24 }}>
          <Bar
            data={{
              labels: top.map((x) => x.r.name),
              datasets: powiaty.map((p) => ({
                label: `pow. ${p}`,
                data: top.map((x) => x.per.get(p) || 0),
                backgroundColor: kolorPowiatu(p),
                borderColor: '#fff',
                borderWidth: { right: 2 },
                borderSkipped: false,
              })),
            }}
            options={{
              indexAxis: 'y',
              maintainAspectRatio: false,
              onClick: (_, els) => els[0] && onSelect(top[els[0].index].r.name),
              onHover: (e, els) => (e.native.target.style.cursor = els.length ? 'pointer' : 'default'),
              plugins: {
                legend: { position: 'top', align: 'start', labels: { boxWidth: 12 } },
                tooltip: {
                  filter: (it) => it.raw > 0,
                  callbacks: {
                    label: (it) => `${it.dataset.label}: ${it.raw} (${fmt1(it.raw / mies)} / mies.)`,
                    footer: (its) => {
                      const n = top[its[0].dataIndex].n
                      return `razem: ${n} wniosków · ${fmt1(n / mies)} / mies.`
                    },
                  },
                },
              },
              scales: { x: { stacked: true, ...grid, ticks: { precision: 0 }, title: { display: true, text: `liczba wniosków (${opis})` } }, y: { stacked: true, grid: { display: false } } },
            }}
          />
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-slate-400">Brak wniosków w tym okresie.</div>
      )}
    </div>
  )
}

/* --- architekt pod lupą ------------------------------------------------------------------------- */

function PoziomeSlupki({ title, rows, color }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-slate-700">{title}</h4>
      {rows.length ? (
        <div className="relative" style={{ height: 40 + rows.length * 26 }}>
          <Bar
            data={{ labels: rows.map(([k]) => k), datasets: [{ label: 'wnioski', data: rows.map(([, n]) => n), backgroundColor: rows.map(([, , c]) => c || color), borderRadius: 4, maxBarThickness: 18 }] }}
            options={{
              indexAxis: 'y',
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { x: { ...grid, beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
            }}
          />
        </div>
      ) : (
        <div className="text-sm text-slate-400">brak danych</div>
      )}
    </div>
  )
}

function ArchitektLupa({ ranking, onSelect }) {
  const lista = useMemo(() => [...ranking].sort((a, b) => b.nZlozone - a.nZlozone), [ranking])
  const [wyb, setWyb] = useState('')
  const r = lista.find((x) => x.name === wyb) || lista[0]
  if (!r) return null

  const w = r.wnioski.filter((x) => x.data_zlozenia)
  const daty = w.map((x) => x.data_zlozenia).sort()
  const ref = data.powiaty.reduce((m, p) => (p.data_pobrania > m ? p.data_pobrania : m), '')
  const osX = daty.length ? miesiace(daty[0], ref || daty[daty.length - 1]) : []
  const mies = daty.length ? dniMies(daty[0], ref || daty[daty.length - 1]) : 1
  const domy = w.reduce((s, x) => s + liczbaDomow(x.zamierzenie), 0)
  const kub = w.map((x) => x.kubatura_m3).filter((x) => x > 0)
  const znane = r.n - r.nNieznany
  const powiaty = r.powiatyN.map(([p]) => p)

  const elektrycy = [
    ...r.elektrycy.map(([k, n]) => [k, n, k === r.staly ? C.staly : C.inny]),
    ...(r.nBrak ? [['bez elektryka', r.nBrak, C.brak]] : []),
    ...(r.nNieznany ? [['nie wiadomo', r.nNieznany, C.nieznany]] : []),
  ]
  const bezSan = r.n - r.sanitarni.reduce((s, [, n]) => s + n, 0)
  const sanitarni = [...r.sanitarni, ...(bezSan ? [['brak / nie wpisano', bezSan, '#cfd5dd']] : [])]
  const rodzaje = [...w.reduce((m, x) => m.set(x.rodzaj_zamierzenia || 'inne', (m.get(x.rodzaj_zamierzenia || 'inne') || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="h-section">Architekt pod lupą</h3>
        <select className="input py-1 font-semibold" value={r.name} onChange={(e) => setWyb(e.target.value)}>
          {lista.map((x) => <option key={x.name} value={x.name}>{x.name} ({x.nZlozone})</option>)}
        </select>
        <button className="btn" onClick={() => onSelect(r.name)}>Szczegóły i wnioski →</button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kafel label="złożone wnioski" value={r.nZlozone} sub={r.nZlozone > r.n ? `w tym wycofane: ${r.nZlozone - r.n}` : null} />
        <Kafel label="wniosków / mies." value={fmt1(r.n / mies)} sub={`od ${formatDate(daty[0])}`} />
        <Kafel label="domów" value={domy} sub={`${fmt1(domy / mies)} / mies.`} />
        <Kafel label="ostatni wniosek" value={formatDate(r.ostatni)} />
        <Kafel label="bez elektryka" value={proc(r.nBrak, znane)} sub={`zespół wpisany: ${proc(znane, r.n)}`} />
        <Kafel label="śr. kubatura" value={kub.length ? Math.round(kub.reduce((s, x) => s + x, 0) / kub.length) + ' m³' : '–'} />
      </div>

      <h4 className="mb-2 text-sm font-semibold text-slate-700">Wnioski miesięcznie – w którym starostwie</h4>
      <div className="relative mb-5" style={{ height: 220 }}>
        <Bar
          data={{
            labels: osX.map(etykieta),
            datasets: powiaty.map((p) => ({
              label: `pow. ${p}`,
              data: osX.map((k) => w.filter((x) => x.powiat === p && ym(x.data_zlozenia) === k).length),
              backgroundColor: kolorPowiatu(p),
              borderColor: '#fff',
              borderWidth: { top: 2 },
              borderSkipped: false,
              maxBarThickness: 28,
            })),
          }}
          options={{
            maintainAspectRatio: false,
            plugins: { legend: { display: powiaty.length > 1, position: 'top', align: 'start', labels: { boxWidth: 12 } }, tooltip: { filter: (it) => it.raw > 0 } },
            scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ...grid, beginAtZero: true, ticks: { precision: 0 } } },
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <PoziomeSlupki title="Elektrycy w jego zespołach" rows={elektrycy} color={C.inny} />
        <PoziomeSlupki title="Sanitarni w jego zespołach" rows={sanitarni} color={C.main} />
        <PoziomeSlupki title="Rodzaj zamierzenia" rows={rodzaje} color={C.main} />
      </div>
    </div>
  )
}
