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
   Obsługiwane są dwa formaty pliku: tabela z kolumnami `gunb_id | powiat | …` albo opisowy (sekcja „Tabela wniosków”
   z polskimi nagłówkami: Nr wniosku, Stan, …, Link; tabela „Wnioski pominięte” trafia do pominiętych, zestawienia są ignorowane).
   Nazwa powiatu jest brana z tytułu („# … powiat wieruszowski …”), a gdy go brak – z nazwy pliku.
   Kontakty do projektantów: `data/kontakty.csv` (separator `;`, kolumny projektant;firma;telefon;email;www;adres;pewnosc;zrodlo).
   Kilka numerów w jednym polu rozdzielaj przecinkiem. Dane z xlsx mają pierwszeństwo; `pewnosc=niepewne` → znak „?” przy telefonie.
3. Odśwież stronę – powiat pojawi się w przełączniku u góry i w zakładce „Powiaty”.

`npm run data:check` – test parsera: porównuje automatyczne rozpoznanie elektryków z ręcznym opisem w xlsx.

## Algorytm
Liczony wyłącznie z wniosków GUNB – ręczne kolumny elektryka, priorytety i notatki z xlsx są ignorowane.
1. **Elektryk w zespole** (`scripts/build_data.py`): kod specjalności w uprawnieniach (…/PWBE/…, też starsza kolejność ŁOD/IE/3664/03) lub opis → pewny;
   stare uprawnienia bez kodu → eliminacja (kto w swoich zespołach stoi obok konstruktora i sanitarnego, a nie obok elektryka).
   `npm run data:check` porównuje wynik z ręcznym opisem (obecnie 262/263 zgodnych).
   **Zespół niewpisany:** nie każde starostwo wpisuje branżystów (wieruszowskie: ok. 6% wniosków). Wniosek bez elektryka to
   `bez_elektryka` tylko, gdy w zespole jest konstruktor lub sanitarny; pusty zespół / sam współautor → `nieznany` (pole `zespol_status`).
   Pełność zespołów per powiat: zakładka „Powiaty”; poniżej 50% skrypt wypisuje ostrzeżenie.
2. **Ranking** (`src/analysis.js`): wnioski ważone świeżością, rodzajem i liczbą domów; stały elektryk = ≥ 50% ważonych projektów;
   wynik 0–100; lista domyślnie posortowana po liczbie złożonych wniosków (kolumna „Złożone wnioski”, także wycofane).
Progi: `PARAM` w `src/analysis.js`. Opis dla użytkownika: „Jak działa algorytm?” pod listą.

## Zakładki
Każda tabela ma filtr pod każdym nagłówkiem (tekst, lista wartości, zakres liczb/dat), sortowanie po kliknięciu w nagłówek,
wyszukiwarkę, wybór kolumn i eksport widoku do CSV. Strona jest statyczna – nic nie jest zapisywane.
- **Lista architektów** – ranking (złożone wnioski, wynik 0–100), kliknięcie wiersza otwiera szczegóły i wnioski.
- **Wykresy** – top 15, mapa okazji, wnioski miesięcznie, udział elektryków, miejscowości.
- **Wnioski GUNB** – pełna lista wniosków.
- **Powiaty** – zestawienie powiatów, pominięte wnioski, uwagi z importu.
- **Sanitarni** – projektanci sanitarni z zespołów (pewni: kod …S/ lub opis; wywnioskowani: stare uprawnienia, eliminacja),
  liczba wniosków, z którymi architektami pracują, kontakty z karty „osoby”. Lista w `baza.json`: `sanitarni`, we wniosku pole `sanitarny`.
- **Biura** – kontakty do biur projektowych.

Wygląd: Tailwind CSS (`tailwind.config.js`, wspólne klasy w `src/styles.css`, drobne komponenty w `src/components/ui.jsx`).

## Struktura
    data/baza_zlecenia.xlsx   baza główna (źródło)
    data/powiaty/             pliki gunb_<powiat>.md od agenta
    scripts/                  build_data.py, xlsx2json.py (Python 3, bez bibliotek)
    src/                      aplikacja React; src/data/baza.json jest generowany przez `npm run data`

## GitHub Pages
Strona: https://cgrzegorz.github.io/architekci/

    npm run deploy     # buduje dist/ i wypycha go na gałąź gh-pages (pakiet gh-pages)

W ustawieniach repo: Settings → Pages → Source: „Deploy from a branch”, gałąź `gh-pages`, folder `/ (root)`.
