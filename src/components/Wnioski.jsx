import { useMemo, useState } from 'react'
import { formatDate } from '../analysis.js'

export default function Wnioski({ wnioski, onSelect, pokazPowiat }) {
  const [q, setQ] = useState('')
  const [bezEl, setBezEl] = useState(false)
  const [stan, setStan] = useState('')
  const stany = [...new Set(wnioski.map((w) => w.stan).filter(Boolean))]

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return wnioski
      .filter((w) => !bezEl || (!w.elektryk_pewny && !w.elektryk_prawdopodobny))
      .filter((w) => !stan || w.stan === stan)
      .filter((w) => !ql || [w.projektant, w.miejscowosc, w.zamierzenie, w.nr_wniosku, w.zespol_zapis].some((s) => s && String(s).toLowerCase().includes(ql)))
      .sort((a, b) => (a.data_zlozenia < b.data_zlozenia ? 1 : -1))
  }, [wnioski, q, bezEl, stan])

  return (
    <div className="card">
      <div className="toolbar">
        <input placeholder="Szukaj: projektant, miejscowość, zamierzenie, zespół…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={stan} onChange={(e) => setStan(e.target.value)}>
          <option value="">Każdy stan</option>
          {stany.map((s) => (<option key={s}>{s}</option>))}
        </select>
        <label className="check"><input type="checkbox" checked={bezEl} onChange={(e) => setBezEl(e.target.checked)} /> tylko bez elektryka</label>
        <span className="muted small">{rows.length} wniosków</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {pokazPowiat && <th>Powiat</th>}<th>Złożony</th><th>Nr</th><th>Stan</th><th>Miejscowość</th><th className="num">m³</th>
              <th>Zamierzenie</th><th>Projektant</th><th>Elektryk</th><th>Zespół</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.gunb_id}>
                {pokazPowiat && <td className="small">{w.powiat}</td>}
                <td className="nowrap">{formatDate(w.data_zlozenia)}</td>
                <td className="small nowrap">{w.nr_wniosku}</td>
                <td className="small">{w.stan}</td>
                <td>{w.miejscowosc}</td>
                <td className="num">{w.kubatura_m3}</td>
                <td className="small clip">{w.rodzaj_zamierzenia}: {w.zamierzenie}</td>
                <td><button className="link" onClick={() => onSelect(w.projektant)}>{w.projektant}</button></td>
                <td className="small">
                  {w.elektryk_pewny || (w.elektryk_prawdopodobny && <>{w.elektryk_prawdopodobny} <span className="muted">(prawdop.)</span></>) || <b className="free">brak</b>}
                </td>
                <td className="small clip muted">{w.zespol_zapis}</td>
                <td><a href={w.link} target="_blank" rel="noreferrer">↗</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
