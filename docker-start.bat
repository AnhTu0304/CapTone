@echo off
title CapTone - Khoi chay he thong bang Docker
echo =======================================================
echo          CAPTONE PLATFORM - DOCKER RUNNER
echo =======================================================
echo.
echo Dang kiem tra trang thai Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [LOI] Docker Desktop chua duoc bat hoac khong chay!
    echo Vui long mo Docker Desktop va thu lai sau khi bieu tuong chuyen sang mau xanh.
    pause
    exit /b 1
)

echo [OK] Docker Desktop dang hoat dong tot.
echo.
echo Dang build va khoi dong 5 dich vu (Postgres, Main Backend, AI Backend, Frontend, Agent)...
docker compose up -d --build

echo.
echo =======================================================
echo                 TRANG THAI CAC DICH VU
echo =======================================================
docker compose ps

echo.
echo =======================================================
echo CAC DUONG DAN TRUY CAP:
echo - Frontend UI:      http://localhost:3005 (hoac http://localhost:8090)
echo - Main Backend API: http://localhost:5005/api/v1/health
echo - AI Backend Docs:  http://localhost:8005/docs
echo =======================================================
echo.
echo Nhan bat ky phim nao de dong cua so nay (cac dich vu van chay ngam)...
pause >nul
