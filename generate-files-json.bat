@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "jsonPath=bin\files.json"

:: ========================================
:: Device Mapping Configuration
:: Map device names to their folder paths
:: Format: DeviceName -> Type/Model
:: ========================================

set deviceCount=0

:: RadioMaster MT8 -> ctl/MT8
set /a deviceCount+=1
set "device[1].name=RadioMaster MT8"
set "device[1].type=ctl"
set "device[1].model=MT8"

:: RadioMaster T8L -> ctl/T8L
set /a deviceCount+=1
set "device[2].name=RadioMaster T8L"
set "device[2].type=ctl"
set "device[2].model=T8L"

:: RM ERS Sensor -> sensor/ERS
set /a deviceCount+=1
set "device[3].name=RM ERS Sensor"
set "device[3].type=sensor"
set "device[3].model=ERS"

:: Radio -> radio
set /a deviceCount+=1
set "device[4].name=Radio"
set "device[4].type=radio"
set "device[4].model="

@REM :: RadioMaster MT6 -> ctl/MT6
@REM set /a deviceCount+=1
@REM set "device[5].name=RadioMaster MT6"
@REM set "device[5].type=ctl"
@REM set "device[5].model=MT6"

:: Example for adding new device:
:: set /a deviceCount+=1
:: set "device[5].name=RadioMaster NewDevice"
:: set "device[5].type=ctl"
:: set "device[5].model=NewDevice"

:: ========================================
:: Generate JSON
:: ========================================

echo Generating files.json...
echo.

:: Start JSON
echo { > "%jsonPath%"
echo   "devices": { >> "%jsonPath%"

set "firstDevice=1"

:: Process each configured device
for /L %%i in (1,1,%deviceCount%) do (
    set "deviceName=!device[%%i].name!"
    set "deviceType=!device[%%i].type!"
    set "deviceModel=!device[%%i].model!"

    :: Build device path (handle empty model for radio)
    if "!deviceModel!"=="" (
        set "devicePath=!deviceType!"
    ) else (
        set "devicePath=!deviceType!\!deviceModel!"
    )

    :: Check if device folder exists and has bin files
    if exist "bin\!devicePath!\*.bin" (
        if !firstDevice!==0 (
            echo , >> "%jsonPath%"
        ) else (
            set "firstDevice=0"
        )

        echo     "!deviceName!": { >> "%jsonPath%"
        echo       "type": "!deviceType!", >> "%jsonPath%"
        echo       "model": "!deviceModel!", >> "%jsonPath%"
        echo       "files": [ >> "%jsonPath%"

        :: List all bin files in this device folder
        set "fileFirst=1"
        for %%f in (bin\!devicePath!\*.bin) do (
            if !fileFirst!==0 (
                echo , >> "%jsonPath%"
            ) else (
                set "fileFirst=0"
            )
            echo         "%%~nxf" >> "%jsonPath%"
        )

        echo       ] >> "%jsonPath%"
        echo     } >> "%jsonPath%"

        echo [Found] !deviceName! -^> !devicePath!
    ) else (
        echo [Warning] No bin files found for !deviceName! in bin\!devicePath!
    )
)

echo   } >> "%jsonPath%"
echo } >> "%jsonPath%"

echo.
echo ========================================
echo files.json generated successfully!
echo Location: %jsonPath%
echo ========================================
echo.
echo Current structure:
for /L %%i in (1,1,%deviceCount!) do (
    set "deviceType=!device[%%i].type!"
    set "deviceModel=!device[%%i].model!"
    set "devicePath=!deviceType!\!deviceModel!"
    if exist "bin\!devicePath!\" (
        echo   bin\!devicePath!\
        for %%f in (bin\!devicePath!\*.bin) do (
            echo     - %%~nxf
        )
    )
)
echo.
pause
