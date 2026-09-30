$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskManifest = Get-Content -LiteralPath (Join-Path $taskRoot 'manifest.json') -Raw | ConvertFrom-Json
$taskRelease = Join-Path $taskRoot 'release'
$taskZip = Join-Path $taskRelease ('zweenotes-' + $taskManifest.version + '.zip')
if (-not [System.IO.File]::Exists((Join-Path $taskRoot 'vendor/pdfjs/pdf.mjs')) -or -not [System.IO.File]::Exists((Join-Path $taskRoot 'vendor/katex/katex.mjs'))) { throw 'Run npm ci and npm run build before packaging.' }
if (-not (Test-Path -LiteralPath $taskRelease)) { New-Item -ItemType Directory -Path $taskRelease | Out-Null }
if (Test-Path -LiteralPath $taskZip) { $taskZip = Join-Path $taskRelease ('zweenotes-' + $taskManifest.version + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip') }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskStream = [System.IO.File]::Open($taskZip, [System.IO.FileMode]::CreateNew)
$taskArchive = [System.IO.Compression.ZipArchive]::new($taskStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  # An explicit file allowlist keeps course exports, local credentials and development caches out.
  $taskFiles = @('manifest.json','sidepanel.html','sidepanel.css','sidepanel.js','studio.html','studio.css','studio.js','ui.css','options.html','options.js','LICENSE','NOTICE.md','PRIVACY.md','THIRD_PARTY.md') | ForEach-Object { Get-Item -LiteralPath (Join-Path $taskRoot $_) }
  foreach ($taskFolder in @('images','scripts','vendor')) { $taskFiles += Get-ChildItem -LiteralPath (Join-Path $taskRoot $taskFolder) -File -Recurse }
  foreach ($taskFile in $taskFiles) {
    $taskAbsolute = [System.IO.Path]::GetFullPath($taskFile.FullName)
    if (-not $taskAbsolute.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Package entry is outside the project.' }
    $taskRelative = $taskAbsolute.Substring($taskRoot.Length + 1).Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,$taskAbsolute,$taskRelative,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $taskArchive.Dispose(); $taskStream.Dispose() }
Write-Output $taskZip
