import { useMemo } from 'react'
import { buildRanking, data, formatDate, wnioskiPowiatu } from '../analysis.js'

export default function Powiaty({ onPick }) {
  const rows = useMemo(
    () =>
      data.powiaty.map((p) => {
        const w = wnioskiPowiatu(p.powiat)
        const r = buildRanking(w)
        return {
          ...p,
          bezEl: w.filter((x) => !x.elektryk_pewny && !x.elektryk_prawdopodobny).length,
          architekci: r.length,
          hot: r.filter((x) => x.rekomendacja.klasa === 'hot'),
          top: r.slice(0, 3),
        }
      }),
    []
  )

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Powiat</th><th>Zakres dat</th><th>Pobrano</th><th className="num">Wnioski</th>
              <th className="num">Bez elektryka</th><th className="num">Architekci</th><th>Najlepsze cele</th><th>Źródło</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.powiat}>
                <td><button className="link" onClick={() => onPick(p.powiat)}><strong>{p.powiat}</strong></button></td>
                <td className="small nowrap">{p.zakres_od ? `${formatDate(p.zakres_od)} – ${formatDate(p.zakres_do)}` : <span className="muted">?</span>}</td>
                <td className="small nowrap">{formatDate(p.data_pobrania)}</td>
                <td className="num">{p.wnioski}</td>
                <td className="num">{p.bezEl} <span className="muted small">({p.wnioski ? Math.round((100 * p.bezEl) / p.wnioski) : 0}%)</span></td>
                <td className="num">{p.architekci}</td>
                <td className="small">{p.top.map((t) => t.name).join(', ')}</td>
                <td className="small muted">
                  {p.pliki.join(', ')}
                  {p.pominiete?.length > 0 && <div className="warn">pominięte: {p.pominiete.join('; ')}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.ostrzezenia?.length > 0 && (
        <div className="note" style={{ marginTop: 14 }}>
          <b>Uwagi z ostatniego importu:</b>
          <ul>{data.ostrzezenia.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </div>
      )}

      <details className="legend" open={rows.length < 2}>
        <summary>Jak dodać powiat?</summary>
        <ol>
          <li>Agent w przeglądarce zbiera dane powiatu i zapisuje plik <code>gunb_&lt;powiat&gt;.md</code> (tabela w kolumnach z zadania).</li>
          <li>Wrzuć plik do folderu <code>Architekci/powiaty/</code>.</li>
          <li>W folderze <code>aplikacja</code> uruchom <code>npm run data</code> – skrypt dopisze wnioski, pominie duplikaty (po gunb_id), sam rozpozna elektryków w zespole i połączy architektów działających w kilku powiatach.</li>
          <li>Odśwież stronę. Nowy powiat pojawi się w tej tabeli i w przełączniku u góry.</li>
        </ol>
        <p className="muted">
          Elektryk „pewny” = w zespole jest numer uprawnień ze specjalnością elektryczną (np. LOD/4121/PWBE/19) albo opis „…elektrycznych”.
          Elektryk „prawdopodobny” = osoba ze starymi uprawnieniami instalacyjnymi, którą w karcie „osoby” oznaczyłeś jako elektryka.
          Nowych osób ze starymi uprawnieniami skrypt nie zgadnie – dopisz je w „osoby” (rola: elektryk) i uruchom <code>npm run data</code> ponownie.
        </p>
      </details>
    </div>
  )
}
