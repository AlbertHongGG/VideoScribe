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

Write-Host "Phase 2: Packaging Python Backend..."
Set-Location $BackendDir
if (-not (Get-Command "pyinstaller" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing PyInstaller..."
    uv pip install pyinstaller
}
# Pack backend into a directory
uv run pyinstaller --noconfirm --onedir --name VideoScribe-backend main.py
$BackendDistDir = Join-Path $BackendDir "dist\VideoScribe-backend"
$BackendTargetDir = Join-Path $PortableDir "backend"
Copy-Item -Recurse $BackendDistDir $BackendTargetDir -Force
Set-Location $ProjectRoot

Write-Host "Phase 3: Setting up FFmpeg..."
$FfmpegDir = Join-Path $PortableDir "ffmpeg\bin"
New-Item -ItemType Directory -Path $FfmpegDir -Force | Out-Null
# Fast download ffmpeg.exe from a reliable source (gyan.dev)
$FfmpegZip = Join-Path $ProjectRoot "ffmpeg-release-essentials.zip"
if (-not (Test-Path $FfmpegZip)) {
    Write-Host "Downloading FFmpeg using curl..."
    curl.exe -L -o $FfmpegZip "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
}
Write-Host "Extracting FFmpeg using tar..."
tar.exe -xf $FfmpegZip -C $ProjectRoot
# Find the extracted ffmpeg.exe
$FfmpegExe = Get-ChildItem -Path $ProjectRoot -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1
Copy-Item $FfmpegExe.FullName $FfmpegDir -Force
# Cleanup extracted ffmpeg folder
$ExtractedFolder = Get-ChildItem -Path $ProjectRoot -Filter "ffmpeg-*-essentials_build" -Directory | Select-Object -First 1
Remove-Item -Recurse -Force $ExtractedFolder.FullName -ErrorAction SilentlyContinue

Write-Host "Phase 4: Copying jmdict.db..."
$DictSource = Join-Path $SrcTauriDir "jmdict.db"
if (Test-Path $DictSource) {
    Copy-Item $DictSource (Join-Path $PortableDir "jmdict.db") -Force
} else {
    Write-Host "WARNING: jmdict.db not found at $DictSource. Please make sure it's placed in the Portable folder manually if needed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=================================================="
Write-Host "✅ Portable build completed successfully!"
Write-Host "The application is ready in: $PortableDir"
Write-Host "You can zip this folder and share it."
Write-Host "=================================================="
