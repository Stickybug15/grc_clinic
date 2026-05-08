@echo off
title School Clinic Launcher
echo ===================================================
echo     Starting School Clinic Management System...
echo ===================================================
echo.
echo Starting the Backend Server...
start "Backend Server" cmd /k "cd backend && npm run dev"

echo Starting the Frontend Server...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo Waiting for servers to initialize...
timeout /t 5 /nobreak > NUL

echo.
echo Opening the application in your default browser...
start http://localhost:5173

echo.
echo ===================================================
echo   System is now running! 
echo   NOTE: Please do not close the two black server 
echo   windows that just opened. You may close this one.
echo ===================================================
pause
