@echo off
setlocal
REM === Remove the auto-start Scheduled Task ===
set "TASK=AMC_Consensus"
schtasks /Delete /TN "%TASK%" /F
echo.
echo Done. (If it says "cannot find", auto-start was not registered.)
echo.
pause
