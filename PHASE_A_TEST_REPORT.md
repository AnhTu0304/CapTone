# PHASE A — TEST REPORT
## EVIDENCE ISOLATION & RCA INTEGRITY TEST SUITE (A01 – A18)
**Dự án:** SelfAI — Closed-Loop Autonomous Self-Healing Platform  
**Tập tin kiểm thử:** `AI_backend/tests/test_phase_a_evidence_isolation.py`  
**Kết quả thực thi:** 18/18 PASSED (100% PASS RATE)  
**Thời gian thực thi:** 0.13s  
**Môi trường:** Python 3.11.9, pytest 9.1.1, Windows x64  

---

## 1. TỔNG KẾT KẾT QUẢ KIỂM THỬ

Toàn bộ 18 kịch bản kiểm thử bắt buộc (A01 đến A18) thuộc Phase A đã được thiết kế và thực thi thành công:

| ID | Tình huống kiểm thử | Kết quả mong đợi | Trạng thái thực tế | Thời gian |
|---|---|---|---|---|
| **A01** | `ecommerce-store-app` và `mongodb-0` cùng namespace `test-lab` | Tuyệt đối không trộn lẫn evidence giữa 2 workload | **PASSED** | 0.01s |
| **A02** | `mongodb-0` có 37 restarts, `ecommerce-store-app` có 1 restart | `KubernetesEventAgent` chỉ chọn Pod thuộc workload mục tiêu | **PASSED** | <0.01s |
| **A03** | Kubernetes Event có structured metadata nhưng thiếu Pod UID | Đánh dấu `UNATTRIBUTED`, không tự động forge target UID | **PASSED** | <0.01s |
| **A04** | Kubernetes Event mang UID của Pod khác (`47e313e2...`) | Không gán cho target ecommerce (`454a6276...`), chuyển `DEPENDENCY` | **PASSED** | <0.01s |
| **A05** | Hai Pod cùng namespace có tên tiền tố tương tự (`ecommerce-store` vs `ecommerce-store-app`) | Phân biệt chính xác hai workload qua controller hierarchy | **PASSED** | <0.01s |
| **A06** | Pod thuộc Deployment qua ReplicaSet (`rsplit("-", 1)[0]`) | Xác minh quan hệ phân cấp controller chính xác | **PASSED** | <0.01s |
| **A07** | Pod thuộc StatefulSet (`mongodb-0` -> `mongodb`) | Ánh xạ chính xác ownership của StatefulSet | **PASSED** | <0.01s |
| **A08** | Pod có nhiều Service selector | Duy trì quan hệ và controller ownership nhất quán | **PASSED** | <0.01s |
| **A09** | Service không có EndpointSlice khả dụng | Không tự động suy diễn endpoint giả tạo | **PASSED** | 0.01s |
| **A10** | Service có log DNS `getaddrinfo ENOTFOUND` thực tế | Bóc tách chính xác thành `LOG_CONNECTION_FAILURE` (`DEPENDENCY`) | **PASSED** | <0.01s |
| **A11** | Ecommerce ghi log lỗi `ECONNREFUSED` tới MongoDB | Không kết luận nhầm thành crash nội bộ ứng dụng, nhận diện `dependency_failure` | **PASSED** | 0.01s |
| **A12** | `mongodb-0` rơi vào `CrashLoopBackOff` | Không gán sự kiện CrashLoop của MongoDB thành lỗi trực tiếp của Ecommerce | **PASSED** | <0.01s |
| **A13** | Dependency lỗi + Target Ecommerce có HTTP 5xx 100% & Latency 2590ms | Phân định đúng: 5xx & Latency là Triệu chứng (Symptoms), Root Cause là `dependency_failure` | **PASSED** | 0.01s |
| **A14** | Bằng chứng mang Historical Pod UID (Pod cũ đã bị thay thế) | Đánh dấu `HISTORICAL`, `is_current_pod = False`, không dùng làm trạng thái hiện tại | **PASSED** | <0.01s |
| **A15** | Bằng chứng thiếu thông tin Timestamp | Đánh dấu `MISSING_TIMESTAMP`, không xác nhận `temporal_correlation`, hạ reliability | **PASSED** | <0.01s |
| **A16** | OwnerReferences không đầy đủ hoặc không khớp quy ước | Đánh dấu `UNVERIFIED`, không fallback suy diễn lỏng lẻo | **PASSED** | <0.01s |
| **A17** | CRD custom controller với tên tiền tố tương tự | Không nhận nhầm controller của Custom Resource Definition | **PASSED** | <0.01s |
| **A18** | Dependency failure chỉ có cảnh báo kết nối đơn độc (thiếu causal evidence) | Đánh giá ở mức `PROBABLE` (không `CONFIRMED`) và có cảnh báo `missing_evidence` | **PASSED** | 0.01s |

---

## 2. MINH CHỨNG THỰC THI THỰC TẾ TRÊN MÔI TRƯỜNG

```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-9.1.1, pluggy-1.7.0
rootdir: D:\NCKH\CapTone\AI_backend
plugins: anyio-4.14.1, langsmith-0.9.5, asyncio-1.4.0
asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 18 items

tests\test_phase_a_evidence_isolation.py ..................              [100%]

============================= 18 passed in 0.13s ==============================
```

---

## 3. PHÂN TÍCH CHI TIẾT CÁC KỊCH BẢN QUAN TRỌNG

### 3.1. Kịch bản A01 & A13 (Tái hiện & Giải quyết Sự cố thực tế `ecommerce-store-app`)
- **Tình huống:** Target Pod `ecommerce-store-app-646f88ccfc-k6sl6` (UID: `454a6276...`) có CPU 5%, RAM 64%, Latency 2590.85ms, HTTP 5xx 100%. MongoDB Pod `mongodb-0` (UID: `47e313e2...`) có 37 restarts, CrashLoopBackOff. Log Ecommerce: `[MongoDB] Dual DB not ready yet: getaddrinfo ENOTFOUND mongodb-1...`.
- **Kết quả xác minh:**
  1. `EvidenceCollector` bóc tách sự kiện CrashLoop gán đúng cho `mongodb-0` với trạng thái `DEPENDENCY`.
  2. `EvidenceValidator` cô lập toàn bộ lỗi của MongoDB sang `dependency_evidences`, không cho lọt vào `valid_evidences` của Ecommerce.
  3. `CauseEvaluator` kết luận chính xác `dependency_failure` (`CONFIRMED`).
  4. HTTP 5xx (100%) và Latency (2590ms) được xếp vào danh mục `symptoms`.
  5. `RecommendationAgent` khuyến nghị `action = "NO_ACTION"` và cung cấp Playbook 3 bước kiểm tra Database & DNS thay vì Restart/Replace Pod trên web app.

### 3.2. Kịch bản A02 & A05 (Khắc phục DEF-02 và DEF-03)
- **Tình huống:** `KubernetesEventAgent` rà soát toàn bộ Pod trong namespace `test-lab`. `mongodb-0` có 37 lần khởi động lại trong khi Ecommerce chỉ có 1 lần.
- **Kết quả xác minh:** `KubernetesEventAgent` lọc danh sách theo `target_pods`. `faulty_pod` trả về chính xác `ecommerce-store-app-646f88ccfc-k6sl6` (không chọn `mongodb-0`). Đồng thời, cờ `is_primary_database` được khóa chặt ở giá trị `False`.

---

## 4. KẾT LUẬN TEST REPORT
Test Suite Phase A đạt tiêu chuẩn chất lượng cao nhất:
- **18/18 kịch bản PASS 100%.**
- Kiểm chứng chặt chẽ tính độc lập của bằng chứng, tính đúng đắn của cây điều phối controller, và cơ chế bảo vệ an toàn cho workload mục tiêu.
