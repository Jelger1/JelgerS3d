@echo off
rem Bouwt de site in de map dist\ en controleert alle links.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run build
if errorlevel 1 goto einde
call npm run check
:einde
pause
