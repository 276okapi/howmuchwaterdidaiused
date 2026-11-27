#requires -Version 5.1
<#
.SYNOPSIS
  howmuchwaterdidaiused - agent: liczy statystyki z lokalnych transkryptów asystenta AI
  i wysyła je na Twoje konto. Nic nie wyświetla i nie zapisuje raportów na dysku.
  Uruchamiany cyklicznie przez Harmonogram zadań (zadanie "howmuchwaterdidaiused", tworzy je
  instalator howmuchwaterdidaiused-setup.exe albo register-task.ps1).

  Strona składa z tego pliku także agenta w jednym pliku (zakładka Agent, "Ręcznie"): wpisuje
  wtedy ustawienia w $AgentConfig, a pliki liczące w $AgentFiles, zamiast config.json obok.

.DESCRIPTION
  1. build-report.ps1 czyta transkrypty Claude Code (%USERPROFILE%\.claude\projects) przyrostowo
     i zapisuje dane tymczasowo w dane.json (usuwany po wysłaniu).
  2. Zgodnie z config.json usuwa treść promptów (shareText = false) i zamienia nazwy projektów
     na "projekt 1", "projekt 2"... (shareProjects = false). Dzieje się to TUTAJ, przed wysłaniem.
  3. Wysyła prompty zakończone od ostatniej synchronizacji (z zapasem 2 dni) na <server>/api/ingest
     z Twoim kluczem API. Serwer nie dubluje danych wysłanych ponownie.

  Pliki w tym folderze: config.json (ustawienia i klucz), stan.json (ostatnia synchronizacja),
  projekty.json (stałe numery projektów przy anonimizacji), sync.log (dziennik),
  cache\ (pamięć podręczna liczenia, żeby kolejne uruchomienia czytały tylko nowe dane).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\sync.ps1          # wyślij nowe dane
  powershell -NoProfile -ExecutionPolicy Bypass -File .\sync.ps1 -All     # wyślij całą historię
#>
param(
    # Send the whole history, not only prompts since the last sync.
    [switch]$All,
    # Re-read all transcripts from the beginning (passed to build-report.ps1).
    [switch]$Full,
    # No console output (scheduled task); everything still goes to sync.log.
    [switch]$Quiet
)
# --- end of parameters: the site builds the one-file agent from the code below ---

$ErrorActionPreference = 'Stop'
$AgentVersion = '1.1.0'
# one-file agent: settings and files are in the script, the working folder is fixed
$oneFile = Test-Path variable:AgentConfig
$here = if ($oneFile) { Join-Path $env:LOCALAPPDATA 'howmuchwaterdidaiused' } else { $PSScriptRoot }
New-Item -ItemType Directory -Force -Path $here | Out-Null
$cfgPath = Join-Path $here 'config.json'
$statePath = Join-Path $here 'stan.json'
$mapPath = Join-Path $here 'projekty.json'
$logPath = Join-Path $here 'sync.log'
$dataPath = Join-Path $here 'dane.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$inv = [Globalization.CultureInfo]::InvariantCulture

Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = [int]::MaxValue
$json.RecursionLimit = 1000

# the log is kept short: last ~500 lines
if ((Test-Path $logPath) -and (Get-Item $logPath).Length -gt 256KB) {
    $tail = Get-Content -LiteralPath $logPath -Tail 500 -Encoding UTF8
    [IO.File]::WriteAllLines($logPath, $tail, $utf8)
}
function Log([string]$m, [string]$color = 'Gray') {
    [IO.File]::AppendAllText($logPath, ('{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $m) + "`r`n", $utf8)
    if (-not $Quiet) { Write-Host $m -ForegroundColor $color }
}
function Read-JsonFile([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    $json.DeserializeObject([IO.File]::ReadAllText($path, [Text.Encoding]::UTF8))
}
function Write-JsonFile([string]$path, $obj) {
    [IO.File]::WriteAllText($path, $json.Serialize($obj), $utf8)
}

try {
    # --- settings -----------------------------------------------------------------
    if ($oneFile) {
        $cfg = $AgentConfig
        # the counting script and its rules travel inside the one-file agent
        foreach ($name in $AgentFiles.Keys) {
            $target = Join-Path $here $name
            if ($name -eq 'ceny.json' -and (Test-Path $target)) { continue }   # kept up to date by build-report.ps1
            $content = [string]$AgentFiles[$name]
            if (-not (Test-Path $target) -or [IO.File]::ReadAllText($target) -ne $content) {
                [IO.File]::WriteAllText($target, $content, $utf8)
            }
        }
    } else {
        $cfg = Read-JsonFile $cfgPath
    }
    if (-not $cfg -or -not $cfg['server'] -or -not $cfg['apiKey']) {
        throw "Brak adresu strony albo klucza API (config.json). Pobierz agenta ponownie ze strony."
    }
    $server = ([string]$cfg['server']).TrimEnd('/')
    $sources = @($cfg['sources'])
    if ($sources -notcontains 'claude-code') {
        Log 'Żadne obsługiwane źródło danych nie jest włączone (config.json: sources). Nic do wysłania.' 'Yellow'
        exit 0
    }
    $shareText = $cfg['shareText'] -eq $true
    $shareProjects = $cfg['shareProjects'] -eq $true

    # --- 1. compute (incremental; data only, no report) -----------------------------------
    $brArgs = @{ OutDir = $here; JsonOut = $dataPath }
    if ($Full) { $brArgs['Full'] = $true }
    $out = & (Join-Path $here 'build-report.ps1') @brArgs *>&1 | Out-String
    foreach ($line in ($out -split "`r?`n" | Where-Object { $_.Trim() })) { [IO.File]::AppendAllText($logPath, "    $line`r`n", $utf8) }
    $data = Read-JsonFile $dataPath
    $turns = if ($data -and $data['turns']) { @($data['turns']) } else { @() }

    # --- 2. select and anonymize --------------------------------------------------------
    $state = Read-JsonFile $statePath
    if (-not $state) { $state = @{} }
    $since = $null
    # sharing settings changed since the last sync: send the whole history again in the new form
    $sharingChanged = $state.ContainsKey('shareText') -and (($state['shareText'] -eq $true) -ne $shareText -or ($state['shareProjects'] -eq $true) -ne $shareProjects)
    if (-not $All -and -not $sharingChanged -and $state['lastEnd']) {
        # prompts can still grow after the last sync (a long agent run): resend the last 2 days
        $since = [DateTimeOffset]::Parse([string]$state['lastEnd'], $inv).AddDays(-2)
    }
    $map = Read-JsonFile $mapPath
    $projects = New-Object 'System.Collections.Generic.Dictionary[string,object]'
    if ($map) { foreach ($k in $map.Keys) { $projects[$k] = $map[$k] } }

    $send = New-Object 'System.Collections.Generic.List[object]'
    $lastEnd = if ($state['lastEnd']) { [DateTimeOffset]::Parse([string]$state['lastEnd'], $inv) } else { [DateTimeOffset]::MinValue }
    foreach ($t in $turns) {
        $end = [DateTimeOffset]::Parse([string]$t['e'], $inv)
        if ($end -gt $lastEnd) { $lastEnd = $end }
        if ($since -and $end -lt $since) { continue }
        if (-not $shareText) { [void]$t.Remove('x'); [void]$t.Remove('tw') }
        if (-not $shareProjects) {
            $p = [string]$t['p']
            if (-not $projects.ContainsKey($p)) { $projects[$p] = 'projekt ' + ($projects.Count + 1) }
            $t['p'] = $projects[$p]
        }
        $send.Add($t)
    }
    if (-not $shareProjects) { Write-JsonFile $mapPath $projects }

    # --- 3. send ---------------------------------------------------------------------------
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $accepted = 0; $rejected = 0
    for ($i = 0; $i -lt $send.Count; $i += 1000) {
        $chunk = $send.GetRange($i, [Math]::Min(1000, $send.Count - $i))
        $body = $json.Serialize(@{ turns = $chunk; agent = @{ version = $AgentVersion; os = 'windows'; source = 'claude-code' } })
        try {
            $res = Invoke-RestMethod -Uri "$server/api/ingest" -Method Post -TimeoutSec 120 `
                -Headers @{ 'x-api-key' = [string]$cfg['apiKey'] } `
                -ContentType 'application/json; charset=utf-8' -Body $utf8.GetBytes($body)
        } catch {
            $code = 0
            if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
            if ($code -eq 401) { throw "Serwer nie przyjął klucza API (401). Na stronie wygenerowano nowy klucz: pobierz agenta ponownie (zakładka Agent)." }
            throw "Nie udało się wysłać danych na $server ($($_.Exception.Message))."
        }
        $accepted += [int]$res.accepted
        $rejected += [int]$res.rejectedCount
    }

    $state['lastSync'] = [DateTimeOffset]::Now.ToString('o')
    if ($lastEnd -gt [DateTimeOffset]::MinValue) { $state['lastEnd'] = $lastEnd.ToString('o') }
    $state['agentVersion'] = $AgentVersion
    $state['shareText'] = $shareText
    $state['shareProjects'] = $shareProjects
    Write-JsonFile $statePath $state
    Remove-Item -LiteralPath $dataPath -ErrorAction SilentlyContinue

    $msg = "Wysłano $($send.Count) z $($turns.Count) promptów: przyjęte $accepted"
    if ($rejected) { $msg += ", odrzucone $rejected" }
    Log $msg 'Green'
    if (-not $Quiet) { Write-Host "Raport: $server/pulpit" }
    exit 0
} catch {
    Log "BŁĄD: $($_.Exception.Message)" 'Red'
    exit 1
}
