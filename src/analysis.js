import baza from './data/baza.json'

export const data = baza
export const POWIATY = (baza.powiaty || []).map((p) => p.powiat)

const NIE_WPISANO = '(nie wpisano)'

/* ───────────── parametry algorytmu (wszystkie w jednym miejscu) ───────────── */
export const PARAM = {
  polowaZycia: 6, // mies. – wniosek sprzed 6 mies. waży połowę, sprzed roku ¼
  wartoscRodzaju: { budowa: 1, nadbudowa: 0.7, rozbudowa: 0.6, inne: 0.4 },
  dostep: { brak: 1, inny: 0.6, staly: 0.05 }, // szansa wejścia przy danym wniosku; „nieznany” = średnia rynku
  minPokrycie: 0.5, // gdy < 50% (ważonych) wniosków ma wpisanych branżystów, nie wiadomo, kto robi elektrykę → priorytet „?”
  stalyMinUdzial: 0.5, // „stały elektryk” robi ≥ 50% (ważonych świeżością) projektów architekta …
  stalyMinLiczba: 2, //  … i co najmniej 2 wnioski
  zastepstwoUdzial: 0.75, // ≥ 75% → architekt związany z jednym elektrykiem, szansa tylko na zastępstwo
  wygladzanie: 2, // „wirtualne” przeciętne wnioski dodawane przy liczeniu otwartości (chroni przed 1–2 wnioskami)
  nasycenie: 6, // skala wyniku: przy 6 ważonych projektach bez stałego elektryka wynik ≈ 63, przy 12 ≈ 86
  progA: 3, // A: bez stałego elektryka i ≥ 3 ważone projekty bez stałego elektryka
  progB: 1, // B: ≥ 1 ważony projekt bez stałego elektryka i nie związany z jednym elektrykiem
}

export const PRIORYTETY = ['A', 'B', '?', 'C', 'D', '—']
export const OPIS_PRIORYTETU = {
  A: 'Dzwoń najpierw',
  B: 'Warto zadzwonić',
  '?': 'Nie wiadomo – zapytaj',
  C: 'Tylko zastępstwo',
  D: 'Mało projektów',
  '—': 'Za mało danych',
}
const KLASA = { A: 'hot', B: 'warm', '?': 'unk', C: 'sub', D: 'cold', '—': 'cold' }

/**
 * Status zespołu we wniosku (wyznaczany w build_data.py):
 *   elektryk      – w zespole jest elektryk,
 *   bez_elektryka – urząd wpisał branżystów (konstruktor/sanitarny), elektryka wśród nich nie ma → realnie wolne miejsce,
 *   nieznany      – zespół pusty albo sam współautor; niektóre starostwa (np. wieruszowskie) nie wpisują branżystów,
 *                   więc brak elektryka NIC nie mówi.
 */
export function statusZespolu(w) {
  if (w.elektryk_pewny || w.elektryk_prawdopodobny) return 'elektryk'
  return w.zespol_status || 'bez_elektryka'
}

/** Elektryk przypisany do wniosku: pewny (specjalność w nr uprawnień) albo prawdopodobny. */
export function elektrykWniosku(w) {
  if (w.elektryk_pewny) return { name: w.elektryk_pewny, pewny: true }
  if (w.elektryk_prawdopodobny) return { name: w.elektryk_prawdopodobny, pewny: false }
  return null
}

const pobranieWg = new Map((baza.powiaty || []).map((p) => [p.powiat, p.data_pobrania]))
export const dataPobrania = baza.wnioski.reduce((m, w) => (w.data_pobrania > m ? w.data_pobrania : m), '0000-00-00')

const LICZEBNIKI = { dwóch: 2, trzech: 3, czterech: 4, pięciu: 5, sześciu: 6, siedmiu: 7, ośmiu: 8, dziewięciu: 9, dziesięciu: 10 }
/** „Budowa zespołu 25-ciu / ośmiu budynków mieszkalnych …” → liczba domów (domyślnie 1). */
export function liczbaDomow(zamierzenie) {
  const m = (zamierzenie || '').toLowerCase().match(/(\d+)(?:-?\s?\w{0,3})?\s+budynk|(dwóch|trzech|czterech|pięciu|sześciu|siedmiu|ośmiu|dziewięciu|dziesięciu)\s+budynk/)
  if (!m) return 1
  return m[1] ? Math.min(+m[1], 50) : LICZEBNIKI[m[2]]
}

function wiekMies(w) {
  const ref = new Date((pobranieWg.get(w.powiat) || w.data_pobrania || dataPobrania) + 'T00:00:00')
  const d = new Date(w.data_zlozenia + 'T00:00:00')
  return Math.max(0, (ref - d) / (1000 * 60 * 60 * 24 * 30.44))
}

/** Waga wniosku = świeżość × wartość zlecenia (rodzaj × liczba domów). */
export function wagaWniosku(w) {
  const swiezosc = Math.pow(0.5, wiekMies(w) / PARAM.polowaZycia)
  const rodzaj = PARAM.wartoscRodzaju[w.rodzaj_zamierzenia] ?? 0.5
  const domy = liczbaDomow(w.zamierzenie)
  return { swiezosc, rodzaj, domy, waga: swiezosc * rodzaj * (1 + Math.log2(domy)) }
}

const osobyByName = new Map(baza.osoby.map((o) => [o.imie_nazwisko, o]))

export function wnioskiPowiatu(powiat) {
  return powiat ? baza.wnioski.filter((w) => w.powiat === powiat) : baza.wnioski
}

/**
 * Ranking projektantów głównych – liczony wyłącznie z wniosków GUNB.
 *
 * 1. Waga wniosku = świeżość (półokres 6 mies.) × rodzaj (budowa 1 … inne 0,4) × (1 + log2 liczby domów).
 * 2. Stały elektryk = ten, kto ma ≥ 50% WAŻONYCH projektów architekta (min. 2 wnioski) – liczą się głównie świeże,
 *    więc architekt, który niedawno zmienił elektryka, nie jest oceniany po starych projektach.
 * 3. Dostęp do wniosku: brak elektryka 1 · inny elektryk 0,6 · stały elektryk 0,05.
 * 4. Aktywność A = Σ waga, otwartość O = (Σ waga·dostęp + 2·średnia rynku) / (Σ waga + 2),
 *    D = A × O, wynik = 100 × (1 − e^(−D/6)). Wnioski są już złożone (elektryka w nich przesądzona) – D mówi tylko,
 *    ile ważonych projektów architekt ostatnio złożył BEZ stałego elektryka, czyli czy jego KOLEJNE projekty mogą trafić do nas.
 * 5. Priorytet:
 *      C – stały elektryk robi ≥ 75% (ważonych) projektów → tylko zastępstwo
 *      A – brak stałego elektryka i D ≥ 3
 *      B – D ≥ 1 (w tym: stały elektryk ma 50–75%, część projektów trafia gdzie indziej)
 *      D – reszta (mało projektów),  „—” – tylko 1 wniosek
 */
export function buildRanking(wnioski = baza.wnioski) {
  const groups = new Map()
  const zlozone = new Map() // wszystkie złożone wnioski architekta (także wycofane)
  for (const w of wnioski) {
    if (!w.projektant || w.projektant === NIE_WPISANO) continue
    zlozone.set(w.projektant, (zlozone.get(w.projektant) || 0) + 1)
    if (w.stan && w.stan.startsWith('Wycofany')) continue
    if (!groups.has(w.projektant)) groups.set(w.projektant, [])
    groups.get(w.projektant).push(w)
  }

  const rows = []
  for (const [name, lista] of groups) {
    const base = lista.map((w) => ({ w, e: elektrykWniosku(w), znany: statusZespolu(w) !== 'nieznany', ...wagaWniosku(w) }))
    const W = base.reduce((s, p) => s + p.waga, 0)
    const Wz = base.reduce((s, p) => s + (p.znany ? p.waga : 0), 0) // waga wniosków, w których wiadomo, czy jest elektryk

    const el = new Map() // elektryk → { n, waga }
    for (const p of base) {
      if (!p.e) continue
      const x = el.get(p.e.name) || { n: 0, waga: 0 }
      x.n++
      x.waga += p.waga
      el.set(p.e.name, x)
    }
    const elektrycy = [...el.entries()].sort((a, b) => b[1].waga - a[1].waga || b[1].n - a[1].n).map(([k, v]) => [k, v.n, v.waga])
    const [top, topN, topW] = elektrycy[0] || [null, 0, 0]
    const udzialTop = Wz ? topW / Wz : 0 // udział liczony tylko z wniosków o znanym zespole
    // stały elektryk tylko wtedy, gdy wiadomo coś o większości projektów (np. Kula: 3 z 67 wniosków ze znanym zespołem → nie wiadomo)
    const staly = topN >= PARAM.stalyMinLiczba && udzialTop >= PARAM.stalyMinUdzial && Wz >= PARAM.minPokrycie * W ? top : null

    const pozycje = base
      .map((p) => {
        const typ = p.e ? (p.e.name === staly ? 'staly' : 'inny') : p.znany ? 'brak' : 'nieznany'
        return { ...p, typ, dostep: PARAM.dostep[typ] ?? null }
      })
      .sort((a, b) => (a.w.data_zlozenia < b.w.data_zlozenia ? 1 : -1))

    const n = lista.length
    const ile = (t) => pozycje.filter((p) => p.typ === t).length
    const osoba = osobyByName.get(name) || null
    rows.push({
      name,
      osoba,
      id: osoba?.osoba_id || name,
      pozycje,
      wnioski: pozycje.map((p) => p.w),
      n,
      nZlozone: zlozone.get(name) || n,
      nStaly: ile('staly'),
      nInny: ile('inny'),
      nBrak: ile('brak'),
      nNieznany: ile('nieznany'),
      wolne: n - ile('staly') - ile('nieznany'),
      pokrycie: W ? Wz / W : 0,
      staly,
      udzialStalego: staly ? udzialTop : 0,
      elektrycy: elektrycy.map(([k, c]) => [k, c]),
      sumaDostepZnane: pozycje.reduce((s, p) => s + (p.znany ? p.waga * p.dostep : 0), 0),
      aktywnoscZnane: Wz,
      aktywnosc: W,
      domy: pozycje.reduce((s, p) => s + p.domy, 0),
      ost6: pozycje.filter((p) => p.swiezosc >= 0.5).length,
      ostatni: pozycje[0]?.w.data_zlozenia || '',
      powiaty: [...new Set(lista.map((w) => w.powiat).filter(Boolean))],
      // gdzie (w którym starostwie) składa wnioski: [[powiat, liczba], …] od największej
      powiatyN: [...lista.reduce((m, w) => (w.powiat ? m.set(w.powiat, (m.get(w.powiat) || 0) + 1) : m), new Map())].sort((a, b) => b[1] - a[1]),
      miejscowosci: [...new Set(lista.map((w) => w.miejscowosc).filter(Boolean))],
      // projektanci sanitarni w zespołach architekta: [[osoba, liczba], …] od najczęstszego
      sanitarni: [...lista.reduce((m, w) => (w.sanitarny ? m.set(w.sanitarny, (m.get(w.sanitarny) || 0) + 1) : m), new Map())].sort((a, b) => b[1] - a[1]),
    })
  }

  // średni (ważony) dostęp na rynku – liczony tylko z wniosków o znanym zespole; punkt odniesienia przy wygładzaniu
  // otwartości i zastępcza wartość dla wniosków, w których nie wiadomo, kto robi elektrykę
  const wAll = rows.reduce((s, r) => s + r.aktywnoscZnane, 0)
  const sredniDostep = wAll ? rows.reduce((s, r) => s + r.sumaDostepZnane, 0) / wAll : 0.5
  const k = PARAM.wygladzanie
  for (const r of rows) {
    for (const p of r.pozycje) if (p.typ === 'nieznany') p.dostep = sredniDostep
    r.sumaDostep = r.pozycje.reduce((s, p) => s + p.waga * p.dostep, 0)
    r.otwartosc = (r.sumaDostep + k * sredniDostep) / (r.aktywnosc + k)
    r.dostepne = r.aktywnosc * r.otwartosc
    r.wynik = Math.round(100 * (1 - Math.exp(-r.dostepne / PARAM.nasycenie)))
    r.priorytet = priorytet(r)
    r.rekomendacja = { klasa: KLASA[r.priorytet.p], tekst: OPIS_PRIORYTETU[r.priorytet.p] }
  }
  rows.sort((a, b) => b.nZlozone - a.nZlozone || (a.ostatni < b.ostatni ? 1 : a.ostatni > b.ostatni ? -1 : 0))
  rows.forEach((r, i) => (r.miejsce = i + 1))
  return rows
}

const proc = (x) => `${Math.round(100 * x)}%`
const trafia = (n) => `${n} ${n === 1 ? 'projekt trafia' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'projekty trafiają' : 'projektów trafia'}`

/** Priorytet A–D + jedno zdanie „dlaczego”. */
function priorytet(r) {
  const D = r.dostepne.toFixed(1).replace('.', ',')
  if (r.n < 2) return { p: '—', powod: 'tylko 1 wniosek – za mało danych, żeby ocenić' }
  if (r.pokrycie < PARAM.minPokrycie && !r.staly && r.dostepne >= PARAM.progB) {
    const pow = r.powiatyN.map(([p]) => p).join(', ')
    return {
      p: '?',
      powod: `w ${r.nNieznany} z ${r.n} wniosków urząd (pow. ${pow}) nie wpisał branżystów – nie wiadomo, kto robi mu elektrykę. Projektuje dużo (${wn(r.n)}, ${r.ost6} świeżych) – zadzwoń i zapytaj`,
    }
  }
  if (r.staly && r.udzialStalego >= PARAM.zastepstwoUdzial)
    return { p: 'C', powod: `${r.staly} robi ${r.nStaly} z ${r.n} projektów (${proc(r.udzialStalego)} ważonych świeżością) – szansa tylko na zastępstwo` }
  if (!r.staly && r.dostepne >= PARAM.progA)
    return { p: 'A', powod: `nie ma stałego elektryka, ${wn(r.n)} (${r.ost6} świeżych), ok. ${D} ważonych projektów bez stałego elektryka – kolejne też mogą trafić do nas` }
  if (r.dostepne >= PARAM.progB)
    return r.staly
      ? { p: 'B', powod: `${r.staly} robi ${r.nStaly} z ${r.n} (${proc(r.udzialStalego)}), ale ${trafia(r.wolne)} do innych lub bez elektryka` }
      : { p: 'B', powod: `nie ma stałego elektryka, ale projektuje mniej (${wn(r.n)}, ${r.ost6} świeżych)` }
  return { p: 'D', powod: `mało świeżych projektów (${wn(r.n)}, ${r.ost6} z ostatnich ${PARAM.polowaZycia} mies.)` }
}

export const domyTxt = (n) => `${n} ${n === 1 ? 'dom' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'domy' : 'domów'}`

const wn = (n) => `${n} ${n === 1 ? 'wniosek' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'wnioski' : 'wniosków'}`
export const wnTxt = wn

/** Jedno–dwa zdania po ludzku: dlaczego ten architekt jest (albo nie jest) dobrym celem. */
export function opis(r) {
  const ruch = `${wn(r.n)}${r.ost6 ? `, z tego ${r.ost6} w ostatnich ${PARAM.polowaZycia} mies.` : ', żaden w ostatnich 6 mies.'}`
  let elektryka
  if (r.pokrycie < PARAM.minPokrycie && !r.staly)
    elektryka = `W ${r.nNieznany} z ${r.n} wniosków urząd nie wpisał branżystów – nie wiadomo, czy ma stałego elektryka.${r.nInny ? ` Tam, gdzie zespół jest znany, elektrykę robią: ${r.elektrycy.map(([k]) => k).join(', ')}.` : ''}`
  else if (!r.nStaly && !r.nInny) elektryka = 'W żadnym projekcie nie ma elektryka w zespole – nikt tu jeszcze nie siedzi.'
  else if (!r.staly && r.nBrak) elektryka = `Nie ma stałego elektryka: elektrykę w projektach robią różne osoby, a w ${wn(r.nBrak)} nie ma nikogo.`
  else if (!r.staly) elektryka = 'Nie ma stałego elektryka – elektrykę w projektach robią różne osoby.'
  else if (r.nStaly === r.n) elektryka = `Całą elektrykę robi ${r.staly}. Szansa tylko na zastępstwo (urlop, natłok, pilny termin).`
  else
    elektryka = `Najczęściej pracuje z: ${r.staly} (${r.nStaly} z ${r.n}), ale ${wn(r.wolne)} ${r.wolne === 1 ? 'trafił' : 'trafiło'} do innych albo bez elektryka.`
  const duze = r.pozycje.filter((p) => p.domy > 1).sort((a, b) => b.domy - a.domy)[0]
  const extra = duze ? ` Ma inwestycję na ${domyTxt(duze.domy)} (${duze.w.miejscowosc}).` : ''
  return { ruch, elektryka: elektryka + extra }
}

/** Co przemawia za / przeciw – krótkie powody do panelu szczegółów. */
export function powody(r) {
  const out = []
  if (r.nBrak) out.push(['+', `${r.nBrak} z ${r.n} wniosków bez elektryka w zespole`])
  if (r.nNieznany) out.push(['?', `${r.nNieznany} z ${r.n} wniosków bez wpisanych branżystów – nie wiadomo, kto robił elektrykę`])
  if (r.nInny) out.push(['+', `${r.nInny} wniosków robi ${r.staly ? 'ktoś inny niż stały elektryk' : 'kilku różnych elektryków'}`])
  if (r.staly) out.push(['−', `stały elektryk: ${r.staly} (${r.nStaly} z ${r.n})`])
  const swieze = r.pozycje.filter((p) => p.swiezosc >= 0.5).length
  out.push([swieze >= 3 ? '+' : '−', `${swieze} wniosków w ostatnich ${PARAM.polowaZycia} mies.`])
  const duze = r.pozycje.filter((p) => p.domy > 1)
  if (duze.length) out.push(['+', `inwestycje wielodomowe: ${duze.map((p) => domyTxt(p.domy)).join(', ')}`])
  if (r.powiatyN.length > 1) out.push(['+', `składa wnioski w kilku starostwach: ${r.powiatyN.map(([p, n]) => `pow. ${p} – ${wn(n)}`).join(', ')}`])
  if (r.n <= 2) out.push(['−', 'mało danych – wynik orientacyjny'])
  return out
}

export function wnioskiMiesiecznie(wnioski = baza.wnioski) {
  const m = new Map()
  for (const w of wnioski) {
    if (!w.data_zlozenia) continue
    const k = w.data_zlozenia.slice(0, 7)
    if (!m.has(k)) m.set(k, { brak: 0, z: 0, nieznany: 0 })
    const st = statusZespolu(w)
    m.get(k)[st === 'elektryk' ? 'z' : st === 'nieznany' ? 'nieznany' : 'brak']++
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

export function udzialElektrykow(wnioski = baza.wnioski) {
  const m = new Map()
  for (const w of wnioski) {
    const e = elektrykWniosku(w)
    const st = statusZespolu(w)
    const k = e ? e.name : st === 'nieznany' ? 'nie wiadomo (zespół niewpisany)' : 'brak elektryka w zespole'
    m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export function topMiejscowosci(wnioski = baza.wnioski, n = 12) {
  const m = new Map()
  for (const w of wnioski) if (w.miejscowosc) m.set(w.miejscowosc, (m.get(w.miejscowosc) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

export function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
