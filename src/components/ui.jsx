/* Drobne elementy wspólne dla kilku widoków (klasy Tailwind muszą być pełnymi napisami, żeby trafiły do CSS). */

export const REK = {
  hot: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  warm: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  sub: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
  unk: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20',
  cold: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-400/20',
}

export const EDGE = {
  hot: 'border-l-hot',
  warm: 'border-l-warm',
  sub: 'border-l-sub',
  unk: 'border-l-unk',
  cold: 'border-l-transparent',
}

const PRIO = {
  A: 'bg-emerald-600 text-white',
  B: 'bg-amber-500 text-white',
  '?': 'bg-violet-500 text-white',
  C: 'bg-blue-500 text-white',
  D: 'bg-slate-300 text-slate-700',
}

export function Rek({ r }) {
  return <span className={`badge ${REK[r.rekomendacja.klasa]}`}>{r.rekomendacja.tekst}</span>
}

export function Prio({ r, full }) {
  const p = r.priorytet.p
  return (
    <span className="inline-flex items-center gap-2" title={r.priorytet.powod}>
      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${PRIO[p] || 'bg-slate-100 text-slate-400'}`}>{p}</span>
      {full && <span className="text-xs font-medium text-slate-700">{r.rekomendacja.tekst}</span>}
    </span>
  )
}

/** Pasek: stały elektryk / inni / bez elektryka. */
export function Stack({ r, className = 'h-2 w-28' }) {
  return (
    <div className={`flex overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div className="bg-staly" style={{ width: (100 * r.nStaly) / r.n + '%' }} />
      <div className="bg-warm" style={{ width: (100 * r.nInny) / r.n + '%' }} />
      <div className="bg-hot" style={{ width: (100 * r.nBrak) / r.n + '%' }} />
      <div className="bg-unk/50" style={{ width: (100 * (r.nNieznany || 0)) / r.n + '%' }} />
    </div>
  )
}

/** Pasek sanitarnych: najczęstszy / inni / nie wpisano sanitarnego. */
export function StackSan({ r, className = 'h-2 w-28' }) {
  const glowny = r.sanitarni[0]?.[1] || 0
  const inni = r.sanitarni.slice(1).reduce((s, [, n]) => s + n, 0)
  return (
    <div className={`flex overflow-hidden rounded-full bg-slate-100 ${className}`} title={`najczęstszy: ${glowny}, inni: ${inni}, bez sanitarnego w zespole: ${r.n - glowny - inni} (z ${r.n})`}>
      <div className="bg-staly" style={{ width: (100 * glowny) / r.n + '%' }} />
      <div className="bg-warm" style={{ width: (100 * inni) / r.n + '%' }} />
    </div>
  )
}

export function StackLegend() {
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <b className="text-slate-600">Pasek „Elektrycy”:</b>
        <span><i className="dot bg-staly" /> stały elektryk architekta</span>
        <span><i className="dot bg-warm" /> inni elektrycy</span>
        <span><i className="dot bg-hot" /> zespół bez elektryka</span>
        <span><i className="dot bg-unk/50" /> nie wiadomo (urząd nie wpisał zespołu)</span>
      </span>
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <b className="text-slate-600">Pasek „Sanitarni”:</b>
        <span><i className="dot bg-staly" /> najczęstszy sanitarny</span>
        <span><i className="dot bg-warm" /> inni sanitarni</span>
        <span><i className="dot bg-slate-200" /> brak sanitarnego w zespole lub nie wpisano</span>
      </span>
    </span>
  )
}

export function Score({ v }) {
  return (
    <div className="relative ml-auto h-5 w-20 overflow-hidden rounded-md bg-slate-100">
      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-300 to-hot" style={{ width: v + '%' }} />
      <span className="relative block text-center text-xs font-bold leading-5 text-slate-800">{v}</span>
    </div>
  )
}

export const Empty = () => <span className="text-slate-300">—</span>

/** „604 538 297, 62 784 22 71” → osobne linki tel: */
export function Tel({ v }) {
  return (v || '').split(/\s*[,;]\s*/).filter(Boolean).map((t, i) => (
    <span key={i}>{i > 0 && ', '}<a href={'tel:' + t.replace(/[^\d+]/g, '')}>{t}</a></span>
  ))
}

/** Adres www jako link; „Facebook: …” bez adresu – jako zwykły tekst. */
export function Www({ v, short }) {
  if (!v) return null
  if (!/^https?:\/\//.test(v)) return <span className="text-xs">{v}</span>
  const label = short ? v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : v
  return <a href={v} target="_blank" rel="noreferrer" className="break-all">{label}</a>
}

/** Znacznik przy kontakcie, którego nie udało się jednoznacznie przypisać. */
export const Niepewne = ({ o }) =>
  o?.pewnosc_kontaktu === 'niepewne' ? (
    <span className="ml-1 cursor-help rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800" title={'Kontakt niepewny: ' + (o.uwagi_kontakt || '')}>?</span>
  ) : null
