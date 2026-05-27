@echo off
title AI Workflow Engine Startup

echo =========================================================
echo  * AI Workflow Engine Startup Script
echo  * Canvas + Gateway + Engine + MinIO
echo =========================================================
echo.

echo [1/4] Starting Engine (Port 4000)...
start "Engine" cmd /k "cd /d %~dp0engine && npm run dev"

echo [2/4] Starting Gateway (Port 3000)...
start "Gateway" cmd /k "cd /d %~dp0gateway && npm run dev"

echo [3/4] Starting Canvas...
start "Canvas" cmd /k "cd /d %~dp0canvas && npm run dev"

echo [4/4] Starting MinIO (API: 19000, Console: 19001)...
start "MinIO" cmd /k "cd /d %~dp0 && docker-compose up -d minio"

echo.
echo =========================================================
echo  * All services are starting and auto-reloading!
echo  Canvas: http://localhost:5173
echo  MinIO Console: http://localhost:19001
echo =========================================================
echo.
pause
