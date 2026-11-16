-- Migration 24: Bảng system_broadcasts lưu trữ các thông báo toàn mạng do Super Admin / Admin phát sóng
CREATE TABLE IF NOT EXISTS system_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'INFO',
    audience VARCHAR(50) NOT NULL DEFAULT 'ALL',
    status VARCHAR(50) NOT NULL DEFAULT 'Đang hiển thị',
    show_sticky_banner BOOLEAN DEFAULT TRUE,
    views_count INT DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_broadcasts_created ON system_broadcasts(created_at DESC);

-- Chèn dữ liệu mẫu ban đầu nếu bảng đang rỗng
INSERT INTO system_broadcasts (broadcast_code, title, content, priority, audience, status, views_count, created_at)
VALUES 
(
    'BC-2026-09',
    'Thông báo cập nhật thuật toán AI Model v2.4.1 (ONNX Runtime)',
    'Hệ thống đã triển khai phiên bản mô hình phát hiện dị thường mới với độ trễ suy luận chỉ 1.2ms và giảm 82% tỷ lệ báo động nhầm.',
    'INFO',
    'Tất cả người dùng',
    'Đang hiển thị',
    1240,
    NOW() - INTERVAL '3 days'
),
(
    'BC-2026-08',
    'Bảo trì hạ tầng cơ sở dữ liệu định kỳ Quý 4',
    'Hệ thống sẽ tiến hành bảo trì tối ưu hóa cơ sở dữ liệu PostgreSQL trong 15 phút vào 02:00 Chủ Nhật ngày 25/10/2026.',
    'WARNING',
    'Chủ Doanh nghiệp & DevOps',
    'Đã lên lịch',
    890,
    NOW() - INTERVAL '5 days'
),
(
    'BC-2026-07',
    'Cảnh báo an ninh: Đã kích hoạt cơ chế mã hóa kiểm toán SHA-256',
    'Toàn bộ thao tác phân quyền và tự phục hồi từ nay được bảo vệ bằng chữ ký số bất khả xâm phạm.',
    'INFO',
    'Tất cả người dùng',
    'Đã kết thúc',
    2450,
    NOW() - INTERVAL '14 days'
)
ON CONFLICT (broadcast_code) DO NOTHING;
