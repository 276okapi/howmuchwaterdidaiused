# prompt-stats

Statystyki promptów Claude Code liczone z lokalnych transkryptów
(`%USERPROFILE%\.claude\projects\**\*.jsonl`). Skrypt PowerShell buduje
interaktywny raport HTML i plik CSV: ile promptów dziennie, jak długo agent
pracował nad każdym z nich, ile to kosztowało według cen API (i ile wody), jak
często coś przerwano albo się wysypało i jakich sformułowań używasz najczęściej.

Wszystkie wskaźniki są liczone deterministycznie, regułami w kodzie. Skrypt
nie wywołuje żadnego modelu językowego, a jedyne połączenie sieciowe to
pobranie publicznego cennika (raz dziennie, można je wyłączyć).

## Wymagania

- Windows z PowerShell 5.1 (wbudowany w system), bez dodatkowych modułów
- Claude Code, który zapisuje transkrypty w `%USERPROFILE%\.claude\projects`

## Uruchomienie

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-report.ps1
```

Potem otwórz `raport.html` w przeglądarce.

Parametry:

| Parametr | Domyślnie | Znaczenie |
|---|---|---|
| `-ProjectsDir` | `%USERPROFILE%\.claude\projects` | Skąd czytać transkrypty |
| `-OutDir` | folder skryptu | Gdzie zapisać raport, CSV, cache i `ceny.json` |
| `-ExcerptLength` | `200` | Długość fragmentu promptu w raporcie i CSV |
| `-IdleGapMinutes` | `15` | Przerwa między odpowiedziami dłuższa niż tyle minut nie liczy się do czasu pracy |
| `-Full` | – | Przeczytaj wszystkie transkrypty od początku |
| `-NoPriceUpdate` | – | Nie pobieraj cennika, użyj cen zapisanych w `ceny.json` |
| `-PriceUrl` | cennik LiteLLM | Źródło cen |

### Codzienne odświeżanie

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\zarejestruj-zadanie.ps1 -At 17:30
```

Rejestruje w Harmonogramie zadań zadanie `Claude prompt stats`, które codziennie
przebudowuje raport. Nie wymaga uprawnień administratora: zadanie działa
w ukrytym oknie na koncie bieżącego użytkownika. Jeśli komputer był wtedy
wyłączony, zadanie uruchomi się przy najbliższej okazji.

```powershell
Start-ScheduledTask -TaskName 'Claude prompt stats'                      # uruchom teraz
Unregister-ScheduledTask -TaskName 'Claude prompt stats' -Confirm:$false # usuń
```

## Pliki

| Plik | Opis | W repozytorium |
|---|---|---|
| `build-report.ps1` | Główny skrypt | tak |
| `report-template.html` | Szablon raportu, skrypt wstawia do niego dane | tak |
| `reguly.json` | Reguły wskaźnika poprawek (edytowalne) | tak |
| `woda.json` | Przelicznik tokenów na litry wody (edytowalny) | tak |
| `ceny.json` | Historia cen modeli i ręczne nadpisania | tak |
| `zarejestruj-zadanie.ps1` | Rejestracja codziennego zadania | tak |
| `raport.html` | Wygenerowany raport | nie |
| `prompty.csv` | Jeden wiersz na prompt, separator `;`, do Excela | nie |
| `cache/events.json` | Cache przyrostowy | nie |

## Co jest w raporcie

Raport ma trzy widoki, przełączane zakładkami u góry. Adres w pasku
przeglądarki zapamiętuje widok i dzień (`#pulpit`, `#dzien/2026-11-24`,
`#prompty`), więc odświeżenie strony i przycisk „Wstecz” działają tak, jak się
spodziewasz.

Obok zakładek jest przełącznik motywu: **Auto** (jak w systemie), **Jasny**
(z zielonymi akcentami) i **Ciemny** (z niebieskimi). Wybór zapamiętuje
przeglądarka.

**Pulpit** (podsumowanie całej historii):

- **Kafelki**: prompty, dni aktywne, łączny czas agenta, koszt, przerwane
  i awarie, mediana czasu odpowiedzi, tokeny wyjściowe i najaktywniejszy dzień
  (kliknięcie otwiera ten dzień).
- **Woda**: łączna szacowana ilość w litrach. Po najechaniu kursorem widać,
  jaka to część basenu olimpijskiego i za ile lat napełniłbyś cały basen
  w obecnym tempie.
- **Kalendarz aktywności**: każdy dzień to kratka, im ciemniejsza, tym więcej
  promptów. Kliknięcie otwiera dzień.
- **Prompty dziennie**: wykres słupkowy za 14, 30 lub 90 dni albo za cały okres.
- **Projekty**: prompty, dni, czas, koszt, woda oraz przerwane i awarie dla
  każdego projektu.

**Dni** (jeden dzień):

- **Lista dni** z boku, pogrupowana po miesiącach, z liczbą promptów i litrami.
  Strzałki ← → na klawiaturze przechodzą do poprzedniego i następnego dnia.
- **Kafelki dnia** i **słup wody**, który napełnia się do ilości litrów z tego
  dnia. Skala jest wspólna dla wszystkich dni (zaokrąglona w górę od dnia
  rekordowego), więc poziomy można porównywać na oko.
- **Oś czasu**: każdy prompt od wysłania do ostatniej odpowiedzi.
  Przerwy dłuższe niż `-IdleGapMinutes` są pokazane jako przerwa, nie jako praca.
- **Tabela promptów dnia** z sortowaniem: start, koniec, czas, projekt, model,
  znaki, tokeny, narzędzia, koszt, woda, problem, fragment promptu.

**Prompty** (jak piszesz), z filtrem okresu (7, 30, 90 dni, wszystko)
i projektu:

- **Kafelki**: mediana długości, udział pytań, promptów z wklejką i z obrazem,
  liczba unikalnych słów, średni koszt i woda na prompt.
- **Najczęstsze słowa** i **najczęstsze sformułowania** (2, 3 lub 4 słowa)
  liczone w promptach, czyli słowo powtórzone w jednym prompcie liczy się raz.
  Słowa funkcyjne („i”, „to”, „się”, „dobra”…) można pominąć.
- **Jak zaczynasz prompty** (pierwsze dwa słowa) i **komendy** (`/…`).
- **Długość promptów** i **godziny**, o których piszesz.
- Kliknięcie słowa lub frazy pokazuje prompty, w których występuje.
  Kliknięcie promptu otwiera jego dzień z zaznaczonym promptem.

Analiza obejmuje tylko to, co sam napisałeś. Wklejki (`<pasted_content>`), bloki
kodu, linki i ścieżki do plików są pomijane.

## Jak liczone są wskaźniki

### Prompt i czas

Prompt to wiadomość wpisana przez człowieka. Polecenia lokalne, przypomnienia
systemowe, wyniki narzędzi i podsumowania kompaktowania są pomijane. Kontekst
wstrzykiwany przez rozszerzenie IDE (`<ide_opened_file>`, `<ide_selection>`)
jest wycinany z treści przed liczeniem znaków i słów.

Tura trwa od wysłania promptu do ostatniej odpowiedzi asystenta przed kolejnym
promptem albo przerwaniem klawiszem Esc. **Czas aktywny** (`CzasSek`) nie
obejmuje przerw dłuższych niż `-IdleGapMinutes`, np. czekania przez noc na
zgodę. **Czas zegarowy** (`CzasZegarSek`) to po prostu koniec minus start.

### Koszt

Koszt to równowartość cen API: tokeny wejścia, odczytu i zapisu cache (5 min
i 1 h) oraz wyjścia, z odpowiedziami subagentów włącznie. Każdy dzień jest
wyceniany według cen obowiązujących w tym dniu. Przy planie Team lub Max
faktyczny rachunek wygląda inaczej, więc ta liczba służy do porównań, nie do
rozliczeń.

`ceny.json` zawiera:

- `historia`: ceny w USD za milion tokenów. Skrypt aktualizuje je raz dziennie
  z [cennika LiteLLM](https://github.com/BerriAI/litellm) i dopisuje nowy wpis
  (`od` = od kiedy) tylko wtedy, gdy cena się zmieniła.
- `override`: ręczne ceny, które mają pierwszeństwo, np.
  `{"claude-opus-4-7": {"in": 5, "out": 25}}`. Brakujące ceny cache są
  wyliczane ze standardowych mnożników (odczyt 0,1×, zapis 5 min 1,25×,
  zapis 1 h 2× ceny wejścia).

Jeśli dla modelu brakuje ceny, skrypt wypisuje ostrzeżenie, a koszt promptu
jest oznaczony jako niepełny (`*` w raporcie, `KosztNiepelny` w CSV). Takie
modele trzeba dopisać w `override`.

### Woda

Szacunek wody zużytej na chłodzenie centrum danych i na produkcję energii.
Dla każdej odpowiedzi, z subagentami włącznie, liczba tokenów jest mnożona
przez stawkę w litrach na milion tokenów z `woda.json`:

| Klucz | Tokeny | Domyślnie (l / mln) |
|---|---|---|
| `out` | wyjście | 100 |
| `in` | wejście bez cache | 20 |
| `cw` | zapis cache | 20 |
| `cr` | odczyt cache | 2 |

`basenOlimpijskiLitry` (2 500 000 l, czyli 50 × 25 × 2 m) służy do porównania
na pulpicie. Publiczne szacunki zużycia wody przez modele różnią się nawet
o rząd wielkości, więc ta liczba jest orientacyjna: nadaje się do porównywania
dni, nie jako pomiar. W CSV jest kolumna `WodaLitry`. Zmiany w `woda.json`
działają od następnego uruchomienia.

### Przerwane / awarie

Każdy prompt dostaje ocenę `k` (kolumny `Poprawka` i `PowodPoprawki` w CSV):

- **2, twarde zdarzenie (●)**: liczone w głównym wskaźniku. To jedna z sytuacji:
  - przerwałeś odpowiedź klawiszem Esc (`przerwanie (Esc)`);
  - zatrzymałeś ją przy pytaniu o zgodę na narzędzie
    (`zatrzymane przy narzędziu`);
  - wywołanie API zakończyło się błędem, np. przeciążenie albo zerwane
    połączenie (`błąd API`);
  - prompt nie dostał żadnej odpowiedzi, a Ty wysłałeś następny
    (`brak odpowiedzi`). Komendy typu `/model` nie są tu liczone.
- **1, sygnał w treści (○)**: pokazywany osobno i niewliczany do głównego
  wskaźnika. Następny prompt odrzuca odpowiedź, zgłasza, że problem nadal
  występuje, doprecyzowuje intencję albo wkleja błąd.
- **0**: nic.

Główny wskaźnik to udział promptów z `k = 2` wśród wszystkich promptów.
Sygnały w treści dotyczą tylko promptów, po których w sesji padł jeszcze jakiś
prompt.

Sygnały w treści sprawdzają pierwsze 400 znaków tego, co sam napisałeś
w następnym prompcie (bez wklejek), a wklejki tylko wzorcem `wklejka`. Liczy się
tylko prompt wysłany w ciągu `oknoMinut` od końca odpowiedzi. Reguły są pisane
wąsko: „nie wiem”, „nie no” albo „znowu konflikty” nie są sygnałem, a „nadal
nie działa” albo „w dalszym ciągu nie zapisuje” są.

Reguły są w `reguly.json`:

| Pole | Znaczenie |
|---|---|
| `oknoMinut` | Maksymalny odstęp między końcem odpowiedzi a następnym promptem |
| `potwierdzenie` | Wzorzec początku typu „tak”, „ok”, „dzięki” |
| `reguly[].nazwa` | Nazwa reguły, trafia do `PowodPoprawki` w CSV |
| `reguly[].wzorzec` | Regex sprawdzany na tekście promptu |
| `reguly[].wklejka` | Opcjonalny regex sprawdzany w treści `<pasted_content>` |
| `reguly[].pomijajPoPotwierdzeniu` | Reguła nie działa, gdy prompt zaczyna się potwierdzeniem („tak, ale zamiast…”) |

Wygrywa pierwsza pasująca reguła. Wzorce używają składni .NET regex i ignorują
wielkość liter. Podawaj warianty z polskimi znakami i bez nich („ciągu|ciagu”). Zmiany w `reguly.json` działają od następnego uruchomienia,
cache nie trzeba czyścić.

## Działanie przyrostowe

Transkrypty są tylko dopisywane, więc `cache/events.json` przechowuje
sparsowane zdarzenia i liczbę bajtów przeczytanych z każdego pliku. Przy
kolejnym uruchomieniu skrypt czyta tylko nowe bajty, a niezmienionych plików
w ogóle nie otwiera. Linia, która jest jeszcze w trakcie zapisu, czeka na
następne uruchomienie.

Claude Code usuwa stare transkrypty (`cleanupPeriodDays`, domyślnie 30 dni).
Zdarzenia z usuniętych plików zostają w cache, więc historia w raporcie nie
znika. Uwaga: skasowanie `cache/` usuwa też tę historię. `-Full` jest
bezpieczniejsze, bo czyta istniejące pliki od nowa, a wpisy usuniętych plików
zachowuje.

Po zmianie reguł parsowania w `build-report.ps1` trzeba podnieść
`$CacheVersion`. Stary cache zostanie wtedy przebudowany automatycznie.

## Prywatność

Raport i CSV zawierają fragmenty treści promptów, dlatego są w `.gitignore`.
Zanim komuś je udostępnisz, sprawdź, co w nich jest.
