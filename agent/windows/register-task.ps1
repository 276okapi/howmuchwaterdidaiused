#requires -Version 5.1
<#
.SYNOPSIS
  Tworzy (albo usuwa) zadanie "howmuchwaterdidaiused" w Harmonogramie zadań, które uruchamia sync.ps1
  z tego folderu w tle. Nie wymaga uprawnień administratora: zadanie działa na Twoim koncie.
  Używa go instalator howmuchwaterdidaiused-setup.exe; przy instalacji ręcznej uruchom go sam.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\register-task.ps1 -Interval 1h
  powershell -NoProfile -ExecutionPolicy Bypass -File .\register-task.ps1 -Remove
#>
param(
    # 30m, 1h (recommended), 6h or 1d (once a day at 17:30)
    [ValidateSet('30m', '1h', '6h', '1d')][string]$Interval = '1h',
    [switch]$Remove,
    [string]$TaskName = 'howmuchwaterdidaiused'
)
$ErrorActionPreference = 'Stop'

if ($Remove) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    exit 0
}

$sync = Join-Path $PSScriptRoot 'sync.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$sync`" -Quiet" `
    -WorkingDirectory $PSScriptRoot
if ($Interval -eq '1d') {
    $trigger = New-ScheduledTaskTrigger -Daily -At '17:30'
} else {
    $minutes = @{ '30m' = 30; '1h' = 60; '6h' = 360 }[$Interval]
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes $minutes)
}
# StartWhenAvailable: if the computer was off or asleep, run as soon as possible afterwards
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Wysyła statystyki pracy z asystentem AI na Twoje konto (howmuchwaterdidaiused).' -Force | Out-Null
exit 0
