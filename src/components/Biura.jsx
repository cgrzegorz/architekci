import { useMemo, useState } from 'react'
import { data } from '../analysis.js'

const val = (v) => (v && v !== 'brak' ? v : null)

export default function Biura() {
  const [q, setQ] = useState('')
  const [domy, setDomy] = useState(false)
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return data.biura
      .filter((b) => !domy || (b.domy_adaptacje || '').startsWith('tak'))
      .filter((b) => !ql || [b.firma, b.miejscowosc, b.adres].some((s) => s && s.toLowerCase().includes(ql)))
  }, [q, domy])

  return (
    <div className="card">
      <div className="toolbar">
        <input placeholder="Szukaj biura lub miejscowości…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={domy} onChange={(e) => setDomy(e.target.checked)} /> projektuje domy</label>
        <span className="muted small">{rows.length} biur</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Firma</th><th>Miejscowość</th><th>Telefon</th><th>E-mail</th><th>WWW</th><th>Domy / adaptacje</th></tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={i}>
                <td><strong>{b.firma}</strong><div className="small muted">{val(b.adres)}</div></td>
                <td>{b.miejscowosc}</td>
                <td className="nowrap">{val(b.telefon) ? <a href={'tel:' + b.telefon.replace(/\s/g, '')}>{b.telefon}</a> : <span className="muted">—</span>}</td>
                <td className="small">{val(b.email) ? <a href={'mailto:' + b.email}>{b.email}</a> : <span className="muted">—</span>}</td>
                <td className="small">{val(b.www) ? <a href={b.www} target="_blank" rel="noreferrer">strona ↗</a> : <span className="muted">—</span>}</td>
                <td className="small">{b.domy_adaptacje}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
