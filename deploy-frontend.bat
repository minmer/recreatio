@echo off
setlocal

rem Deploys the website (docs\ for GitHub Pages) and builds the Android app
rem from the SAME build: the APK/AAB carry exactly the files that go online.
rem
rem   deploy-frontend.bat              site + app (+ upload to Google Play if configured)
rem   deploy-frontend.bat --web-only   site only
rem
rem The app needs the signing key in %USERPROFILE%\.recreatio\android (npm run android:keystore).
rem The Play upload needs play-service-account.json next to it (frontend\android\play\PLAY_CONSOLE.md).

echo Building frontend...
pushd frontend
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
call npm run build
if errorlevel 1 (
  echo Build failed.
  popd
  exit /b 1
)
popd

echo Updating docs folder for GitHub Pages...
if exist docs (
  rmdir /s /q docs
)
xcopy /E /I /Y frontend\dist docs >nul

if /i "%~1"=="--web-only" goto done

set "KEYDIR=%USERPROFILE%\.recreatio\android"
set "SIGNING=%RECREATIO_SIGNING%"
if "%SIGNING%"=="" set "SIGNING=%KEYDIR%\signing.properties"
set "PLAYKEY=%RECREATIO_PLAY_KEY%"
if "%PLAYKEY%"=="" set "PLAYKEY=%KEYDIR%\play-service-account.json"

echo.
if not exist "%SIGNING%" (
  echo Android app skipped: no signing key at %SIGNING%
  echo Create it once with: cd frontend ^&^& npm run android:keystore
  goto done
)

echo Building the Android app - APK and AAB...
pushd frontend
call npm run android:release -- --skip-web
if errorlevel 1 (
  echo Android build failed.
  popd
  exit /b 1
)

if exist "%PLAYKEY%" (
  echo Uploading to Google Play - internal testing, as draft...
  call npm run android:publish
  if errorlevel 1 (
    echo Google Play upload failed. The site is updated; the app files are in frontend\android-out.
    popd
    exit /b 1
  )
) else (
  echo Google Play upload skipped: no service account at %PLAYKEY%
  echo The files for a manual upload are in frontend\android-out.
)
popd

:done
echo.
echo Done. Commit and push the docs folder to publish the site.
endlocal
