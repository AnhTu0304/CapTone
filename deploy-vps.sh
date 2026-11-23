#!/bin/bash
# ==============================================================================
# SelfHeal Platform - 1-Click Production Deployment Script for VPS
# ==============================================================================
set -e

echo "=========================================================="
echo "    CAPTONE PLATFORM - VPS 1-CLICK DEPLOYMENT RUNNER"
echo "=========================================================="
echo ""

# 1. Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "[LỖI] Docker chưa được cài đặt trên máy chủ!"
    echo "Vui lòng cài đặt Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# 2. Kiểm tra file .env
if [ ! -f .env ]; then
    echo "[CẢNH BÁO] Không tìm thấy file .env! Đang sao chép từ .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "[OK] Đã tạo file .env từ .env.example."
    fi
fi

# 3. Kéo toàn bộ image mới nhất từ Docker Hub
echo ">> [1/2] Đang kéo các Image mới nhất từ Docker Hub (phamthaisang/captone1)..."
docker compose -f docker-compose.prod.yml pull

# 4. Khởi động các container
echo ">> [2/2] Đang khởi chạy toàn bộ dịch vụ (Postgres, Redis, Main Backend, AI Backend, Frontend, Reverse Proxy)..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo ""
echo "=========================================================="
echo "               TRẠNG THÁI CÁC DỊCH VỤ TRÊN VPS"
echo "=========================================================="
docker compose -f docker-compose.prod.yml ps
echo ""
echo "[THÀNH CÔNG] Toàn bộ nền tảng SelfHeal đã được triển khai và đang chạy ngầm!"
