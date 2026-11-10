## Mô tả thay đổi (Summary)
<!-- Mô tả ngắn gọn 1-3 dòng về vấn đề được giải quyết trong PR này -->

## Phân hệ bị ảnh hưởng (Affected Services)
- [ ] `Main_backend/` (Node.js TypeScript MVC, PostgreSQL Migrations, Redis)
- [ ] `AI_backend/` (FastAPI GRU Prediction, Multi-Agent RCA)
- [ ] `Frontend/` (React 19 Greptile Blueprint UI)
- [ ] `Agent/` (Kubernetes SelfHeal Agent & Installer Service)
- [ ] `nginx/` / `docker-compose` / `.github/workflows` (Hạ tầng & CI/CD)

## Danh sách kiểm tra trước khi Merge (Pre-Merge Checklist)
- [ ] Đã kiểm tra không commit tệp `.env`, khóa bí mật (API Key, SMTP Password, JWT Secret) lên Git.
- [ ] Nếu có thay đổi cấu trúc bảng PostgreSQL, đã bổ sung file `.sql` có tính idempotent (`IF NOT EXISTS`) vào `Main_backend/migrations/`.
- [ ] Toàn bộ các Job tương ứng trong **SelfHeal Monorepo CI Pipeline** đã báo xanh (Passed).
