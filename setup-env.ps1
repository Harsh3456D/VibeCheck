# VibeCheck Setup — Run this to configure MSVC environment before 'npm run tauri dev'
$vsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207"
$kitLib = "C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0"
$kitInc = "C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0"

# Auto-detect MSVC version if the above path doesn't exist
if (-not (Test-Path $vsPath)) {
    $vsBase = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"
    if (-not (Test-Path $vsBase)) {
        $vsBase = "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC"
    }
    if (Test-Path $vsBase) {
        $vsVersion = (Get-ChildItem $vsBase | Sort-Object Name -Descending | Select-Object -First 1).Name
        $vsPath = Join-Path $vsBase $vsVersion
    } else {
        Write-Error "Visual Studio Build Tools not found. Install with: winget install Microsoft.VisualStudio.2022.BuildTools"
        exit 1
    }
}

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";$vsPath\bin\Hostx64\x64"
$env:LIB = "$vsPath\lib\x64;$kitLib\ucrt\x64;$kitLib\um\x64"
$env:INCLUDE = "$vsPath\include;$kitInc\ucrt;$kitInc\um;$kitInc\shared"

Write-Host "MSVC environment configured." -ForegroundColor Green
Write-Host "  MSVC: $vsPath" -ForegroundColor DarkGray
Write-Host "  Run: npm run tauri dev" -ForegroundColor Cyan
