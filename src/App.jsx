import { useMemo, useState } from 'react'
import { buildRanking, data, formatDate, POWIATY, wnioskiPowiatu } from './analysis.js'
import { useKontakty } from './useKontakty.js'
import Ranking from './components/Ranking.jsx'
import Wykresy from './components/Wykresy.jsx'
import Wnioski from './components/Wnioski.jsx'
import Biura from './components/Biura.jsx'
import Powiaty from './components/Powiaty.jsx'
import Szczegoly from './components/Szczegoly.jsx'

const TABS = [
  ['ranking', 'Do kogo dzwonić'],
  ['wykresy', 'Wykresy'],
  ['wnioski', 'Wnioski GUNB'],
  ['powiaty', 'Powiaty'],
  ['biura', 'Biura'],
]
const POWIAT_KEY = 'wybrany-powiat-v1'

export default function App() {
  const [tab, setTabState] = useState(() => {
    const h = window.location.hash.slice(1)
    return TABS.some(([k]) => k === h) ? h : 'ranking'
  })
  const setTab = (k) => {
    setTabState(k)
    window.history.replaceState(null, '', '#' + k)
  }
  const [powiat, setPowiatState] = useState(() => {
    try {
      const p = localStorage.getItem(POWIAT_KEY) || ''
      return POWIATY.includes(p) ? p : ''
    } catch {
      return ''
    }
  })
  const setPowiat = (p) => {
    setPowiatState(p)
    try {
      localStorage.setItem(POWIAT_KEY, p)
    } catch {
      /* bez zapamiętywania */
    }
  }

  const wnioski = useMemo(() => wnioskiPowiatu(powiat), [powiat])
  const ranking = useMemo(() => buildRanking(wnioski), [wnioski])
  const [wybrany, setWybrany] = useState(null)
  const [kontakty, updateKontakt] = useKontakty()

  const hot = ranking.filter((r) => r.rekomendacja.klasa === 'hot').length
  const wolne = ranking.reduce((s, r) => s + r.wolne, 0)
  const bezEl = wnioski.filter((w) => !w.elektryk_pewny && !w.elektryk_prawdopodobny).length
  const wybranyRow = ranking.find((r) => r.name === wybrany) || (wybrany && buildRanking().find((r) => r.name === wybrany))
  const meta = data.powiaty.find((p) => p.powiat === powiat)

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Architekci → projekty elektryczne</h1>
          <p className="muted">
            <select className="powiat" value={powiat} onChange={(e) => setPowiat(e.target.value)}>
              <option value="">Wszystkie powiaty ({POWIATY.length})</option>
              {data.powiaty.map((p) => (
                <option key={p.powiat} value={p.powiat}>pow. {p.powiat} ({p.wnioski})</option>
              ))}
            </select>{' '}
            rejestr GUNB (RWDZ) ·{' '}
            {meta ? <>dane z {formatDate(meta.data_pobrania)}</> : <>dane do {formatDate(data.powiaty.reduce((m, p) => (p.data_pobrania > m ? p.data_pobrania : m), ''))}</>}
          </p>
        </div>
        <nav className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <section className="kpis">
        <Kpi label="Wniosków o pozwolenie (domy)" value={wnioski.length} />
        <Kpi label="Architektów (projektantów głównych)" value={ranking.length} />
        <Kpi label="Projektów bez elektryka w zespole" value={bezEl} hint={wnioski.length ? `${Math.round((100 * bezEl) / wnioski.length)}% wszystkich` : ''} />
        <Kpi label="Projektów nie zaklepanych przez stałego elektryka" value={wolne} />
        <Kpi label="Architektów z dużą szansą" value={hot} accent />
      </section>

      <main>
        {tab === 'ranking' && <Ranking ranking={ranking} kontakty={kontakty} onSelect={setWybrany} onStatus={updateKontakt} pokazPowiat={!powiat && POWIATY.length > 1} />}
        {tab === 'wykresy' && <Wykresy ranking={ranking} wnioski={wnioski} pokazPowiaty={!powiat && POWIATY.length > 1} onSelect={setWybrany} />}
        {tab === 'wnioski' && <Wnioski wnioski={wnioski} onSelect={setWybrany} pokazPowiat={!powiat && POWIATY.length > 1} />}
        {tab === 'powiaty' && <Powiaty onPick={(p) => { setPowiat(p); setTab('ranking') }} />}
        {tab === 'biura' && <Biura />}
      </main>

      {wybranyRow && (
        <Szczegoly
          row={wybranyRow}
          kontakt={kontakty[wybranyRow.id] || {}}
          onChange={(patch) => updateKontakt(wybranyRow.id, patch)}
          onClose={() => setWybrany(null)}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, hint, accent }) {
  return (
    <div className={'kpi' + (accent ? ' accent' : '')}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  )
}
