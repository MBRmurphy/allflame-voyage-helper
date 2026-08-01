@echo off
cd /d "%~dp0"
if exist "%~dp0dist\PoE-Allflame-Voyage-Helper.exe" (
  start "PoE Allflame Voyage Helper" "%~dp0dist\PoE-Allflame-Voyage-Helper.exe"
  exit /b 0
)
where npm >nul 2>nul
if errorlevel 1 (
  echo No portable build was found and npm is not installed.
  echo Download the latest EXE from:
  echo https://github.com/MBRmurphy/allflame-voyage-helper/releases/latest
  pause
  exit /b 1
)
npm start
