import { useMemo } from 'react'
import { formatDate, PARAM } from '../analysis.js'
import DataGrid from './DataGrid.jsx'
import { Empty, Niepewne, Stack, StackLegend, StackSan, Tel, Www } from './ui.jsx'


function minusMonths(iso, m) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() - m)
  return d.toISOString().slice(0, 10)
}

/** Lista „nazwisko … liczba” (3 pierwsze + „+N”), wspólna dla kolumn Elektrycy i Sanitarni. */
function Osoby({ lista }) {
  return (
    <div className="space-y-0.5 text-xs leading-tight">
      {lista.slice(0, 3).map(([k, n]) => (
        <div key={k} className="flex justify-between gap-2 whitespace-nowrap"><span>{k}</span><b>{n}</b></div>
      ))}
      {lista.length > 3 && <div className="text-slate-400">+{lista.length - 3}</div>}
    </div>
  )
}

/**
 * Kto robi daną branżę. Gdy urząd nie wpisał zespołu w większości wniosków (pokrycie < PARAM.minPokrycie),
 * pojedyncze znane nazwiska nic nie mówią o architekcie – wtedy na pierwszym planie „nie wiadomo”, nazwiska wyszarzone.
 */
function Kto({ r, lista, pusto }) {
  const malo = r.pokrycie < PARAM.minPokrycie
  return (
    <>
      {malo ? (
        <div className="text-xs font-medium text-violet-600">nie wiadomo</div>
      ) : lista.length ? (
        <Osoby lista={lista} />
      ) : (
        <div className="text-xs text-slate-400">{pusto}</div>
      )}
      {r.nNieznany > 0 && (
        <div className={`text-xs ${malo ? 'text-violet-600' : 'text-slate-400'}`}>bez zespołu: {r.nNieznany} z {r.n}</div>
      )}
      {malo && lista.length > 0 && (
        <div className="text-xs text-slate-400">w znanych: {lista.map(([k, n]) => `${k} (${n})`).join(', ')}</div>
      )}
    </>
  )
}

const ktoElektryka = (r) =>
  r.staly ? r.staly : r.pokrycie < PARAM.minPokrycie ? 'nie wiadomo' : r.nBrak + r.nNieznany === r.n ? 'nikt' : 'różne osoby'

export default function Ranking({ ranking, onSelect }) {
  const ref = useMemo(() => ranking.reduce((m, r) => (r.ostatni > m ? r.ostatni : m), ''), [ranking])

  const columns = useMemo(
    () => [
      { key: 'name', label: 'Architekt', filter: 'text', fixed: true, width: 180, get: (r) => r.name, render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
      {
        key: 'zlozone', label: 'Złożone wnioski', filter: 'number', num: true, width: 110, firstDir: 'desc',
        get: (r) => r.nZlozone,
        render: (r) => <b title="Wszystkie złożone wnioski w wybranym zakresie (także wycofane)">{r.nZlozone}</b>,
      },
      {
        key: 'powiat', label: 'Gdzie składa', filter: 'enum', width: 150,
        get: (r) => r.powiaty,
        csv: (r) => r.powiatyN.map(([p, n]) => `${p} ${n}`).join(', '),
        render: (r) => (
          <div className="space-y-0.5 text-xs leading-tight" title="Starostwo (powiat), do którego architekt składał wnioski, i liczba wniosków">
            {r.powiatyN.map(([p, n]) => (
              <div key={p} className="flex justify-between gap-2 whitespace-nowrap">
                <span>pow. {p}</span><b>{n}</b>
              </div>
            ))}
          </div>
        ),
      },
      {
        key: 'ostatni', label: 'Ostatni wniosek', filter: 'date', width: 120, firstDir: 'desc',
        get: (r) => r.ostatni,
        render: (r) => formatDate(r.ostatni),
        presets: [1, 3, 6, 12].map((m) => ({ label: `ostatnie ${m} mies.`, value: { min: minusMonths(ref, m), max: '' } })),
      },
      {
        key: 'miejscowosci', label: 'Miejscowości budów', filter: 'enum', width: 150, hidden: true,
        get: (r) => r.miejscowosci,
        render: (r) => (
          <span title={r.miejscowosci.join(', ')}>
            {r.miejscowosci.slice(0, 2).join(', ')}
            {r.miejscowosci.length > 2 && <span className="text-slate-400"> +{r.miejscowosci.length - 2}</span>}
          </span>
        ),
      },
      { key: 'ost6', label: `Ost. ${PARAM.polowaZycia} mies.`, filter: 'number', num: true, width: 90, firstDir: 'desc', get: (r) => r.ost6 },
      { key: 'domy', label: 'Domów', filter: 'number', num: true, width: 80, firstDir: 'desc', hidden: true, get: (r) => r.domy },
      {
        key: 'elektryk', label: 'Elektrycy', filter: 'enum', width: 170,
        get: ktoElektryka,
        csv: (r) => `${ktoElektryka(r)}: ${r.elektrycy.map(([k, n]) => `${k} ${n}`).join(', ')}`,
        search: (r) => r.elektrycy.map(([k]) => k),
        render: (r) => (
          <div className="space-y-1">
            <Stack r={r} />
            <Kto r={r} lista={r.elektrycy} pusto={ktoElektryka(r)} />
          </div>
        ),
      },
      {
        key: 'sanitarni', label: 'Sanitarni', filter: 'enum', width: 170,
        get: (r) => r.sanitarni.map(([k]) => k),
        csv: (r) => r.sanitarni.map(([k, n]) => `${k} ${n}`).join(', '),
        render: (r) => (
          <div className="space-y-1" title="Projektanci sanitarni w zespołach architekta i liczba wniosków">
            <StackSan r={r} />
            <Kto r={r} lista={r.sanitarni} pusto="nie wpisano" />
          </div>
        ),
      },
      {
        key: 'telefon', label: 'Telefon', filter: 'enum', options: ['jest', 'brak'], width: 130, stop: true,
        get: (r) => (r.osoba?.telefon ? 'jest' : 'brak'),
        search: (r) => r.osoba?.telefon || '',
        csv: (r) => r.osoba?.telefon || '',
        render: (r) => (r.osoba?.telefon ? <span className="text-xs"><Tel v={r.osoba.telefon} /><Niepewne o={r.osoba} /></span> : <Empty />),
      },
      {
        key: 'email', label: 'E-mail', filter: 'enum', options: ['jest', 'brak'], width: 150, stop: true,
        get: (r) => (r.osoba?.email ? 'jest' : 'brak'),
        search: (r) => r.osoba?.email || '',
        csv: (r) => r.osoba?.email || '',
        render: (r) => (r.osoba?.email ? <a className="break-all text-xs" href={'mailto:' + r.osoba.email}>{r.osoba.email}</a> : <Empty />),
      },
      {
        key: 'www', label: 'WWW', filter: 'enum', options: ['jest', 'brak'], width: 150, stop: true,
        get: (r) => (r.osoba?.www ? 'jest' : 'brak'),
        search: (r) => r.osoba?.www || '',
        csv: (r) => r.osoba?.www || '',
        render: (r) => (r.osoba?.www ? <span className="line-clamp-2 text-xs"><Www v={r.osoba.www} short /></span> : <Empty />),
      },
      { key: 'firma', label: 'Firma', filter: 'text', width: 150, wrap: true, get: (r) => r.osoba?.firma || '', render: (r) => (r.osoba?.firma ? <span className="line-clamp-2 max-w-[220px] text-xs leading-snug" title={r.osoba.firma}>{r.osoba.firma}</span> : <Empty />) },
    ],
    [ref],
  )

  return (
    <div className="space-y-4">
      <DataGrid
        columns={columns}
        rows={ranking}
        rowKey={(r) => r.name}
        onRowClick={(r) => onSelect(r.name)}
        noun="architektów"
        footer={
          <div className="flex flex-col gap-2">
            <StackLegend />
            <span>Kliknij wiersz, żeby zobaczyć projekty architekta. Kliknięcie nagłówka sortuje: pierwsze – sortuje, drugie – odwraca kolejność, trzecie – przywraca domyślną.</span>
          </div>
        }
      />

      <details className="card group px-5 py-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-semibold text-slate-900">Jak działa algorytm?</summary>
        <div className="mt-3 max-w-4xl space-y-3 leading-relaxed">
          <p>
            Kolumna <b>„Gdzie składa”</b> pokazuje, do którego starostwa (powiatu) architekt składał wnioski i ile – liczba przy powiecie
            to liczba jego wniosków w tym powiecie. Przełącznik powiatu u góry zawęża całą listę do jednego starostwa.
          </p>
          <p>
            Wszystko jest liczone wyłącznie z wniosków o pozwolenie na budowę z rejestru GUNB: kto jest projektantem głównym
            (architektem) i kto jest w zespole. Ręczne opisy z arkusza nie mają wpływu na wynik.
          </p>
          <p><b>1. Kto jest elektrykiem w zespole.</b> Uprawnienia z kodem specjalności (np. <code>LOD/4121/PWBE/19</code>, „E” = elektryczna) albo
            opisem „…elektrycznych” – elektryk pewny. Stare uprawnienia bez kodu (np. „955/91”) – metodą eliminacji: zespół domu to zwykle
            konstruktor, sanitarny i elektryk; kto w większości swoich zespołów stoi obok konstruktora i sanitarnego, a nigdy obok innego elektryka,
            jest elektrykiem wywnioskowanym. Ta metoda zgadza się z ręcznym opisem 262 z 263 wniosków.</p>
          <p><b>Zespół niewpisany.</b> Nie każde starostwo wpisuje do rejestru branżystów – np. wieruszowskie zwykle podaje tylko głównego
            projektanta albo współautora. „Brak elektryka” liczy się więc tylko wtedy, gdy w zespole jest konstruktor lub sanitarny, a elektryka nie ma.
            Pusty zespół = <b>nie wiadomo</b>: taki wniosek dostaje przeciętną szansę rynku, nie liczy się do udziału stałego elektryka. Pełność zespołów każdego powiatu: zakładka „Powiaty”.</p>
          <p><b>2. Waga wniosku.</b> Świeże wnioski liczą się bardziej (wniosek sprzed {PARAM.polowaZycia} mies. waży połowę, sprzed roku ¼),
            budowa bardziej niż rozbudowa, a osiedle kilku domów bardziej niż jeden dom.</p>
          <p><b>3. Stały elektryk</b> = ten, kto robi co najmniej połowę (ważonych) projektów architekta. Dzięki ważeniu liczy się,
            z kim architekt pracuje <i>teraz</i>, a nie rok temu.</p>
          <p><b>4. Szansa na kolejne projekty.</b> Wnioski z GUNB są już złożone – elektryka w nich jest zrobiona, to dane historyczne.
            Służą tylko do przewidzenia, czy <i>następne</i> projekty architekta mogą trafić do nas: projekt bez elektryka = 1, z innym
            elektrykiem = 0,6, ze stałym = 0,05. Suma ważona mówi, jak często architekt ostatnio projektował bez stałego elektryka;
            z niej powstaje <b>wynik 0–100</b>.</p>
          <p><b>Złożone wnioski</b> = wszystkie wnioski architekta w wybranym zakresie, także wycofane (do wyniku wycofane się nie liczą).
            Lista jest domyślnie posortowana po tej kolumnie. Panel szczegółów (klik w wiersz) pokazuje, co przemawia za i przeciw. Progi: <code>PARAM</code> w <code>src/analysis.js</code>.</p>
        </div>
      </details>
    </div>
  )
}
