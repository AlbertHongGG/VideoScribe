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
$ExeSource = Join-Path $SrcTauriDir "target\release\VideoScribe.exe"
$ExeTarget = Join-Path $PortableDir "VideoScribe.exe"
Copy-Item $ExeSource $ExeTarget -Force

Write-Host "Phase 2: Setting up Python Environment (Standalone)..."
$BackendTargetDir = Join-Path $PortableDir "backend"
New-Item -ItemType Directory -Path $BackendTargetDir | Out-Null

# Use uv to get a full Python distribution (3.11 is very stable for PyTorch)
uv python install 3.11
$UvPythonExe = uv python find 3.11
if (-not $UvPythonExe) {
    Write-Host "Failed to find Python via uv. Please ensure uv is installed properly." -ForegroundColor Red
    exit 1
}
$UvPythonDir = Split-Path $UvPythonExe
$PortablePythonDir = Join-Path $BackendTargetDir "python"

Write-Host "Copying Python from $UvPythonDir to Portable Folder..."
Copy-Item -Recurse $UvPythonDir $PortablePythonDir -Force

Write-Host "Installing backend dependencies into portable python..."
$PortablePythonExe = Join-Path $PortablePythonDir "python.exe"
uv pip install --python $PortablePythonExe -r (Join-Path $BackendDir "requirements.txt")

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
Write-Host "Extracting FFmpeg using tar..."
tar.exe -xf $FfmpegZip -C $ProjectRoot
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
