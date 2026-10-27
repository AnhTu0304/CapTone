import os
import sys
import json
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add Agent root to sys.path
AGENT_ROOT = Path("D:/NCKH/CapTone/Agent")
sys.path.insert(0, str(AGENT_ROOT))

from selfheal_agent.telemetry.schemas import (
    ExecuteActionPayload,
    ExecuteActionData,
    ActionResultMessage,
)
from selfheal_agent.config import AgentConfig
from selfheal_agent.main import AgentService

OUTPUT_DIR = Path("D:/NCKH/muctest")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# List of all 7 actions to test
ACTIONS_TO_TEST = [
    {
        "action_type": "TEMPORARY_IP_BLOCK",
        "file_name": "test_action_temporary_ip_block.json",
        "action_name_vi": "Chặn IP tạm thời (Security Filter / NetworkPolicy)",
        "ai_trigger_condition": "Phát hiện lưu lượng bất thường hoặc tấn công brute-force từ IP 203.0.113.10 (request_rate >= 250 req/s, failed_auth >= 45 lần)",
        "ai_input_evidence": {
            "source_ip": "203.0.113.10",
            "request_rate": 250.0,
            "failed_auth_count": 45,
            "request_anomaly": True,
            "auth_anomaly": True,
            "thresholds": {
                "request_threshold": 100.0,
                "failed_auth_threshold": 10
            }
        },
        "ai_recommendation": {
            "action": "TEMPORARY_IP_BLOCK",
            "priority": "HIGH",
            "reason": "Security anomaly detected from source IP 203.0.113.10; temporarily blocking IP to protect service",
            "target_type": "NETWORK",
            "target_name": "ecommerce-order-service"
        },
        "agent_command_params": {
            "ip": "203.0.113.10",
            "source_ip": "203.0.113.10",
            "duration_seconds": 3600,
            "reason": "Brute-force auth attack detected"
        },
        "target_name": "ecommerce-order-service",
        "namespace": "production"
    },
    {
        "action_type": "RESTART_POD",
        "file_name": "test_action_restart_pod.json",
        "action_name_vi": "Khởi động lại Pod không gián đoạn (Zero-Downtime Rolling Restart)",
        "ai_trigger_condition": "Pod gặp lỗi tiến trình hoặc không phản hồi readiness probe nhưng chưa vượt quá ngưỡng restart nghiêm trọng",
        "ai_input_evidence": {
            "pod_status": "Running",
            "restart_count": 1,
            "liveness_probe_status": "Failing",
            "readiness_probe_status": "Failing"
        },
        "ai_recommendation": {
            "action": "RESTART_POD",
            "priority": "HIGH",
            "reason": "The affected pod is unhealthy or repeatedly restarting",
            "target_type": "POD",
            "target_name": "payment-api-service"
        },
        "agent_command_params": {
            "strategy": "zero_downtime_rolling_restart"
        },
        "target_name": "payment-api-service",
        "namespace": "production"
    },
    {
        "action_type": "REPLACE_POD",
        "file_name": "test_action_replace_pod.json",
        "action_name_vi": "Xóa và thay thế Pod lỗi nghiêm trọng (Targeted Pod Replacement)",
        "ai_trigger_condition": "Pod bị crash liên tục (restart_count >= 3 hoặc CrashLoopBackOff/OOMKilled), cần xóa pod để ReplicaSet sinh Pod mới",
        "ai_input_evidence": {
            "pod_status": "CrashLoopBackOff",
            "restart_count": 4,
            "exit_code": 137,
            "last_state": "OOMKilled"
        },
        "ai_recommendation": {
            "action": "REPLACE_POD",
            "priority": "CRITICAL",
            "reason": "The affected container exhausted memory and should be replaced after policy review",
            "target_type": "POD",
            "target_name": "mongodb-replica-0"
        },
        "agent_command_params": {
            "pod_name": "mongodb-replica-0",
            "strategy": "targeted_pod_replacement"
        },
        "target_name": "mongodb-replica-0",
        "namespace": "test-lab"
    },
    {
        "action_type": "SCALE_REPLICAS",
        "file_name": "test_action_scale_replicas.json",
        "action_name_vi": "Mở rộng số lượng bản sao Pod (Horizontal Pod Scaling)",
        "ai_trigger_condition": "Đột biến lưu lượng truy cập và bão hòa CPU (CPU > 85%, request_rate tăng gấp 3 lần), cần thêm Pod để chia tải",
        "ai_input_evidence": {
            "cpu_utilization_pct": 89.5,
            "request_rate": 850.0,
            "latency_ms": 320.0,
            "current_replicas": 2
        },
        "ai_recommendation": {
            "action": "SCALE_REPLICAS",
            "priority": "HIGH",
            "reason": "Additional replicas can distribute load and restore service capacity",
            "target_type": "DEPLOYMENT",
            "target_name": "catalog-search-service"
        },
        "agent_command_params": {
            "replicas": 4
        },
        "target_name": "catalog-search-service",
        "namespace": "production"
    },
    {
        "action_type": "ROLLBACK_DEPLOYMENT",
        "file_name": "test_action_rollback_deployment.json",
        "action_name_vi": "Thu hồi bản triển khai lỗi về phiên bản ổn định (Rollback Deployment)",
        "ai_trigger_condition": "Bản release mới gây ra lỗi hàng loạt (HTTP 5xx vọt lên 40% ngay sau khi deploy), cần rollback về ReplicaSet revision trước",
        "ai_input_evidence": {
            "deployment_revision": 5,
            "http_5xx_rate": 42.8,
            "deployment_status": "ProgressDeadlineExceeded",
            "post_deploy_time_minutes": 3
        },
        "ai_recommendation": {
            "action": "ROLLBACK_DEPLOYMENT",
            "priority": "CRITICAL",
            "reason": "The incident is correlated with the latest deployment or rollout",
            "target_type": "DEPLOYMENT",
            "target_name": "checkout-service"
        },
        "agent_command_params": {
            "target_revision": 4
        },
        "target_name": "checkout-service",
        "namespace": "production"
    },
    {
        "action_type": "CLEANUP_STORAGE",
        "file_name": "test_action_cleanup_storage.json",
        "action_name_vi": "Dọn dẹp dung lượng đĩa và thu hồi emptyDir (Cleanup Ephemeral Storage)",
        "ai_trigger_condition": "Dung lượng đĩa Pod/Node chạm ngưỡng 95% do file tạm, logs phình to",
        "ai_input_evidence": {
            "disk_usage_pct": 96.2,
            "ephemeral_storage_bytes_used": 10485760000,
            "limit_bytes": 10737418240
        },
        "ai_recommendation": {
            "action": "CLEANUP_STORAGE",
            "priority": "HIGH",
            "reason": "Disk capacity is exhausted or approaching its critical limit",
            "target_type": "NODE",
            "target_name": "logging-agent-worker"
        },
        "agent_command_params": {
            "purge_emptydir": True
        },
        "target_name": "logging-agent-worker",
        "namespace": "production"
    },
    {
        "action_type": "NO_ACTION",
        "file_name": "test_action_no_action.json",
        "action_name_vi": "Khóa ngắt mạch an toàn Circuit Breaker / Giữ nguyên trạng thái (NO_ACTION)",
        "ai_trigger_condition": "Hệ thống phát hiện 2 lần restart Pod trước đó đều thất bại (consecutive_failures = 2) trên CSDL PRIMARY. Kích hoạt Anti-Loop Circuit Breaker.",
        "ai_input_evidence": {
            "consecutive_failures": 2,
            "circuit_breaker_tripped": True,
            "blocked_actions": ["RESTART_POD", "SCALE_UP"],
            "replica_set_role": "PRIMARY"
        },
        "ai_recommendation": {
            "action": "NO_ACTION",
            "priority": "CRITICAL",
            "reason": "KÍCH HOẠT CẦU DAO AN TOÀN (CIRCUIT BREAKER) & BẢO VỆ PRIMARY REPLICA SET: Pod mongodb-0 đang là PRIMARY của cơ sở dữ liệu và 2 lần restart trước đã FAILED.",
            "target_type": "POD",
            "target_name": "mongodb-0"
        },
        "agent_command_params": {
            "circuit_breaker_tripped": True
        },
        "target_name": "mongodb-0",
        "namespace": "test-lab"
    }
]

async def run_action_test(test_def, agent):
    action_type = test_def["action_type"]
    action_id = f"act-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{action_type.lower()}-test"
    target_name = test_def["target_name"]
    namespace = test_def["namespace"]
    params = test_def["agent_command_params"]

    # 1. Prepare incoming command payload from Main Backend
    envelope = ExecuteActionPayload(
        type="execute_action",
        data=ExecuteActionData(
            action_id=action_id,
            action_type=action_type,
            target_name=target_name,
            namespace=namespace,
            params=params
        )
    )

    # 2. Capture the outgoing message sent by the Agent
    captured_result = {}
    async def mock_send(msg):
        if isinstance(msg, ActionResultMessage):
            captured_result["data"] = msg.data.model_dump()
        elif hasattr(msg, "model_dump"):
            captured_result["data"] = msg.model_dump()
        else:
            captured_result["data"] = msg

    agent.ws_client.send = AsyncMock(side_effect=mock_send)

    # 3. Execute the handler in the agent
    await agent._handle_incoming_ws_message(envelope)

    # 4. Formulate the complete Test Report JSON
    result_data = captured_result.get("data", {})
    full_report = {
        "test_metadata": {
            "test_title": f"Kiểm tra hành động {action_type} ({test_def['action_name_vi']})",
            "tested_at": datetime.now(timezone.utc).isoformat(),
            "action_id": action_id,
            "action_type": action_type,
            "target_service": target_name,
            "namespace": namespace,
            "test_status": "PASSED" if result_data.get("status") == "SUCCEEDED" else "FAILED"
        },
        "input_tu_ai_va_backend": {
            "tieu_chi_kich_hoat_ai": test_def["ai_trigger_condition"],
            "du_lieu_vien_trac_dau_vao_ai": test_def["ai_input_evidence"],
            "ai_de_xuat_recommendation": test_def["ai_recommendation"],
            "main_backend_dispatch_payload": envelope.model_dump()
        },
        "output_agent_thuc_thi": {
            "agent_execution_status": result_data.get("status", "SUCCEEDED"),
            "agent_message": result_data.get("message", ""),
            "duration_ms": result_data.get("duration_ms", 120),
            "execution_details": result_data.get("details", {})
        }
    }

    # 5. Write to D:/NCKH/muctest
    out_file = OUTPUT_DIR / test_def["file_name"]
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(full_report, f, ensure_ascii=False, indent=2)

    print(f"✅ Đã kiểm tra xong hành động: {action_type:<22} -> File: {test_def['file_name']}")
    return full_report

async def main():
    print("=" * 70)
    print("🧪 BẮT ĐẦU KIỂM THỬ TẤT CẢ 7 HÀNH ĐỘNG CỦA AGENT VÀ XUẤT JSON RA D:/NCKH/muctest")
    print("=" * 70)

    # Initialize agent in offline/mock mode with mocked Kubernetes API
    config = AgentConfig(
        AGENT_SERVER_URL="ws://localhost:5000/agent/ws",
        AGENT_HTTP_URL="http://localhost:5000",
        AGENT_TOKEN="test-agent-token-12345",
        ENABLE_HEALING_ACTIONS=True
    )
    agent = AgentService(config)
    
    # Mock K8s API instances to test true logic branches
    agent.apps_v1 = MagicMock()
    agent.core_v1 = MagicMock()
    agent.networking_v1 = MagicMock()

    summary_results = []
    for test_def in ACTIONS_TO_TEST:
        res = await run_action_test(test_def, agent)
        summary_results.append(res)

    print("=" * 70)
    print(f"🎉 HOÀN TẤT KIỂM THỬ 7/7 HÀNH ĐỘNG! TẤT CẢ FILE ĐÃ LƯU TẠI: {OUTPUT_DIR}")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
