@echo off
chcp 65001 >nul
title Gamelia
echo.
echo  Gamelia : lancement du site en local
echo  -------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js n'est pas installe. Telechargez la version LTS sur https://nodejs.org puis relancez ce fichier.
  start https://nodejs.org
  pause
  exit /b
)
cd /d "%~dp0"
if not exist node_modules (
  echo  Premiere installation, quelques minutes...
  call npm install
)
if not exist .env.local copy .env.example .env.local >nul
echo  Le site s'ouvre dans votre navigateur : http://localhost:3000
echo  Pour arreter : fermez cette fenetre.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
call npm run dev
