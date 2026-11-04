param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$Commit,
    [Parameter(Mandatory = $true)][string]$RunUrl
)

$ErrorActionPreference = 'Stop'
$repoPath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$actualCommit = git -C $repoPath rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $actualCommit -ne $Commit) {
    throw 'Build commit does not match the checked-out source.'
}

$artifacts = @(
    "Twinkle.Tray.v$Version.exe",
    "Twinkle.Tray.v$Version-portable.zip"
)
$distPath = Join-Path $repoPath 'dist'
$files = @(
    foreach ($name in $artifacts) {
        $file = Get-Item -LiteralPath (Join-Path $distPath $name)
        [ordered]@{
            name = $file.Name
            sizeBytes = $file.Length
            sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
)

[ordered]@{
    commit = $Commit
    version = $Version
    versionBuild = "$Version+$Commit"
    runUrl = $RunUrl
    artifacts = $files
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $distPath 'build-manifest.json') -Encoding utf8

$files | ForEach-Object { "$($_.sha256)  $($_.name)" } |
    Set-Content -LiteralPath (Join-Path $distPath 'SHA256SUMS.txt') -Encoding ascii
