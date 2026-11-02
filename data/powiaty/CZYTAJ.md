# Nowe powiaty

Wrzucaj tu pliki od agenta w formacie `gunb_<powiat>.md` (np. `gunb_sieradzki.md`),
potem w katalogu głównym repozytorium uruchom:

    npm run data

Skrypt dopisze nowe wnioski (duplikaty po gunb_id pomija), sam rozpozna elektryków
w zespole i połączy architektów działających w kilku powiatach.
Plik `baza_zlecenia.xlsx` nie jest zmieniany.
