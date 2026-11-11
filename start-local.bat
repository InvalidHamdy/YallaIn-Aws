@echo off
rem Runs YallaIn on this computer (no AWS needed). Double-click this file.
rem Needs: Node.js 20+, and MySQL running (e.g. XAMPP Control Panel -> Start MySQL).
title YallaIn - local server
cd /d "%~dp0app"
:start

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if exist .env goto haveenv
echo.
echo First run: creating app\.env for local testing.
echo   - Using XAMPP's MySQL (port 3307, no password)? Just press Enter.
echo   - Using your own MySQL 8.0? Type its root password, then Enter.
set "DBPASS="
set /p "DBPASS=MySQL password: "
set "DBPORT=3306"
if "%DBPASS%"=="" set "DBPORT=3307"
> .env echo NODE_ENV=development
>> .env echo PORT=3000
>> .env echo DB_HOST=127.0.0.1
>> .env echo DB_PORT=%DBPORT%
>> .env echo DB_USER=root
>> .env echo DB_PASS=%DBPASS%
>> .env echo DB_NAME=yallain
>> .env echo S3_IDS_BUCKET=
>> .env echo ASSETS_BASE_URL=
>> .env echo OTP_MODE=demo
:haveenv

if exist node_modules goto havemods
echo.
echo Installing packages (first run only, takes a minute)...
call npm install --no-audit --no-fund
if errorlevel 1 goto fail
:havemods

echo.
echo Preparing the database...
call npm run db:init
if errorlevel 1 goto dbfail

echo.
echo Starting YallaIn at http://localhost:3000  (close this window to stop it)
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
call npm start
pause
exit /b 0

:dbfail
echo.
echo Could not log in to MySQL with that password (or MySQL is not running).
echo Let's try again - close this window to give up.
del .env >nul 2>nul
goto start

:fail
echo.
echo Something went wrong installing packages. Check your internet connection and try again.
pause
exit /b 1
