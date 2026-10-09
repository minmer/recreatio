@echo off
setlocal

rem Deploys the website: builds the frontend and replaces docs\ for GitHub Pages.
rem The Android app is built separately with deploy-app.bat.

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

echo.
echo Done. Commit and push the docs folder to publish the site.
endlocal
