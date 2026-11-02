import { useMemo } from 'react'
import { data } from '../analysis.js'
import DataGrid from './DataGrid.jsx'
import { Empty } from './ui.jsx'

const val = (v) => (v && v !== 'brak' ? v : null)
const jest = (v) => (val(v) ? 'jest' : 'brak')

export default function Biura() {
  const columns = useMemo(
    () => [
      { key: 'firma', label: 'Firma', filter: 'text', fixed: true, width: 220, get: (b) => b.firma, render: (b) => <span className="font-semibold text-slate-900">{b.firma}</span> },
      { key: 'miejscowosc', label: 'Miejscowość', filter: 'enum', width: 140, get: (b) => b.miejscowosc },
      { key: 'adres', label: 'Adres', filter: 'text', width: 200, get: (b) => val(b.adres) || '', render: (b) => <span className="text-xs text-slate-600">{val(b.adres) || <Empty />}</span> },
      {
        key: 'telefon', label: 'Telefon', filter: 'enum', options: ['jest', 'brak'], width: 140, stop: true,
        get: (b) => jest(b.telefon), search: (b) => val(b.telefon) || '', csv: (b) => val(b.telefon) || '',
        render: (b) => (val(b.telefon) ? <a href={'tel:' + b.telefon.replace(/\s/g, '')}>{b.telefon}</a> : <Empty />),
      },
      {
        key: 'email', label: 'E-mail', filter: 'enum', options: ['jest', 'brak'], width: 140, stop: true,
        get: (b) => jest(b.email), search: (b) => val(b.email) || '', csv: (b) => val(b.email) || '',
        render: (b) => (val(b.email) ? <a className="text-xs" href={'mailto:' + b.email}>{b.email}</a> : <Empty />),
      },
      {
        key: 'www', label: 'WWW', filter: 'enum', options: ['jest', 'brak'], width: 90, stop: true,
        get: (b) => jest(b.www), csv: (b) => val(b.www) || '',
        render: (b) => (val(b.www) ? <a href={b.www} target="_blank" rel="noreferrer">strona ↗</a> : <Empty />),
      },
      {
        key: 'domy', label: 'Projektuje domy', filter: 'enum', width: 140,
        get: (b) => ((b.domy_adaptacje || '').startsWith('tak') ? 'tak' : (b.domy_adaptacje || '').startsWith('nie') ? 'nie' : 'brak danych'),
        search: (b) => b.domy_adaptacje || '', csv: (b) => b.domy_adaptacje || '',
        render: (b) => <span className="text-xs">{b.domy_adaptacje || <Empty />}</span>,
      },
    ],
    [],
  )

  return <DataGrid columns={columns} rows={data.biura} rowKey={(b) => `${b.nr}-${b.firma}-${b.miejscowosc}`} noun="biur" />
}
