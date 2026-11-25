#requires -Version 5.1
<#
.SYNOPSIS
  Registers a daily Windows Task Scheduler job that rebuilds raport.html
  (no admin rights needed - the task runs as the current user, hidden).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\zarejestruj-zadanie.ps1 -At 17:30

.NOTES
  Remove:  Unregister-ScheduledTask -TaskName 'Claude prompt stats' -Confirm:$false
  Run now: Start-ScheduledTask -TaskName 'Claude prompt stats'
#>
param(
    [string]$At = '17:30',
    [string]$TaskName = 'Claude prompt stats'
)

$script = Join-Path $PSScriptRoot 'build-report.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" `
    -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $At
# StartWhenAvailable: if the computer was off/asleep at that time, run as soon as possible afterwards
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Rebuilds the Claude Code prompt statistics report (prompt-stats\raport.html).' -Force | Out-Null

Write-Host "Zadanie '$TaskName' zarejestrowane: codziennie o $At."
Write-Host "Raport: $(Join-Path $PSScriptRoot 'raport.html')"
