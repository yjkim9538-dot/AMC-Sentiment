@echo off
setlocal
cd /d "%~dp0"

REM === AMC Consensus Dashboard - one-click launcher (Windows) ===
REM Double-click to run. The API key is read from the .env file in this folder.
REM Corporate TLS inspection: place your company root cert here as "corp-ca.pem"
REM (recommended). If absent, TLS verification is disabled for internal use.

if exist "corp-ca.pem" goto USE_CERT
set NODE_TLS_REJECT_UNAUTHORIZED=0
echo [warn] corp-ca.pem not found - running with TLS verification disabled (internal use only).
goto CHECK_DEPS

:USE_CERT
set "NODE_EXTRA_CA_CERTS=%~dp0corp-ca.pem"
echo [info] Using corp-ca.pem for TLS verification.

:CHECK_DEPS
if exist "node_modules" goto RUN
echo [info] First run - installing dependencies...
call npm install

:RUN
echo [info] Starting server... open http://localhost:3000 in your browser.
call npm start

echo.
echo Server stopped. Press any key to close this window.
pause >nul
