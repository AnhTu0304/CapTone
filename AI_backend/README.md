# AI Backend – Proactive Self-Healing Infrastructure

FastAPI backend sử dụng checkpoint GRU đã train để dự báo sớm rủi ro, sau đó tổng hợp metrics, logs và Kubernetes events bằng các agent phân tích có thể giải thích. RCA có thể dùng OpenAI Structured Outputs, với deterministic fallback khi OpenAI không được cấu hình hoặc tạm lỗi. Backend **không gọi kubectl và không thực thi action**; kết quả cuối chỉ là khuyến nghị cho Main Backend/Policy Engine.

## Chức năng đúng scope AI Backend

```text
GET /health
├── Health status
├── GRU model loaded status
└── RCA provider status

POST /api/v1/predict
├── Validate input 12 timestep × 8 feature
├── Normalize metrics bằng scaler trong checkpoint
├── GRU inference
├── Trả 6 risk prediction và confidence
└── Threshold post-processing

POST /api/v1/rca
├── Analyze current metrics
├── Analyze logs
├── Analyze Kubernetes status/events
├── Analyze health/deployment context
├── Sử dụng kết quả Rule Engine được truyền vào (không tự chạy Rule Engine)
├── Sử dụng GRU prediction được truyền vào
├── Hoặc chạy GRU từ metric_sequence
├── Phân tích historical_incidents được truyền vào (không tự lưu history)
├── Đánh giá lại root cause và recommendation khi action trước FAILED hoặc PARTIAL
├── Determine root cause
├── Generate evidence
├── Severity + confidence
├── Explanation
└── Đúng một recommendation
```

AI Backend không thu thập metrics, không tạo `incident_id`, không chạy Rule Engine, không truy vấn/lưu Incident History, không chạy Policy Engine/Executor, không thực thi restart/scale/rollback và không tạo kết quả Post-Action Verification.

## GRU Multi-Label 8-feature

Checkpoint hiện tại nhận chính xác `12 timestep × 8 feature`. Một GRU chung và Shared Dense cấp dữ liệu cho 6 Risk Head nhị phân riêng. API áp dụng `Sigmoid` lên mỗi logit để tạo confidence. Đây là multi-label classification: nhiều risk có thể đồng thời dương tính.

Thứ tự feature được đọc và kiểm tra trực tiếp từ checkpoint:

```text
cpu, ram, disk, request_rate, latency, http_5xx_rate, pod_restart_count, replica_count
```

API bắt buộc đúng 12 timestep, không padding một điểm thành chuỗi giả. Khi inference, GRU phân tích xu hướng của toàn bộ vector 8 feature trong cả chuỗi; model không học thêm tại `/predict`. Không có quan hệ một-một kiểu một feature chỉ quyết định một risk.

Sáu output là `CPU_OVERLOAD`, `OOM`, `DISK_FULL`, `HIGH_LATENCY`, `HTTP_5XX_SPIKE`, `TRAFFIC_OVERLOAD`; mỗi output chỉ có `confidence`. Backend dùng threshold riêng cho từng risk đã được chọn trên validation và lưu trong checkpoint. Confidence dưới threshold tương ứng không xuất hiện trong `detected_risks`; `risk_outputs` vẫn luôn trả đủ sáu kết quả. GRU nhận đúng tám feature đã liệt kê; các dependency metric không thuộc input model.

## Chạy local

```powershell
cd D:\NCKH\ai-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Swagger: `http://localhost:8000/docs`  
Health: `http://localhost:8000/health`

## Cấu hình OpenAI RCA

Không ghi API key vào source code. Tạo `.env` từ `.env.example`, sau đó đặt:

```dotenv
OPENAI_API_KEY=your_project_api_key
OPENAI_MODEL=gpt-5-mini
OPENAI_TIMEOUT_SECONDS=30
```

Chạy Uvicorn với file môi trường:

```powershell
uvicorn app.main:app --reload --env-file .env
```

Khi key hợp lệ, `/health` trả `"rca_provider": "openai"`. Nếu không có key hoặc OpenAI lỗi/timeout, `/rca` tự dùng deterministic RCA để không làm gián đoạn phân tích sự cố. OpenAI chỉ nhận incident evidence đã lọc; `store=false` được dùng khi gọi Responses API.

## Prediction API

`POST /api/v1/predict`

Endpoint này dùng khi Main Backend chỉ cần dự đoán GRU độc lập, chưa cần RCA. Với luồng RCA, Main Backend có thể truyền nguyên prediction đã có vào `/rca`; nếu chưa gọi `/predict`, `/rca` có thể tự chạy GRU khi nhận `metric_sequence`. Khi cả `prediction` và `metric_sequence` cùng có mặt, RCA ưu tiên prediction đã được cung cấp.

```json
{
  "service_id": "payment-service",
  "sequence": [
    {
      "cpu": 55,
      "ram": 50,
      "disk": 42,
      "request_rate": 500,
      "latency": 180,
      "http_5xx_rate": 0.5,
      "pod_restart_count": 0,
      "replica_count": 3
    }
  ]
}
```

`sequence` trong request thật phải có đúng 12 object như trên và mỗi object phải có đủ 8 feature GRU. Schema dùng `extra="forbid"`, vì vậy thiếu feature hoặc gửi thêm field đều bị từ chối. Response là multi-label: `detected_risks` là kết quả chính và có thể chứa nhiều risk; `risk_outputs` luôn trả đủ cả 6 head. Mọi head có confidence lớn hơn hoặc bằng threshold phải xuất hiện trong `detected_risks`; head dưới threshold không xuất hiện trong danh sách này. Không có một `risk_type` duy nhất ở cấp ngoài cùng.

```json
{
  "service_id": "payment-service",
  "threshold": 0.79,
  "thresholds": {
    "CPU_OVERLOAD": 0.81,
    "OOM": 0.50,
    "DISK_FULL": 0.85,
    "HIGH_LATENCY": 0.62,
    "HTTP_5XX_SPIKE": 0.81,
    "TRAFFIC_OVERLOAD": 0.85
  },
  "detected_risks": [
    {
      "risk_type": "HIGH_LATENCY",
      "confidence": 0.94
    }
  ],
  "risk_outputs": {
    "CPU_OVERLOAD": {"confidence": 0.12},
    "OOM": {"confidence": 0.08},
    "DISK_FULL": {"confidence": 0.04},
    "HIGH_LATENCY": {"confidence": 0.94},
    "HTTP_5XX_SPIKE": {"confidence": 0.15},
    "TRAFFIC_OVERLOAD": {"confidence": 0.21}
  }
}
```

`threshold=0.79` được giữ làm fallback tương thích. Checkpoint tối ưu lưu thêm `thresholds` riêng cho sáu risk; map này là nguồn chính để lọc `detected_risks`. `GRU_RISK_THRESHOLD` là override có chủ đích và khi được cấu hình sẽ thay thế đồng loạt mọi per-risk threshold.

## RCA API

`POST /api/v1/rca`. Thứ tự ưu tiên nguồn dự đoán là: (1) có `prediction` thì dùng nguyên response `/predict`; (2) nếu không có `prediction` nhưng có đủ `risk_type + confidence` thì dùng cặp rút gọn đó; (3) nếu không có hai nguồn trên nhưng có `metric_sequence` thì RCA tự chạy GRU. Nếu không có nguồn nào, RCA vẫn phân tích metrics/logs/Kubernetes nhưng **không chạy GRU từ một metric hiện tại**, vì một điểm không phải chuỗi thời gian. Khi gửi `prediction`, `risk_outputs` bắt buộc chứa đủ cả 6 risk giống response `/predict`.

Input tối thiểu chỉ gồm `service_id` và `metrics`. Các field optional là `risk_type`, `confidence`, `pod_id`, `logs`, `rule_engine`, `kubernetes`, `kubernetes_events`, `deployment`, `health_check`, `prediction`, `metric_sequence`, `security`, `security_policy`, `previous_action`, `previous_action_result`, `previous_action_result_source`, `previous_rca_root_cause` và `historical_incidents`. `pod_restart_count` và `replica_count` chỉ nằm trong object `metrics`, không tồn tại ở cấp ngoài cùng. `company_id`, `cluster_id`, current `incident_id`, authorization và history storage/retrieval thuộc Main Backend, không nằm trong RCA request schema.

`security` là evidence optional; `security_policy` là ngưỡng chính thức do Main Backend/Policy Engine quản lý và gửi vào. Schema chính:

```json
{
  "security": {
    "source_ip": "203.0.113.10",
    "request_rate": 250,
    "failed_auth_count": 45,
    "request_anomaly": true,
    "auth_anomaly": true
  },
  "security_policy": {
    "request_threshold": 100,
    "failed_auth_threshold": 10,
    "failed_auth_window_seconds": 60
  }
}
```

`http_401_rate` và `http_403_rate` có thể gửi thêm làm context. `request_threshold` có đơn vị requests/second; `failed_auth_threshold` là số failed authentication attempts trong `failed_auth_window_seconds`. AI Backend chỉ sử dụng policy được cung cấp để kiểm tra `TEMPORARY_IP_BLOCK`; nó không sở hữu hay tự đặt threshold. Nếu thiếu `security_policy` hoặc security evidence không đủ, server không cho phép `TEMPORARY_IP_BLOCK` và dùng action khác được RCA deterministic suy ra từ evidence hiện tại; chỉ trả `NO_ACTION` khi không có action nào khác đủ bằng chứng. AI Backend không tự block IP.

```json
{
  "service_id": "payment-service",
  "pod_id": "payment-abc123",
  "metrics": {
    "cpu": 35,
    "ram": 50,
    "disk": 65,
    "request_rate": 500,
    "latency": 2500,
    "http_5xx_rate": 15
  },
  "logs": ["ERROR Readiness probe failed while serving requests"],
  "rule_engine": ["HIGH_LATENCY detected", "HTTP 5xx rate is high"],
  "kubernetes": {
    "pod_status": "Running",
    "restart_count": 2,
    "events": ["Readiness probe failed"],
    "desired_replicas": 3,
    "available_replicas": 3
  },
  "prediction": null
}
```

Ví dụ response khi không gửi `metric_sequence` hoặc `prediction`:

```json
{
  "service_id": "payment-service",
  "prediction": null,
  "root_cause": {
    "cause": "Unstable application pod",
    "confidence": 0.775,
    "severity": "HIGH"
  },
  "evidence": [
    "ERROR Readiness probe failed while serving requests",
    "Readiness probe failed"
  ],
  "recommendation": {
    "action": "RESTART_POD",
    "reason": "The affected pod is unhealthy or repeatedly restarting",
    "priority": "HIGH"
  },
  "explanation": "Current incident evidence most strongly supports Unstable application pod.",
  "historical_context_used": false,
  "similar_incident_ids": []
}
```

### Historical Incident Memory

`historical_incidents` là bộ nhớ ngoài do Main Backend gửi kèm từng request; AI Backend không tự lưu incident và không retrain GRU/LLM từ dữ liệu này. Request cũ không có history vẫn hợp lệ.

```json
{
  "previous_action": "SCALE_REPLICAS",
  "previous_action_result": "FAILED",
  "previous_action_result_source": "POST_ACTION_VERIFICATION",
  "previous_rca_root_cause": "TRAFFIC_OVERLOAD",
  "historical_incidents": [
    {
      "incident_id": "INC-105",
      "service_id": "payment-service",
      "predicted_root_cause": "TRAFFIC_OVERLOAD",
      "confirmed_root_cause": "UNHEALTHY_POD",
      "confirmation_source": "DEVOPS",
      "executed_action": "SCALE_REPLICAS",
      "action_result": "FAILED",
      "action_result_source": "POST_ACTION_VERIFICATION",
      "evidence": ["Readiness probe failed", "HTTP 5xx rate increased"],
      "operator_feedback": "Scaling did not fix the problem"
    },
    {
      "incident_id": "INC-106",
      "service_id": "payment-service",
      "confirmed_root_cause": "UNHEALTHY_POD",
      "confirmation_source": "VERIFIED_EVIDENCE",
      "executed_action": "RESTART_POD",
      "action_result": "SUCCESS",
      "action_result_source": "POST_ACTION_VERIFICATION",
      "evidence": ["Readiness probe failed", "Pod became healthy after restart"]
    }
  ]
}
```

AI Backend phân tích evidence hiện tại trước, sau đó chỉ chọn incident cũ có signal/cause tương đồng. `confirmed_root_cause` chỉ hợp lệ khi `confirmation_source` là `DEVOPS`, `MANUAL_INVESTIGATION` hoặc `VERIFIED_EVIDENCE`; đây là dữ liệu đã được hệ thống khác xác nhận rồi gửi vào, AI Backend không tự xác nhận. Không được lấy output LLM cũ rồi tự gắn nhãn confirmed. Nếu action trước `FAILED` hoặc `PARTIAL`, RCA đánh giá lại root cause và recommendation, đồng thời không ưu tiên lặp lại action đó khi chưa có evidence mới đủ mạnh. Một action lịch sử từng `SUCCESS` chỉ hỗ trợ explanation, không tự động thay thế recommendation được suy ra từ incident hiện tại. Output bổ sung:

Khi request hiện tại có `previous_action_result = FAILED`, RCA đưa sự kiện này vào evidence theo dạng `Previous <ACTION> action result was FAILED`. Nhờ đó recommendation đổi sang action khác, ví dụ từ `RESTART_POD` sang `REPLACE_POD`, có căn cứ rõ ràng trong response.

```json
{
  "historical_context_used": true,
  "similar_incident_ids": ["INC-105", "INC-106"],
  "explanation": "Current pod-health evidence contradicts the previous traffic-only diagnosis; similar confirmed incidents support pod remediation."
}
```

`action_result` chỉ nhận `SUCCESS`, `FAILED`, `PARTIAL` hoặc `UNKNOWN` và phải do `POST_ACTION_VERIFICATION` cung cấp. LLM/RCA không tự kết luận action đã thành công hay thất bại. History chỉ cung cấp context để cải thiện phân tích, không phải cơ chế tự học hoặc retrain model.

Trong capstone hiện tại, Main Backend gửi `historical_incidents` trực tiếp trong request. AI Backend chỉ chọn incident tương tự rồi đưa chúng vào RCA context. Nếu sau này dùng Database/Vector DB, việc truy vấn và quản lý history thuộc Main Backend hoặc một dịch vụ History bên ngoài, không phải capability hiện tại của AI Backend.

### Post-Action Verification (ngoài AI Backend)

```text
Policy Engine cho phép action
        ↓
Self-Healing Executor thực thi
        ↓
Verification Agent thu thập metrics / health / Kubernetes sau action
        ↓
Main Backend/Post-Action Verification xác định SUCCESS / FAILED / PARTIAL / UNKNOWN
        ↓
DevOps hoặc verification đáng tin cậy xác nhận root cause
        ↓
Database/History Store lưu incident
        ↓
RCA lần sau sử dụng lại historical context
```

Verification không thuộc AI Backend. AI Backend chỉ nhận kết quả verification, phân tích và đưa recommendation.

### Ranh giới trách nhiệm

| Thành phần | Trách nhiệm |
|---|---|
| GRU | Dự đoán risk type và confidence |
| RCA/OpenAI | Phân tích evidence, historical context và đưa recommendation |
| Policy Engine | Quyết định recommendation có được phép thực hiện không |
| Self-Healing Executor | Thực thi action đã được policy cho phép |
| Post-Action Verification | Đo lại hệ thống và xác định SUCCESS/FAILED/PARTIAL/UNKNOWN |
| Database/History Store | Lưu incident, verification và nguồn xác nhận |

Historical memory được mô tả là “RCA sử dụng historical incident context để cải thiện phân tích”, không phải LLM tự học hay tự cập nhật trọng số.

`recommendation.action` chỉ là đề xuất. AI Backend không restart, scale hoặc rollback; Main Backend/Policy Engine phải kiểm tra policy và quyết định có chuyển đề xuất sang Self-Healing Executor hay không.

## Test và Docker

```powershell
pytest -q
docker build -t ai-backend .
docker run --rm -p 8000:8000 ai-backend
```

Các biến môi trường nằm trong `.env.example`. Không có API key hard-code. OpenAI dùng Responses API + Pydantic Structured Outputs để giới hạn JSON schema và action enum; các guard phía server tiếp tục chặn rollback/IP block khi thiếu evidence bắt buộc.

Dataset hiện tại là synthetic và chỉ phù hợp xác minh kiến trúc/pipeline. Các metric rất cao trên dữ liệu này không chứng minh khả năng tổng quát hóa production; cần đánh giá lại trên metrics và incident thật trước khi tự động hóa quyết định.

## So sánh GRU và LSTM

Pipeline đối chứng LSTM nằm trong `D:\NCKH\trainLSTM`. LSTM dùng cùng dataset,
split, input `12 × 8`, sáu nhãn risk, seed, loss và threshold `0.79` với GRU.
Checkpoint và báo cáo LSTM chỉ phục vụ đánh giá; AI Backend production vẫn load GRU.
Kết quả tổng hợp nằm trong `D:\NCKH\trainLSTM\gru_lstm_comparison.json`.

## Giới hạn an toàn

Ứng dụng không chứa Kubernetes client, không lưu lịch sử metrics/logs, không quản lý user/company và không có endpoint thực thi action. `RESTART_POD`, `SCALE_REPLICAS`, `ROLLBACK_DEPLOYMENT`… chỉ là enum trong response khuyến nghị.
