import { useEffect, useState } from 'react'
import { data } from './analysis.js'

const KEY = 'kontakty-architekci-v1'

export const STATUSY = data.slowniki.map((s) => s.status).filter(Boolean)

/** Start: wpisy z karty „rozmowy” (bez wiersza przykładowego), potem to, co zapiszesz w przeglądarce. */
function seed() {
  const out = {}
  for (const r of data.rozmowy) {
    if (!r.osoba_id || (r.notatka || '').startsWith('PRZYKŁAD')) continue
    out[r.osoba_id] = { status: r.status || '', notatka: r.notatka || '', nastepny_krok: r.nastepny_krok || '', data: r.data || '' }
  }
  return out
}

export function useKontakty() {
  const [kontakty, setKontakty] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
      return saved || seed()
    } catch {
      return seed()
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(kontakty))
    } catch {
      /* brak dostępu do localStorage – działamy w pamięci */
    }
  }, [kontakty])

  const update = (id, patch) =>
    setKontakty((k) => ({
      ...k,
      [id]: { ...(k[id] || {}), ...patch, data: new Date().toISOString().slice(0, 10) },
    }))

  return [kontakty, update]
}

/** CSV w kolumnach karty „rozmowy” – do wklejenia z powrotem do baza_zlecenia.xlsx. */
export function eksportCsv(kontakty, ranking) {
  const names = new Map(ranking.map((r) => [r.id, r.name]))
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [['data', 'osoba_id', 'imie_nazwisko', 'status', 'notatka', 'nastepny_krok'].join(';')]
  for (const [id, k] of Object.entries(kontakty)) {
    if (!k.status && !k.notatka && !k.nastepny_krok) continue
    lines.push([k.data, id, names.get(id) || '', k.status, k.notatka, k.nastepny_krok].map(esc).join(';'))
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `rozmowy_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
