import { useMemo, useState } from 'react'
import { buildRanking, data, formatDate, POWIATY, wnioskiPowiatu } from './analysis.js'
import Ranking from './components/Ranking.jsx'
import Wykresy from './components/Wykresy.jsx'
import Wnioski from './components/Wnioski.jsx'
import Biura from './components/Biura.jsx'
import Sanitarni from './components/Sanitarni.jsx'
import Powiaty from './components/Powiaty.jsx'
import Szczegoly from './components/Szczegoly.jsx'

const TABS = [
  ['ranking', 'Lista architektów'],
  ['wykresy', 'Wykresy'],
  ['wnioski', 'Wnioski GUNB'],
  ['sanitarni', 'Sanitarni'],
  ['powiaty', 'Powiaty'],
  ['biura', 'Biura'],
]

export default function App() {
  const [tab, setTabState] = useState(() => {
    const h = window.location.hash.slice(1)
    return TABS.some(([k]) => k === h) ? h : 'ranking'
  })
  const setTab = (k) => {
    setTabState(k)
    window.history.replaceState(null, '', '#' + k)
  }
  const [powiat, setPowiat] = useState('')

  const wnioski = useMemo(() => wnioskiPowiatu(powiat), [powiat])
  const ranking = useMemo(() => buildRanking(wnioski), [wnioski])
  const [wybrany, setWybrany] = useState(null)

  const wybranyRow = ranking.find((r) => r.name === wybrany) || (wybrany && buildRanking().find((r) => r.name === wybrany))
  const meta = data.powiaty.find((p) => p.powiat === powiat)
  const dataDo = meta ? meta.data_pobrania : data.powiaty.reduce((m, p) => (p.data_pobrania > m ? p.data_pobrania : m), '')

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Architekci → projekty elektryczne</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <select className="input py-1 font-semibold" value={powiat} onChange={(e) => setPowiat(e.target.value)}>
              <option value="">Wszystkie powiaty ({POWIATY.length})</option>
              {data.powiaty.map((p) => (
                <option key={p.powiat} value={p.powiat}>pow. {p.powiat} ({p.wnioski})</option>
              ))}
            </select>
            <span>rejestr GUNB (RWDZ) · pobrano {formatDate(dataDo)}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
            {(meta ? [meta] : data.powiaty).map((p) => (
              <span key={p.powiat} className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600" title="Zakres dat złożenia wniosków, które są w bazie">
                {!meta && <>pow. {p.powiat}: </>}wnioski złożone{' '}
                <b className="text-slate-800">{p.zakres_od ? `${formatDate(p.zakres_od)} – ${formatDate(p.zakres_do)}` : 'zakres nieznany'}</b>
              </span>
            ))}
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-xl bg-slate-200/70 p-1">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-3.5 py-1.5 text-sm transition ${tab === k ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'ranking' && <Ranking ranking={ranking} onSelect={setWybrany} />}
        {tab === 'wykresy' && <Wykresy ranking={ranking} wnioski={wnioski} wybranyPowiat={powiat} onSelect={setWybrany} />}
        {tab === 'wnioski' && <Wnioski wnioski={wnioski} onSelect={setWybrany} />}
        {tab === 'powiaty' && <Powiaty onPick={(p) => { setPowiat(p); setTab('ranking') }} />}
        {tab === 'biura' && <Biura />}
        {tab === 'sanitarni' && <Sanitarni wnioski={wnioski} />}
      </main>

      {wybranyRow && <Szczegoly row={wybranyRow} onClose={() => setWybrany(null)} />}
    </div>
  )
}
