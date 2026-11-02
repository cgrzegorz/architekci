import { domyTxt, formatDate, PARAM, powody } from '../analysis.js'
import { STATUSY } from '../useKontakty.js'

export default function Szczegoly({ row: r, kontakt, onChange, onClose }) {
  const o = r.osoba || {}
  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Zamknij">×</button>
        <h2>{r.name}</h2>
        <p className="muted">
          {o.firma && <>{o.firma} · </>}upr. {r.wnioski[0]?.nr_uprawnien}
          {o.priorytet && <span className={'tag prio-' + o.priorytet}>priorytet {o.priorytet}</span>}
        </p>

        <div className="mini-kpis">
          <div><b>{r.n}</b><span>projektów</span></div>
          <div><b>{r.ost6}</b><span>w ostatnich {PARAM.polowaZycia} mies.</span></div>
          <div><b>{r.wolne}</b><span>bez stałego elektryka</span></div>
          <div><b>{r.domy}</b><span>domów łącznie</span></div>
          <div><b>{formatDate(r.ostatni).slice(0, 5)}</b><span>ostatni wniosek</span></div>
        </div>
        <p className={'rek ' + r.rekomendacja.klasa} style={{ marginTop: 12 }}>{r.rekomendacja.tekst}</p>
        <div className="stack wide" style={{ marginTop: 8 }}>
          <div className="seg staly" style={{ width: (100 * r.nStaly) / r.n + '%' }} />
          <div className="seg inny" style={{ width: (100 * r.nInny) / r.n + '%' }} />
          <div className="seg brak" style={{ width: (100 * r.nBrak) / r.n + '%' }} />
        </div>
        <p className="small muted">
          <span className="dot staly" /> stały elektryk {r.nStaly} · <span className="dot inny" /> inny {r.nInny} ·{' '}
          <span className="dot brak" /> brak {r.nBrak}
        </p>

        <ul className="powody">
          {powody(r).map(([z, t], i) => (
            <li key={i} className={z === '+' ? 'plus' : 'minus'}>{t}</li>
          ))}
        </ul>
        {r.powiaty.length > 0 && <p className="small muted">Powiat: {r.powiaty.join(', ')}</p>}

        {o.uwagi && <div className="note"><b>Jak podejść:</b> {o.uwagi}</div>}

        <h3>Kontakt</h3>
        <dl className="contact">
          {o.telefon && (<><dt>Telefon</dt><dd><a href={'tel:' + o.telefon.replace(/\s/g, '')}>{o.telefon}</a></dd></>)}
          {o.email && (<><dt>E-mail</dt><dd><a href={'mailto:' + o.email}>{o.email}</a></dd></>)}
          {o.adres && (<><dt>Adres</dt><dd>{o.adres}</dd></>)}
          {o.zrodlo_kontaktu && (<><dt>Źródło</dt><dd>{o.zrodlo_kontaktu}</dd></>)}
          {!o.telefon && !o.email && (<><dt>Brak</dt><dd>Brak kontaktu w bazie – sprawdź kartę „Biura” lub Google.</dd></>)}
        </dl>

        <h3>Moja rozmowa</h3>
        <div className="form">
          <select value={kontakt.status || ''} onChange={(e) => onChange({ status: e.target.value })}>
            <option value="">— status —</option>
            {STATUSY.map((s) => (<option key={s}>{s}</option>))}
          </select>
          <input placeholder="Następny krok" value={kontakt.nastepny_krok || ''} onChange={(e) => onChange({ nastepny_krok: e.target.value })} />
          <textarea rows={3} placeholder="Notatka" value={kontakt.notatka || ''} onChange={(e) => onChange({ notatka: e.target.value })} />
          {kontakt.data && <span className="small muted">Zmieniono {formatDate(kontakt.data)} · zapis w tej przeglądarce</span>}
        </div>

        <h3>Z kim robi elektrykę</h3>
        {r.elektrycy.length ? (
          <ul className="el-list">
            {r.elektrycy.map(([name, n]) => (
              <li key={name}>
                <span>{name}{name === r.staly && <span className="tag">stały</span>}</span>
                <span className="muted">{n} wn. ({Math.round((100 * n) / r.n)}%)</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">W żadnym wniosku nie ma elektryka w zespole.</p>
        )}

        <h3>Wnioski ({r.n})</h3>
        <ul className="wn-list">
          {r.pozycje.map(({ w, domy, typ }) => {
            const el = w.elektryk_pewny || w.elektryk_prawdopodobny
            return (
              <li key={w.gunb_id} className={'typ-' + typ}>
                <div>
                  <b>{formatDate(w.data_zlozenia)}</b> · {w.miejscowosc} · {w.rodzaj_zamierzenia}
                  {w.kubatura_m3 && <> · {w.kubatura_m3} m³</>}
                  {domy > 1 && <> · <b>{domyTxt(domy)}</b></>}
                </div>
                <div className="small">{w.zamierzenie}</div>
                <div className="small muted">
                  {w.stan} · elektryk: {el ? `${el}${w.elektryk_pewny ? '' : ' (prawdop.)'}` : <b className="free">brak</b>} ·{' '}
                  <a href={w.link} target="_blank" rel="noreferrer">GUNB ↗</a>
                </div>
              </li>
            )
          })}
        </ul>
        <details className="legend">
          <summary>Dla dociekliwych: jak policzono kolejność</summary>
          <p className="small">
            Aktywność {r.aktywnosc.toFixed(1)} (wnioski ważone świeżością, rodzajem i liczbą domów) × szansa wejścia{' '}
            {Math.round(r.otwartosc * 100)}% = {r.dostepne.toFixed(1)} „dostępnych” projektów → miejsce {r.miejsce} na liście.
          </p>
        </details>
      </aside>
    </div>
  )
}
