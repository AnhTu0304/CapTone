import json
from datetime import datetime, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app

RESULTS_DIR = Path(__file__).resolve().parent / "action_test_cases"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


ACTION_SCENARIOS = [
    {
        "id": "01",
        "action": "RESTART_POD",
        "filename": "01_action_RESTART_POD.json",
        "scenario_title": "Khởi động lại Pod đơn lẻ (Restart Pod)",
        "description": "Pod bị lỗi Readiness probe thất bại nhẹ, restart_count thấp (1 lần < 3). RCA đề xuất RESTART_POD để khởi động lại container bị treo.",
        "input": {
            "request_id": "req-20261026-restart-pod-001",
            "incident_id": "inc-20261026-restart-pod-001",
            "cluster_id": "cluster-prod-asia-01",
            "namespace": "production",
            "service_id": "payment-service",
            "workload_id": "wl-payment-svc-001",
            "workload_type": "Deployment",
            "suspected_pod_name": "payment-service-7c9d8f6b5-x2abc",
            "metrics": {
                "cpu": 35.0, "ram": 50.0, "disk": 40.0, "request_rate": 350.0,
                "latency": 150.0, "http_5xx_rate": 1.0, "pod_restart_count": 1, "replica_count": 3
            },
            "logs": ["ERROR Readiness probe failed while serving requests"],
            "kubernetes": {
                "pod_status": "Running",
                "restart_count": 1,
                "events": ["Readiness probe failed"],
                "desired_replicas": 3,
                "available_replicas": 3
            }
        }
    },
    {
        "id": "02",
        "action": "REPLACE_POD",
        "filename": "02_action_REPLACE_POD.json",
        "scenario_title": "Thay thế và tái tạo mới Pod (Replace Pod)",
        "description": "Pod bị CrashLoopBackOff liên tục với restart_count cao (4 lần >= 3). RCA đề xuất REPLACE_POD để Kubernetes hủy và tái tạo lại Pod hoàn toàn sạch.",
        "input": {
            "request_id": "req-20261026-replace-pod-002",
            "incident_id": "inc-20261026-replace-pod-002",
            "cluster_id": "cluster-prod-asia-01",
            "namespace": "production",
            "service_id": "order-service",
            "workload_id": "wl-order-svc-002",
            "workload_type": "Deployment",
            "suspected_pod_name": "order-service-67fb989c4-k98xz",
            "metrics": {
                "cpu": 40.0, "ram": 60.0, "disk": 35.0, "request_rate": 300.0,
                "latency": 200.0, "http_5xx_rate": 1.0, "pod_restart_count": 4, "replica_count": 2
            },
            "logs": ["FATAL CrashLoopBackOff: back-off 5m0s restarting failed container"],
            "kubernetes": {
                "pod_status": "CrashLoopBackOff",
                "restart_count": 4,
                "events": ["Back-off restarting failed container", "Pod is in CrashLoopBackOff"],
                "desired_replicas": 2,
                "available_replicas": 1
            }
        }
    },
    {
        "id": "03",
        "action": "RESTART_DEPLOYMENT",
        "filename": "03_action_RESTART_DEPLOYMENT.json",
        "scenario_title": "Khởi động lại toàn bộ Deployment (Restart Deployment)",
        "description": "Lỗi ứng dụng cấp hệ thống (Application errors / deadlock) xảy ra diện rộng trên toàn bộ Replicas của Deployment mà không có Pod crash riêng lẻ (restart_count: 0, HTTP 5xx: 15%). RCA đề xuất RESTART_DEPLOYMENT thực hiện rolling restart an toàn.",
        "input": {
            "request_id": "req-20261026-restart-depl-003",
            "incident_id": "inc-20261026-restart-depl-003",
            "cluster_id": "cluster-prod-asia-01",
            "namespace": "production",
            "service_id": "auth-service",
            "workload_id": "wl-auth-svc-003",
            "workload_type": "Deployment",
            "metrics": {
                "cpu": 45.0, "ram": 60.0, "disk": 30.0, "request_rate": 500.0,
                "latency": 250.0, "http_5xx_rate": 15.0, "pod_restart_count": 0, "replica_count": 3
            },
            "logs": ["ERROR HTTP 500 internal application error across all active sessions"],
            "kubernetes": {
                "pod_status": "Running",
                "restart_count": 0,
                "desired_replicas": 3,
                "available_replicas": 3,
                "deployment": {
                    "desired_replicas": 3,
                    "available_replicas": 3,
                    "version": "auth-v3.1.0"
                }
            }
        }
    },
    {
        "id": "04",
        "action": "SCALE_REPLICAS",
        "filename": "04_action_SCALE_REPLICAS.json",
        "scenario_title": "Tăng cường quy mô bản sao Workload (Scale Replicas)",
        "description": "Đỉnh tải giao dịch cao bất thường đẩy CPU lên 96.5% và số bản sao khả dụng thấp hơn yêu cầu. RCA đề xuất SCALE_REPLICAS tăng thêm pods để phân tải.",
        "input": {
            "request_id": "req-20261026-scale-replicas-004",
            "incident_id": "inc-20261026-scale-replicas-004",
            "cluster_id": "cluster-prod-asia-01",
            "namespace": "production",
            "service_id": "checkout-service",
            "workload_id": "wl-checkout-svc-004",
            "workload_type": "Deployment",
            "risk_type": "CPU_OVERLOAD",
            "confidence": 0.94,
            "metrics": {
                "cpu": 96.5, "ram": 78.0, "disk": 45.0, "request_rate": 1450.0,
                "latency": 920.0, "http_5xx_rate": 4.5, "pod_restart_count": 0, "replica_count": 2
            },
            "logs": ["High CPU usage detected"],
            "kubernetes": {
                "pod_status": "Running",
                "restart_count": 0,
                "desired_replicas": 4,
                "available_replicas": 2,
                "events": ["Available replicas (2) are lower than desired replicas (4)"]
            }
        }
    },
    {
        "id": "05",
        "action": "ROLLBACK_DEPLOYMENT",
        "filename": "05_action_ROLLBACK_DEPLOYMENT.json",
        "scenario_title": "Thu hồi phiên bản lỗi về bản cũ ổn định (Rollback Deployment)",
        "description": "Sự cố sập phát sinh ngay sau đợt cập nhật phiên bản mới (v1.8.2 lên v1.9.0) kèm Deployment failure events. RCA đề xuất ROLLBACK_DEPLOYMENT về phiên bản ổn định trước đó.",
        "input": {
            "request_id": "req-20261026-rollback-005",
            "incident_id": "inc-20261026-rollback-005",
            "cluster_id": "cluster-prod-asia-01",
            "namespace": "production",
            "service_id": "notification-service",
            "workload_id": "wl-notif-svc-005",
            "workload_type": "Deployment",
            "metrics": {
                "cpu": 45.0, "ram": 55.0, "disk": 35.0, "request_rate": 300.0,
                "latency": 200.0, "http_5xx_rate": 18.0, "pod_restart_count": 1, "replica_count": 2
            },
            "logs": ["ERROR Crash after new deployment v1.9.0"],
            "kubernetes": {
                "pod_status": "Running",
                "restart_count": 1,
                "events": ["Deployment rollout started for notification-v1.9.0", "Deploy failed"],
                "deployment": {
                    "desired_replicas": 2,
                    "available_replicas": 1,
                    "version": "notification-v1.9.0",
                    "previous_version": "notification-v1.8.2"
                }
            },
            "deployment": {
                "current_version": "notification-v1.9.0",
                "previous_version": "notification-v1.8.2",
                "deployed_at": "2026-10-26T17:30:00Z",
                "status": "degraded"
            }
        }
    },
    {
        "id": "06",
        "action": "CLEANUP_STORAGE",
        "filename": "06_action_CLEANUP_STORAGE.json",
        "scenario_title": "Dọn dẹp dung lượng ổ đĩa / PVC (Cleanup Storage)",
        "description": "Ổ đĩa hoặc PersistentVolumeClaim đạt ngưỡng cạn kiệt nghiêm trọng (98.5%), không thể ghi file log. RCA đề xuất CLEANUP_STORAGE dọn dẹp dung lượng.",
        "input": {
            "request_id": "req-20261026-cleanup-storage-006",
            "incident_id": "inc-20261026-cleanup-storage-006",
            "cluster_id": "cluster-prod-asia-01",
            "namespace": "production",
            "service_id": "logging-service",
            "workload_id": "wl-logging-svc-006",
            "workload_type": "StatefulSet",
            "suspected_pod_name": "logging-service-es-0",
            "metrics": {
                "cpu": 38.0, "ram": 55.0, "disk": 98.5, "request_rate": 250.0,
                "latency": 150.0, "http_5xx_rate": 0.5, "pod_restart_count": 0, "replica_count": 2
            },
            "logs": ["ERROR No space left on device while writing application log"],
            "kubernetes": {
                "pod_status": "Running",
                "restart_count": 0,
                "events": ["Storage capacity critical on PVC /data"]
            }
        }
    },
    {
        "id": "07",
        "action": "TEMPORARY_IP_BLOCK",
        "filename": "07_action_TEMPORARY_IP_BLOCK.json",
        "scenario_title": "Khóa tạm thời IP tấn công (Temporary IP Block)",
        "description": "Phát hiện lưu lượng bất thường từ source IP (198.51.100.25) với 450 req/s và 55 lần xác thực thất bại, vượt ngưỡng Security Policy. RCA đề xuất TEMPORARY_IP_BLOCK.",
        "input": {
            "request_id": "req-20261026-temp-ip-block-007",
            "incident_id": "inc-20261026-temp-ip-block-007",
            "cluster_id": "cluster-prod-asia-01",
            "namespace": "production",
            "service_id": "gateway-api",
            "workload_id": "wl-gateway-svc-007",
            "workload_type": "Deployment",
            "metrics": {
                "cpu": 45.0, "ram": 50.0, "disk": 30.0, "request_rate": 300.0,
                "latency": 120.0, "http_5xx_rate": 0.0, "pod_restart_count": 0, "replica_count": 3
            },
            "security": {
                "source_ip": "198.51.100.25",
                "request_rate": 450.0,
                "failed_auth_count": 55,
                "request_anomaly": True,
                "auth_anomaly": True
            },
            "security_policy": {
                "request_threshold": 100.0,
                "failed_auth_threshold": 10,
                "failed_auth_window_seconds": 60
            }
        }
    },
    {
        "id": "08",
        "action": "NO_ACTION",
        "filename": "08_action_NO_ACTION_CIRCUIT_BREAKER.json",
        "scenario_title": "Ngắt mạch an toàn Circuit Breaker & Human-in-the-Loop",
        "description": "Sự cố MongoDB Replica Set OOM SIGKILL 137, Pod giữ vai trò PRIMARY, đã thử tự động cứu chữa 2 lần thất bại (consecutive_failures: 2). Kích hoạt Circuit Breaker chuyển quyền can thiệp thủ công (NO_ACTION, CRITICAL) kèm manual_playbook 3 bước failover rs.stepDown(60).",
        "input": {
            "request_id": "req-20261026-circuit-breaker-008",
            "incident_id": "inc-20261026-circuit-breaker-008",
            "cluster_id": "9ea1db42-7524-4238-8716-315cbe0d0b39",
            "namespace": "test-lab",
            "service_id": "mongodb",
            "workload_id": "wl-7788-99aa-bbcc-ddeeff001122",
            "workload_type": "StatefulSet",
            "suspected_pod_name": "mongodb-0",
            "risk_type": "OOM",
            "confidence": 0.94,
            "metrics": {
                "cpu": 45.2, "ram": 98.7, "disk": 34.0, "request_rate": 420.5,
                "latency": 850.0, "http_5xx_rate": 6.8, "pod_restart_count": 3, "replica_count": 3
            },
            "kubernetes": {
                "all_pods": [
                    {
                        "pod_name": "mongodb-0",
                        "status": "Running",
                        "restart_count": 3,
                        "termination": {"last_exit_code": 137, "reason": "OOMKilled"},
                        "mongodb_cluster_health": {"role": "PRIMARY", "quorum_status": "INTACT"}
                    }
                ]
            },
            "action_history": {
                "total_actions_recorded": 2,
                "consecutive_failures": 2,
                "circuit_breaker_tripped": True,
                "blocked_actions": ["RESTART_POD", "REPLACE_POD"]
            }
        }
    }
]


def _execute_and_persist(scenario: dict) -> dict:
    with TestClient(app) as client:
        resp = client.post("/api/v1/rca", json=scenario["input"])
    assert resp.status_code == 200, resp.text
    output = resp.json()

    # Validate correct action returned
    actual_action = output["recommendation"]["action"]
    assert actual_action == scenario["action"], (
        f"Expected action {scenario['action']}, but got {actual_action}"
    )

    # Persist specific action JSON file with full Input and Output
    target_path = RESULTS_DIR / scenario["filename"]
    doc = {
        "test_case_id": scenario["id"],
        "action_name": scenario["action"],
        "scenario_title": scenario["scenario_title"],
        "file_name": scenario["filename"],
        "test_status": "PASSED",
        "tested_at": datetime.now(timezone.utc).isoformat(),
        "description": scenario["description"],
        "input_payload": scenario["input"],
        "output_response": output
    }
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)

    return doc


@pytest.mark.parametrize("scenario", ACTION_SCENARIOS, ids=lambda s: s["action"])
def test_all_actions_input_output_persistence(scenario: dict):
    doc = _execute_and_persist(scenario)
    assert doc["test_status"] == "PASSED"
    assert doc["output_response"]["recommendation"]["action"] == scenario["action"]
    assert Path(RESULTS_DIR / scenario["filename"]).exists()


def test_master_summary_index_generation():
    summary_list = []
    for sc in ACTION_SCENARIOS:
        doc = _execute_and_persist(sc)
        summary_list.append({
            "id": sc["id"],
            "action": sc["action"],
            "file_name": sc["filename"],
            "scenario_title": sc["scenario_title"],
            "root_cause": doc["output_response"]["root_cause"]["cause"],
            "severity": doc["output_response"]["root_cause"]["severity"],
            "recommendation_priority": doc["output_response"]["recommendation"]["priority"],
            "target_type": doc["output_response"]["recommendation"].get("target_type"),
            "target_name": doc["output_response"]["recommendation"].get("target_name"),
            "status": "PASSED"
        })

    master_file = RESULTS_DIR / "00_master_all_actions_summary.json"
    master_doc = {
        "title": "Master Summary of All 8 RCA Self-Healing Actions",
        "total_actions_tested": len(summary_list),
        "all_passed": True,
        "tested_at": datetime.now(timezone.utc).isoformat(),
        "actions": summary_list
    }
    with open(master_file, "w", encoding="utf-8") as f:
        json.dump(master_doc, f, indent=2, ensure_ascii=False)

    assert master_file.exists()
    assert len(summary_list) == 8
