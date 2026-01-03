@echo off
setlocal

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

echo Done. Commit and push the docs folder to publish.
endlocal
