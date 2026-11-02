import baza from './data/baza.json'

export const data = baza
export const POWIATY = (baza.powiaty || []).map((p) => p.powiat)

const NIE_WPISANO = '(nie wpisano)'

/* ───────────── parametry algorytmu (wszystkie w jednym miejscu) ───────────── */
export const PARAM = {
  polowaZycia: 6, // mies. – wniosek sprzed 6 mies. waży połowę, sprzed roku ¼
  wartoscRodzaju: { budowa: 1, nadbudowa: 0.7, rozbudowa: 0.6, inne: 0.4 },
  dostep: { brak: 1, inny: 0.6, staly: 0.05 }, // szansa wejścia przy danym wniosku
  stalyMinUdzial: 0.5, // „stały elektryk” robi ≥ 50% wniosków architekta …
  stalyMinLiczba: 2, //  … i co najmniej 2 wnioski
  wygladzanie: 2, // tyle „wirtualnych” przeciętnych wniosków dodajemy przy liczeniu otwartości
  nasycenie: 6, // przy 6 dostępnych (ważonych) projektach wynik ≈ 63, przy 12 ≈ 86
  progi: { hot: 55, warm: 30, zastepstwoUdzial: 0.75, zastepstwoMinAktywnosc: 6 },
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
 * Ranking projektantów głównych – wersja 2.
 *
 * 1. Dla architekta szukamy „stałego elektryka” (≥ 50% jego wniosków, min. 2).
 * 2. Każdy wniosek dostaje:
 *      dostęp  – brak elektryka 1 · inny elektryk 0,6 · stały elektryk 0,05
 *      waga    – świeżość (półokres 6 mies.) × rodzaj (budowa 1 … inne 0,4) × (1 + log2 liczby domów)
 * 3. Aktywność A   = Σ waga                    – ile świeżej pracy produkuje architekt
 *    Otwartość O   = (Σ dostęp + 2·średnia) / (n + 2)  – wygładzona, żeby 1–2 wnioski nie dawały 100%
 *    Dostępne D    = A × O                      – ile zleceń realnie do wzięcia
 *    Wynik         = 100 × (1 − e^(−D/6))       – skala bezwzględna, porównywalna między powiatami
 */
export function buildRanking(wnioski = baza.wnioski) {
  const groups = new Map()
  for (const w of wnioski) {
    if (!w.projektant || w.projektant === NIE_WPISANO) continue
    if (w.stan && w.stan.startsWith('Wycofany')) continue
    if (!groups.has(w.projektant)) groups.set(w.projektant, [])
    groups.get(w.projektant).push(w)
  }

  const rows = []
  for (const [name, lista] of groups) {
    const counts = new Map()
    for (const w of lista) {
      const e = elektrykWniosku(w)
      if (e) counts.set(e.name, (counts.get(e.name) || 0) + 1)
    }
    const elektrycy = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const [top, topN] = elektrycy[0] || [null, 0]
    const staly = topN >= PARAM.stalyMinLiczba && topN / lista.length >= PARAM.stalyMinUdzial ? top : null

    const pozycje = lista
      .map((w) => {
        const e = elektrykWniosku(w)
        const typ = !e ? 'brak' : e.name === staly ? 'staly' : 'inny'
        return { w, typ, dostep: PARAM.dostep[typ], ...wagaWniosku(w) }
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
      nStaly: ile('staly'),
      nInny: ile('inny'),
      nBrak: ile('brak'),
      wolne: n - ile('staly'),
      staly,
      elektrycy,
      sumaDostep: pozycje.reduce((s, p) => s + p.dostep, 0),
      aktywnosc: pozycje.reduce((s, p) => s + p.waga, 0),
      domy: pozycje.reduce((s, p) => s + p.domy, 0),
      ost6: pozycje.filter((p) => p.swiezosc >= 0.5).length,
      ostatni: pozycje[0]?.w.data_zlozenia || '',
      powiaty: [...new Set(lista.map((w) => w.powiat).filter(Boolean))],
      miejscowosci: [...new Set(lista.map((w) => w.miejscowosc).filter(Boolean))],
    })
  }

  // średni dostęp na rynku – punkt odniesienia przy wygładzaniu otwartości
  const nAll = rows.reduce((s, r) => s + r.n, 0)
  const sredniDostep = nAll ? rows.reduce((s, r) => s + r.sumaDostep, 0) / nAll : 0.5
  const k = PARAM.wygladzanie
  for (const r of rows) {
    r.otwartosc = (r.sumaDostep + k * sredniDostep) / (r.n + k)
    r.dostepne = r.aktywnosc * r.otwartosc
    r.wynik = Math.round(100 * (1 - Math.exp(-r.dostepne / PARAM.nasycenie)))
    r.rekomendacja = rekomendacja(r)
  }
  rows.sort((a, b) => b.wynik - a.wynik || b.n - a.n)
  rows.forEach((r, i) => (r.miejsce = i + 1))
  return rows
}

function rekomendacja(r) {
  const p = PARAM.progi
  const zwiazany = r.staly && r.nStaly / r.n >= p.zastepstwoUdzial // prawie wszystko robi jeden elektryk
  if (r.wynik >= p.hot) return { klasa: 'hot', tekst: 'Duża szansa' }
  if (r.wynik >= p.warm && !zwiazany) return { klasa: 'warm', tekst: 'Średnia szansa' }
  if (r.staly && r.aktywnosc >= p.zastepstwoMinAktywnosc) return { klasa: 'sub', tekst: 'Tylko zastępstwo' }
  return { klasa: 'cold', tekst: 'Mała szansa' }
}

export const domyTxt = (n) => `${n} ${n === 1 ? 'dom' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'domy' : 'domów'}`

const wn = (n) => `${n} ${n === 1 ? 'wniosek' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'wnioski' : 'wniosków'}`
export const wnTxt = wn

/** Jedno–dwa zdania po ludzku: dlaczego ten architekt jest (albo nie jest) dobrym celem. */
export function opis(r) {
  const ruch = `${wn(r.n)}${r.ost6 ? `, z tego ${r.ost6} w ostatnich ${PARAM.polowaZycia} mies.` : ', żaden w ostatnich 6 mies.'}`
  let elektryka
  if (!r.nStaly && !r.nInny) elektryka = 'W żadnym projekcie nie ma elektryka w zespole – nikt tu jeszcze nie siedzi.'
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
  if (r.nInny) out.push(['+', `${r.nInny} wniosków robi ${r.staly ? 'ktoś inny niż stały elektryk' : 'kilku różnych elektryków'}`])
  if (r.staly) out.push(['−', `stały elektryk: ${r.staly} (${r.nStaly} z ${r.n})`])
  const swieze = r.pozycje.filter((p) => p.swiezosc >= 0.5).length
  out.push([swieze >= 3 ? '+' : '−', `${swieze} wniosków w ostatnich ${PARAM.polowaZycia} mies.`])
  const duze = r.pozycje.filter((p) => p.domy > 1)
  if (duze.length) out.push(['+', `inwestycje wielodomowe: ${duze.map((p) => domyTxt(p.domy)).join(', ')}`])
  if (r.powiaty.length > 1) out.push(['+', `działa w kilku powiatach: ${r.powiaty.join(', ')}`])
  if (r.n <= 2) out.push(['−', 'mało danych – wynik orientacyjny'])
  return out
}

export function wnioskiMiesiecznie(wnioski = baza.wnioski) {
  const m = new Map()
  for (const w of wnioski) {
    if (!w.data_zlozenia) continue
    const k = w.data_zlozenia.slice(0, 7)
    if (!m.has(k)) m.set(k, { brak: 0, z: 0 })
    m.get(k)[elektrykWniosku(w) ? 'z' : 'brak']++
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

export function udzialElektrykow(wnioski = baza.wnioski) {
  const m = new Map()
  for (const w of wnioski) {
    const e = elektrykWniosku(w)
    const k = e ? e.name : 'brak elektryka w zespole'
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
