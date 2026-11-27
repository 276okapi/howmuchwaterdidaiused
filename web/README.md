# Claude Water Tracker – wersja webowa

Aplikacja Next.js z logowaniem (Better Auth) i bazą MySQL/MariaDB. Po zalogowaniu
pokazuje ten sam interaktywny raport co wersja lokalna (`../report-template.html`),
ale z danymi zapisanymi na serwerze dla danego użytkownika.

Wersja lokalna (`build-report.ps1` w głównym folderze) działa dalej bez zmian:
służy do podglądu własnego raportu bez serwera.

## Co już działa

| Adres | Opis |
|---|---|
| `/register`, `/login` | Rejestracja i logowanie: e-mail + hasło, Google, GitHub (przyciski OAuth pokazują się po ustawieniu kluczy w `.env`) |
| `/pulpit`, `/dni`, `/prompty` | Raport zalogowanego użytkownika, trzy widoki (szablon z `report-template.html` w ramce `/raport/widok`) |
| `/agent` | Instalacja agenta: instalator `.exe` z okienkiem albo ręcznie (agent w jednym pliku do skopiowania) |
| `/konto` | Dane konta, sposoby logowania, klucz agenta i „Wygeneruj nowy klucz” |

Po zalogowaniu każda strona ma wysuwane z lewej menu: Pulpit, Raporty (Dni, Prompty), Agent, Konto,
a na dole „Wyloguj” i przełącznik motywu (auto / jasny / ciemny, zapamiętany w przeglądarce).
Nową funkcję dodaje się jako stronę owiniętą w `AppShell` i pozycję w `ITEMS` w `src/components/SideMenu.tsx`.
| `POST /api/ingest` | Odbiór metryk z komputera użytkownika; nagłówek `x-api-key: cw_...` albo `Authorization: Bearer cw_...` |
| `GET /api/agent/download?os=windows` | `AIWaterTracker-Setup.exe` z dopisanym adresem strony i kluczem agenta (`&klucz=0`: bez nich) |
| `GET /api/agent/plik/<nazwa>` | Plik agenta (publiczny), `?pobierz=1`: pobiera go instalator |
| `GET /api/agent/skrypt` | Agent w jednym pliku (`ai-water-tracker.ps1`) z wpisanym kluczem; `?pobierz=1`: do zapisania |
| `POST /api/agent/klucz` | Nowy klucz agenta (unieważnia wszystkie dotychczasowe klucze użytkownika) |
| `/api/auth/*` | Endpointy Better Auth |

Każdy użytkownik ma jeden **klucz agenta**: strona wpisuje go w instalator i w agenta w jednym pliku,
więc nikt nie musi go kopiować. Better Auth trzyma klucze API tylko jako skrót, dlatego jawny klucz agenta
jest dodatkowo zapisany zaszyfrowany (AES-256-GCM, klucz z `BETTER_AUTH_SECRET`) w `cw_agent_key`, żeby przy
każdym pobraniu wpisać ten sam. Po wycieku: Konto → „Wygeneruj nowy klucz” unieważnia wszystkie klucze
użytkownika; agenta trzeba wtedy zainstalować ponownie. Zmiana `BETTER_AUTH_SECRET` też wymusza nowy klucz.

### Agent (Windows)

Agent tylko wysyła dane: nic nie wyświetla i nie zapisuje raportów na komputerze użytkownika.

- `../agent/windows/setup/Setup.cs`: instalator z okienkiem (Windows Forms, C# 5). Użytkownik wybiera
  źródło danych (na razie tylko Claude Code), częstotliwość (30 min / 1 h / 6 h / raz dziennie)
  i czy udostępnia treść promptów oraz nazwy projektów. Instalator pobiera ze strony aktualne pliki
  agenta do `%LOCALAPPDATA%\AIWaterTracker`, zapisuje `config.json`, tworzy zadanie w Harmonogramie
  zadań, wysyła pierwsze dane i dodaje skrót „AI Water Tracker” w menu Start (zmiana ustawień,
  odinstalowanie). Adres strony i klucz API strona dopisuje na końcu `.exe` przy pobieraniu.
- Budowanie: `..\agent\windows\setup\build.cmd` (kompilator C# wbudowany w Windows, nic nie trzeba
  instalować). Wynik `AIWaterTracker-Setup.exe` jest w repozytorium. Przebudować trzeba tylko po zmianie
  `Setup.cs`, bo skrypty agenta instalator pobiera ze strony.
- `../agent/windows/sync.ps1`: liczy (`../build-report.ps1 -JsonOut`, bez raportu), anonimizuje i wysyła.
- `../agent/windows/register-task.ps1`: zadanie w Harmonogramie (instalator; przy ręcznej konfiguracji).

Ręcznie: strona składa z `sync.ps1`, `build-report.ps1` i plików reguł jeden `ai-water-tracker.ps1`
(`src/lib/agent-script.ts`) z wpisanym adresem strony i kluczem agenta. Plik jest w czystym ASCII, bo kod
wklejony do Notatnika zapisuje się bez BOM, a Windows PowerShell 5.1 źle czyta wtedy polskie znaki.
Ustawienia (treść promptów, nazwy projektów) są na początku pliku; użytkownik ustawia uruchamianie co godzinę.

`scripts/copy-shared.mjs` kopiuje instalator i pliki agenta do `web/agent-dist/windows/`.

### Prywatność

Agent zawsze wysyła liczby (tokeny, czasy, koszt, woda, model). Treść promptów (`x`, `tw`)
i nazwy projektów wysyła tylko za zgodą użytkownika wyrażoną w instalatorze; bez zgody usuwa
treść i zamienia nazwy na „projekt 1”, „projekt 2”… **na komputerze użytkownika**, przed wysłaniem.
Bez treści widok Prompty nie pokazuje statystyk słów ani podglądu promptów. Treść widzi tylko jej
właściciel w swoim raporcie. Skrypt `scripts/import-raport.mjs` zawsze usuwa treść promptów.

## Baza danych

Wszystkie tabele mają prefiks `cw_`, więc aplikacja może korzystać z istniejącej
bazy na hostingu obok innych aplikacji:

- `cw_user`, `cw_session`, `cw_account`, `cw_verification`, `cw_apikey`: Better Auth
- `cw_turn`: metryki promptów (jeden wiersz = jeden prompt; definicja w `db/schema.sql`)
- `cw_agent_key`: zaszyfrowany klucz agenta każdego użytkownika

Baza powinna mieć kodowanie `utf8mb4`. Działa na MySQL 8 i MariaDB 10.5+.

## Szybki start lokalnie (Windows)

Potrzebne: Node.js 20.12+ i działający MySQL/MariaDB (np. usługa MariaDB albo XAMPP).

Kliknij dwukrotnie `web\start-local.cmd` albo w PowerShellu:

```powershell
cd web
.\start-local.ps1
```

Za pierwszym razem skrypt zapyta o dane do bazy i zapisze je w `web\.env`, potem:
instaluje zależności, tworzy bazę i tabele, zakłada konto demo z danymi z `..\raport.html`,
uruchamia stronę i otwiera http://localhost:3000.

- Konto demo: `demo@example.com` / `demo-haslo-123`
- `-Port 3001`: inny port, `-Prod`: wersja produkcyjna jak na hostingu,
  `-NoDemo`: bez konta demo, `-NoBrowser`: bez otwierania przeglądarki,
  `-ResetConfig`: zapytaj ponownie o dane do bazy
- Na macOS/Linux: `npm install`, uzupełnij `.env`, `node scripts/setup-local.mjs`, `npm run dev`

## Uruchomienie lokalne krok po kroku

1. Utwórz bazę i użytkownika (phpMyAdmin albo konsola):
   ```sql
   CREATE DATABASE cw_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'cw'@'localhost' IDENTIFIED BY 'haslo';
   GRANT ALL ON cw_dev.* TO 'cw'@'localhost';
   ```
2. Skopiuj `.env.example` do `.env` i uzupełnij `DATABASE_URL` oraz `BETTER_AUTH_SECRET`.
3. Zainstaluj zależności i utwórz tabele:
   ```powershell
   cd web
   npm install
   npm run migrate
   ```
4. Uruchom: `npm run dev` i otwórz http://localhost:3000
5. Załóż konto, na stronie **Konto** utwórz klucz API i wyślij dane z lokalnego raportu:
   ```powershell
   node scripts/import-raport.mjs --url http://localhost:3000 --key cw_... ..\raport.html
   ```

`npm run migrate` można uruchamiać wielokrotnie: dodaje tylko brakujące tabele i kolumny.
`npm run migrate -- --sql` wypisuje SQL bez zmieniania bazy.

## Logowanie przez Google i GitHub

Przycisk danego dostawcy pojawia się, gdy w `.env` są oba klucze.

- **Google**: Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web).
  Authorized redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`
- **GitHub**: Settings → Developer settings → OAuth Apps → New.
  Authorization callback URL: `<BETTER_AUTH_URL>/api/auth/callback/github`

Lokalnie `BETTER_AUTH_URL` to `http://localhost:3000`; na produkcji adres strony.
Do każdego środowiska najlepiej utworzyć osobną aplikację OAuth.
Konta z tym samym, zweryfikowanym adresem e-mail są łączone, więc ta sama osoba może
się logować na kilka sposobów.

## Wdrożenie na hosting z cPanelem

Hosting musi mieć w cPanelu **Setup Node.js App** (Node.js 20.12 lub nowszy).
Bez tego Next.js z logowaniem i API nie zadziała na zwykłym hostingu PHP.

1. Lokalnie zbuduj aplikację (na hostingu zwykle brakuje pamięci na build):
   ```powershell
   cd web
   npm ci
   npm run build
   ```
2. Wgraj na serwer (np. do `~/woda-app`) zawartość folderu `web` **bez** `node_modules`
   i `.env`: `.next/`, `public/`, `templates/`, `agent-dist/`, `src/lib/`, `scripts/`, `db/`,
   `server.js`, `next.config.mjs`, `package.json`, `package-lock.json`.
3. cPanel → Setup Node.js App → Create Application:
   - Node.js version: 20 lub nowsza
   - Application mode: Production
   - Application root: `woda-app`
   - Application URL: domena / subdomena
   - Application startup file: `server.js`
   - Environment variables: te same co w `.env.example`
     (`BETTER_AUTH_URL` = adres strony z `https://`)
4. **Run NPM Install**, a następnie raz utwórz tabele: w terminalu cPanelu
   (polecenie aktywujące środowisko widać na górze strony aplikacji)
   `npm run migrate`, albo w „Run JS script” wybierz `migrate`.
5. **Restart** aplikacji. Przy kolejnych wdrożeniach: wgraj nowy `.next/`,
   uruchom `npm run migrate`, zrestartuj.

## Struktura

```
web/
├── start-local.ps1 / .cmd    # uruchamia wszystko lokalnie
├── server.js                  # plik startowy dla Passengera (cPanel)
├── db/schema.sql              # tabele aplikacji (cw_turn)
├── scripts/
│   ├── migrate.mjs            # tworzy/aktualizuje tabele (Better Auth + schema.sql)
│   ├── import-raport.mjs      # wysyła dane z lokalnego raport.html (tymczasowo zamiast agenta)
│   ├── setup-local.mjs        # lokalnie: baza + tabele + konto demo
│   ├── copy-shared.mjs        # kopiuje szablon raportu i paczkę agenta z repozytorium
│   └── lib/raport-data.mjs    # odczyt danych z raport.html (bez treści promptów)
└── src/
    ├── lib/
    │   ├── auth-options.mjs   # konfiguracja Better Auth (wspólna dla aplikacji i migracji)
    │   ├── auth.ts            # instancja Better Auth + getSession()
    │   ├── db.mjs             # pula połączeń MySQL
    │   ├── agent-key.ts       # klucz agenta (jeden na konto, zaszyfrowany)
    │   ├── agent-script.ts    # agent w jednym pliku
    │   └── turns.ts           # walidacja i zapis metryk
    ├── components/            # AppShell + SideMenu (menu po zalogowaniu)
    └── app/
        ├── (auth)/login, register
        ├── (raport)/          # /pulpit, /dni, /prompty: wspólna ramka z raportem
        ├── raport/widok/      # HTML raportu z danymi użytkownika (zawartość ramki)
        ├── agent/             # instalacja agenta
        ├── api/agent/         # instalator, pliki agenta, agent w jednym pliku, nowy klucz
        ├── konto/             # dane konta
        └── api/ingest, api/auth
```

## Do zrobienia później

- Wysyłka maili (SMTP): weryfikacja adresu e-mail i reset hasła
  (`requireEmailVerification` w `src/lib/auth-options.mjs`)
- Agent dla macOS / Linux i kolejne źródła (Codex CLI, Gemini CLI, Cursor, Copilot)
- Wspólny przelicznik wody liczony na serwerze (teraz wartość `h2o` przychodzi z komputera)
- Rankingi i grupy
