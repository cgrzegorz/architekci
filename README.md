# Architekci → projekty elektryczne

Aplikacja React + Vite + Chart.js, która z bazy `data/baza_zlecenia.xlsx` (rejestr GUNB) wskazuje,
do których architektów warto zadzwonić z ofertą projektów elektrycznych.

## Uruchomienie
    npm install
    npm run dev        # http://localhost:5173

## Nowy powiat
1. Plik od agenta `gunb_<powiat>.md` wrzuć do `data/powiaty/`.
2. `npm run data` – łączy `data/baza_zlecenia.xlsx` + wszystkie `data/powiaty/gunb_*.md` w `src/data/baza.json`
   (Python 3, bez dodatkowych bibliotek). Duplikaty po gunb_id są pomijane, xlsx ma pierwszeństwo.
   Elektryków w zespole skrypt rozpoznaje sam (kod uprawnień …E/, opis „elektryczn…”, osoby z karty „osoby”).
3. Odśwież stronę – powiat pojawi się w przełączniku u góry i w zakładce „Powiaty”.

`npm run data:check` – test parsera: porównuje automatyczne rozpoznanie elektryków z ręcznym opisem w xlsx.

## Algorytm
Parametry są w jednym miejscu: `PARAM` w `src/analysis.js`. Opis: rozwiń „Jak liczony jest wynik?” pod rankingiem.

## Zakładki
- **Do kogo dzwonić** – ranking architektów (wynik 0–100), filtry, status rozmowy, eksport CSV do karty „rozmowy”.
- **Wykresy** – top 15 i struktura wniosków, mapa okazji (skala × otwartość), wnioski miesięcznie, udział elektryków, miejscowości.
- **Wnioski GUNB** – pełna lista z filtrem „tylko bez elektryka”.
- **Powiaty** – zestawienie powiatów, pominięte wnioski, uwagi z importu.
- **Biura** – kontakty do biur projektowych.

Statusy rozmów zapisują się w przeglądarce (localStorage). Przycisk „Eksport rozmów CSV” daje plik do wklejenia do karty „rozmowy”.

## Struktura
    data/baza_zlecenia.xlsx   baza główna (źródło)
    data/powiaty/             pliki gunb_<powiat>.md od agenta
    scripts/                  build_data.py, xlsx2json.py (Python 3, bez bibliotek)
    src/                      aplikacja React; src/data/baza.json jest generowany przez `npm run data`

## GitHub Pages
Strona: https://cgrzegorz.github.io/architekci/

    npm run deploy     # buduje dist/ i wypycha go na gałąź gh-pages (pakiet gh-pages)

W ustawieniach repo: Settings → Pages → Source: „Deploy from a branch”, gałąź `gh-pages`, folder `/ (root)`.
