@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "jsonPath=bin\files.json"

echo { > "%jsonPath%"

set "first=1"

:: Process ctl folder (remote)
if exist "bin\ctl\*.bin" (
    if !first!==0 (echo , >> "%jsonPath%") else (set "first=0")
    echo   "remote": [ >> "%jsonPath%"
    set "fileFirst=1"
    for %%f in (bin\ctl\*.bin) do (
        if !fileFirst!==0 (echo , >> "%jsonPath%") else (set "fileFirst=0")
        echo     "%%~nxf" >> "%jsonPath%"
    )
    echo   ] >> "%jsonPath%"
)

:: Process radio folder (transmitter)
if exist "bin\radio\*.bin" (
    if !first!==0 (echo , >> "%jsonPath%") else (set "first=0")
    echo   "transmitter": [ >> "%jsonPath%"
    set "fileFirst=1"
    for %%f in (bin\radio\*.bin) do (
        if !fileFirst!==0 (echo , >> "%jsonPath%") else (set "fileFirst=0")
        echo     "%%~nxf" >> "%jsonPath%"
    )
    echo   ] >> "%jsonPath%"
)

:: Process sensor folder (sensor)
if exist "bin\sensor\*.bin" (
    if !first!==0 (echo , >> "%jsonPath%") else (set "first=0")
    echo   "sensor": [ >> "%jsonPath%"
    set "fileFirst=1"
    for %%f in (bin\sensor\*.bin) do (
        if !fileFirst!==0 (echo , >> "%jsonPath%") else (set "fileFirst=0")
        echo     "%%~nxf" >> "%jsonPath%"
    )
    echo   ] >> "%jsonPath%"
)

echo } >> "%jsonPath%"

echo files.json generated successfully at %jsonPath%
pause
