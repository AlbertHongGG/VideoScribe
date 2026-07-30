# build_portable.ps1
$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$SrcTauriDir = Join-Path $ProjectRoot "src-tauri"
$BackendDir = Join-Path $ProjectRoot "src-backend"
$PortableDir = Join-Path $ProjectRoot "VideoScribe-Portable"

Write-Host "Cleaning up old Portable directory..."
if (Test-Path $PortableDir) {
    Remove-Item -Recurse -Force $PortableDir
}
New-Item -ItemType Directory -Path $PortableDir | Out-Null

Write-Host "Phase 1: Building Tauri App (Frontend + Rust Core)..."
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build Tauri App!" -ForegroundColor Red
    exit $LASTEXITCODE
}
$ExeSource = Join-Path $SrcTauriDir "target\release\VideoScribe.exe"
$ExeTarget = Join-Path $PortableDir "VideoScribe.exe"
Copy-Item $ExeSource $ExeTarget -Force

Write-Host "Phase 2: Setting up Python Environment (Standalone)..."
$BackendTargetDir = Join-Path $PortableDir "backend"
New-Item -ItemType Directory -Path $BackendTargetDir | Out-Null

# Use uv to get a full Python distribution (3.12 is required by backend)
uv python install 3.12
$UvPythonExe = uv python find 3.12
if (-not $UvPythonExe) {
    Write-Host "Failed to find Python via uv. Please ensure uv is installed properly." -ForegroundColor Red
    exit 1
}
$UvPythonDir = Split-Path $UvPythonExe
$PortablePythonDir = Join-Path $BackendTargetDir "python"

Write-Host "Copying Python from $UvPythonDir to Portable Folder..."
Copy-Item -Recurse $UvPythonDir $PortablePythonDir -Force

# Remove the EXTERNALLY-MANAGED marker so we can install packages directly into the base environment
$ExternallyManaged = Join-Path $PortablePythonDir "Lib\EXTERNALLY-MANAGED"
if (Test-Path $ExternallyManaged) {
    Remove-Item $ExternallyManaged -Force
}

Write-Host "Exporting dependencies from uv.lock to requirements..."
Set-Location $BackendDir
uv export --format requirements-txt -o export_req.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to export dependencies from uv.lock!" -ForegroundColor Red
    exit $LASTEXITCODE
}
Set-Location $ProjectRoot

Write-Host "Installing backend dependencies into portable python..."
$PortablePythonExe = Join-Path $PortablePythonDir "python.exe"
$ExportReq = Join-Path $BackendDir "export_req.txt"
uv pip install --prerelease=allow --extra-index-url https://download.pytorch.org/whl/nightly/cu130 --index-strategy unsafe-best-match --python $PortablePythonExe -r $ExportReq
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install backend dependencies!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Copying backend source code..."
Copy-Item -Recurse (Join-Path $BackendDir "videoscribe") $BackendTargetDir -Force
# Copy models directory if it exists
if (Test-Path (Join-Path $BackendDir "models")) {
    Copy-Item -Recurse (Join-Path $BackendDir "models") $BackendTargetDir -Force
}

Write-Host "Phase 3: Setting up FFmpeg..."
$FfmpegDir = Join-Path $PortableDir "ffmpeg\bin"
New-Item -ItemType Directory -Path $FfmpegDir -Force | Out-Null
$FfmpegZip = Join-Path $ProjectRoot "ffmpeg-release-essentials.zip"
if (-not (Test-Path $FfmpegZip)) {
    Write-Host "Downloading FFmpeg using curl..."
    curl.exe -L -o $FfmpegZip "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
}
Write-Host "Extracting FFmpeg using Expand-Archive..."
try {
    Expand-Archive -Path $FfmpegZip -DestinationPath $ProjectRoot -Force
} catch {
    Write-Host "Failed to extract FFmpeg! The ZIP file might be corrupted." -ForegroundColor Red
    Write-Host "Deleting corrupted ZIP file. Please run the script again to re-download." -ForegroundColor Yellow
    Remove-Item $FfmpegZip -Force -ErrorAction SilentlyContinue
    exit 1
}
$FfmpegExe = Get-ChildItem -Path $ProjectRoot -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1
$FfprobeExe = Get-ChildItem -Path $ProjectRoot -Filter "ffprobe.exe" -Recurse | Select-Object -First 1
Copy-Item $FfmpegExe.FullName $FfmpegDir -Force
Copy-Item $FfprobeExe.FullName $FfmpegDir -Force
$ExtractedFolder = Get-ChildItem -Path $ProjectRoot -Filter "ffmpeg-*-essentials_build" -Directory | Select-Object -First 1
Remove-Item -Recurse -Force $ExtractedFolder.FullName -ErrorAction SilentlyContinue

Write-Host "Phase 4: Copying extra assets..."
$DictSource = Join-Path $SrcTauriDir "jmdict.db"
if (Test-Path $DictSource) {
    Copy-Item $DictSource (Join-Path $PortableDir "jmdict.db") -Force
}

Write-Host ""
Write-Host "=================================================="
Write-Host "✅ Portable build completed successfully!"
Write-Host "The application is ready in: $PortableDir"
Write-Host "=================================================="
