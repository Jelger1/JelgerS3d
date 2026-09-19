@echo off
rem Start de site lokaal op http://localhost:3000 en bouwt opnieuw bij elke wijziging.
cd /d "%~dp0"
if not exist node_modules call npm install
start "" http://localhost:3000
call npm run dev
