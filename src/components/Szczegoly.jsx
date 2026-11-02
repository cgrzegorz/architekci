import { useEffect } from 'react'
import { data, domyTxt, formatDate, PARAM, powody } from '../analysis.js'
import { Niepewne, Stack, Tel, Www } from './ui.jsx'

const PODSTAWA = new Map((data.elektrycy || []).map((e) => [e.osoba, e]))

const TYP_EDGE = { brak: 'border-l-hot', inny: 'border-l-warm', staly: 'border-l-staly', nieznany: 'border-l-unk/50' }

export default function Szczegoly({ row: r, onClose }) {
  const o = r.osoba || {}
  useEffect(() => {
    const key = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white px-6 pb-10 pt-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-4 top-3 text-3xl leading-none text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Zamknij">×</button>

        <div className="flex flex-wrap items-center gap-2 pr-8">
          <h2 className="text-xl font-bold text-slate-900">{r.name}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {o.firma && <>{o.firma} · </>}upr. {r.wnioski[0]?.nr_uprawnien}
          {r.powiatyN.length > 0 && <> · składa w: {r.powiatyN.map(([p, n]) => `pow. ${p} (${n})`).join(', ')}</>}
        </p>

        <div className="mt-4 grid grid-cols-5 gap-2">
          {[
            [r.nZlozone, 'złożonych wniosków'],
            [r.ost6, `w ost. ${PARAM.polowaZycia} mies.`],
            [r.wolne, 'bez stałego el.'],
            [r.domy, 'domów łącznie'],
            [formatDate(r.ostatni).slice(0, 5), 'ostatni wniosek'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
              <div className="text-lg font-bold text-slate-900">{v}</div>
              <div className="text-[11px] leading-tight text-slate-500">{l}</div>
            </div>
          ))}
        </div>

        <Stack r={r} className="mt-4 h-3 w-full" />
        <p className="mt-1.5 text-xs text-slate-500">
          <i className="dot bg-staly" /> stały elektryk {r.nStaly} · <i className="dot bg-warm" /> inny {r.nInny} · <i className="dot bg-hot" /> brak {r.nBrak}
          {r.nNieznany > 0 && <> · <i className="dot bg-unk/50" /> nie wiadomo {r.nNieznany}</>}
        </p>

        <ul className="mt-3 space-y-1 text-sm">
          {powody(r).map(([z, t], i) => (
            <li key={i} className="flex gap-2">
              <span className={`w-3 font-bold ${z === '+' ? 'text-hot' : z === '?' ? 'text-violet-600' : 'text-red-600'}`}>{z}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>


        <Section title="Kontakt">
          <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 text-sm">
            {o.firma && (<><dt className="muted">Firma</dt><dd>{o.firma}</dd></>)}
            {o.telefon && (<><dt className="muted">Telefon</dt><dd><Tel v={o.telefon} /><Niepewne o={o} /></dd></>)}
            {o.email && (<><dt className="muted">E-mail</dt><dd><a href={'mailto:' + o.email}>{o.email}</a></dd></>)}
            {o.www && (<><dt className="muted">WWW</dt><dd><Www v={o.www} /></dd></>)}
            {o.adres && (<><dt className="muted">Adres</dt><dd>{o.adres}</dd></>)}
            {o.zrodlo_kontaktu && (<><dt className="muted">Źródło</dt><dd>{o.zrodlo_kontaktu}</dd></>)}
            {o.pewnosc_kontaktu === 'niepewne' && (<><dt className="muted">Uwaga</dt><dd className="text-amber-700">Kontakt niepewny – sprawdź przed dzwonieniem.{o.uwagi_kontakt && <> {o.uwagi_kontakt}</>}</dd></>)}
            {!o.telefon && !o.email && (<><dt className="muted">Brak</dt><dd>Brak telefonu i e-maila w bazie{o.adres ? ' – jest tylko adres' : ''}. Uzupełnij w <code>data/kontakty.csv</code>.</dd></>)}
          </dl>
        </Section>

        <Section title="Z kim robi elektrykę">
          {r.elektrycy.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {r.elektrycy.map(([name, n]) => (
                <li key={name} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {name}
                    {name === r.staly && <span className="badge ml-2 bg-slate-100 text-slate-500">stały</span>}
                    {PODSTAWA.get(name) && (
                      <span className="block text-xs text-slate-400">
                        {PODSTAWA.get(name).pewnosc === 'pewny' ? `elektryk pewny: ${PODSTAWA.get(name).podstawa}` : `elektryk wywnioskowany: ${PODSTAWA.get(name).podstawa}`}
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-slate-500">{n} wn. ({Math.round((100 * n) / r.n)}%)</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">W żadnym wniosku nie ma elektryka w zespole.</p>
          )}
        </Section>

        <Section title={`Złożone wnioski – historia (${r.n})`}>
          <ul className="space-y-2">
            {r.pozycje.map(({ w, domy, typ }) => {
              const el = w.elektryk_pewny || w.elektryk_prawdopodobny
              return (
                <li key={w.gunb_id} className={`border-l-[3px] py-1 pl-3 text-sm ${TYP_EDGE[typ]}`}>
                  <div>
                    <b>{formatDate(w.data_zlozenia)}</b> · {w.miejscowosc} <span className="text-slate-500">(pow. {w.powiat})</span> · {w.rodzaj_zamierzenia}
                    {w.kubatura_m3 && <> · {w.kubatura_m3} m³</>}
                    {domy > 1 && <> · <b>{domyTxt(domy)}</b></>}
                  </div>
                  <div className="text-xs text-slate-700">{w.zamierzenie}</div>
                  <div className="text-xs text-slate-500">
                    {w.stan} · elektryk: {el ? `${el}${w.elektryk_pewny ? '' : ' (prawdop.)'}` : typ === 'nieznany' ? <span className="text-violet-600">nie wiadomo (zespół niewpisany)</span> : <b className="text-hot">brak</b>} ·{' '}
                    <a href={w.link} target="_blank" rel="noreferrer">GUNB ↗</a>
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>

        <details className="mt-6 text-sm text-slate-600">
          <summary className="cursor-pointer font-semibold">Dla dociekliwych: jak policzono kolejność</summary>
          <p className="mt-2 text-xs leading-relaxed">
            Aktywność {r.aktywnosc.toFixed(1)} (wnioski ważone świeżością, rodzajem i liczbą domów) × szansa wejścia{' '}
            {Math.round(r.otwartosc * 100)}% = {r.dostepne.toFixed(1)} ważonych projektów bez stałego elektryka → miejsce {r.miejsce} na liście.
            To dane historyczne (wnioski już złożone) – wskazują tylko, czy kolejne projekty mogą trafić do nas.
          </p>
        </details>
      </aside>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  )
}
