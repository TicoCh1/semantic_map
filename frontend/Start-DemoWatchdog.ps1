param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,
  [Parameter(Mandatory = $true)]
  [string]$FrontendUrl,
  [string]$BackendToken = "",
  [string]$SessionId = "",
  [int]$IntervalSeconds = 10,
  [int]$TimeoutSeconds = 5,
  [int]$StartGraceSeconds = 45,
  [int]$LocalMonitorPort = 51973,
  [int]$LocalFrontendHeartbeatTimeoutSeconds = 35,
  [int]$BrowserRestartCooldownSeconds = 45,
  [int]$ParentProcessId = 0,
  [int]$LogMaxBytes = 5242880,
  [int]$LogBackupCount = 2,
  [string]$LogPath = ""
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
if ([string]::IsNullOrWhiteSpace($LogPath)) {
  $LogPath = Join-Path $AppDir "logs\demo-watchdog.log"
}

$script:LastFrontendHeartbeatAt = $null
$script:LastFrontendStatus = "none"
$script:LastFrontendSessionId = ""
$script:LastFrontendDetails = $null
$script:LastFrontendEventAt = $null
$script:LastFrontendEventCode = ""
$script:LastBrowserRestartAt = $null
$script:BrowserRestartCount = 0
$script:LocalMonitorAvailable = $false
$script:BackendPostFailureCount = 0
$script:BackendPostOutageStartedAt = $null
$script:LastBackendPostError = ""
$script:PendingFrontendEvents = New-Object 'System.Collections.Generic.Queue[object]'
$script:RecentRestartEventKeys = @{}
$script:HttpClient = New-Object System.Net.Http.HttpClient

function Normalize-BaseUrl {
  param([string]$Value)
  $trimmed = $Value.Trim().TrimEnd("/")
  if ($trimmed -notmatch "^[a-zA-Z][a-zA-Z0-9+.-]*://") {
    return "https://$trimmed"
  }
  return $trimmed
}

function Get-JsonProperty {
  param(
    [object]$Object,
    [string]$Name,
    [object]$Fallback = $null
  )

  if ($null -eq $Object) {
    return $Fallback
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property -or $null -eq $property.Value) {
    return $Fallback
  }

  return $property.Value
}

function Write-WatchdogLog {
  param([string]$Message)
  $dir = Split-Path -Parent $LogPath
  if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  Rotate-WatchdogLogIfNeeded
  $line = "$(Get-Date -Format o) $Message"
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Rotate-WatchdogLogIfNeeded {
  if ($LogMaxBytes -le 0 -or -not (Test-Path -LiteralPath $LogPath -PathType Leaf)) {
    return
  }
  $item = Get-Item -LiteralPath $LogPath
  if ($item.Length -lt $LogMaxBytes) {
    return
  }
  if ($LogBackupCount -le 0) {
    Remove-Item -LiteralPath $LogPath -Force
    return
  }
  for ($index = $LogBackupCount; $index -ge 1; $index--) {
    $current = "$LogPath.$index"
    if ($index -eq $LogBackupCount) {
      if (Test-Path -LiteralPath $current -PathType Leaf) {
        Remove-Item -LiteralPath $current -Force
      }
      continue
    }
    $next = "$LogPath.$($index + 1)"
    if (Test-Path -LiteralPath $current -PathType Leaf) {
      Move-Item -LiteralPath $current -Destination $next -Force
    }
  }
  Move-Item -LiteralPath $LogPath -Destination "$LogPath.1" -Force
}

function Test-ParentProcessAlive {
  if ($ParentProcessId -le 0) {
    return $true
  }
  try {
    $parent = Get-Process -Id $ParentProcessId -ErrorAction Stop
    return -not $parent.HasExited
  } catch {
    return $false
  }
}

function New-Headers {
  $headers = @{ "Content-Type" = "application/json" }
  if (-not [string]::IsNullOrWhiteSpace($BackendToken)) {
    $headers["Authorization"] = "Bearer $BackendToken"
  }
  return $headers
}

function Add-RequestHeaders {
  param(
    [System.Net.Http.HttpRequestMessage]$Request,
    [hashtable]$Headers = @{}
  )

  foreach ($entry in $Headers.GetEnumerator()) {
    if ([string]::IsNullOrWhiteSpace([string]$entry.Value)) {
      continue
    }
    [void]$Request.Headers.TryAddWithoutValidation([string]$entry.Key, [string]$entry.Value)
  }
}

function Invoke-HttpRequest {
  param(
    [ValidateSet("GET", "POST")]
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    [string]$Body = ""
  )

  $httpMethod = if ($Method -eq "POST") { [System.Net.Http.HttpMethod]::Post } else { [System.Net.Http.HttpMethod]::Get }
  $request = New-Object System.Net.Http.HttpRequestMessage -ArgumentList @($httpMethod, $Url)
  $cts = New-Object System.Threading.CancellationTokenSource -ArgumentList ([TimeSpan]::FromSeconds([Math]::Max(1, $TimeoutSeconds)))
  try {
    Add-RequestHeaders -Request $request -Headers $Headers
    if ($Method -eq "POST") {
      $request.Content = New-Object System.Net.Http.StringContent -ArgumentList @($Body, [System.Text.Encoding]::UTF8, "application/json")
    }
    $response = $script:HttpClient.SendAsync($request, $cts.Token).GetAwaiter().GetResult()
    try {
      return @{
        ok = [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400
        status = [int]$response.StatusCode
        error = $null
      }
    } finally {
      $response.Dispose()
    }
  } catch {
    return @{
      ok = $false
      status = $null
      error = $_.Exception.Message
    }
  } finally {
    $cts.Dispose()
    $request.Dispose()
  }
}

function Track-BackendPostFailure {
  param([string]$ErrorMessage)

  if ($null -eq $script:BackendPostOutageStartedAt) {
    $script:BackendPostOutageStartedAt = Get-Date
    $script:BackendPostFailureCount = 0
  }
  $script:BackendPostFailureCount += 1
  $script:LastBackendPostError = $ErrorMessage
}

function Maybe-ReportBackendPostRecovered {
  if ($null -eq $script:BackendPostOutageStartedAt) {
    return
  }

  $startedAt = [datetime]$script:BackendPostOutageStartedAt
  $durationSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1)
  $failureCount = $script:BackendPostFailureCount
  $lastError = $script:LastBackendPostError
  $script:BackendPostOutageStartedAt = $null
  $script:BackendPostFailureCount = 0
  $script:LastBackendPostError = ""

  Post-MonitorPayload -Path "/api/demo/monitor/events" -NoConnectionTracking -Payload @{
    source = "watchdog"
    severity = "recovered"
    code = "watchdog_backend_connection_recovered"
    message = "A-side watchdog can reach the backend again after failed monitor posts."
    session_id = $SessionId
    observed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    details = @{
      outage_started_at = $startedAt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
      outage_duration_seconds = $durationSeconds
      failed_post_count = $failureCount
      last_error = $lastError
      analysis = "The demo computer could not post monitor data to B, then recovered. During the outage B should independently report watchdog_heartbeat_stale if it had previously received watchdog heartbeats."
    }
  }
}

function Invoke-Probe {
  param(
    [string]$Url,
    [hashtable]$Headers = @{}
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $result = Invoke-HttpRequest -Method "GET" -Url $Url -Headers $Headers
  $sw.Stop()
  return @{
    ok = $result["ok"]
    status = $result["status"]
    elapsed_ms = [int]$sw.ElapsedMilliseconds
    error = $result["error"]
  }
}

function Post-MonitorPayload {
  param(
    [string]$Path,
    [object]$Payload,
    [switch]$NoConnectionTracking
  )

  $url = "$BackendUrl$Path"
  $body = $Payload | ConvertTo-Json -Depth 12 -Compress
  $result = Invoke-HttpRequest -Method "POST" -Url $url -Headers (New-Headers) -Body $body
  if ($result["ok"]) {
    if (-not $NoConnectionTracking) {
      Maybe-ReportBackendPostRecovered
    }
    return $true
  }
  $errorMessage = if ($result["error"]) { [string]$result["error"] } else { "HTTP $($result["status"])" }
  Write-WatchdogLog "post failed path=$Path error=$errorMessage"
  if (-not $NoConnectionTracking) {
    Track-BackendPostFailure -ErrorMessage $errorMessage
  }
  return $false
}

function Enqueue-FrontendEvent {
  param([object]$Payload)

  while ($script:PendingFrontendEvents.Count -ge 50) {
    [void]$script:PendingFrontendEvents.Dequeue()
  }
  $script:PendingFrontendEvents.Enqueue($Payload)
}

function Flush-PendingFrontendEvents {
  $sentCount = 0
  while ($script:PendingFrontendEvents.Count -gt 0 -and $sentCount -lt 5) {
    $payload = $script:PendingFrontendEvents.Dequeue()
    Post-MonitorPayload -Path "/api/demo/monitor/events" -Payload $payload | Out-Null
    $sentCount += 1
  }
}

function Send-Heartbeat {
  param(
    [hashtable]$FrontendProbe,
    [hashtable]$BackendProbe,
    [bool]$InStartupGrace
  )

  $frontendHeartbeatAge = $null
  if ($null -ne $script:LastFrontendHeartbeatAt) {
    $frontendHeartbeatAge = [Math]::Round(((Get-Date) - [datetime]$script:LastFrontendHeartbeatAt).TotalSeconds, 1)
  }

  $status = if (($FrontendProbe["ok"] -or $InStartupGrace) -and $BackendProbe["ok"]) { "ok" } else { "degraded" }
  return Post-MonitorPayload -Path "/api/demo/monitor/heartbeat" -Payload @{
    source = "watchdog"
    session_id = $SessionId
    status = $status
    observed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    frontend_url = $FrontendUrl
    backend_url = $BackendUrl
    details = @{
      frontend_probe = $FrontendProbe
      backend_ready_probe = $BackendProbe
      frontend_local_heartbeat_age_seconds = $frontendHeartbeatAge
      frontend_local_status = $script:LastFrontendStatus
      frontend_local_session_id = $script:LastFrontendSessionId
      frontend_last_event_code = $script:LastFrontendEventCode
      browser_restart_count = $script:BrowserRestartCount
      last_browser_restart_at = if ($null -ne $script:LastBrowserRestartAt) { ([datetime]$script:LastBrowserRestartAt).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") } else { $null }
      pending_frontend_event_count = $script:PendingFrontendEvents.Count
      local_monitor_url = "http://127.0.0.1:$LocalMonitorPort"
      computer = $env:COMPUTERNAME
      user = $env:USERNAME
    }
  }
}

function Send-Event {
  param(
    [string]$Severity,
    [string]$Code,
    [string]$Message,
    [hashtable]$Details
  )

  Post-MonitorPayload -Path "/api/demo/monitor/events" -Payload @{
    source = "watchdog"
    severity = $Severity
    code = $Code
    message = $Message
    session_id = $SessionId
    observed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    details = $Details
  } | Out-Null
}

function Should-SendEvent {
  param(
    [string]$Code,
    [datetime]$Now,
    [hashtable]$LastEventAt,
    [int]$CooldownSeconds = 60
  )

  if (-not $LastEventAt.ContainsKey($Code)) {
    $LastEventAt[$Code] = $Now
    return $true
  }
  $elapsed = ($Now - [datetime]$LastEventAt[$Code]).TotalSeconds
  if ($elapsed -lt $CooldownSeconds) {
    return $false
  }
  $LastEventAt[$Code] = $Now
  return $true
}

function Restart-Browser {
  param(
    [string]$Reason,
    [hashtable]$Details = @{},
    [int]$CooldownSeconds = $BrowserRestartCooldownSeconds
  )

  $now = Get-Date
  if ($null -ne $script:LastBrowserRestartAt -and ($now - [datetime]$script:LastBrowserRestartAt).TotalSeconds -lt $CooldownSeconds) {
    return $false
  }

  $script:LastBrowserRestartAt = $now
  $script:BrowserRestartCount += 1
  Start-Process $FrontendUrl
  Write-WatchdogLog "browser restart count=$script:BrowserRestartCount reason=$Reason status=$script:LastFrontendStatus"
  $eventDetails = @{
    reason = $Reason
    frontend_local_status = $script:LastFrontendStatus
    frontend_local_session_id = $script:LastFrontendSessionId
    restart_count = $script:BrowserRestartCount
    analysis = "The watchdog opened the frontend URL because the demo page closed or visible-page heartbeat stopped."
  }
  foreach ($entry in $Details.GetEnumerator()) {
    $eventDetails[$entry.Key] = $entry.Value
  }
  Send-Event -Severity "warning" -Code "frontend_browser_restarted" -Message "A-side watchdog reopened the frontend." -Details $eventDetails
  return $true
}

function Should-RestartForFrontendEvent {
  param([object]$Payload)

  $now = Get-Date
  $staleKeys = @()
  foreach ($entry in $script:RecentRestartEventKeys.GetEnumerator()) {
    if (($now - [datetime]$entry.Value).TotalSeconds -gt 30) {
      $staleKeys += $entry.Key
    }
  }
  foreach ($key in $staleKeys) {
    $script:RecentRestartEventKeys.Remove($key)
  }

  $sessionId = [string](Get-JsonProperty -Object $Payload -Name "session_id" -Fallback "")
  $observedAt = [string](Get-JsonProperty -Object $Payload -Name "observed_at" -Fallback "")
  $code = [string](Get-JsonProperty -Object $Payload -Name "code" -Fallback "")
  $eventKey = "$sessionId|$observedAt|$code"
  if ([string]::IsNullOrWhiteSpace($eventKey) -or $script:RecentRestartEventKeys.ContainsKey($eventKey)) {
    return $false
  }
  $script:RecentRestartEventKeys[$eventKey] = $now
  return $true
}

function Send-LocalJsonResponse {
  param(
    [System.Net.HttpListenerContext]$Context,
    [int]$StatusCode,
    [object]$Payload
  )

  $Context.Response.StatusCode = $StatusCode
  $Context.Response.Headers["Access-Control-Allow-Origin"] = "*"
  $Context.Response.Headers["Access-Control-Allow-Headers"] = "content-type"
  $Context.Response.Headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
  if ($StatusCode -eq 204) {
    $Context.Response.ContentLength64 = 0
    $Context.Response.Close()
    return
  }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Depth 8 -Compress))
  $Context.Response.ContentType = "application/json; charset=utf-8"
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function Read-LocalJsonRequest {
  param([System.Net.HttpListenerRequest]$Request)

  $maxBytes = 65536
  if ($Request.ContentLength64 -gt $maxBytes) {
    throw "local monitor payload too large: $($Request.ContentLength64) bytes"
  }
  if ($Request.InputStream.CanTimeout) {
    $Request.InputStream.ReadTimeout = 2000
  }

  if ($Request.ContentLength64 -gt 0) {
    $buffer = New-Object byte[] ([int]$Request.ContentLength64)
    $offset = 0
    while ($offset -lt $buffer.Length) {
      $read = $Request.InputStream.Read($buffer, $offset, $buffer.Length - $offset)
      if ($read -le 0) {
        break
      }
      $offset += $read
    }
    $raw = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $offset)
  } else {
    $reader = New-Object System.IO.StreamReader -ArgumentList @($Request.InputStream, [System.Text.Encoding]::UTF8)
    $raw = $reader.ReadToEnd()
  }

  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }
  return $raw | ConvertFrom-Json
}

function Handle-LocalMonitorContext {
  param([System.Net.HttpListenerContext]$Context)

  try {
    $path = $Context.Request.Url.AbsolutePath
    if ($Context.Request.HttpMethod -eq "OPTIONS") {
      Send-LocalJsonResponse -Context $Context -StatusCode 204 -Payload @{ ok = $true }
      return
    }
    if ($Context.Request.HttpMethod -ne "POST") {
      Send-LocalJsonResponse -Context $Context -StatusCode 405 -Payload @{ ok = $false; error = "method_not_allowed" }
      return
    }

    $payload = Read-LocalJsonRequest -Request $Context.Request
    $now = Get-Date
    if ($path -eq "/frontend/heartbeat") {
      $script:LastFrontendHeartbeatAt = $now
      $script:LastFrontendStatus = [string](Get-JsonProperty -Object $payload -Name "status" -Fallback "ok")
      $script:LastFrontendSessionId = [string](Get-JsonProperty -Object $payload -Name "session_id" -Fallback "")
      $script:LastFrontendDetails = Get-JsonProperty -Object $payload -Name "details" -Fallback $null
      Send-LocalJsonResponse -Context $Context -StatusCode 200 -Payload @{ ok = $true }
      return
    }

    if ($path -eq "/frontend/events") {
      $script:LastFrontendEventAt = $now
      $script:LastFrontendEventCode = [string](Get-JsonProperty -Object $payload -Name "code" -Fallback "")
      if ($script:LastFrontendEventCode -eq "frontend_page_hidden_or_closing") {
        $script:LastFrontendStatus = "pagehide"
        if (Should-RestartForFrontendEvent -Payload $payload) {
          Restart-Browser -Reason "frontend_pagehide" -CooldownSeconds 0 -Details @{ frontend_event_code = $script:LastFrontendEventCode } | Out-Null
        }
      }
      Write-WatchdogLog "frontend event code=$script:LastFrontendEventCode status=$script:LastFrontendStatus"
      Enqueue-FrontendEvent -Payload $payload
      Send-LocalJsonResponse -Context $Context -StatusCode 200 -Payload @{ ok = $true }
      return
    }

    Send-LocalJsonResponse -Context $Context -StatusCode 404 -Payload @{ ok = $false; error = "not_found" }
  } catch {
    Write-WatchdogLog "local monitor request failed error=$($_.Exception.Message)"
    try {
      Send-LocalJsonResponse -Context $Context -StatusCode 500 -Payload @{ ok = $false; error = "internal_error" }
    } catch {
    }
  }
}

function Process-LocalMonitorContexts {
  param(
    [System.Net.HttpListener]$Listener,
    [object]$PendingContext,
    [int]$MaxContexts = 20
  )

  $processed = 0
  while ($null -ne $PendingContext -and $PendingContext.IsCompleted -and $processed -lt $MaxContexts) {
    try {
      Handle-LocalMonitorContext -Context $PendingContext.GetAwaiter().GetResult()
    } catch {
      Write-WatchdogLog "local monitor context failed error=$($_.Exception.Message)"
    }
    $PendingContext = $Listener.GetContextAsync()
    $processed += 1
  }
  return $PendingContext
}

function Start-LocalMonitorListener {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://127.0.0.1:$LocalMonitorPort/")
  try {
    $listener.Start()
    Write-WatchdogLog "local monitor listening url=http://127.0.0.1:$LocalMonitorPort/"
    return $listener
  } catch {
    Write-WatchdogLog "local monitor failed port=$LocalMonitorPort error=$($_.Exception.Message)"
    return $null
  }
}

function Maybe-RestartBrowser {
  param(
    [hashtable]$FrontendProbe,
    [bool]$InStartupGrace,
    [datetime]$Now,
    [hashtable]$LastEventAt
  )

  if ($InStartupGrace -or -not $FrontendProbe["ok"]) {
    return
  }
  if (-not $script:LocalMonitorAvailable) {
    return
  }

  $heartbeatAge = $null
  if ($null -ne $script:LastFrontendHeartbeatAt) {
    $heartbeatAge = ((Get-Date) - [datetime]$script:LastFrontendHeartbeatAt).TotalSeconds
  }
  $missingHeartbeat = $null -eq $script:LastFrontendHeartbeatAt -or $heartbeatAge -gt $LocalFrontendHeartbeatTimeoutSeconds
  if (-not $missingHeartbeat) {
    return
  }

  if ($script:LastFrontendStatus -eq "hidden") {
    if (Should-SendEvent -Code "frontend_background_timer_suspended" -Now $Now -LastEventAt $LastEventAt -CooldownSeconds 600) {
      Send-Event -Severity "info" -Code "frontend_background_timer_suspended" -Message "Frontend heartbeat is stale, but the last page state was hidden; this is likely browser background throttling." -Details @{
        frontend_local_status = $script:LastFrontendStatus
        frontend_local_heartbeat_age_seconds = if ($heartbeatAge) { [Math]::Round($heartbeatAge, 1) } else { $null }
        frontend_probe = $FrontendProbe
        analysis = "The local static server is reachable and the last frontend page state was hidden. Browser background timer throttling is the most likely cause, so the watchdog does not reopen the page."
      }
    }
    return
  }

  if ($null -ne $script:LastBrowserRestartAt -and ($Now - [datetime]$script:LastBrowserRestartAt).TotalSeconds -lt $BrowserRestartCooldownSeconds) {
    return
  }

  Restart-Browser -Reason "frontend_heartbeat_missing" -Details @{
    frontend_local_status = $script:LastFrontendStatus
    frontend_local_session_id = $script:LastFrontendSessionId
    frontend_local_heartbeat_age_seconds = if ($heartbeatAge) { [Math]::Round($heartbeatAge, 1) } else { $null }
    frontend_probe = $FrontendProbe
    analysis = "Local static server is reachable, but the visible frontend page stopped sending heartbeat. The watchdog opened the frontend URL again."
  } | Out-Null
}

$BackendUrl = Normalize-BaseUrl $BackendUrl
$FrontendUrl = Normalize-BaseUrl $FrontendUrl
if ([string]::IsNullOrWhiteSpace($SessionId)) {
  $SessionId = "watchdog-{0}-{1}" -f (Get-Date -Format "yyyyMMddHHmmss"), ([Guid]::NewGuid().ToString("N").Substring(0, 8))
}
$authHeaders = @{}
if (-not [string]::IsNullOrWhiteSpace($BackendToken)) {
  $authHeaders["Authorization"] = "Bearer $BackendToken"
}

Write-WatchdogLog "started session=$SessionId frontend=$FrontendUrl backend=$BackendUrl"
$localListener = Start-LocalMonitorListener
$script:LocalMonitorAvailable = $null -ne $localListener
$pendingContext = if ($null -ne $localListener) { $localListener.GetContextAsync() } else { $null }

$lastEventAt = @{}
$startedAt = Get-Date
$nextCheckAt = Get-Date
while ($true) {
  if (-not (Test-ParentProcessAlive)) {
    Write-WatchdogLog "stopping because parent process exited parent_pid=$ParentProcessId"
    break
  }

  if ($null -ne $localListener) {
    $pendingContext = Process-LocalMonitorContexts -Listener $localListener -PendingContext $pendingContext
  }

  $loopNow = Get-Date
  if ($loopNow -lt $nextCheckAt) {
    Start-Sleep -Milliseconds 250
    continue
  }
  $nextCheckAt = $loopNow.AddSeconds([Math]::Max(1, $IntervalSeconds))

  $frontendProbe = Invoke-Probe -Url "$FrontendUrl/"
  $backendProbe = Invoke-Probe -Url "$BackendUrl/api/ready" -Headers $authHeaders
  $inStartupGrace = ((Get-Date) - $startedAt).TotalSeconds -lt $StartGraceSeconds

  Flush-PendingFrontendEvents
  Send-Heartbeat -FrontendProbe $frontendProbe -BackendProbe $backendProbe -InStartupGrace $inStartupGrace

  $now = Get-Date
  if ((-not $inStartupGrace) -and (-not $frontendProbe["ok"]) -and (Should-SendEvent -Code "frontend_local_unreachable" -Now $now -LastEventAt $lastEventAt)) {
    Send-Event -Severity "critical" -Code "frontend_local_unreachable" -Message "A-side watchdog cannot reach the local frontend." -Details @{ frontend_probe = $frontendProbe }
  }
  if ((-not $backendProbe["ok"]) -and (Should-SendEvent -Code "backend_ready_probe_failed" -Now $now -LastEventAt $lastEventAt)) {
    Send-Event -Severity "warning" -Code "backend_ready_probe_failed" -Message "A-side watchdog cannot reach backend /api/ready." -Details @{ backend_ready_probe = $backendProbe }
  }
  if ((-not $script:LocalMonitorAvailable) -and (Should-SendEvent -Code "frontend_local_monitor_unavailable" -Now $now -LastEventAt $lastEventAt -CooldownSeconds 600)) {
    Send-Event -Severity "warning" -Code "frontend_local_monitor_unavailable" -Message "A-side watchdog could not bind its local frontend heartbeat receiver." -Details @{
      local_monitor_url = "http://127.0.0.1:$LocalMonitorPort"
      analysis = "The watchdog is still probing local frontend and backend readiness, but browser-page auto-reopen is disabled because the local heartbeat receiver is unavailable."
    }
  }
  if ($backendProbe["ok"] -and $backendProbe["elapsed_ms"] -gt 8000 -and (Should-SendEvent -Code "backend_ready_probe_slow" -Now $now -LastEventAt $lastEventAt)) {
    Send-Event -Severity "warning" -Code "backend_ready_probe_slow" -Message "Backend /api/ready is responding slowly." -Details @{ backend_ready_probe = $backendProbe }
  }

  Maybe-RestartBrowser -FrontendProbe $frontendProbe -InStartupGrace $inStartupGrace -Now $now -LastEventAt $lastEventAt

  Start-Sleep -Milliseconds 250
}

if ($null -ne $localListener) {
  $localListener.Stop()
}
