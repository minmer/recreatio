@echo off
setlocal

REM Ścieżka do projektu API
set PROJECT_PATH=backend\Recreatio.Api\Recreatio.Api.csproj

REM Folder publikacji
set PUBLISH_DIR=backend\Recreatio.Api\publish

REM Ścieżka do msdeploy.exe (jeśli masz inną, zmień tutaj)
set MSDEPLOY_EXE="C:\Program Files (x86)\IIS\Microsoft Web Deploy V3\msdeploy.exe"

REM Sprawdzenie zmiennych środowiskowych
if "%WEBIO_API_USER%"=="" (
    echo [ERROR] Zmienna WEBIO_API_USER nie jest ustawiona.
    goto :end
)

if "%WEBIO_API_PASS%"=="" (
    echo [ERROR] Zmienna WEBIO_API_PASS nie jest ustawiona.
    goto :end
)

if "%WEBIO_API_MSDEPLOY_SITE%"=="" (
    echo [ERROR] Zmienna WEBIO_API_MSDEPLOY_SITE nie jest ustawiona.
    goto :end
)

if "%WEBIO_API_PUBLISH_URL%"=="" (
    echo [ERROR] Zmienna WEBIO_API_PUBLISH_URL nie jest ustawiona.
    goto :end
)

echo === Krok 1: dotnet publish ===
dotnet publish "%PROJECT_PATH%" -c Release -o "%PUBLISH_DIR%"
if errorlevel 1 (
    echo [ERROR] dotnet publish nie powiodl sie.
    goto :end
)

echo === Krok 2: msdeploy sync ===
%MSDEPLOY_EXE% -verb:sync ^
    -source:contentPath="%PUBLISH_DIR%" ^
    -dest:contentPath="%WEBIO_API_MSDEPLOY_SITE%",ComputerName="%WEBIO_API_PUBLISH_URL%",UserName="%WEBIO_API_USER%",Password="%WEBIO_API_PASS%",AuthType="Basic" ^
    -allowUntrusted ^
    -enableRule:DoNotDeleteRule ^
    -enableRule:AppOffline

if errorlevel 1 (
    echo [ERROR] msdeploy nie powiodl sie.
    goto :end
)

echo === Deploy zakonczony pomyslnie ===

:end
endlocal
pause
