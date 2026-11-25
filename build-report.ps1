#requires -Version 5.1
<#
.SYNOPSIS
  Builds an HTML report of Claude Code prompts from local transcripts
  (%USERPROFILE%\.claude\projects\**\*.jsonl): prompts per day and the
  duration of each prompt (from sending it to the last assistant reply).

  Incremental: parsed events are kept in cache\events.json together with the
  byte offset read so far in every transcript. Each run reads only the bytes
  appended since the previous run (transcripts are append-only); unchanged
  files are not opened at all. Events of transcripts that Claude Code has
  since deleted (cleanupPeriodDays, default 30 days) stay in the cache, so
  the history in the report is not lost.

  Per prompt it also computes:
  - estimated cost at API list prices (main thread + subagents), prices from
    ceny.json, refreshed once a day from the public LiteLLM price list;
  - a problem flag (k): 2 = hard event (Esc, stopped at a tool permission prompt,
    API error, no reply), 1 = soft signal in the next prompt (rejection,
    persisting problem, clarification, reported error; regexes in reguly.json);
  - estimated water in litres (woda.json) and your own words of the prompt
    (no pastes, code, links) for the "Prompty" tab.

.OUTPUTS
  raport.html        - interactive report (open in a browser)
  prompty.csv        - one row per prompt (semicolon separated, for Excel)
  ceny.json          - price history per model (USD per million tokens) + manual "override"
  cache\events.json  - incremental cache (safe to delete; -Full rebuilds it)

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\build-report.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\build-report.ps1 -Full
  powershell -NoProfile -ExecutionPolicy Bypass -File .\build-report.ps1 -NoPriceUpdate
#>
param(
    [string]$ProjectsDir = (Join-Path $env:USERPROFILE '.claude\projects'),
    [string]$OutDir = $PSScriptRoot,
    [int]$ExcerptLength = 200,
    # A gap longer than this between replies (waiting overnight for a permission, /loop wakeups...)
    # splits a turn into activity segments; the gap is not counted as working time.
    [int]$IdleGapMinutes = 15,
    # Re-read every transcript from the beginning (events of transcripts already deleted from disk are kept).
    [switch]$Full,
    # Do not download the price list (use the prices already saved in ceny.json).
    [switch]$NoPriceUpdate,
    [string]$PriceUrl = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = [int]::MaxValue
$json.RecursionLimit = 1000
$inv = [Globalization.CultureInfo]::InvariantCulture
$utf8 = New-Object System.Text.UTF8Encoding($false)
$sw = [Diagnostics.Stopwatch]::StartNew()

# Bump when the parsing rules below change - an old cache is then rebuilt automatically.
# v2: token usage (input / cache read / cache write 5m+1h), subagent replies (K='sub'), tool names, '?' endings.
# v3: interrupt type (IT='tool' = stopped at a tool permission prompt), API error replies (Err).
$CacheVersion = 3

# NOTE on object construction: values stored in .NET collections that go to JavaScriptSerializer
# must not be PSObject-wrapped (New-Object output, cmdlet output) - hence ::new() and explicit casts.

function Get-Blocks($content, [string]$type) {
    if ($null -eq $content -or $content -is [string]) { return @() }
    @($content | Where-Object { $_ -is [System.Collections.IDictionary] -and $_['type'] -eq $type })
}

function Get-Text($content) {
    if ($null -eq $content) { return '' }
    if ($content -is [string]) { return $content }
    ((Get-Blocks $content 'text') | ForEach-Object { [string]$_['text'] }) -join "`n"
}

function Get-Excerpt([string]$text, [int]$max) {
    if ($text -match '<command-name>([^<]*)</command-name>') {
        $cmd = $Matches[1]
        $cmdArgs = if ($text -match '<command-args>([^<]*)</command-args>') { $Matches[1] } else { '' }
        $text = "$cmd $cmdArgs"
    }
    $x = ($text -replace '\s+', ' ').Trim()
    if ($x.Length -gt $max) { $x = $x.Substring(0, $max) + [char]0x2026 }
    $x
}

# Parses one transcript line into an event dictionary, or returns $null when the line is irrelevant.
function ConvertTo-Event([string]$line, [string]$dirName) {
    $isA = $line.Contains('"type":"assistant"')
    if (-not $isA) {
        if (-not $line.Contains('"type":"user"')) { return $null }
        # tool results do not affect prompt start/end - skip without parsing (they are the bulk of the data)
        if ($line.Contains('"type":"tool_result"')) { return $null }
    }
    try { $d = $json.DeserializeObject($line) } catch { return $null }
    if ($d -isnot [System.Collections.IDictionary]) { return $null }
    $type = $d['type']
    if ($type -ne 'user' -and $type -ne 'assistant') { return $null }
    # sidechain = subagent conversation: only its replies matter (their cost belongs to your prompt)
    $side = $d['isSidechain'] -eq $true
    if ($side -and $type -ne 'assistant') { return $null }

    $uuid = [string]$d['uuid']; $ts = [string]$d['timestamp']; $sid = [string]$d['sessionId']
    if (-not $uuid -or -not $ts -or -not $sid) { return $null }
    $msg = $d['message']
    if ($msg -isnot [System.Collections.IDictionary]) { return $null }

    $ev = [System.Collections.Generic.Dictionary[string,object]]::new()
    $ev['U'] = $uuid
    $ev['Sid'] = $sid
    $ev['T'] = [long][DateTimeOffset]::Parse($ts, $inv).UtcTicks
    $ev['Ts'] = $ts

    if ($type -eq 'user') {
        $content = $msg['content']
        if ((Get-Blocks $content 'tool_result').Count -gt 0) { return $null }
        $text = Get-Text $content
        $origin = $d['origin']
        if ($text.StartsWith('[Request interrupted')) { $kind = 'interrupt' }
        elseif ($origin -is [System.Collections.IDictionary]) {
            $kind = if ($origin['kind'] -eq 'human') { 'prompt' } else { 'other' }
        }
        elseif ($d['isMeta'] -or $d['isCompactSummary'] -or $text.StartsWith('<local-command') -or
                $text.StartsWith('<system-reminder') -or $text.StartsWith('Caveat:')) { $kind = 'other' }
        else { $kind = 'prompt' }
        if ($kind -eq 'other') { return $null }
        $ev['K'] = [string]$kind
        # "[Request interrupted by user for tool use]" = you rejected / stopped a tool call
        if ($kind -eq 'interrupt' -and $text.Contains('for tool use')) { $ev['IT'] = 'tool' }
        if ($kind -eq 'prompt') {
            # drop context the IDE extension injects (<ide_opened_file>, <ide_selection>, ...) - not typed by you
            $ev['Text'] = [string](($text -replace '(?s)<(ide_[a-z_]+|system-reminder)>.*?</\1>', '').Trim())
            $ev['Img'] = [int](Get-Blocks $content 'image').Count
            $ev['Cwd'] = [string]$d['cwd']
            $ev['Dir'] = [string]$dirName
        }
    }
    else {
        $ev['K'] = if ($side) { 'sub' } else { 'assistant' }
        # one API message is split into several lines (one per content block) with the same usage;
        # the tokens are counted once per message id when events are merged
        $ev['Mid'] = [string]$msg['id']
        $u = $msg['usage']
        $in = 0; $cr = 0; $cw5 = 0; $cw1 = 0; $out = 0
        if ($u -is [System.Collections.IDictionary]) {
            $out = $u['output_tokens']; $in = $u['input_tokens']; $cr = $u['cache_read_input_tokens']
            $cc = $u['cache_creation']
            if ($cc -is [System.Collections.IDictionary]) { $cw5 = $cc['ephemeral_5m_input_tokens']; $cw1 = $cc['ephemeral_1h_input_tokens'] }
            else { $cw5 = $u['cache_creation_input_tokens'] }
        }
        $ev['Out'] = [int]$out
        $ev['In']  = [int]$in
        $ev['CR']  = [int]$cr
        $ev['CW5'] = [int]$cw5
        $ev['CW1'] = [int]$cw1
        $ev['Model'] = [string]$msg['model']
        # reply generated locally because the API call failed (overloaded, timeout, connection lost...)
        if ($d['isApiErrorMessage'] -eq $true -or ($ev['Model'] -eq '<synthetic>' -and (Get-Text $msg['content']).StartsWith('API Error'))) { $ev['Err'] = $true }
        if (-not $side) {
            $tools = Get-Blocks $msg['content'] 'tool_use'
            $ev['Tools'] = [int]$tools.Count
            # tool names and whether the reply ends with a question - input for future prompt-improvement rules
            if ($tools.Count) { $ev['TN'] = [string](($tools | ForEach-Object { [string]$_['name'] }) -join ',') }
            $txt = @(Get-Blocks $msg['content'] 'text')
            if ($txt.Count) { $ev['Q'] = [bool]([string]$txt[-1]['text']).TrimEnd().EndsWith('?') }
        }
    }
    $ev
}

# Reads a transcript from byte $offset up to its last complete line.
# A line still being written (no trailing newline yet) is left for the next run.
function Read-Transcript([string]$path, [long]$offset, [string]$dirName, $events) {
    $fs = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]'ReadWrite, Delete')
    try {
        $count = [int]($fs.Length - $offset)
        $buf = [byte[]]::new([Math]::Max(0, $count))
        [void]$fs.Seek($offset, [IO.SeekOrigin]::Begin)
        $read = 0
        while ($read -lt $count) {
            $n = $fs.Read($buf, $read, $count - $read)
            if ($n -le 0) { break }
            $read += $n
        }
    }
    finally { $fs.Dispose() }

    if ($read -le 0) { return $offset }
    $lastNl = [Array]::LastIndexOf($buf, [byte]10, $read - 1)
    if ($lastNl -lt 0) { return $offset }
    $text = [Text.Encoding]::UTF8.GetString($buf, 0, $lastNl + 1)
    foreach ($line in $text.Split("`n")) {
        if ($line.Length -lt 2) { continue }
        $ev = ConvertTo-Event $line.TrimEnd("`r") $dirName
        if ($null -ne $ev) { $events.Add($ev) }
    }
    $offset + $lastNl + 1
}

# --- 0. Prices (USD per million tokens) -----------------------------------------
# ceny.json keeps a price history per model: a new entry ("od" = since date) is appended only when
# the downloaded price differs from the last one, so old days are always costed at their own prices.
# "override" (edited by hand) wins over the downloaded prices, e.g. {"claude-opus-4-7": {"in": 5, "out": 25}}.
$pricesPath = Join-Path $OutDir 'ceny.json'

function ConvertFrom-PriceEntry($src) {
    # LiteLLM entry (USD per token) -> USD per million tokens; missing cache prices use the standard multipliers
    if ($src -isnot [System.Collections.IDictionary]) { return $null }
    $get = { param($k) if ($src.ContainsKey($k) -and $src[$k] -is [ValueType]) { [Math]::Round([double]$src[$k] * 1e6, 6) } else { $null } }
    $in = & $get 'input_cost_per_token'; $out = & $get 'output_cost_per_token'
    if ($null -eq $in -or $null -eq $out) { return $null }
    $p = [System.Collections.Generic.Dictionary[string,object]]::new()
    $p['in'] = $in; $p['out'] = $out
    $p['cr']  = $(if ($null -ne ($x = & $get 'cache_read_input_token_cost')) { $x } else { $in * 0.1 })
    $p['cw5'] = $(if ($null -ne ($x = & $get 'cache_creation_input_token_cost')) { $x } else { $in * 1.25 })
    $p['cw1'] = $(if ($null -ne ($x = & $get 'cache_creation_input_token_cost_above_1hr')) { $x } else { $in * 2 })
    # tiered price above N tokens in the request (e.g. Haiku 5.5 above 100k)
    $tier = @($src.Keys | Where-Object { $_ -match '^input_cost_per_token_above_(\d+)k_tokens$' } | Select-Object -First 1)
    if ($tier.Count -and $tier[0] -match '_above_(\d+)k_') {
        $n = $Matches[1]; $tin = & $get $tier[0]; $r = $tin / $in
        $p['prog'] = [int]$n * 1000
        $p['pin'] = $tin
        $p['pout'] = $(if ($null -ne ($x = & $get "output_cost_per_token_above_${n}k_tokens")) { $x } else { $out * $r })
        $p['pcr']  = $(if ($null -ne ($x = & $get "cache_read_input_token_cost_above_${n}k_tokens")) { $x } else { $p['cr'] * $r })
        $p['pcw5'] = $(if ($null -ne ($x = & $get "cache_creation_input_token_cost_above_${n}k_tokens")) { $x } else { $p['cw5'] * $r })
        $p['pcw1'] = $(if ($null -ne ($x = & $get "cache_creation_input_token_cost_above_1hr_above_${n}k_tokens")) { $x } else { $p['cw1'] * $r })
    }
    $p
}

function Test-SamePrice($a, $b) {
    foreach ($k in @('in', 'out', 'cr', 'cw5', 'cw1', 'prog', 'pin', 'pout', 'pcr', 'pcw5', 'pcw1')) {
        $x = if ($a.ContainsKey($k)) { [double]$a[$k] } else { -1 }
        $y = if ($b.ContainsKey($k)) { [double]$b[$k] } else { -1 }
        if ([Math]::Abs($x - $y) -gt 1e-9) { return $false }
    }
    $true
}

# Readable ceny.json: one price entry per line ("od" first), so "override" is easy to edit by hand.
function Format-PriceStore($store) {
    $line = {
        param($d)
        $parts = @()
        if ($d.ContainsKey('od')) { $parts += '"od": ' + $json.Serialize([string]$d['od']) }
        foreach ($k in $d.Keys) { if ($k -ne 'od') { $parts += $json.Serialize([string]$k) + ': ' + $json.Serialize($d[$k]) } }
        '{ ' + ($parts -join ', ') + ' }'
    }
    $sb = [Text.StringBuilder]::new()
    [void]$sb.AppendLine('{')
    foreach ($k in '_opis', 'zrodlo', 'sprawdzono') {
        if ($store.ContainsKey($k)) { [void]$sb.AppendLine('  ' + $json.Serialize($k) + ': ' + $json.Serialize([string]$store[$k]) + ',') }
    }
    $ov = @($store['override'].Keys)
    if ($ov.Count) {
        [void]$sb.AppendLine('  "override": {')
        for ($i = 0; $i -lt $ov.Count; $i++) {
            $v = $store['override'][$ov[$i]]
            $txt = if ($v -is [System.Collections.IDictionary]) { & $line $v } else { $json.Serialize($v) }
            [void]$sb.AppendLine('    ' + $json.Serialize([string]$ov[$i]) + ': ' + $txt + $(if ($i -lt $ov.Count - 1) { ',' } else { '' }))
        }
        [void]$sb.AppendLine('  },')
    }
    else { [void]$sb.AppendLine('  "override": {},') }
    [void]$sb.AppendLine('  "historia": {')
    $names = @($store['historia'].Keys | Sort-Object)
    for ($i = 0; $i -lt $names.Count; $i++) {
        [void]$sb.AppendLine('    ' + $json.Serialize([string]$names[$i]) + ': [')
        $hist = @($store['historia'][$names[$i]])
        for ($j = 0; $j -lt $hist.Count; $j++) {
            [void]$sb.AppendLine('      ' + (& $line $hist[$j]) + $(if ($j -lt $hist.Count - 1) { ',' } else { '' }))
        }
        [void]$sb.AppendLine('    ]' + $(if ($i -lt $names.Count - 1) { ',' } else { '' }))
    }
    [void]$sb.AppendLine('  }')
    [void]$sb.Append('}')
    $sb.ToString()
}

function Update-Prices {
    $store = $null
    if (Test-Path $pricesPath) {
        try { $store = $json.DeserializeObject([IO.File]::ReadAllText($pricesPath, [Text.Encoding]::UTF8)) }
        catch { Write-Warning "ceny.json jest uszkodzony ($($_.Exception.Message)) - tworze nowy." }
    }
    if ($store -isnot [System.Collections.IDictionary]) { $store = [System.Collections.Generic.Dictionary[string,object]]::new() }
    $store['_opis'] = 'Ceny USD za milion tokenow (in = wejscie, out = wyjscie, cr = odczyt cache, cw5/cw1 = zapis cache 5 min/1 h; ' +
        'prog/p* = ceny powyzej progu tokenow w zapytaniu). "historia" aktualizuje skrypt raz dziennie z publicznego cennika LiteLLM; ' +
        '"override" edytujesz recznie - ma pierwszenstwo, np. {"claude-opus-4-7": {"in": 5, "out": 25}}.'
    foreach ($k in 'override', 'historia') {
        if ($store[$k] -isnot [System.Collections.IDictionary]) { $store[$k] = [System.Collections.Generic.Dictionary[string,object]]::new() }
    }
    $today = [DateTime]::Now.ToString('yyyy-MM-dd')
    $status = 'zapisane'
    if ($NoPriceUpdate) { $status = 'zapisane (-NoPriceUpdate)' }
    elseif ([string]$store['sprawdzono'] -eq $today) { $status = 'pobrane dzisiaj' }
    else {
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            $resp = Invoke-WebRequest -Uri $PriceUrl -UseBasicParsing -TimeoutSec 30
            $src = $json.DeserializeObject($resp.Content)
            $changed = 0
            foreach ($name in @($src.Keys)) {
                # plain Anthropic ids only (no provider prefixes like bedrock/..., no regional or versioned aliases)
                if ($name -notmatch '^claude-[a-z0-9-]+$' -or $name -match 'latest') { continue }
                $p = ConvertFrom-PriceEntry $src[$name]
                if (-not $p) { continue }
                $hist = [System.Collections.Generic.List[object]]::new()
                if ($store['historia'].ContainsKey($name)) { foreach ($h in $store['historia'][$name]) { $hist.Add($h) } }
                if ($hist.Count -and (Test-SamePrice $hist[$hist.Count - 1] $p)) { continue }
                $p['od'] = $today
                $hist.Add($p)
                $store['historia'][$name] = $hist.ToArray()
                $changed++
            }
            $store['zrodlo'] = $PriceUrl
            $store['sprawdzono'] = $today
            $status = "pobrane dzisiaj (nowe/zmienione ceny: $changed)"
            $tmpP = "$pricesPath.tmp"
            [IO.File]::WriteAllText($tmpP, (Format-PriceStore $store), $utf8)
            Move-Item -LiteralPath $tmpP -Destination $pricesPath -Force
        }
        catch {
            Write-Warning "Nie udalo sie pobrac cennika ($($_.Exception.Message)) - uzywam zapisanych cen."
            $status = 'zapisane (pobieranie nie powiodlo sie)'
        }
    }
    if (-not (Test-Path $pricesPath)) { [IO.File]::WriteAllText($pricesPath, (Format-PriceStore $store), $utf8) }

    # lookup table: model -> entries sorted by "od", with the manual override applied to every entry
    $table = @{}
    foreach ($name in @($store['historia'].Keys)) {
        $table[$name] = @($store['historia'][$name] | Sort-Object { [string]$_['od'] })
    }
    foreach ($name in @($store['override'].Keys)) {
        if ($name.StartsWith('_')) { continue }
        $ov = $store['override'][$name]
        if ($ov -isnot [System.Collections.IDictionary]) { continue }
        if (-not $table.ContainsKey($name)) {
            if (-not ($ov.ContainsKey('in') -and $ov.ContainsKey('out'))) { Write-Warning "override '$name': brak 'in'/'out' - pominiety."; continue }
            $base = [System.Collections.Generic.Dictionary[string,object]]::new(); $base['od'] = '0000-00-00'
            $table[$name] = @($base)
        }
        $table[$name] = @($table[$name] | ForEach-Object {
            $e = [System.Collections.Generic.Dictionary[string,object]]::new()
            foreach ($k in $_.Keys) { $e[$k] = $_[$k] }
            foreach ($k in $ov.Keys) { $e[$k] = $ov[$k] }
            foreach ($k in 'cr', 'cw5', 'cw1') { if (-not $e.ContainsKey($k)) { $e[$k] = [double]$e['in'] * @{ cr = 0.1; cw5 = 1.25; cw1 = 2 }[$k] } }
            $e
        })
    }
    @{ Table = $table; Status = $status; Checked = [string]$store['sprawdzono']; Source = [string]$store['zrodlo'] }
}

$prices = Update-Prices
$priceMemo = @{}
$unknownModels = [System.Collections.Generic.HashSet[string]]::new()

# Price of a model on a given day as double[]: in, out, cr, cw5, cw1, then threshold (0 = none) and the
# same five prices above the threshold; $null when the model is unknown. Memoized per model and UTC day.
function Get-PriceVector([string]$model, [long]$ticks) {
    $key = $model + '|' + [long][Math]::Floor($ticks / 864000000000)
    if ($priceMemo.ContainsKey($key)) { return $priceMemo[$key] }
    $day = ([DateTime]::new($ticks, [DateTimeKind]::Utc)).ToLocalTime().ToString('yyyy-MM-dd')
    $list = $prices.Table[$model]
    if (-not $list) { $list = $prices.Table[($model -replace '-\d{8}$', '')] }   # dated id -> alias
    $v = $null
    if ($list) {
        $p = $list[0]                                   # days before the first known price use the oldest one
        foreach ($e in $list) { if ([string]$e['od'] -le $day) { $p = $e } }
        $v = [double[]]::new(11)
        $i = 0
        foreach ($k in 'in', 'out', 'cr', 'cw5', 'cw1') { $v[$i] = [double]$p[$k]; $i++ }
        if ($p.ContainsKey('prog')) {
            $v[5] = [double]$p['prog']
            $i = 6
            foreach ($k in 'in', 'out', 'cr', 'cw5', 'cw1') { $v[$i] = $(if ($p.ContainsKey("p$k")) { [double]$p["p$k"] } else { [double]$p[$k] }); $i++ }
        }
    }
    $priceMemo[$key] = $v
    $v
}

# --- 1. Read transcripts (incremental) -----------------------------------------
$cacheDir = Join-Path $OutDir 'cache'
$cachePath = Join-Path $cacheDir 'events.json'
$cacheFiles = $null
# Entries of an old cache version (or of a -Full run): files that still exist are re-read from the
# start; files already deleted by Claude Code are kept as they are, so their history is not lost.
$legacyFiles = $null
if (Test-Path $cachePath) {
    try {
        $cache = $json.DeserializeObject([IO.File]::ReadAllText($cachePath, [Text.Encoding]::UTF8))
        if ($cache['files'] -is [System.Collections.IDictionary]) {
            if (-not $Full -and $cache['v'] -eq $CacheVersion) { $cacheFiles = $cache['files'] }
            else {
                $legacyFiles = $cache['files']
                if (-not $Full) { Write-Host 'Cache w starej wersji - pelne przeliczenie.' }
            }
        }
    }
    catch { Write-Host "Nie mozna odczytac cache ($($_.Exception.Message)) - pelne przeliczenie." }
}
if ($null -eq $cacheFiles) { $cacheFiles = [System.Collections.Generic.Dictionary[string,object]]::new() }

# Subagent transcripts (\subagents\) are read too: only their replies (K='sub', for the cost of your prompt).
$files = @(Get-ChildItem -Path $ProjectsDir -Recurse -Filter *.jsonl -File)

$stat = @{ Unchanged = 0; Appended = 0; New = 0; Rebuilt = 0; Bytes = [long]0 }
foreach ($f in $files) {
    $key = $f.FullName
    $len = [long]$f.Length
    $entry = if ($cacheFiles.ContainsKey($key)) { $cacheFiles[$key] } else { $null }
    if ($entry -and [long]$entry['len'] -eq $len) { $stat.Unchanged++; continue }

    $events = [System.Collections.Generic.List[object]]::new()
    $offset = [long]0
    if ($entry -and [long]$entry['off'] -le $len) {
        # file grew: keep what was parsed, read only the appended part
        $offset = [long]$entry['off']
        foreach ($x in $entry['ev']) { $events.Add($x) }
        $stat.Appended++
    }
    elseif ($entry) { $stat.Rebuilt++ }   # file shrank (rewritten) - read again from the start
    else { $stat.New++ }

    $stat.Bytes += $len - $offset
    $newOffset = Read-Transcript $key $offset $f.Directory.Name $events

    $e2 = [System.Collections.Generic.Dictionary[string,object]]::new()
    $e2['off'] = [long]$newOffset
    $e2['len'] = [long]$len
    $e2['ev'] = $events.ToArray()
    $cacheFiles[$key] = $e2
}
if ($legacyFiles) {
    $onDisk = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($f in $files) { [void]$onDisk.Add($f.FullName) }
    foreach ($key in @($legacyFiles.Keys)) {
        if (-not $onDisk.Contains($key) -and -not $cacheFiles.ContainsKey($key)) { $cacheFiles[$key] = $legacyFiles[$key] }
    }
}

# Save the cache before merging (merging adds derived fields that must not be persisted).
if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir | Out-Null }
$cacheObj = [System.Collections.Generic.Dictionary[string,object]]::new()
$cacheObj['v'] = [int]$CacheVersion
$cacheObj['files'] = $cacheFiles
$tmp = "$cachePath.tmp"
[IO.File]::WriteAllText($tmp, $json.Serialize($cacheObj), $utf8)
Move-Item -LiteralPath $tmp -Destination $cachePath -Force

# Merge: dedupe (resumed sessions copy old entries into a new file) and group by session.
$seenUuid = New-Object 'System.Collections.Generic.HashSet[string]'
$seenMsg = New-Object 'System.Collections.Generic.HashSet[string]'
$sessions = @{}   # sessionId -> List of events
foreach ($key in ($cacheFiles.Keys | Sort-Object)) {
    foreach ($ev in $cacheFiles[$key]['ev']) {
        if (-not $seenUuid.Add([string]$ev['U'])) { continue }
        if ($ev['K'] -eq 'assistant' -or $ev['K'] -eq 'sub') {
            # usage is repeated on every line of one API message - count it on the first line only
            $mid = [string]$ev['Mid']
            $eff = [bool]($mid -and $seenMsg.Add($mid))
            $ev['Eff'] = $eff
            $ev['EffOut'] = if ($eff) { [int]$ev['Out'] } else { 0 }
            # cost in USD (inline - this loop runs for every reply); events kept from an old cache
            # version have no usage beyond output tokens -> cost unknown ($null)
            if (-not $eff) { $ev['Cost'] = [double]0 }
            elseif (-not $ev.ContainsKey('In')) { $ev['Cost'] = $null }
            else {
                $tIn = [long]$ev['In']; $tCr = [long]$ev['CR']; $tC5 = [long]$ev['CW5']; $tC1 = [long]$ev['CW1']; $tOut = [long]$ev['Out']
                $tok = $tIn + $tCr + $tC5 + $tC1
                if ($tok + $tOut -eq 0) { $ev['Cost'] = [double]0 }
                else {
                    $model = [string]$ev['Model']
                    $mKey = $model + '|' + [long][Math]::Floor([long]$ev['T'] / 864000000000)
                    $pv = if ($priceMemo.ContainsKey($mKey)) { $priceMemo[$mKey] } else { Get-PriceVector $model ([long]$ev['T']) }
                    if ($null -eq $pv) { [void]$unknownModels.Add($model); $ev['Cost'] = $null }
                    else {
                        $po = if ($pv[5] -gt 0 -and $tok -gt $pv[5]) { 6 } else { 0 }
                        $ev['Cost'] = [double](($tIn * $pv[$po] + $tOut * $pv[$po + 1] + $tCr * $pv[$po + 2] + $tC5 * $pv[$po + 3] + $tC1 * $pv[$po + 4]) / 1e6)
                    }
                }
            }
        }
        $sid = [string]$ev['Sid']
        if (-not $sessions.ContainsKey($sid)) { $sessions[$sid] = New-Object System.Collections.Generic.List[object] }
        $sessions[$sid].Add($ev)
    }
}

# --- 2. Build turns: prompt -> last assistant reply before the next prompt ----
$turns = New-Object System.Collections.Generic.List[object]
$rxWord = [regex]::new('\S+')
# prompt-text analysis: what you typed yourself, without pastes, code, links and file paths
$rxNoise = [regex]::new('(?s)<pasted_content\b[^>]*>.*?(</pasted_content\b[^>]*>|$)|```.*?(```|$)|`[^`]*`|https?://\S+|\S*[\\/]\S*|<[^>]+>')
$rxTok = [regex]::new("\p{L}+(?:['’\-]\p{L}+)*")
$MaxWords = 300

function Get-PromptWords([string]$text) {
    $own = $rxNoise.Replace($text, ' ').ToLowerInvariant()
    $w = @($rxTok.Matches($own) | Select-Object -First $MaxWords | ForEach-Object { $_.Value })
    [string]($w -join ' ')
}

function Close-Turn($c) {
    $text = $c.Text
    $proj = if ($c.Cwd) { Split-Path -Leaf $c.Cwd.TrimEnd('\', '/') } else { $c.Dir }
    $o = New-Object 'System.Collections.Generic.Dictionary[string,object]'
    $o['s']   = [string]$c.Ts                    # start (UTC ISO)
    $o['e']   = [string]$c.EndTs                 # end (UTC ISO)
    $o['p']   = [string]$proj                    # project
    $o['sid'] = [string]$c.Sid
    $o['c']   = [int]$text.Length                # prompt length (chars)
    $o['w']   = [int]$rxWord.Matches($text).Count
    $o['img'] = [int]$c.Img
    $o['o']   = [int]$c.Out                      # output tokens of all replies in this turn
    $o['t']   = [int]$c.Tools                    # tool calls
    $o['r']   = [int]$c.Replies                  # assistant messages
    $o['i']   = [bool]$c.Int                     # interrupted by user
    $o['x']   = [string](Get-Excerpt $text $ExcerptLength)
    if ($text -match '<command-name>/?([^<]*)</command-name>') { $o['cmd'] = [string]('/' + $Matches[1].Trim()) }
    else {
        $o['tw'] = Get-PromptWords $text           # normalized words for the "Prompty" tab
        if ($rxNoise.Replace($text, ' ').Contains('?')) { $o['q'] = $true }   # asks a question
    }
    if ($text.Contains('<pasted_content')) { $o['pst'] = $true }
    # models used in this turn, most used first (comma separated)
    $o['m']   = if ($c.Models.Count -le 1) { [string](@($c.Models.Keys) -join '') }
                else { [string](($c.Models.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { $_.Key }) -join ', ') }
    # activity segments as [startSec, endSec] offsets from the prompt; idle gaps excluded
    $c.Segs.Add(@($c.SegStart, $c.LastT))
    $active = 0
    $segs = @()
    foreach ($sg in $c.Segs) {
        $active += ($sg[1] - $sg[0]) / 1e7
        $segs += , ([int[]]@([int](($sg[0] - $c.StartT) / 1e7), [int](($sg[1] - $c.StartT) / 1e7)))
    }
    $o['a']   = [int]$active                     # active seconds
    if ($segs.Count -gt 1) { $o['g'] = [object[]]$segs }
    # tokens of the main thread (input not cached, cache read, cache write) and estimated cost in USD
    $o['in']  = [int]$c.In
    $o['cr']  = [int]$c.CR
    $o['cw']  = [int]$c.CW
    $o['h2o'] = [double][Math]::Round($c.H2O, 4)   # estimated water in litres (woda.json), subagents included
    $o['usd'] = [double][Math]::Round($c.Usd + $c.SubUsd, 4)
    if ($c.SubUsd -gt 0) { $o['usds'] = [double][Math]::Round($c.SubUsd, 4) }   # of which subagents
    if ($c.Unk) { $o['cu'] = $true }            # some replies had no known price - cost is a lower bound
    $o
}

# --- correction rules (reguly.json) ---
$rulesPath = Join-Path $PSScriptRoot 'reguly.json'
$rules = $json.DeserializeObject([IO.File]::ReadAllText($rulesPath, [Text.Encoding]::UTF8))
$rxOpt = [Text.RegularExpressions.RegexOptions]'IgnoreCase, CultureInvariant'
$rxConfirm = [regex]::new([string]$rules['potwierdzenie'], $rxOpt)
$corrRules = @(foreach ($r in $rules['reguly']) {
    @{
        Name  = [string]$r['nazwa']
        Rx    = [regex]::new([string]$r['wzorzec'], $rxOpt)
        Paste = $(if ($r['wklejka']) { [regex]::new([string]$r['wklejka'], $rxOpt) } else { $null })
        SkipAfterConfirm = [bool]$r['pomijajPoPotwierdzeniu']
    }
})
$corrWindowTicks = [long]$rules['oknoMinut'] * 60 * 1e7
# the closing tag carries the id too: </pasted_content id="...">; an unclosed paste runs to the end
$rxPaste = [regex]::new('(?s)<pasted_content\b[^>]*>(.*?)(</pasted_content\b[^>]*>|$)')

# Marks turns that went wrong, kr = what happened:
#   k = 2  hard event in the turn itself: you pressed Esc, you stopped it at a tool permission prompt,
#          the API call failed, or there was no reply at all and you sent another prompt;
#   k = 1  soft signal: the NEXT prompt in the session (sent within the time window) matches a rule
#          from reguly.json - shown separately, not counted in the main rate;
#   k = 0  nothing.
function Set-Corrections($list) {
    for ($i = 0; $i -lt $list.Count; $i++) {
        $cur = $list[$i]
        $o = $cur.O
        $next = if ($i + 1 -lt $list.Count) { $list[$i + 1] } else { $null }
        $k = 0; $kr = ''
        # this file must stay ASCII (PowerShell 5.1 reads it as ANSI) - Polish letters as char codes
        if ($o['i']) { $k = 2; $kr = $(if ($cur.IntTool) { 'zatrzymane przy narz' + [char]0x119 + 'dziu' } else { 'przerwanie (Esc)' }) }
        elseif ($cur.ApiErr) { $k = 2; $kr = 'b' + [char]0x142 + [char]0x105 + 'd API' }
        # slash commands (/model, /clear...) legitimately get no reply from the model
        elseif ($o['r'] -eq 0 -and $next -and -not $cur.Text.Contains('<command-name>')) { $k = 2; $kr = 'brak odpowiedzi' }
        elseif ($next -and ($next.StartT - $cur.EndT) -le $corrWindowTicks) {
            $own = $rxPaste.Replace($next.Text, ' ').Trim()
            if ($own.Length -gt 400) { $own = $own.Substring(0, 400) }
            $pasted = (@($rxPaste.Matches($next.Text) | ForEach-Object { $_.Groups[1].Value }) -join "`n")
            $confirm = $rxConfirm.IsMatch($own)
            foreach ($r in $corrRules) {
                if ($confirm -and $r.SkipAfterConfirm) { continue }
                if ($r.Rx.IsMatch($own) -or ($r.Paste -and $pasted -and $r.Paste.IsMatch($pasted))) { $k = 1; $kr = $r.Name; break }
            }
        }
        $o['k'] = [int]$k
        if ($kr) { $o['kr'] = [string]$kr }
        # a soft signal was possible only if another prompt followed in the session
        $o['nx'] = [bool]($null -ne $next)
    }
}

$gapTicks = [long]$IdleGapMinutes * 60 * 1e7

# --- water estimate (woda.json): litres per million tokens of each kind ---
$water = @{ in = 20.0; cw = 20.0; cr = 2.0; out = 100.0; pool = 2500000.0 }
$waterPath = Join-Path $PSScriptRoot 'woda.json'
if (Test-Path $waterPath) {
    try {
        $wj = $json.DeserializeObject([IO.File]::ReadAllText($waterPath, [Text.Encoding]::UTF8))
        $wf = $wj['litryNaMilionTokenow']
        if ($wf -is [System.Collections.IDictionary]) {
            foreach ($k in 'in', 'cw', 'cr', 'out') { if ($wf.ContainsKey($k)) { $water[$k] = [double]$wf[$k] } }
        }
        if ($wj['basenOlimpijskiLitry']) { $water.pool = [double]$wj['basenOlimpijskiLitry'] }
    }
    catch { Write-Warning "woda.json jest uszkodzony ($($_.Exception.Message)) - uzywam domyslnego przelicznika." }
}
$wIn = $water.in / 1e6; $wCw = $water.cw / 1e6; $wCr = $water.cr / 1e6; $wOut = $water.out / 1e6
# litres of one reply; usage is counted once per API message (Eff), like the cost
function Get-Water($e) {
    if (-not $e.Eff) { return 0.0 }
    [int]$e.In * $wIn + ([int]$e.CW5 + [int]$e.CW1) * $wCw + [int]$e.CR * $wCr + [int]$e.Out * $wOut
}

function Step-Turn($c, $e) {
    # extend the current activity segment, or start a new one after an idle gap
    if ($e.T - $c.LastT -gt $gapTicks) {
        $c.Segs.Add(@($c.SegStart, $c.LastT))
        $c.SegStart = $e.T
    }
    $c.LastT = $e.T
    $c.EndTs = $e.Ts
}

$SortByKeys = [Array].GetMethod('Sort', [Type[]]@([Array], [Array]))
foreach ($sid in $sessions.Keys) {
    $cur = $null
    $sessTurns = [System.Collections.Generic.List[object]]::new()
    $close = { $sessTurns.Add(@{ O = (Close-Turn $cur); Text = $cur.Text; StartT = $cur.StartT; EndT = $cur.LastT; ApiErr = $cur.ApiErr; IntTool = $cur.IntTool }) }
    # native sort by time (Sort-Object with a scriptblock is slow); + index keeps equal timestamps in file
    # order - timestamps have millisecond precision, i.e. multiples of 10000 ticks
    $evs = $sessions[$sid].ToArray()
    $keys = [long[]]::new($evs.Length)
    for ($i = 0; $i -lt $evs.Length; $i++) { $keys[$i] = [long]$evs[$i]['T'] + [Math]::Min($i, 9999) }
    # [Array]::Sort($keys, $evs) would bind to the generic overload and sort a converted COPY of $evs
    [void]$SortByKeys.Invoke($null, @($keys, $evs))
    foreach ($e in $evs) {
        switch ($e.K) {
            'prompt' {
                if ($cur) { . $close }
                $cur = @{ Sid = $sid; Ts = $e.Ts; EndTs = $e.Ts; Text = $e.Text; Img = $e.Img; Cwd = $e.Cwd; Dir = $e.Dir
                          Out = 0; Tools = 0; Replies = 0; Int = $false; Models = @{}
                          In = 0; CR = 0; CW = 0; Usd = [double]0; SubUsd = [double]0; Unk = $false; H2O = [double]0; ApiErr = $false; IntTool = $false
                          StartT = $e.T; SegStart = $e.T; LastT = $e.T; Segs = (New-Object System.Collections.Generic.List[object]) }
            }
            'assistant' {
                if ($cur) {
                    Step-Turn $cur $e; $cur.Out += $e.EffOut; $cur.Tools += $e.Tools; $cur.Replies++
                    if ($e.Eff) { $cur.In += [int]$e.In; $cur.CR += [int]$e.CR; $cur.CW += [int]$e.CW5 + [int]$e.CW1; $cur.H2O += Get-Water $e }
                    if ($null -ne $e.Cost) { $cur.Usd += $e.Cost } elseif (-not $e.Model.StartsWith('<')) { $cur.Unk = $true }
                    # '<synthetic>' = locally generated message (error, interrupt), not a real model
                    if ($e.Err) { $cur.ApiErr = $true }
                    if ($e.Model -and -not $e.Model.StartsWith('<')) { $cur.Models[$e.Model] = 1 + [int]$cur.Models[$e.Model] }
                }
            }
            'sub' {
                # subagent reply: adds cost to the prompt that is running, does not change its timing
                if ($cur) { $cur.H2O += Get-Water $e; if ($null -ne $e.Cost) { $cur.SubUsd += $e.Cost } elseif (-not $e.Model.StartsWith('<')) { $cur.Unk = $true } }
            }
            'interrupt' {
                if ($cur) {
                    # an Esc pressed long after the last reply does not extend working time
                    if ($e.T - $cur.LastT -le $gapTicks) { $cur.LastT = $e.T }
                    $cur.EndTs = $e.Ts; $cur.Int = $true; $cur.IntTool = $e.IT -eq 'tool'
                    . $close; $cur = $null
                }
            }
        }
    }
    if ($cur) { . $close }
    Set-Corrections $sessTurns
    foreach ($st in $sessTurns) { $turns.Add($st.O) }
}

$sorted = New-Object 'System.Collections.Generic.List[object]'
foreach ($t in ($turns | Sort-Object { $_['s'] })) { $sorted.Add($t) }

# --- 3. Write outputs ----------------------------------------------------------
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$meta = New-Object 'System.Collections.Generic.Dictionary[string,object]'
$meta['generated'] = [string][DateTimeOffset]::Now.ToString('o')
$meta['files']     = [int]$cacheFiles.Count
$meta['sessions']  = [int]$sessions.Count
$meta['prompts']   = [int]$sorted.Count
$meta['idleGap']   = [int]$IdleGapMinutes
$meta['corrWindow'] = [int]$rules['oknoMinut']
$meta['pricesChecked'] = [string]$prices.Checked
$meta['pricesStatus']  = [string]$prices.Status
$wm = [System.Collections.Generic.Dictionary[string,object]]::new()
foreach ($k in 'in', 'cw', 'cr', 'out', 'pool') { $wm[$k] = [double]$water[$k] }
$meta['water'] = $wm
if ($unknownModels.Count) { $meta['unknownModels'] = [string](@($unknownModels) -join ', ') }
$dataJson = $json.Serialize($sorted).Replace('</', '<\/')
$metaJson = $json.Serialize($meta)

$template = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'report-template.html'), [Text.Encoding]::UTF8)
$html = $template.Replace('/*__DATA__*/[]', $dataJson).Replace('/*__META__*/{}', $metaJson)
$htmlPath = Join-Path $OutDir 'raport.html'
[IO.File]::WriteAllText($htmlPath, $html, $utf8)

$csvPath = Join-Path $OutDir 'prompty.csv'
$csvRows = $sorted | ForEach-Object {
    $s = [DateTimeOffset]::Parse($_.s, $inv).ToLocalTime()
    $e = [DateTimeOffset]::Parse($_.e, $inv).ToLocalTime()
    [pscustomobject]@{
        Dzien         = $s.ToString('yyyy-MM-dd')
        Start         = $s.ToString('HH:mm:ss')
        Koniec        = $e.ToString('HH:mm:ss')
        CzasSek       = $_.a
        CzasZegarSek  = [int]($e - $s).TotalSeconds
        Projekt       = $_.p
        Model         = $_.m
        Znaki         = $_.c
        Slowa         = $_.w
        TokenyWyjscia = $_.o
        TokenyWejscia = $_.in
        TokenyCacheOdczyt = $_.cr
        TokenyCacheZapis  = $_.cw
        KosztUSD      = $_.usd
        KosztSubagentowUSD = $(if ($_.ContainsKey('usds')) { $_.usds } else { 0 })
        KosztNiepelny = [bool]$_.ContainsKey('cu')
        WodaLitry     = $_.h2o
        Narzedzia     = $_.t
        Przerwany     = $_.i
        Poprawka      = $_.k
        PowodPoprawki = $(if ($_.ContainsKey('kr')) { $_.kr } else { '' })
        Sesja         = $_.sid
        Prompt        = $_.x
    }
}
# The CSV may be open in Excel (locked) - then skip it instead of failing the whole run.
$csvTmp = "$csvPath.tmp"
$csvRows | Export-Csv -Path $csvTmp -NoTypeInformation -Delimiter ';' -Encoding UTF8
try { Move-Item -LiteralPath $csvTmp -Destination $csvPath -Force }
catch {
    Remove-Item -LiteralPath $csvTmp -ErrorAction SilentlyContinue
    Write-Warning "prompty.csv jest otwarty w innym programie (Excel?) - nie zaktualizowano CSV, raport HTML jest aktualny."
    $csvPath = '(pominiety)'
}

$sw.Stop()
$gone = $cacheFiles.Count - $files.Count
Write-Host ("Pliki: {0} bez zmian, {1} dopisane, {2} nowe, {3} od nowa ({4:N1} MB przeczytane){5}" -f `
    $stat.Unchanged, $stat.Appended, $stat.New, $stat.Rebuilt, ($stat.Bytes / 1MB),
    $(if ($gone -gt 0) { "; $gone usunietych z dysku - zachowane w cache" } else { '' }))
Write-Host ("Sesji: {0}, promptow: {1}, czas: {2:N1} s" -f $sessions.Count, $sorted.Count, $sw.Elapsed.TotalSeconds)
$totUsd = 0.0; $nHard = 0; $nSoft = 0; $totH2O = 0.0
foreach ($t in $sorted) { $totUsd += $t['usd']; $totH2O += $t['h2o']; if ($t['k'] -eq 2) { $nHard++ } elseif ($t['k'] -eq 1) { $nSoft++ } }
Write-Host ("Szacowany koszt (ceny API): {0:N2} USD; przerwane/awarie: {1:P1} ({2} z {3}), sygnaly w tresci: {4}; ceny: {5}" -f `
    $totUsd, ($nHard / [Math]::Max(1, $sorted.Count)), $nHard, $sorted.Count, $nSoft, $prices.Status)
Write-Host ("Szacowana woda: {0:N1} l ({1:N6} basenu olimpijskiego)" -f $totH2O, ($totH2O / $water.pool))
if ($unknownModels.Count) { Write-Warning "Brak ceny dla modeli: $(@($unknownModels) -join ', ') - dopisz je w 'override' w ceny.json." }
Write-Host "Raport: $htmlPath"
Write-Host "CSV:    $csvPath"
