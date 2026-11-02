import { useMemo, useState } from 'react'
import { data, formatDate, opis, PARAM, wnTxt } from '../analysis.js'
import { STATUSY, eksportCsv } from '../useKontakty.js'

const KOLEJNOSC = {
  szansa: ['od największej szansy', (r) => r.wynik],
  wolne: ['najwięcej wolnych projektów', (r) => r.wolne],
  n: ['najwięcej projektów', (r) => r.n],
  ost6: ['najwięcej świeżych projektów', (r) => r.ost6],
  ostatni: ['najnowszy wniosek', (r) => +r.ostatni.replace(/-/g, '')],
}
const ZAMKNIETE = ['odmowa', 'zlecenie']
const WIDOK_KEY = 'widok-listy-v1'
const OPIS_PRIO = Object.fromEntries(data.slowniki.filter((s) => s.priorytet).map((s) => [s.priorytet, s.opis_priorytetu]))

const SEKCJE = [
  { klasy: ['hot', 'warm'], tytul: 'Zadzwoń w pierwszej kolejności', pod: 'Dużo projektują i nie mają jednego stałego elektryka – tu najłatwiej dostać zlecenia.' },
  { klasy: ['sub'], tytul: 'Mają stałego elektryka – zaproponuj zastępstwo', pod: 'Dużo projektują, ale prawie zawsze z tym samym elektrykiem. Oferta: pomoc przy natłoku, urlopie, pilnym terminie.' },
]

export default function Ranking({ ranking, kontakty, onSelect, onStatus, pokazPowiat }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [tylkoKontakt, setTylkoKontakt] = useState(false)
  const [ukryjZamkniete, setUkryjZamkniete] = useState(true)
  const [kolejnosc, setKolejnosc] = useState('szansa')
  const [widok, setWidokState] = useState(() => {
    try {
      return localStorage.getItem(WIDOK_KEY) === 'tabela' ? 'tabela' : 'kafle'
    } catch {
      return 'kafle'
    }
  })
  const setWidok = (v) => {
    setWidokState(v)
    try {
      localStorage.setItem(WIDOK_KEY, v)
    } catch {
      /* bez zapamiętywania */
    }
  }

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const key = KOLEJNOSC[kolejnosc][1]
    return ranking
      .filter((r) => !status || (kontakty[r.id]?.status || 'do zrobienia') === status)
      .filter((r) => !tylkoKontakt || r.osoba?.telefon || r.osoba?.email)
      .filter((r) => !ukryjZamkniete || !ZAMKNIETE.includes(kontakty[r.id]?.status))
      .filter((r) => !ql || [r.name, r.osoba?.firma, r.staly, ...r.miejscowosci, ...r.powiaty].some((s) => s && s.toLowerCase().includes(ql)))
      .sort((a, b) => key(b) - key(a) || b.wynik - a.wynik)
  }, [ranking, q, status, tylkoKontakt, ukryjZamkniete, kolejnosc, kontakty])

  const pozostali = rows.filter((r) => !SEKCJE.some((s) => s.klasy.includes(r.rekomendacja.klasa)))

  return (
    <div className="ranking-page">
      <div className="card toolbar-card">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Widok">
            <button className={widok === 'kafle' ? 'active' : ''} onClick={() => setWidok('kafle')}>▦ Kafle</button>
            <button className={widok === 'tabela' ? 'active' : ''} onClick={() => setWidok('tabela')}>☰ Tabela</button>
          </div>
          <input placeholder="Szukaj: nazwisko, firma, miejscowość, elektryk…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label>
            Kolejność
            <select value={kolejnosc} onChange={(e) => setKolejnosc(e.target.value)}>
              {Object.entries(KOLEJNOSC).map(([k, [l]]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Każdy status rozmowy</option>
            {STATUSY.map((s) => (<option key={s}>{s}</option>))}
          </select>
          <label className="check">
            <input type="checkbox" checked={tylkoKontakt} onChange={(e) => setTylkoKontakt(e.target.checked)} /> tylko z telefonem/e-mailem
          </label>
          <label className="check" title="ukrywa architektów ze statusem „odmowa” lub „zlecenie”">
            <input type="checkbox" checked={ukryjZamkniete} onChange={(e) => setUkryjZamkniete(e.target.checked)} /> ukryj odmowy i klientów
          </label>
          <button className="ghost" onClick={() => eksportCsv(kontakty, ranking)}>Pobierz moje rozmowy (CSV)</button>
        </div>
      </div>

      {widok === 'tabela' && (
        <Tabela rows={rows} kontakty={kontakty} kolejnosc={kolejnosc} setKolejnosc={setKolejnosc} onSelect={onSelect} onStatus={onStatus} pokazPowiat={pokazPowiat} />
      )}

      {widok === 'kafle' && SEKCJE.map((s) => {
        const lista = rows.filter((r) => s.klasy.includes(r.rekomendacja.klasa))
        if (!lista.length) return null
        return (
          <section key={s.tytul} className="sekcja">
            <h2>{s.tytul} <span className="count">{lista.length}</span></h2>
            <p className="muted">{s.pod}</p>
            <div className="cards">
              {lista.map((r) => (
                <Karta key={r.name} r={r} kontakt={kontakty[r.id] || {}} onSelect={onSelect} onStatus={onStatus} pokazPowiat={pokazPowiat} />
              ))}
            </div>
          </section>
        )
      })}

      {widok === 'kafle' && pozostali.length > 0 && (
        <section className="sekcja">
          <details>
            <summary>
              <h2>Pozostali architekci <span className="count">{pozostali.length}</span></h2>
              <span className="muted">mało projektów albo zamknięci na nowych elektryków – kliknij, żeby rozwinąć</span>
            </summary>
            <div className="card table-wrap" style={{ marginTop: 10 }}>
              <table className="compact">
                <thead>
                  <tr><th>Architekt</th>{pokazPowiat && <th>Powiat</th>}<th className="num">Projekty</th><th>Kto robi elektrykę</th><th>Ostatni wniosek</th><th>Kontakt</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {pozostali.map((r) => (
                    <tr key={r.name} onClick={() => onSelect(r.name)}>
                      <td><strong>{r.name}</strong><div className="small muted">{r.osoba?.firma || r.miejscowosci.slice(0, 2).join(', ')}</div></td>
                      {pokazPowiat && <td className="small">{r.powiaty.join(', ')}</td>}
                      <td className="num">{r.n}</td>
                      <td className="small">{r.staly ? `zawsze/prawie zawsze: ${r.staly}` : r.nBrak === r.n ? 'nikt (brak w zespole)' : 'różne osoby'}</td>
                      <td className="small nowrap">{formatDate(r.ostatni)}</td>
                      <td className="small">{r.osoba?.telefon || r.osoba?.email || <span className="muted">—</span>}</td>
                      <td className="small">{kontakty[r.id]?.status || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      {!rows.length && <p className="muted pad">Nikt nie pasuje do tych filtrów.</p>}

      <details className="legend card">
        <summary>Skąd ta kolejność?</summary>
        <p>
          Dane to wnioski o pozwolenie na budowę domów z rejestru GUNB. W każdym wniosku widać, kto jest projektantem głównym
          (architekt) i kto jest w zespole – w tym elektryk, jeśli jest.
        </p>
        <p>Na górze listy są architekci, którzy jednocześnie:</p>
        <ul>
          <li><b>dużo projektują</b> – liczą się zwłaszcza świeże wnioski (z ostatnich {PARAM.polowaZycia} mies.) i duże inwestycje, np. osiedle kilku domów,</li>
          <li><b>nie mają jednego stałego elektryka</b> – w ich projektach elektrykę robią różne osoby albo nie ma nikogo.</li>
        </ul>
        <p>
          Jeśli jeden elektryk robi u architekta 3/4 projektów lub więcej, trafia on do grupy „zastępstwo”. Architekci z 1–2
          wnioskami lądują w „pozostałych” – za mało danych, żeby coś obiecywać. Wnioski wycofane przez inwestora nie są liczone.
        </p>
        <p className="muted">
          „Elektryk prawdopodobny” = ktoś ze starymi uprawnieniami instalacyjnymi, kogo uznaliśmy za elektryka na podstawie układu
          zespołu – warto to potwierdzić w e-CRUB.
        </p>
      </details>
    </div>
  )
}

function Karta({ r, kontakt, onSelect, onStatus, pokazPowiat }) {
  const o = r.osoba || {}
  const { ruch, elektryka } = opis(r)
  return (
    <article className={'karta ' + r.rekomendacja.klasa}>
      <header>
        <div>
          <h3><button className="link name" onClick={() => onSelect(r.name)}>{r.name}</button></h3>
          <div className="small muted">
            {[o.firma, pokazPowiat && `pow. ${r.powiaty.join(', ')}`, r.miejscowosci.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className={'rek ' + r.rekomendacja.klasa}>{r.rekomendacja.tekst}</span>
      </header>

      <p className="fakt"><b>{ruch}</b></p>
      <p className="fakt">{elektryka}</p>

      <div className="kto">
        <div className="stack wide">
          <div className="seg staly" style={{ width: (100 * r.nStaly) / r.n + '%' }} />
          <div className="seg inny" style={{ width: (100 * r.nInny) / r.n + '%' }} />
          <div className="seg brak" style={{ width: (100 * r.nBrak) / r.n + '%' }} />
        </div>
        <div className="small legend-inline">
          {r.nStaly > 0 && <span><i className="dot staly" /> {r.staly}: {r.nStaly}</span>}
          {r.nInny > 0 && <span><i className="dot inny" /> {r.staly ? 'inni elektrycy' : 'różni elektrycy'}: {r.nInny}</span>}
          {r.nBrak > 0 && <span><i className="dot brak" /> bez elektryka: {r.nBrak}</span>}
        </div>
      </div>

      {o.uwagi && <p className="porada">💡 {o.uwagi}</p>}
      {!o.uwagi && o.priorytet && OPIS_PRIO[o.priorytet] && <p className="porada">💡 {OPIS_PRIO[o.priorytet]}</p>}

      <footer>
        <div className="kontakt">
          {o.telefon && <a className="btn" href={'tel:' + o.telefon.replace(/\s/g, '')}>☎ {o.telefon}</a>}
          {o.email && <a className="btn ghost-btn" href={'mailto:' + o.email}>✉ {o.email}</a>}
          {!o.telefon && !o.email && <span className="small muted">Brak telefonu w bazie – poszukaj w zakładce „Biura”.</span>}
        </div>
        <div className="akcje">
          <select value={kontakt.status || ''} onChange={(e) => onStatus(r.id, { status: e.target.value })} title="status rozmowy">
            <option value="">— status rozmowy —</option>
            {STATUSY.filter((s) => s !== 'do zrobienia').map((s) => (<option key={s}>{s}</option>))}
          </select>
          <button className="ghost" onClick={() => onSelect(r.name)}>Projekty ({wnTxt(r.n).split(' ')[0]}) →</button>
        </div>
      </footer>
    </article>
  )
}

function Tabela({ rows, kontakty, kolejnosc, setKolejnosc, onSelect, onStatus, pokazPowiat }) {
  const Th = ({ k, children, className }) => (
    <th className={(className || '') + (k ? ' sortable' : '') + (k === kolejnosc ? ' sorted' : '')} onClick={k ? () => setKolejnosc(k) : undefined} title={k ? 'Sortuj' : undefined}>
      {children}
      {k === kolejnosc && ' ↓'}
    </th>
  )
  return (
    <div className="card table-wrap">
      <table className="lista">
        <thead>
          <tr>
            <th>#</th>
            <th>Architekt</th>
            {pokazPowiat && <th>Powiat</th>}
            <Th k="szansa">Szansa</Th>
            <Th k="n" className="num">Projekty</Th>
            <Th k="ost6" className="num">Ost. 6 mies.</Th>
            <Th k="wolne" className="num" >Bez stałego el.</Th>
            <th>Kto robi elektrykę</th>
            <Th k="ostatni">Ostatni wniosek</Th>
            <th>Kontakt</th>
            <th>Status rozmowy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} onClick={() => onSelect(r.name)} className={'row-' + r.rekomendacja.klasa}>
              <td className="muted">{i + 1}</td>
              <td>
                <strong>{r.name}</strong>
                <div className="small muted">{r.osoba?.firma || r.miejscowosci.slice(0, 3).join(', ')}</div>
              </td>
              {pokazPowiat && <td className="small">{r.powiaty.join(', ')}</td>}
              <td><span className={'rek ' + r.rekomendacja.klasa}>{r.rekomendacja.tekst}</span></td>
              <td className="num"><strong>{r.n}</strong></td>
              <td className="num">{r.ost6}</td>
              <td className="num">{r.wolne}</td>
              <td className="small kto-cell">
                <div className="stack">
                  <div className="seg staly" style={{ width: (100 * r.nStaly) / r.n + '%' }} />
                  <div className="seg inny" style={{ width: (100 * r.nInny) / r.n + '%' }} />
                  <div className="seg brak" style={{ width: (100 * r.nBrak) / r.n + '%' }} />
                </div>
                <div>{r.staly ? <>głównie {r.staly}</> : r.nBrak === r.n ? 'nikt' : 'różne osoby'}</div>
              </td>
              <td className="small nowrap">{formatDate(r.ostatni)}</td>
              <td className="small" onClick={(e) => e.stopPropagation()}>
                {r.osoba?.telefon && <div><a href={'tel:' + r.osoba.telefon.replace(/\s/g, '')}>☎ {r.osoba.telefon}</a></div>}
                {r.osoba?.email && <div><a href={'mailto:' + r.osoba.email}>✉ {r.osoba.email}</a></div>}
                {!r.osoba?.telefon && !r.osoba?.email && <span className="muted">—</span>}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <select className="status-sel" value={kontakty[r.id]?.status || ''} onChange={(e) => onStatus(r.id, { status: e.target.value })}>
                  <option value="">—</option>
                  {STATUSY.filter((s) => s !== 'do zrobienia').map((s) => (<option key={s}>{s}</option>))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ margin: '10px 4px 0' }}>
        <i className="dot staly" /> stały elektryk · <i className="dot inny" /> inni elektrycy · <i className="dot brak" /> bez elektryka.
        Kliknij wiersz, żeby zobaczyć projekty; kliknij nagłówek, żeby posortować.
      </p>
    </div>
  )
}
