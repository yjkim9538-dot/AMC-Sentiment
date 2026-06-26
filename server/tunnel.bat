@echo off
setlocal
cd /d "%~dp0"
REM === Public access via Cloudflare Tunnel (quick mode, no account) ===
REM Prerequisite: the dashboard server must already be running (start.bat).
REM This exposes http://localhost:3000 to a public https URL you can open on any device.
REM NOTE: the quick-tunnel URL changes every time you run it. For a permanent fixed
REM       address, set up a NAMED tunnel as a service (see README).

where cloudflared >nul 2>&1
if errorlevel 1 goto nocf

echo Starting public tunnel to http://localhost:3000 ...
echo.
echo  ==> Look below for a line like:  https://xxxxx.trycloudflare.com
echo      Open THAT address on your phone / tablet / laptop, then log in.
echo.
cloudflared tunnel --url http://localhost:3000
goto end

:nocf
echo [ERROR] cloudflared is not installed.
echo Install it first (one of):
echo   1^) winget install --id Cloudflare.cloudflared
echo   2^) Download from https://github.com/cloudflare/cloudflared/releases (cloudflared-windows-amd64.exe)
echo      then put it in your PATH (or this folder, renamed cloudflared.exe).

:end
echo.
pause
