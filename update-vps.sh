#!/bin/bash
# ==============================================================================
# SelfHeal Platform - 1-Click Update Script for VPS
# ==============================================================================
set -e

echo ">> Đang kéo bản cập nhật code mới từ Docker Hub..."
docker compose -f docker-compose.prod.yml pull

echo ">> Đang thay thế container cũ bằng container mới (Dữ liệu DB vẫn giữ nguyên 100%)..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo ">> Hoàn tất cập nhật! Trạng thái hệ thống:"
docker compose -f docker-compose.prod.yml ps
