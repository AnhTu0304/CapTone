SET client_encoding = 'UTF8';

-- Sửa lỗi hiển thị font tiếng Việt trong bảng healing_policies
UPDATE healing_policies 
SET description = 'Tự động mở rộng bản sao Pod khi quá tải lưu lượng đột biến' 
WHERE name = 'POL-SCALE-OUT-TRAFFIC';

UPDATE healing_policies 
SET description = 'Hoàn nguyên phiên bản khi tỷ lệ HTTP 5xx vượt 5%' 
WHERE name = 'POL-ROLLBACK-HTTP5XX';

UPDATE healing_policies 
SET description = 'Dọn dẹp dung lượng disk tạm thời trong thư mục /tmp' 
WHERE name = 'POL-CLEANUP-DISK-TEMP';

UPDATE healing_policies 
SET description = 'Chặn IP tấn công bất thường bằng eBPF/iptables' 
WHERE name = 'POL-BLOCK-MALICIOUS-IP';

UPDATE healing_policies 
SET description = 'Di tản workload và cô lập Node vật lý bị lỗi phần cứng' 
WHERE name = 'POL-DRAIN-UNHEALTHY-NODE';

UPDATE healing_policies 
SET description = 'Tự động khởi động lại Pod bị treo hoặc crash liveness probe' 
WHERE name = 'POL-RESTART-CRASHED-POD';

-- Sửa lỗi hiển thị font tiếng Việt trong bảng healing_action_types
UPDATE healing_action_types 
SET description = 'Khởi động lại Pod bị lỗi hoặc treo tiến trình' 
WHERE code = 'RESTART_POD';

UPDATE healing_action_types 
SET description = 'Tăng hoặc giảm số lượng bản sao Pod để điều tiết tải' 
WHERE code = 'SCALE_REPLICAS';

UPDATE healing_action_types 
SET description = 'Quay lại phiên bản deployment ổn định trước đó' 
WHERE code = 'ROLLBACK_DEPLOYMENT';

UPDATE healing_action_types 
SET description = 'Dọn dẹp tập tin tạm và giải phóng bộ nhớ lưu trữ' 
WHERE code = 'CLEANUP_TEMP_FILES';

UPDATE healing_action_types 
SET description = 'Tạm thời chặn nguồn lưu lượng bất thường gây quá tải' 
WHERE code = 'BLOCK_IP_TEMP';

UPDATE healing_action_types 
SET description = 'Điều chỉnh hạn mức CPU và RAM của container' 
WHERE code = 'ADJUST_RESOURCE_LIMITS';

UPDATE healing_action_types 
SET description = 'Di tản toàn bộ Pod khỏi Node gặp sự cố phần cứng' 
WHERE code = 'DRAIN_NODE';
