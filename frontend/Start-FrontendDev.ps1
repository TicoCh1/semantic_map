param(
  [ValidateSet("Demo", "Full", "Screensaver")]
  [string]$Mode = "Full",
  [int]$PreferredPort = 5173,
  [int]$WatchdogPort = 51973,
  [switch]$NoStart
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$FrontendDir = $PSScriptRoot
$RuntimeConfigPath = Join-Path $FrontendDir "public\runtime-config.js"

function Normalize-RunpodUrl {
  param([string]$Value)

  $trimmed = $Value.Trim().TrimEnd("/")
  if ($trimmed -notmatch "^[a-zA-Z][a-zA-Z0-9+.-]*://") {
    $trimmed = "https://$trimmed"
  }
  try {
    $uri = [System.Uri]$trimmed
    if ($uri.Scheme -eq "http" -and $uri.Host.EndsWith(".proxy.runpod.net", [System.StringComparison]::OrdinalIgnoreCase)) {
      $builder = [System.UriBuilder]$uri
      $builder.Scheme = "https"
      if ($builder.Port -eq 80) {
        $builder.Port = -1
      }
      return $builder.Uri.AbsoluteUri.TrimEnd("/")
    }
  } catch {
  }
  return $trimmed
}

function Start-DemoWatchdog {
  param(
    [string]$BackendUrl,
    [int]$FrontendPort,
    [int]$LocalMonitorPort
  )

  $watchdogPath = Join-Path $FrontendDir "Start-DemoWatchdog.ps1"
  if (-not (Test-Path -LiteralPath $watchdogPath -PathType Leaf)) {
    Write-Host "Demo watchdog script was not found: $watchdogPath"
    return
  }

  $frontendUrl = "http://127.0.0.1:$FrontendPort/"
  $sessionId = "watchdog-dev-{0}-{1}" -f (Get-Date -Format "yyyyMMddHHmmss"), ([Guid]::NewGuid().ToString("N").Substring(0, 8))
  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $watchdogPath,
    "-BackendUrl", $BackendUrl,
    "-FrontendUrl", $frontendUrl,
    "-LocalMonitorPort", $LocalMonitorPort,
    "-ParentProcessId", $PID,
    "-SessionId", $sessionId
  )
  Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WindowStyle Hidden | Out-Null
  Write-Host "Demo watchdog started: $sessionId"
}

function Read-DemoSettings {
  Write-Host ""
  Write-Host "UrbanFabric development frontend demo mode"
  Write-Host ""

  do {
    $runpodUrl = (Read-Host "RunPod URL, for example https://POD-8000.proxy.runpod.net").Trim()
    if ([string]::IsNullOrWhiteSpace($runpodUrl)) {
      Write-Host "RunPod URL is required for demo mode."
      Write-Host ""
    }
  } while ([string]::IsNullOrWhiteSpace($runpodUrl))

  do {
    $timeoutText = (Read-Host "Idle reset timeout in seconds [180]").Trim()
    if ([string]::IsNullOrWhiteSpace($timeoutText)) {
      $timeoutText = "180"
    }

    $timeoutSeconds = 0
    $isInteger = [int]::TryParse($timeoutText, [ref]$timeoutSeconds)
    if (-not $isInteger -or $timeoutSeconds -le 0) {
      Write-Host "Please enter a positive integer number of seconds."
      Write-Host ""
    }
  } while (-not $isInteger -or $timeoutSeconds -le 0)

  return @{
    RunpodUrl = Normalize-RunpodUrl $runpodUrl
    TimeoutSeconds = $timeoutSeconds
  }
}

function Test-WatchdogPortAvailable {
  param([int]$Port)

  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://127.0.0.1:$Port/")
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener.IsListening) {
      $listener.Stop()
    }
    $listener.Close()
  }
}

function Find-WatchdogPort {
  param([int]$PreferredPort)

  for ($port = $PreferredPort; $port -le ($PreferredPort + 80); $port++) {
    if (Test-WatchdogPortAvailable -Port $port) {
      return $port
    }
  }
  throw "Could not bind a local demo watchdog monitor port in range $PreferredPort-$($PreferredPort + 80)."
}

function Write-RuntimeConfig {
  param(
    [ValidateSet("Demo", "Full", "Screensaver")]
    [string]$Mode,
    [string]$RunpodUrl = "",
    [int]$TimeoutSeconds = 180,
    [int]$LocalMonitorPort = 51973
  )

  $isDemo = $Mode -eq "Demo"
  $isScreensaver = $Mode -eq "Screensaver"
  $idleMs = if ($isDemo) { $TimeoutSeconds * 1000 } else { 180000 }
  $config = [ordered]@{
    mode = if ($isDemo) { "demo" } elseif ($isScreensaver) { "screensaver" } else { "full" }
    runpodUrl = if ($isDemo) { $RunpodUrl } else { "" }
    runpodToken = ""
    lockRunpodUrl = $isDemo
    idleResetEnabled = $isDemo
    idleMs = $idleMs
    defaultDatasetId = "london_224_8_45"
    defaultDatasetIds = @("london_224_8_45", "shanghai_224_8_45_2B")
    defaultDatasetGroupId = "london_shanghai"
    defaultRemoteBackendUrl = if ($isDemo) { $RunpodUrl } else { "" }
    remoteBackendEnabled = $true
    demoWatchdogUrl = if ($isDemo) { "http://127.0.0.1:$LocalMonitorPort" } else { "" }
    generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  }

  if (-not (Test-Path -LiteralPath (Split-Path -Parent $RuntimeConfigPath) -PathType Container)) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $RuntimeConfigPath) | Out-Null
  }

  $json = $config | ConvertTo-Json -Depth 8 -Compress
  $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText($RuntimeConfigPath, "window.__SEMANTIC_MAP_RUNTIME_CONFIG__ = $json;`r`n", $utf8NoBom)
}

if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir "package.json") -PathType Leaf)) {
  throw "Cannot find frontend\package.json under $FrontendDir."
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm.cmd was not found on PATH. Install Node.js/npm before starting the development frontend."
}

$selectedWatchdogPort = if ($Mode -eq "Demo") { Find-WatchdogPort -PreferredPort $WatchdogPort } else { $WatchdogPort }

if ($Mode -eq "Demo") {
  $settings = Read-DemoSettings
  Write-RuntimeConfig -Mode Demo -RunpodUrl $settings.RunpodUrl -TimeoutSeconds $settings.TimeoutSeconds -LocalMonitorPort $selectedWatchdogPort
  Write-Host ""
  Write-Host "Demo mode: RunPod URL is locked in the UI."
  Write-Host "Idle reset: $($settings.TimeoutSeconds) seconds."
  Write-Host "Demo watchdog local monitor: http://127.0.0.1:$selectedWatchdogPort"
  if (-not $NoStart) {
    Start-DemoWatchdog -BackendUrl $settings.RunpodUrl -FrontendPort $PreferredPort -LocalMonitorPort $selectedWatchdogPort
  }
} elseif ($Mode -eq "Screensaver") {
  Write-RuntimeConfig -Mode Screensaver
  Write-Host ""
  Write-Host "Screensaver mode: full editing behavior with idle reset disabled."
  Write-Host "The top icon button starts the street-view screensaver."
} else {
  Write-RuntimeConfig -Mode Full
  Write-Host ""
  Write-Host "Full mode: RunPod URL remains editable in the Prompt panel."
  Write-Host "Idle reset is disabled."
}

Write-Host "Runtime config: $RuntimeConfigPath"
Write-Host "Frontend source: $FrontendDir"

if ($NoStart) {
  return
}

Set-Location $FrontendDir
Write-Host ""
Write-Host "Starting Vite development server from frontend source."
Write-Host "This uses the latest source code, not SemanticMapFrontendApp\www."
Write-Host ""

& npm.cmd run dev -- --port $PreferredPort --strictPort --open
exit $LASTEXITCODE
