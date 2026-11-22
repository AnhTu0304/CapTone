# SPRINT D — BÁO CÁO SAO LƯU, KHÔI PHỤC & DIỄN TẬP THẢM HỌA (SD-04)

**Dự án:** AI-Driven Proactive Self-Healing Infrastructure for SMEs  
**Phạm vi:** Phase 4 (`SD-04`) — Backup, Restore & Disaster Recovery  
**Trạng thái:** ✅ Đã nâng cấp script và diễn tập khôi phục thành công trong môi trường Linux PostgreSQL cô lập

---

## 1. Tóm tắt cải tiến kỹ thuật (`SD-04`)

| Hạng mục | Trước Sprint D | Sau Sprint D (`SD-04`) | Tệp liên quan |
| :--- | :--- | :--- | :--- |
| Chế độ kết nối backup/restore | Chỉ hỗ trợ kết nối TCP trực tiếp từ host (`DB_HOST:5432`) — không khớp production đóng cổng PostgreSQL | Hỗ trợ **2 chế độ**: `DOCKER_COMPOSE_FILE` + `DOCKER_PG_SERVICE` (`docker compose exec -T`) **và** TLS trực tiếp (`PGSSLMODE=verify-full`) | [`scripts/backup-postgres.sh`](file:///d:/AISelfHealing/scripts/backup-postgres.sh), [`scripts/restore-postgres.sh`](file:///d:/AISelfHealing/scripts/restore-postgres.sh) |
| Tính khả chuyển của `.sha256` | `sha256sum "$ENC_FILE"` ghi đường dẫn tuyệt đối (gây lỗi `sha256sum -c` khi chuyển thư mục/host) | Ghi checksum với **basename tương đối** (`(cd "$ENC_DIR" && sha256sum "$ENC_BASE")`), tương thích kiểm chứng đa máy/off-host | [`scripts/backup-postgres.sh`](file:///d:/AISelfHealing/scripts/backup-postgres.sh), [`scripts/restore-postgres.sh`](file:///d:/AISelfHealing/scripts/restore-postgres.sh) |
| Tương thích POSIX / Alpine `mktemp` | `mktemp ..._XXXXXX.dump` (lỗi `Invalid argument` trên BusyBox/Alpine khi phát hiện trong drill) | Chuẩn hóa suffix `XXXXXX` ở cuối mẫu tệp tạm (`...dump.XXXXXX`) | [`scripts/backup-postgres.sh`](file:///d:/AISelfHealing/scripts/backup-postgres.sh), [`scripts/restore-postgres.sh`](file:///d:/AISelfHealing/scripts/restore-postgres.sh) |
| Bảo vệ ghi đè khi restore | Chỉ chặn tên cứng `captone_db` | Chặn cả `captone_db` **và** `${DB_NAME}` đang cấu hình nếu thiếu `--confirm-overwrite` | [`scripts/restore-postgres.sh`](file:///d:/AISelfHealing/scripts/restore-postgres.sh) |
| Sao lưu ngoài máy chủ (Off-host) & Lịch định kỳ | Chưa có hook sync ngoài VPS và file cron mẫu | Thêm hook `BACKUP_OFFHOST_CMD` (nhận `ENC_FILE`, `SHA_FILE`) + mẫu lịch cron hằng ngày & diễn tập hằng tuần | [`scripts/cron/selfheal-backup.cron`](file:///d:/AISelfHealing/scripts/cron/selfheal-backup.cron) |
| Gate CI/CD trước deploy/migrate | `cd.yml` gọi container exec backup | Đồng bộ tham số `DOCKER_COMPOSE_FILE=docker-compose.prod.yml DOCKER_PG_SERVICE=postgres` fail-closed trước migration | [`.github/workflows/cd.yml`](file:///d:/AISelfHealing/.github/workflows/cd.yml) |

---

## 2. Đề xuất mục tiêu RPO / RTO

| Mức độ sự cố | RPO mục tiêu | RTO mục tiêu | Cơ chế đạt được |
| :--- | :--- | :--- | :--- |
| **Triển khai sai / Migration hỏng** | **0 – 5 phút** (ngay trước mỗi lần deploy) | **≤ 15 phút** | Gate sao lưu bắt buộc trong `cd.yml` trước `docker compose up` & `migrate.js`, kết hợp `pg_restore` từ bản backup pre-deploy |
| **Mất dữ liệu logic / Xóa nhầm tenant** | **≤ 24 giờ** (mỗi đêm 02:15 UTC) *(giảm xuống ≤ 1 giờ nếu bật PITR WAL archiving)* | **≤ 30 phút** | Cron hằng ngày (`selfheal-backup.cron`) + Off-host sync (`BACKUP_OFFHOST_CMD`) |
| **Hỏng ổ đĩa VPS chính** | **≤ 24 giờ** | **≤ 60 phút** | Dựng lại stack từ Docker Hub + TLS certs + khôi phục từ bản backup mã hóa lưu tại off-host storage |

> [!NOTE]
> Vì hệ thống hiện tại dùng logical dump (`pg_dump -Fc`) theo lịch hằng ngày và trước mỗi lần deploy, RPO giữa hai lần deploy có thể lên tới 24 giờ nếu không bật continuous WAL archiving (ví dụ pgBackRest / Barman lên S3-compatible). Đề xuất bổ sung WAL archiving ở giai đoạn mở rộng vận hành sau Go-Live.

---

## 3. Bằng chứng diễn tập thực tế (Linux PostgreSQL Drill)

Diễn tập được thực thi trực tiếp trên container cô lập `sd04-pg-drill` (`postgres:16-alpine` + `bash` + `openssl`), **không tác động** tới `captone-*`, `captone_db`, hay `aiselfheal`:

1. **Tạo dữ liệu nguồn (`drill_src`):** tạo bảng `sd04_verify` gồm 2 bản ghi (`alpha-backup-ok`, `beta-restore-ok`).
2. **Chạy backup mã hóa (`backup-postgres.sh`) + Off-host hook:**
   - Xuất bản mã hóa `/tmp/drill_backups/drill_src_20261119T100211Z.dump.enc` với header AES OpenSSL (`Salted__`), PBKDF2 SHA-256 600.000 iterations, quyền tệp `0600` trong thư mục `0700`.
   - File manifest `.sha256` ghi định dạng basename: `18c538e6175f7c3cc0747a30148feafe9af5f4feba5aa986f52fc71bd272d693  drill_src_20261119T100211Z.dump.enc`.
   - Hook `BACKUP_OFFHOST_CMD` sao chép thành công 2 tệp (`.dump.enc` + `.sha256`) sang `/tmp/offhost_bucket/` (`OFFHOST_COUNT=1`).
   - Thời gian sao lưu: `backup_s=1` giây.
3. **Kiểm thử bảo vệ ghi đè (`--confirm-overwrite` guard):**
   - Chạy `restore-postgres.sh "$ENC_FILE" drill_src` không kèm cờ xác nhận → script **từ chối ngay** (`Refusing to overwrite protected database 'drill_src' without explicit --confirm-overwrite flag`).
4. **Kiểm thử phát hiện giả mạo (Tamper Detection):**
   - Nối thêm 1 byte (`X`) vào bản sao `.dump.enc` → `restore-postgres.sh` phát hiện `tamper.dump.enc: FAILED` và **hủy trước khi giải mã**.
5. **Khôi phục & kiểm chứng dữ liệu (`drill_dst`):**
   - Restore hoàn tất trong `restore_s=0` giây (1 bảng public, `rows=2`, giá trị bản ghi 2 khớp chính xác `beta-restore-ok`).

---

## 4. Disaster Recovery (DR) Runbook tóm tắt

1. **Khắc phục nhanh khi migration hoặc release mới gặp sự cố:**
   - Dừng tác vụ deploy hiện tại, giữ nguyên bản backup vừa tạo trước deploy ở `/var/backups/selfheal/`.
   - Kiểm tra toàn vẹn file backup: `sha256sum -c <backup>.dump.enc.sha256`.
   - Thực hiện restore kiểm chứng sang DB tạm trước hoặc restore trực tiếp với `--confirm-overwrite`:
     ```bash
     DOCKER_COMPOSE_FILE=docker-compose.prod.yml DOCKER_PG_SERVICE=postgres \
       ./scripts/restore-postgres.sh /var/backups/selfheal/<file>.dump.enc captone_db --confirm-overwrite
     ```
   - Khởi động lại tag image backend ổn định trước đó (`docker compose -f docker-compose.prod.yml up -d`) và kiểm tra `/api/v1/health`.
2. **Diễn tập định kỳ (Weekly Drill):**
   - Cron Sunday `03:30 UTC` trong `scripts/cron/selfheal-backup.cron` tự động khôi phục bản backup mới nhất vào `backup_verify_drill`, đếm số bảng public và xóa DB tạm, ghi log vào `/var/log/selfheal-restore-drill.log`.
