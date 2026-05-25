@echo off
title AI Workflow Engine Startup

echo =========================================================
echo  * AI Workflow Engine Startup Script (Canvas + Gateway + Engine)
echo =========================================================
echo.

echo [1/3] Starting Engine (Port 4000)...
start "Engine" cmd /k "cd /d %~dp0engine && npm run dev"

echo [2/3] Starting Gateway (Port 3000)...
start "Gateway" cmd /k "cd /d %~dp0gateway && npm run dev"

echo [3/3] Starting Canvas...
start "Canvas" cmd /k "cd /d %~dp0canvas && npm run dev"

echo.
echo =========================================================
echo  * All 3 services are starting and auto-reloading!
echo  Canvas: http://localhost:5173
echo =========================================================
echo.
pause
