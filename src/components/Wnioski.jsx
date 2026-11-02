import { useMemo } from 'react'
import { formatDate } from '../analysis.js'
import DataGrid from './DataGrid.jsx'
import { Empty } from './ui.jsx'

const elektryk = (w) => w.elektryk_pewny || w.elektryk_prawdopodobny || (w.zespol_status === 'nieznany' ? 'nie wiadomo' : 'brak')

export default function Wnioski({ wnioski, onSelect }) {
  const rows = useMemo(() => [...wnioski].sort((a, b) => (a.data_zlozenia < b.data_zlozenia ? 1 : -1)), [wnioski])

  const columns = useMemo(
    () => [
      { key: 'data', label: 'Złożony', filter: 'date', width: 110, firstDir: 'desc', get: (w) => w.data_zlozenia, render: (w) => formatDate(w.data_zlozenia) },
      { key: 'powiat', label: 'Powiat', filter: 'enum', width: 110, get: (w) => w.powiat },
      { key: 'nr', label: 'Nr wniosku', filter: 'text', width: 140, get: (w) => w.nr_wniosku, render: (w) => <span className="text-xs">{w.nr_wniosku}</span> },
      { key: 'stan', label: 'Stan', filter: 'enum', width: 150, get: (w) => w.stan, render: (w) => <span className="text-xs">{w.stan}</span> },
      { key: 'miejscowosc', label: 'Miejscowość', filter: 'enum', width: 140, get: (w) => w.miejscowosc },
      { key: 'rodzaj', label: 'Rodzaj', filter: 'enum', width: 110, get: (w) => w.rodzaj_zamierzenia },
      { key: 'kubatura', label: 'm³', filter: 'number', num: true, width: 80, firstDir: 'desc', get: (w) => w.kubatura_m3 },
      { key: 'zamierzenie', label: 'Zamierzenie', filter: 'text', width: 280, wrap: true, get: (w) => w.zamierzenie, render: (w) => <span className="line-clamp-2 text-xs">{w.zamierzenie}</span> },
      { key: 'projektant', label: 'Projektant', filter: 'text', width: 170, get: (w) => w.projektant, render: (w) => <span className="font-semibold text-slate-900">{w.projektant}</span> },
      {
        key: 'elektryk', label: 'Elektryk', filter: 'enum', width: 160, get: elektryk,
        render: (w) =>
          w.elektryk_pewny || (w.elektryk_prawdopodobny && <>{w.elektryk_prawdopodobny} <span className="text-slate-400">(prawdop.)</span></>) || (w.zespol_status === 'nieznany' ? <span className="text-violet-600" title="urząd nie wpisał branżystów">nie wiadomo</span> : <b className="text-hot">brak</b>),
      },
      { key: 'zespol', label: 'Zespół', filter: 'text', width: 240, wrap: true, hidden: true, get: (w) => w.zespol_zapis, render: (w) => <span className="line-clamp-2 text-xs text-slate-500">{w.zespol_zapis}</span> },
      { key: 'link', label: 'GUNB', stop: true, get: (w) => w.link, render: (w) => (w.link ? <a href={w.link} target="_blank" rel="noreferrer">↗</a> : <Empty />) },
    ],
    [],
  )

  return <DataGrid columns={columns} rows={rows} rowKey={(w) => w.gunb_id} onRowClick={(w) => onSelect(w.projektant)} noun="wniosków" footer="Kliknij wiersz, żeby zobaczyć architekta i wszystkie jego projekty." />
}
