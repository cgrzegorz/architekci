import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDate } from '../analysis.js'

/*
 * Tabela w stylu dashboardu: filtr pod każdym nagłówkiem, sortowanie kliknięciem w nagłówek,
 * aktywne filtry jako „chipy”, wyszukiwarka globalna, wybór kolumn i eksport widoku do CSV.
 * Nic nie jest zapisywane – po odświeżeniu strony widok wraca do ustawień domyślnych.
 *
 * Kolumna: { key, label, get(row), render?(row), filter: 'text'|'enum'|'number'|'date'|null,
 *            options?: [...] (stała kolejność wartości enum), presets?: [{label, value:{min,max}}],
 *            sort?(row), firstDir?: 'asc'|'desc', num?, hidden? (domyślnie ukryta), fixed? (nie do ukrycia),
 *            stop? (klik w komórkę nie otwiera wiersza), csv?(row), search?(row), width?, wrap? }
 */

export const PUSTE = '(puste)'
const asArr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v])
const norm = (s) => String(s ?? '').toLowerCase()
const values = (col, row) => {
  const a = asArr(col.get(row)).map(String)
  return a.length ? a : [PUSTE]
}

function isActive(col, f) {
  if (!col.filter || f == null) return false
  if (col.filter === 'text') return f.trim() !== ''
  if (col.filter === 'enum') return f.length > 0
  return (f.min ?? '') !== '' || (f.max ?? '') !== ''
}

function matches(col, f, row) {
  if (col.filter === 'text') {
    const q = norm(f).trim()
    return asArr((col.search || col.get)(row)).some((x) => norm(x).includes(q))
  }
  if (col.filter === 'enum') return values(col, row).some((v) => f.includes(v))
  const v = col.get(row)
  if (v == null || v === '') return false
  const conv = col.filter === 'number' ? Number : String
  if ((f.min ?? '') !== '' && v < conv(f.min)) return false
  if ((f.max ?? '') !== '' && v > conv(f.max)) return false
  return true
}

function summary(col, f) {
  if (col.filter === 'text') return `„${f.trim()}”`
  if (col.filter === 'enum') return f.length === 1 ? f[0] : `${f.length} wybrane`
  const fmt = col.filter === 'date' ? formatDate : (x) => x
  const has = (x) => (x ?? '') !== ''
  if (has(f.min) && has(f.max)) return `${fmt(f.min)} – ${fmt(f.max)}`
  return has(f.min) ? `od ${fmt(f.min)}` : `do ${fmt(f.max)}`
}

function cmp(a, b) {
  const na = a == null || a === ''
  const nb = b == null || b === ''
  if (na || nb) return na === nb ? 0 : na ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pl', { numeric: true })
}

export default function DataGrid({ columns, rows, rowKey, rowClass, onRowClick, actions, noun = 'wierszy', footer }) {
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState(null)
  const [hidden, setHidden] = useState(() => columns.filter((c) => c.hidden).map((c) => c.key))
  const [open, setOpen] = useState(null) // { key, el }
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(10) // 0 = wszystkie

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const clearFilter = (key) => setFilters((f) => { const n = { ...f }; delete n[key]; return n })
  const clearAll = () => { setQ(''); setFilters({}) }

  const visible = columns.filter((c) => !hidden.includes(c.key))
  const active = columns.filter((c) => isActive(c, filters[c.key]))
  const searchCols = columns.filter((c) => c.search || c.filter === 'text')
  const ql = norm(q).trim()

  const passes = (row, except) =>
    active.every((c) => c.key === except || matches(c, filters[c.key], row)) &&
    (!ql || searchCols.some((c) => asArr((c.search || c.get)(row)).some((x) => norm(x).includes(ql))))

  const filtered = useMemo(() => {
    const out = rows.filter((r) => passes(r))
    const sc = sort && columns.find((c) => c.key === sort.key)
    if (sc) {
      const d = sort.dir === 'asc' ? 1 : -1
      const val = (r) => { const v = (sc.sort || sc.get)(r); return Array.isArray(v) ? v.join(', ') : v }
      const empty = (v) => v == null || v === ''
      out.sort((a, b) => {
        const va = val(a), vb = val(b)
        return empty(va) || empty(vb) ? cmp(va, vb) : d * cmp(va, vb) // puste zawsze na końcu
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, q, filters, sort])

  useEffect(() => setPage(0), [rows, q, filters, sort, perPage])
  const pages = perPage ? Math.max(1, Math.ceil(filtered.length / perPage)) : 1
  const pg = Math.min(page, pages - 1)
  const pageRows = perPage ? filtered.slice(pg * perPage, (pg + 1) * perPage) : filtered

  const toggleSort = (c) => {
    const first = c.firstDir || 'asc'
    setSort((s) => {
      if (s?.key !== c.key) return { key: c.key, dir: first }
      if (s.dir === first) return { key: c.key, dir: first === 'asc' ? 'desc' : 'asc' }
      return null
    })
  }

  const facet = (col) => {
    const counts = new Map((col.options || []).map((o) => [o, 0]))
    for (const r of rows) for (const v of values(col, r)) if (!counts.has(v)) counts.set(v, 0)
    for (const r of rows) if (passes(r, col.key)) for (const v of new Set(values(col, r))) counts.set(v, counts.get(v) + 1)
    const list = [...counts.entries()]
    if (col.options) {
      const idx = (v) => { const i = col.options.indexOf(v); return i < 0 ? 999 : i }
      return list.sort((a, b) => idx(a[0]) - idx(b[0]) || a[0].localeCompare(b[0], 'pl'))
    }
    return list.sort((a, b) => (a[0] === PUSTE) - (b[0] === PUSTE) || b[1] - a[1] || a[0].localeCompare(b[0], 'pl'))
  }

  const toggleOpen = (key, el) => setOpen((o) => (o?.key === key ? null : { key, el }))

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [visible.map((c) => esc(c.label)).join(';')]
    for (const r of filtered) lines.push(visible.map((c) => esc(c.csv ? c.csv(r) : asArr(c.get(r)).join(', '))).join(';'))
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${noun}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const openCol = open && columns.find((c) => c.key === open.key)
  const fltBase = 'mt-1.5 flex h-7 w-full items-center rounded-md border px-2 text-xs font-normal normal-case tracking-normal'
  const fltOn = 'border-brand bg-blue-50 font-semibold text-brand'
  const fltOff = 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'

  return (
    <div className="card overflow-hidden">
      {/* pasek narzędzi */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.47 9.77l3.63 3.63a.75.75 0 1 0 1.06-1.06l-3.63-3.63A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
          </svg>
          <input className="input w-full pl-8" placeholder="Szukaj we wszystkich kolumnach…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="mr-auto whitespace-nowrap text-sm text-slate-500">
          <b className="text-slate-900">{filtered.length}</b> z {rows.length} {noun}
        </span>
        {(active.length > 0 || ql) && <button className="btn" onClick={clearAll}>Wyczyść filtry</button>}
        <button className="btn" onClick={(e) => toggleOpen('__cols', e.currentTarget)}>Kolumny <Chevron /></button>
        <button className="btn" onClick={exportCsv} title="Eksportuje to, co widać (filtry i kolumny)">Eksport CSV</button>
        {actions}
      </div>

      {/* aktywne filtry */}
      {active.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2">
          {active.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-0.5 pl-3 pr-1 text-xs text-blue-800 ring-1 ring-inset ring-blue-600/20">
              <b>{c.label}:</b> {summary(c, filters[c.key])}
              <button className="grid h-5 w-5 place-items-center rounded-full text-sm hover:bg-blue-600/15" onClick={() => clearFilter(c.key)} aria-label={`Usuń filtr ${c.label}`}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* tabela */}
      <div className="max-h-[calc(100vh-200px)] min-h-[320px] overflow-auto max-sm:max-h-none">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {visible.map((c) => {
                const sorted = sort?.key === c.key ? sort.dir : null
                const f = filters[c.key]
                const on = isActive(c, f)
                return (
                  <th
                    key={c.key}
                    className={`th sticky top-0 z-10 align-top ${sorted ? 'bg-blue-50/80' : ''}`}
                    style={c.width ? { minWidth: c.width } : undefined}
                  >
                    <button
                      className={`flex w-full items-center gap-1 uppercase tracking-wide hover:text-slate-800 ${c.num ? 'justify-end' : ''} ${sorted ? 'text-brand' : ''}`}
                      onClick={() => toggleSort(c)}
                      title="Sortuj"
                    >
                      {c.label}
                      <span className={`text-[10px] ${sorted ? '' : 'opacity-40'}`}>{sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}</span>
                    </button>
                    {c.filter === 'text' && (
                      <input
                        className={`${fltBase} ${on ? fltOn : fltOff} text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none`}
                        size={1}
                        placeholder="Filtruj…"
                        value={f || ''}
                        onChange={(e) => setFilter(c.key, e.target.value)}
                      />
                    )}
                    {c.filter && c.filter !== 'text' && (
                      <button className={`${fltBase} justify-between gap-1 text-left ${on ? fltOn : fltOff}`} onClick={(e) => toggleOpen(c.key, e.currentTarget)}>
                        <span className="truncate">{on ? summary(c, f) : 'Wszystkie'}</span>
                        <Chevron />
                      </button>
                    )}
                    {!c.filter && <span className="mt-1.5 block h-7" />}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={rowKey(r)} className={`group ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(r)}>
                {visible.map((c, i) => (
                  <td
                    key={c.key}
                    className={`td align-middle group-hover:bg-blue-50/50 ${c.num ? 'text-right tabular-nums' : ''} ${c.wrap ? '' : 'whitespace-nowrap'} ${i === 0 ? `border-l-4 ${rowClass?.(r) || 'border-l-transparent'}` : ''}`}
                    onClick={c.stop ? (e) => e.stopPropagation() : undefined}
                  >
                    {c.render ? c.render(r) : asArr(c.get(r)).join(', ')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="px-4 py-10 text-center text-slate-500">
            Nic nie pasuje do filtrów. <button className="link" onClick={clearAll}>Wyczyść filtry</button>
          </div>
        )}
      </div>
      {/* paginacja */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-2 text-sm text-slate-600">
        <span>
          {filtered.length ? <>{pg * (perPage || 0) + 1}–{perPage ? Math.min((pg + 1) * perPage, filtered.length) : filtered.length} z {filtered.length}</> : '0 z 0'}
        </span>
        <label className="ml-2 flex items-center gap-1.5 text-xs text-slate-500">
          na stronie
          <select className="input py-0.5 text-xs" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            <option value={0}>wszystkie</option>
          </select>
        </label>
        {pages > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <button className="btn px-2 py-1 disabled:opacity-40" disabled={pg === 0} onClick={() => setPage(0)} aria-label="Pierwsza strona">«</button>
            <button className="btn px-2 py-1 disabled:opacity-40" disabled={pg === 0} onClick={() => setPage(pg - 1)} aria-label="Poprzednia strona">‹</button>
            <span className="px-2 tabular-nums">strona <b className="text-slate-900">{pg + 1}</b> z {pages}</span>
            <button className="btn px-2 py-1 disabled:opacity-40" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} aria-label="Następna strona">›</button>
            <button className="btn px-2 py-1 disabled:opacity-40" disabled={pg >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Ostatnia strona">»</button>
          </div>
        )}
      </div>
      {footer && <div className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">{footer}</div>}

      {open?.key === '__cols' && (
        <Popover anchor={open.el} onClose={() => setOpen(null)} width={240}>
          <PopTitle>Widoczne kolumny</PopTitle>
          {columns.map((c) => (
            <CheckRow
              key={c.key}
              checked={!hidden.includes(c.key)}
              disabled={c.fixed}
              onChange={(on) => setHidden((h) => (on ? h.filter((k) => k !== c.key) : [...h, c.key]))}
            >
              {c.label}
            </CheckRow>
          ))}
        </Popover>
      )}
      {openCol?.filter === 'enum' && (
        <Popover anchor={open.el} onClose={() => setOpen(null)} width={280}>
          <EnumFilter col={openCol} options={facet(openCol)} value={filters[openCol.key] || []} onChange={(v) => setFilter(openCol.key, v)} />
        </Popover>
      )}
      {(openCol?.filter === 'number' || openCol?.filter === 'date') && (
        <Popover anchor={open.el} onClose={() => setOpen(null)} width={260}>
          <RangeFilter col={openCol} value={filters[openCol.key] || {}} onChange={(v) => setFilter(openCol.key, v)} />
        </Popover>
      )}
    </div>
  )
}

const Chevron = () => (
  <svg className="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
  </svg>
)

const PopTitle = ({ children }) => <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</div>

function CheckRow({ checked, disabled, onChange, children, count, dim }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50 ${dim ? 'text-slate-400' : 'text-slate-800'} ${disabled ? 'cursor-default opacity-60' : ''}`}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-brand" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count != null && <span className="text-xs tabular-nums text-slate-400">{count}</span>}
    </label>
  )
}

function EnumFilter({ col, options, value, onChange }) {
  const [q, setQ] = useState('')
  const shown = options.filter(([v]) => norm(v).includes(norm(q)))
  const sel = new Set(value)
  return (
    <>
      <PopTitle>{col.label}</PopTitle>
      {options.length > 8 && <input className="input mb-2 w-full" autoFocus placeholder="Szukaj wartości…" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="mb-1.5 flex justify-between text-xs">
        <button className="link" onClick={() => onChange([...new Set([...value, ...shown.map(([v]) => v)])])}>Zaznacz {q ? 'znalezione' : 'wszystkie'}</button>
        <button className="link" onClick={() => onChange([])}>Wyczyść</button>
      </div>
      {shown.map(([v, n]) => (
        <CheckRow key={v} checked={sel.has(v)} count={n} dim={!n} onChange={(on) => onChange(on ? [...value, v] : value.filter((x) => x !== v))}>
          {v}
        </CheckRow>
      ))}
      {!shown.length && <div className="px-1.5 py-1 text-xs text-slate-400">brak wartości</div>}
    </>
  )
}

function RangeFilter({ col, value, onChange }) {
  const type = col.filter === 'date' ? 'date' : 'number'
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <>
      <PopTitle>{col.label}</PopTitle>
      <div className="grid gap-2">
        <label className="grid grid-cols-[28px_1fr] items-center text-xs text-slate-500">od<input className="input w-full" type={type} value={value.min ?? ''} onChange={(e) => set('min', e.target.value)} autoFocus /></label>
        <label className="grid grid-cols-[28px_1fr] items-center text-xs text-slate-500">do<input className="input w-full" type={type} value={value.max ?? ''} onChange={(e) => set('max', e.target.value)} /></label>
      </div>
      {col.presets && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {col.presets.map((p) => (
            <button key={p.label} className="btn px-2 py-0.5 text-xs" onClick={() => onChange(p.value)}>{p.label}</button>
          ))}
        </div>
      )}
      <div className="mt-2 text-right text-xs"><button className="link" onClick={() => onChange({})}>Wyczyść</button></div>
    </>
  )
}

function Popover({ anchor, onClose, width, children }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const close = useRef(onClose)
  close.current = onClose

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) })
  }, [anchor, width])

  useEffect(() => {
    const down = (e) => { if (!ref.current?.contains(e.target) && !anchor.contains(e.target)) close.current() }
    const key = (e) => { if (e.key === 'Escape') close.current() }
    const scroll = (e) => { if (!ref.current?.contains(e.target)) close.current() }
    const resize = () => close.current()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', resize)
    }
  }, [anchor])

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-xl"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width, maxHeight: pos ? `calc(100vh - ${pos.top + 12}px)` : undefined }}
    >
      {children}
    </div>,
    document.body,
  )
}
