@echo off
setlocal

rem Builds the Android app (APK and AAB) and uploads the AAB to Google Play if configured.
rem The website is deployed separately with deploy-web.bat.
rem
rem   deploy-app.bat               builds the frontend itself, then the app (+ upload)
rem   deploy-app.bat --skip-web    uses frontend\dist as the last deploy-web.bat left it,
rem                                so the app carries exactly the files that went online
rem
rem The app needs the signing key in %USERPROFILE%\.recreatio\android (npm run android:keystore).
rem The Play upload needs play-service-account.json next to it (frontend\android\play\PLAY_CONSOLE.md).

set "SKIPWEB="
if /i "%~1"=="--skip-web" set "SKIPWEB=--skip-web"

set "KEYDIR=%USERPROFILE%\.recreatio\android"
set "SIGNING=%RECREATIO_SIGNING%"
if "%SIGNING%"=="" set "SIGNING=%KEYDIR%\signing.properties"
set "PLAYKEY=%RECREATIO_PLAY_KEY%"
if "%PLAYKEY%"=="" set "PLAYKEY=%KEYDIR%\play-service-account.json"

if not exist "%SIGNING%" (
  echo No signing key at %SIGNING%
  echo Create it once with: cd frontend ^&^& npm run android:keystore
  exit /b 1
)

if defined SKIPWEB if not exist frontend\dist\index.html (
  echo No frontend build in frontend\dist - run deploy-web.bat first, or leave out --skip-web.
  exit /b 1
)

pushd frontend
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

echo Building the Android app - APK and AAB...
call npm run android:release -- %SKIPWEB%
if errorlevel 1 (
  echo Android build failed.
  popd
  exit /b 1
)

if exist "%PLAYKEY%" (
  echo Uploading to Google Play - internal testing, as draft...
  call npm run android:publish
  if errorlevel 1 (
    echo Google Play upload failed. The app files are in frontend\android-out.
    popd
    exit /b 1
  )
) else (
  echo Google Play upload skipped: no service account at %PLAYKEY%
  echo The files for a manual upload are in frontend\android-out.
)
popd

echo.
echo Done.
endlocal
