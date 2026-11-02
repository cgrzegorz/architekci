import { useMemo } from 'react'
import { buildRanking, data, formatDate, statusZespolu, wnioskiPowiatu } from '../analysis.js'

export default function Powiaty({ onPick }) {
  const rows = useMemo(
    () =>
      data.powiaty.map((p) => {
        const w = wnioskiPowiatu(p.powiat)
        const r = buildRanking(w)
        return {
          ...p,
          bezEl: w.filter((x) => statusZespolu(x) === 'bez_elektryka').length,
          niezn: w.filter((x) => statusZespolu(x) === 'nieznany').length,
          architekci: r.length,
          hot: r.filter((x) => x.rekomendacja.klasa === 'hot'),
          top: r.slice(0, 3),
        }
      }),
    []
  )

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="th">Powiat</th><th className="th">Zakres dat</th><th className="th">Pobrano</th><th className="th text-right">Wnioski</th>
              <th className="th text-right">Bez elektryka</th><th className="th text-right" title="Wnioski z wpisanymi branżystami – tylko w nich wiadomo, czy jest elektryk">Pełne zespoły</th><th className="th text-right">Architekci</th><th className="th">Najlepsze cele</th><th className="th">Źródło</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.powiat}>
                <td className="td"><button className="link" onClick={() => onPick(p.powiat)}><strong>{p.powiat}</strong></button></td>
                <td className="td whitespace-nowrap text-xs">{p.zakres_od ? `${formatDate(p.zakres_od)} – ${formatDate(p.zakres_do)}` : <span className="text-slate-400">?</span>}</td>
                <td className="td whitespace-nowrap text-xs">{formatDate(p.data_pobrania)}</td>
                <td className="td text-right tabular-nums">{p.wnioski}</td>
                <td className="td text-right tabular-nums">{p.bezEl} <span className="text-xs text-slate-400">({p.wnioski ? Math.round((100 * p.bezEl) / p.wnioski) : 0}%)</span></td>
                <td className={`td text-right tabular-nums ${p.pelnosc_zespolow != null && p.pelnosc_zespolow < 0.5 ? 'font-semibold text-red-600' : ''}`}>
                  {p.pelnosc_zespolow != null ? `${Math.round(100 * p.pelnosc_zespolow)}%` : '?'}
                  {p.niezn > 0 && <div className="text-[11px] font-normal text-slate-400">{p.niezn} nie wiadomo</div>}
                </td>
                <td className="td text-right tabular-nums">{p.architekci}</td>
                <td className="td text-xs">{p.top.map((t) => t.name).join(', ')}</td>
                <td className="td text-xs text-slate-500">
                  {p.pliki.join(', ')}
                  {p.pominiete?.length > 0 && <div className="text-amber-700">pominięte: {p.pominiete.join('; ')}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.ostrzezenia?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <b>Uwagi z ostatniego importu:</b>
          <ul className="mt-1 list-disc pl-5">{data.ostrzezenia.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </div>
      )}

      <details className="card px-5 py-4 text-sm text-slate-700" open={rows.length < 2}>
        <summary className="cursor-pointer font-semibold text-slate-900">Jak dodać powiat?</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 leading-relaxed">
          <li>Agent w przeglądarce zbiera dane powiatu i zapisuje plik <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">gunb_&lt;powiat&gt;.md</code> (tabela w kolumnach z zadania).</li>
          <li>Wrzuć plik do folderu <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">data/powiaty/</code>.</li>
          <li>W katalogu głównym repozytorium uruchom <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">npm run data</code> – skrypt dopisze wnioski, pominie duplikaty (po gunb_id), sam rozpozna elektryków w zespole i połączy architektów działających w kilku powiatach.</li>
          <li>Odśwież stronę. Nowy powiat pojawi się w tej tabeli i w przełączniku u góry.</li>
        </ol>
        <p className="mt-3 max-w-4xl leading-relaxed text-slate-500">
          Elektryk „pewny” = w zespole jest numer uprawnień ze specjalnością elektryczną (np. LOD/4121/PWBE/19) albo opis „…elektrycznych”.
          Elektryk „prawdopodobny” = osoba ze starymi uprawnieniami instalacyjnymi, którą w karcie „osoby” oznaczyłeś jako elektryka.
          Nowych osób ze starymi uprawnieniami skrypt nie zgadnie – dopisz je w „osoby” (rola: elektryk) i uruchom <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">npm run data</code> ponownie.
        </p>
      </details>
    </div>
  )
}
