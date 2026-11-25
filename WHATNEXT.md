Architektura i Założenia Techniczne – Claude Water Tracker

Dokument opisuje docelową architekturę, decyzje produktowe oraz założenia bezpieczeństwa systemu do śledzenia i grywalizacji zużycia wody wynikającego z pracy z Claude / Claude Code.

1. Architektura Ogólna (Monolit Fullstack + Lokalny Agent)

Rezygnujemy z podejścia opartego wyłącznie o statyczny HTML oraz rozdzielonego monorepo (osobny front i osobny serwer API) na rzecz monolitu fullstackowego (Next.js lub Astro w trybie SSR). Pozwala to utrzymać widoki HTML/CSS oraz endpointy API w jednym projekcie bez konieczności konfigurowania CORS i podwójnego procesu wdrożenia.

System składa się z dwóch warstw utrzymywanych w jednym repozytorium:

Aplikacja Webowa (Frontend + Backend API): Fullstackowy serwer Node.js postawiony na własnym VPS, odpowiedzialny za renderowanie rankingów (SSR), uwierzytelnianie użytkowników, generowanie spersonalizowanych paczek instalacyjnych oraz odbieranie metryk.

Lokalny Agent (Klient): Lekki skrypt lub binarka uruchamiana cyklicznie w tle na komputerze użytkownika (cron na Linux/macOS, Task Scheduler na Windows), parsująca lokalne logi użycia Claude i wysyłająca zagregowane statystyki do API.

[Komputer Użytkownika]                          [VPS - woda.twojadomena.pl]
┌─────────────────────────────┐                 ┌──────────────────────────────┐
│ Logi Claude Code (~/.claude)│                 │ Nginx / Caddy (HTTPS / TLS)  │
└──────────────┬──────────────┘                 └──────────────┬───────────────┘
               │ (odczyt lokalny)                              │
┌──────────────▼──────────────┐                 ┌──────────────▼───────────────┐
│ Agent (Python / Binarka)    │ ── HTTPS POST ─►│ Fullstack App (Node.js / PM2)│
│ + config.json (API_KEY)     │    /api/ingest  │  ├── Frontend (SSR Rankingi) │
└─────────────────────────────┘                 │  └── API (Ingest / Download) │
                                                └──────────────┬───────────────┘
                                                               │
                                                ┌──────────────▼───────────────┐
                                                │ Istniejąca Baza Danych VPS   │
                                                │ (izolowany schemat / prefiks)│
                                                └──────────────────────────────┘


2. Kluczowe Decyzje Technologiczne

Infrastruktura, Domena i Baza Danych

Domena i migracja: Start na subdomenie istniejącej domeny (np. woda.twojadomena.pl) z możliwością bezbolesnego przepięcia na docelową domenę poprzez rekord CNAME / przekierowanie w DNS. Docelowy adres endpointu API jest zapisany jako parametr w config.json agenta, co eliminuje potrzebę aktualizacji kodu u użytkowników przy zmianie adresu.

Hosting na VPS: Aplikacja działa jako proces Node.js zarządzany przez PM2 (automatyczny restart po awarii i reboocie serwera), wystawiony na świat przez reverse proxy (Nginx / Caddy) na dedykowanym porcie lokalnym.

Istniejąca baza danych (Izolacja): Projekt wykorzystuje już skonfigurowaną instancję bazy danych na VPS (PostgreSQL / MySQL) poprzez ORM (Prisma / Drizzle). Aby uniknąć kolizji z innymi aplikacjami na serwerze, tabele projektu są odizolowane w dedykowanym schemacie (np. claude_water) lub opatrzone stałym prefiksem (cw_users, cw_reports, cw_groups).

Dystrybucja Agenta i Rozwiązanie Problemów Korporacyjnych

Aby obejść blokady bezpieczeństwa na laptopach firmowych (AppLocker, Gatekeeper, restrykcje EDR wobec niepodpisanych plików wykonywalnych), system wspiera dwa warianty klienta:

Czysty skrypt (.py): Napisany wyłącznie w oparciu o bibliotekę standardową Pythona (zero zewnętrznych zależności). Użytkownik może podejrzeć jego kod przed uruchomieniem i odpalić go w środowiskach zablokowanych dla plików .exe.

Gotowa binarka (Windows .exe / Linux): Skompilowana paczka (np. przez PyInstaller lub w Go) dla osób nietechnicznych, które nie mają lokalnie zainstalowanego środowiska Python/Node.

Mechanizm pobierania z zaszytym kluczem (Zero kompilacji w locie):

Użytkownik pobiera agenta dopiero po zalogowaniu się na swoje konto w serwisie.

Zamiast modyfikować kod źródłowy lub kompilować binarkę przy każdym pobraniu, endpoint GET /api/download pobiera statyczny plik z katalogu agent-dist/ i pakuje go w locie (w pamięci RAM) do archiwum .zip razem z wygenerowanym indywidualnie plikiem config.json zawierającym klucz API użytkownika.

Metodologia Przeliczania Wody

Ze względu na brak oficjalnych, per-promptowych metryk zużycia wody od Anthropic, platforma stosuje jawny, wspólny dla wszystkich uczestników przelicznik (np. estymacja X ml wody na 1000 tokenów wejściowych/wyjściowych z uwzględnieniem modelu), opublikowany w regulaminie/FAQ serwisu, aby zapewnić równe zasady rywalizacji.

(Opcjonalnie w przyszłości) Możliwość integracji bezpośredniej z Anthropic Usage & Cost API dla zespołów korzystających z kluczy organizacyjnych – eliminuje potrzebę instalacji lokalnego agenta.

3. Bezpieczeństwo i Prywatność (Privacy by Design)

Rezygnacja z wysyłki na surowe IP i własnego szyfrowania:

Cała komunikacja odbywa się wyłącznie po HTTPS (TLS) pod domeną z certyfikatem SSL – rezygnujemy ze strzelania po HTTP na goły adres IP oraz z pisania własnych algorytmów szyfrujących payload.

Identyfikacja użytkownika opiera się na tajnym kluczu zaszytym w config.json, przesyłanym w nagłówku Authorization: Bearer <API_KEY>.

W bazie danych przechowywany jest wyłącznie kryptograficzny skrót (hash SHA-256) klucza API, nigdy jego jawna postać.

Minimalizacja i anonimizacja danych (Ochrona kodu firmowego):

Lokalny agent parsuje wyłącznie metadane i liczniki liczbowe (liczba tokenów, typ modelu, znacznik czasu).

Treści promptów, odpowiedzi, nazwy plików oraz ścieżki lokalnych repozytoriów nigdy nie opuszczają komputera użytkownika.

Granularna kontrola prywatności:

Podczas generowania/konfiguracji agenta użytkownik wybiera zakres raportowanych danych.

W panelu WWW użytkownik decyduje o widoczności swojego profilu: ranking globalny (publiczny) vs wyłącznie zamknięte grupy znajomych/zespołu.

Model zaufania i podstawowe Sanity Checks:

Aplikacja zakłada model oparty na zaufaniu w ramach rywalizacji znajomych, wsparty lekką walidacją po stronie backendu:

Odrzucanie raportów z datą z przyszłości lub starszych niż ustalony bufor (np. 7 dni).

Limity maksymalnego przyrostu zużycia w pojedynczym oknie czasowym (ochrona przed błędami parsera lub prostym spamem).

Idempotencja zapytań (unikalny report_id), zapobiegająca podwójnemu naliczeniu tych samych danych przy ponownym uruchomieniu skryptu.

4. Struktura Wdrożenia na VPS

/var/www/woda.twojadomena.pl/
├── app/                      # Aplikacja Fullstack (Next.js / Astro)
│   ├── src/
│   │   ├── app/              # Widoki HTML/CSS (Landing, Dashboard, Rankingi)
│   │   └── app/api/
│   │       ├── ingest/       # POST: odbiór, autoryzacja i walidacja raportów
│   │       ├── download/     # GET: pakowanie w locie ZIP (agent + config.json)
│   │       └── auth/         # Logowanie użytkowników (np. GitHub / Google OAuth)
│   ├── .env                  # Zmienne środowiskowe (DATABASE_URL, sekrety)
│   └── package.json
└── agent-dist/               # Statyczne pliki klienta dołączane do paczek ZIP
    ├── tracker.py            # Wersja skryptowa (czysta biblioteka standardowa)
    ├── tracker-linux         # Wersja binarna Linux
    └── tracker-win.exe       # Wersja binarna Windows


5. Kontrakt API (Ingest Metryk)

Przykładowe żądanie wysyłane cyklicznie przez lokalnego agenta na endpoint POST /api/ingest z nagłówkiem Authorization: Bearer <API_KEY>:

{
  "report_id": "2026-11-25T14:00:00Z_uuid",
  "date": "2026-11-25",
  "metrics": {
    "model": "claude-3-7-sonnet",
    "input_tokens": 145000,
    "output_tokens": 32000,
    "cache_read_tokens": 890000,
    "estimated_water_ml": 412.5
  }
}
