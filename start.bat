@echo off
title Finora Personal Finance App Launcher
echo =======================================================
echo          FINORA - Personal Finance Platform
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/3] Memeriksa & Menjalankan MySQL Portable Server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-mysql.ps1"

echo [2/3] Menjalankan Laravel API Server (http://127.0.0.1:8000)...
start "Finora Backend API" /min cmd /c "cd /d "%~dp0backend" && ..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000"

echo [3/3] Menjalankan Vite Frontend Server (http://localhost:5173)...
start "Finora Frontend Web" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo =======================================================
echo  Aplikasi Finora siap digunakan!
echo  URL: http://localhost:5173
echo  Demo Akun: demo@finora.test
echo  Password:  password
echo =======================================================
echo.

start http://localhost:5173
