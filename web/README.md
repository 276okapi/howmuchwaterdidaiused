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
| `/raport` | Raport zalogowanego użytkownika (szablon z `report-template.html`) |
| `/konto` | Klucze API (tworzenie, lista, usuwanie) i wylogowanie |
| `POST /api/ingest` | Odbiór metryk z komputera użytkownika; nagłówek `x-api-key: cw_...` albo `Authorization: Bearer cw_...` |
| `/api/auth/*` | Endpointy Better Auth |

Klucz API przypisuje każde żądanie do konta użytkownika. W bazie jest tylko skrót
klucza, nie jego jawna postać. Ten sam mechanizm posłuży później lokalnemu agentowi.

### Prywatność

Serwer **nie przyjmuje treści promptów**: `/api/ingest` zapisuje tylko liczby i etykiety
(tokeny, czasy, koszt, woda, model). Skrypt `scripts/import-raport.mjs` usuwa tekst
promptów jeszcze na komputerze użytkownika, a nazwy projektów zamienia na
„projekt 1”, „projekt 2”… (chyba że podasz `--keep-project-names`). Dlatego w wersji
online nie ma podglądu treści promptów ani statystyki najczęstszych słów.

## Baza danych

Wszystkie tabele mają prefiks `cw_`, więc aplikacja może korzystać z istniejącej
bazy na hostingu obok innych aplikacji:

- `cw_user`, `cw_session`, `cw_account`, `cw_verification`, `cw_apikey`: Better Auth
- `cw_turn`: metryki promptów (jeden wiersz = jeden prompt; definicja w `db/schema.sql`)

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
   i `.env`: `.next/`, `templates/`, `src/lib/`, `scripts/`, `db/`, `server.js`,
   `next.config.mjs`, `package.json`, `package-lock.json`.
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
│   ├── copy-template.mjs      # kopiuje ../report-template.html do templates/
│   └── lib/raport-data.mjs    # odczyt danych z raport.html (bez treści promptów)
└── src/
    ├── lib/
    │   ├── auth-options.mjs   # konfiguracja Better Auth (wspólna dla aplikacji i migracji)
    │   ├── auth.ts            # instancja Better Auth + getSession()
    │   ├── db.mjs             # pula połączeń MySQL
    │   └── turns.ts           # walidacja i zapis metryk
    └── app/
        ├── (auth)/login, register
        ├── konto/             # klucze API, wylogowanie
        ├── raport/route.ts    # raport HTML z danymi użytkownika
        └── api/ingest, api/auth
```

## Do zrobienia później

- Wysyłka maili (SMTP): weryfikacja adresu e-mail i reset hasła
  (`requireEmailVerification` w `src/lib/auth-options.mjs`)
- Lokalny agent i paczka do pobrania z zaszytym kluczem (`/api/download`)
- Wspólny przelicznik wody liczony na serwerze (teraz wartość `h2o` przychodzi z komputera)
- Rankingi i grupy
