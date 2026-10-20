$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Build reproducible whisper.cpp CPU binaries and bundle FFmpeg with the installer.
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tools = Join-Path $root 'build-tools\transcription'
New-Item -ItemType Directory -Force $tools | Out-Null
$parent = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$temp = Join-Path $parent 'nosso-culto-whisper'
New-Item -ItemType Directory -Force $temp | Out-Null
$src = Join-Path $temp 'whisper.cpp'
if (-not (Test-Path $src)) {
    git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp.git $src
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao baixar o código do whisper.cpp.' }
}
$build = Join-Path $temp 'build'
cmake -S $src -B $build -A x64 -DGGML_NATIVE=OFF -DWHISPER_BUILD_TESTS=OFF
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar o whisper.cpp com CMake.' }
cmake --build $build --config Release --target whisper-cli --parallel 4
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o whisper-cli.' }

$exe = Get-ChildItem -Path $build -Filter whisper-cli.exe -File -Recurse | Select-Object -First 1
if (-not $exe) { throw 'whisper-cli.exe não foi encontrado.' }
Copy-Item $exe.FullName (Join-Path $tools 'whisper-cli.exe') -Force
Get-ChildItem $build -Filter *.dll -Recurse -File | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $tools $_.Name) -Force
}
# Upstream source: https://www.gyan.dev/ffmpeg/builds/ (FFmpeg essentials).
# GPL/LGPL notices and source links are included with the distribution.
$archive = Join-Path $temp 'ffmpeg-essentials.zip'
Invoke-WebRequest 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $archive
$expanded = Join-Path $temp 'ffmpeg-extracted'
Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
$ffmpeg = Get-ChildItem $expanded -Filter ffmpeg.exe -File -Recurse | Select-Object -First 1
if (-not $ffmpeg) { throw 'ffmpeg.exe não foi encontrado.' }
Copy-Item $ffmpeg.FullName (Join-Path $tools 'ffmpeg.exe') -Force

# Ship any available bundled license files from the FFmpeg distribution.
Get-ChildItem -Path $expanded -File -Recurse | Where-Object { $_.Name -match '^(LICENSE|COPYING)' } |
    ForEach-Object { Copy-Item $_.FullName (Join-Path $tools ('FFMPEG-' + $_.Name)) -Force }
$licenses = Join-Path $tools 'THIRD_PARTY.txt'
@'
This installer contains executable programs from independent open-source projects.

whisper.cpp / GGML, release v1.9.5
  https://github.com/ggml-org/whisper.cpp
  License: MIT. See source LICENSE for terms and copyright notices.
FFmpeg (gyan.dev Windows essentials release)
  https://www.ffmpeg.org/
  https://www.gyan.dev/ffmpeg/builds/
  License varies by linked libraries and build configuration; FFmpeg is
  distributed under LGPL/GPL terms. Review the release package and source
  repository for the full corresponding license and source.
The Nosso Culto application does not own these components.
'@ | Set-Content -LiteralPath $licenses -Encoding utf8

& (Join-Path $tools 'ffmpeg.exe') -version | Select-Object -First 1
if ($LASTEXITCODE -ne 0) { throw 'ffmpeg.exe não iniciou corretamente.' }
& (Join-Path $tools 'whisper-cli.exe') -h *> $null
if ($LASTEXITCODE -ne 0) { throw 'whisper-cli.exe não iniciou corretamente.' }
Write-Host "Whisper local bundled: $tools"
