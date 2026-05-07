param(
    [string]$VaultPath = "$env:APPDATA\Obsidian\Obsidian Sandbox",
    [switch]$EnablePlugin
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $scriptDir "manifest.json"
$mainJsPath = Join-Path $scriptDir "main.js"
$stylesPath = Join-Path $scriptDir "styles.css"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "manifest.json not found: $manifestPath"
}

if (-not (Test-Path -LiteralPath $mainJsPath)) {
    throw "main.js not found: $mainJsPath"
}

if (-not (Test-Path -LiteralPath $VaultPath)) {
    throw "Vault path not found: $VaultPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$pluginId = $manifest.id

if ([string]::IsNullOrWhiteSpace($pluginId)) {
    throw "Plugin id is missing in manifest.json"
}

$obsidianDir = Join-Path $VaultPath ".obsidian"
$pluginsDir = Join-Path $obsidianDir "plugins"
$targetDir = Join-Path $pluginsDir $pluginId

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $targetDir "manifest.json") -Force
Copy-Item -LiteralPath $mainJsPath -Destination (Join-Path $targetDir "main.js") -Force

if (Test-Path -LiteralPath $stylesPath) {
    Copy-Item -LiteralPath $stylesPath -Destination (Join-Path $targetDir "styles.css") -Force
}

if ($EnablePlugin) {
    $communityPluginsPath = Join-Path $obsidianDir "community-plugins.json"
    $plugins = @()

    if (Test-Path -LiteralPath $communityPluginsPath) {
        $raw = Get-Content -LiteralPath $communityPluginsPath -Raw
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            $parsed = $raw | ConvertFrom-Json
            if ($parsed -is [System.Array]) {
                $plugins = @($parsed)
            } elseif ($null -ne $parsed) {
                $plugins = @($parsed)
            }
        }
    }

    if ($plugins -notcontains $pluginId) {
        $plugins = @($plugins) + $pluginId
    }

    $json = $plugins | ConvertTo-Json
    Write-Utf8NoBom -Path $communityPluginsPath -Content $json
}

Write-Host "Sandbox preview updated:"
Write-Host "  Vault:  $VaultPath"
Write-Host "  Plugin: $pluginId"
Write-Host "  Target: $targetDir"

if ($EnablePlugin) {
    Write-Host "  Status: plugin added to community-plugins.json"
} else {
    Write-Host "  Status: files copied only"
}

