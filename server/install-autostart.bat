@echo off
setlocal
REM === AMC Consensus Dashboard - register auto-start at Windows logon ===
REM Run this once (recommended: right-click > Run as administrator).
REM It registers a Scheduled Task that launches start.bat every time you log in.

set "TASK=AMC_Consensus"
set "BAT=%~dp0start.bat"

schtasks /Create /TN "%TASK%" /TR "\"%BAT%\"" /SC ONLOGON /RL HIGHEST /F
if errorlevel 1 goto fail

echo.
echo [OK] Auto-start registered.
echo      The dashboard server will launch automatically at Windows logon.
echo      Task name: %TASK%
echo      (To run it now without rebooting: double-click start.bat)
goto end

:fail
echo.
echo [ERROR] Registration failed.
echo         Close this window, right-click install-autostart.bat,
echo         choose "Run as administrator", and try again.

:end
echo.
pause
