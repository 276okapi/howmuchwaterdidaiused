<#
.SYNOPSIS
  Uruchamia lokalnie strone Claude Water Tracker (Next.js + MySQL/MariaDB).

.DESCRIPTION
  Za pierwszym razem:
    - sprawdza Node.js i instaluje zaleznosci (npm install),
    - pyta o dane do lokalnego MySQL/MariaDB i zapisuje je w web\.env,
    - tworzy baze i tabele, zaklada konto demo z danymi z ..\raport.html.
  Przy kazdym uruchomieniu sprawdza, czy serwer bazy dziala (w razie potrzeby probuje
  uruchomic usluge Windows), startuje strone i otwiera ja w przegladarce.
  Wszystkie kroki mozna powtarzac: nic nie jest tworzone drugi raz.

.PARAMETER Port
  Port strony (domyslnie 3000).
.PARAMETER NoDemo
  Nie zakladaj konta demo.
.PARAMETER Prod
  Zbuduj i uruchom wersje produkcyjna (npm run build + server.js), tak jak na hostingu.
.PARAMETER NoBrowser
  Nie otwieraj przegladarki.
.PARAMETER ResetConfig
  Zapytaj ponownie o dane do bazy (nadpisuje DATABASE_URL w web\.env).

.EXAMPLE
  .\start-local.ps1
  .\start-local.ps1 -Port 3001 -Prod
#>
param(
    [int]$Port = 3000,
    [switch]$NoDemo,
    [switch]$Prod,
    [switch]$NoBrowser,
    [switch]$ResetConfig
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step([string]$t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Fail([string]$t) { Write-Host "`nBŁĄD: $t" -ForegroundColor Red; exit 1 }

function Set-EnvLine([string]$text, [string]$key, [string]$value) {
    $line = "$key=$value"
    $rx = "(?m)^$([regex]::Escape($key))=.*$"
    if ($text -match $rx) {
        return [regex]::Replace($text, $rx, [System.Text.RegularExpressions.MatchEvaluator] { param($m) $line })
    }
    return $text.TrimEnd() + "`r`n$line`r`n"
}

function Test-Port([string]$h, [int]$p) {
    $c = New-Object System.Net.Sockets.TcpClient
    try { return $c.ConnectAsync($h, $p).Wait(1500) } catch { return $false } finally { $c.Close() }
}

function Read-WithDefault([string]$prompt, [string]$default) {
    $v = Read-Host "$prompt [$default]"
    if ([string]::IsNullOrWhiteSpace($v)) { return $default }
    return $v.Trim()
}

# --- 1. Node.js ----------------------------------------------------------------
Step 'Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Nie znaleziono Node.js. Zainstaluj wersję LTS (20.12 lub nowszą): https://nodejs.org'
}
$nodeVersion = (& node -v).Trim().TrimStart('v')
$nv = $nodeVersion.Split('.') | ForEach-Object { [int]$_ }
if ($nv[0] -lt 20 -or ($nv[0] -eq 20 -and $nv[1] -lt 12)) {
    Fail "Node.js $nodeVersion jest za stary, potrzebny 20.12 lub nowszy: https://nodejs.org"
}
Write-Host "Node.js $nodeVersion"

# --- 2. Dependencies ----------------------------------------------------------
Step 'Zależności (npm)'
$stamp = 'node_modules\.package-lock.json'
if (-not (Test-Path $stamp) -or (Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item $stamp).LastWriteTime) {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE) { Fail 'npm install nie powiódł się' }
} else {
    Write-Host 'aktualne'
}

# --- 3. Configuration (.env) --------------------------------------------------
Step 'Konfiguracja (web\.env)'
$envFile = Join-Path $PSScriptRoot '.env'
$utf8 = New-Object System.Text.UTF8Encoding $false
$text = if (Test-Path $envFile) { [IO.File]::ReadAllText($envFile) } else { [IO.File]::ReadAllText((Join-Path $PSScriptRoot '.env.example')) }

if (-not (Test-Path $envFile) -or $ResetConfig) {
    Write-Host 'Podaj dane do lokalnego serwera MySQL/MariaDB (Enter = wartość w nawiasie).'
    Write-Host 'Baza zostanie utworzona, jeśli jej nie ma. Hasło trafi tylko do pliku web\.env na tym komputerze.'
    $dbHost = Read-WithDefault 'Host' '127.0.0.1'
    $dbPort = Read-WithDefault 'Port' '3306'
    $dbUser = Read-WithDefault 'Użytkownik' 'root'
    $sec = Read-Host 'Hasło' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $dbPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $dbName = Read-WithDefault 'Nazwa bazy' 'cw_dev'
    $url = 'mysql://{0}:{1}@{2}:{3}/{4}' -f [uri]::EscapeDataString($dbUser), [uri]::EscapeDataString($dbPass), $dbHost, $dbPort, $dbName
    $text = Set-EnvLine $text 'DATABASE_URL' $url
}
if ($text -notmatch '(?m)^BETTER_AUTH_SECRET=\S+') {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $text = Set-EnvLine $text 'BETTER_AUTH_SECRET' ([Convert]::ToBase64String($bytes))
}
# local address follows -Port (a non-localhost address set by hand is left alone)
if ($text -notmatch '(?m)^BETTER_AUTH_URL=\S+' -or $text -match '(?m)^BETTER_AUTH_URL=http://(localhost|127\.0\.0\.1)(:\d+)?\s*$') {
    $text = Set-EnvLine $text 'BETTER_AUTH_URL' "http://localhost:$Port"
}
[IO.File]::WriteAllText($envFile, $text, $utf8)
Write-Host 'zapisano (możesz go edytować ręcznie; -ResetConfig pyta o bazę od nowa)'

# --- 4. Database server -------------------------------------------------------
Step 'Serwer bazy'
$m = [regex]::Match($text, '(?m)^DATABASE_URL=mysql://[^@\s]*@\[?([^\]:/\s]+)\]?(?::(\d+))?/')
if (-not $m.Success) { Fail 'Nie rozumiem DATABASE_URL w web\.env (oczekuję mysql://użytkownik:hasło@host:port/baza)' }
$dbHost = $m.Groups[1].Value
$dbPort = if ($m.Groups[2].Success) { [int]$m.Groups[2].Value } else { 3306 }
if (-not (Test-Port $dbHost $dbPort)) {
    $svc = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'maria|mysql' -and $_.Status -ne 'Running' } | Select-Object -First 1
    if ($svc -and $dbHost -in @('127.0.0.1', 'localhost', '::1')) {
        Write-Host "Uruchamiam usługę $($svc.Name)..."
        try { Start-Service $svc.Name; Start-Sleep -Seconds 3 }
        catch { Fail "Nie mogę uruchomić usługi $($svc.Name) (potrzebne uprawnienia administratora). Uruchom ją w services.msc albo uruchom ten skrypt jako administrator." }
    }
    if (-not (Test-Port $dbHost $dbPort)) { Fail "Serwer MySQL/MariaDB nie odpowiada na ${dbHost}:$dbPort. Uruchom go i spróbuj ponownie." }
}
Write-Host "działa na ${dbHost}:$dbPort"

# --- 5. Database, tables, demo account ----------------------------------------
Step 'Baza, tabele i konto demo'
$setupArgs = @('scripts/setup-local.mjs')
if ($NoDemo) { $setupArgs += '--no-demo' }
& node @setupArgs
if ($LASTEXITCODE) {
    Fail 'Przygotowanie bazy nie powiodło się (komunikat powyżej). Jeśli to złe hasło lub użytkownik, uruchom: .\start-local.ps1 -ResetConfig'
}

# --- 6. Start ---------------------------------------------------------------------
$siteUrl = "http://localhost:$Port"
Step "Start strony: $siteUrl"
if (-not $NoDemo) {
    Write-Host 'Konto demo:  demo@example.com  /  demo-haslo-123' -ForegroundColor Green
}
Write-Host 'Zatrzymanie: Ctrl+C'

if (-not $NoBrowser) {
    # open the browser once the site answers (the first dev compile takes a moment)
    $probe = @"
for (`$i = 0; `$i -lt 120; `$i++) {
  try { Invoke-WebRequest '$siteUrl/login' -UseBasicParsing -TimeoutSec 60 | Out-Null; Start-Process '$siteUrl'; break }
  catch { Start-Sleep -Seconds 1 }
}
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($probe))
    Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-EncodedCommand', $encoded
}

if ($Prod) {
    & npm run build
    if ($LASTEXITCODE) { Fail 'Build nie powiódł się' }
    $env:PORT = "$Port"
    $env:NODE_ENV = 'production'
    & node server.js
} else {
    & npm run dev -- -p $Port
}
