# SelfHeal Kubernetes Agent (v0.1)

AI-driven proactive self-healing infrastructure platform for SMEs running containerized applications on Kubernetes.

> **Status:** Agent v0.1 Foundation  
> **Scope:** Configuration loading, authentication, structured logging, heartbeat telemetry, and read-only Kubernetes cluster discovery. Destructive operations (patch/delete/restart) and automated AI decisions are strictly excluded in v0.1.

---

## 1. Architecture Overview

```
selfheal-agent/
├── app/
│   ├── main.py                     # Lifecycle orchestration & OS signal handling
│   ├── config/
│   │   ├── constants.py            # Enums (KubernetesMode, AgentStatus) & constants
│   │   └── settings.py             # Pydantic Settings with SecretStr token protection
│   ├── logging/
│   │   └── logger.py               # Structured JSON/Text logging with secret redacting
│   ├── auth/
│   │   └── agent_auth.py           # Header generation & token masking
│   ├── transport/
│   │   ├── models.py               # Pydantic Heartbeat schemas (camelCase/snake_case)
│   │   └── backend_client.py       # Asynchronous HTTP client (httpx + tenacity retry)
│   ├── heartbeat/
│   │   └── heartbeat_service.py    # Resilient background periodic pulse loop
│   └── kubernetes/
│       └── client.py               # Official K8s client (LOCAL & IN_CLUSTER modes)
├── tests/
│   └── test_agent.py               # Unit tests verifying resilience, secrets, and DTOs
├── .env.example                    # Template environment file
├── requirements.txt                # Python dependencies
└── README.md
```

## 2. Core Responsibilities (v0.1)

1. **Secure Configuration**: Loads environment variables using `pydantic-settings`. Sensitive tokens (`SELFHEAL_AGENT_TOKEN`) are wrapped in `SecretStr` and automatically redacted from logs.
2. **Structured Logging**: Outputs UTC timestamps, log level, module, function, line number, and sanitized messages in JSON or console text format.
3. **Resilient Backend Communication**: Communicates asynchronously with the SelfHeal Backend API via `httpx`. Transient network drops and 5xx errors trigger exponential backoff retries via `tenacity`.
4. **Heartbeat Telemetry**: Sends periodic pulses containing `agentId`, `agentVersion`, `status`, `reportedAt`, and cluster connectivity metadata. Temporary backend downtime **does not crash** the agent.
5. **Kubernetes Integration**: Supports both local kubeconfig development (`LOCAL`) and in-cluster Pod service accounts (`IN_CLUSTER`). Exposes read-only discovery foundations.

## 3. Configuration Reference

| Environment Variable | Type | Default | Description |
|---|---|---|---|
| `SELFHEAL_BACKEND_URL` | string | `http://localhost:8000` | Backend API root URL |
| `SELFHEAL_AGENT_ID` | string | *Required* | Unique Agent ID |
| `SELFHEAL_AGENT_TOKEN` | string (secret) | *Required* | Agent Auth Token (Bearer) |
| `SELFHEAL_HEARTBEAT_INTERVAL` | int | `10` | Heartbeat pulse interval (seconds) |
| `SELFHEAL_KUBERNETES_MODE` | enum | `LOCAL` | `LOCAL` or `IN_CLUSTER` |
| `KUBECONFIG_PATH` | string | `None` | Path to custom kubeconfig (LOCAL mode) |
| `HTTP_CONNECT_TIMEOUT` | float | `5.0` | Connection timeout (seconds) |
| `HTTP_REQUEST_TIMEOUT` | float | `10.0` | Read/request timeout (seconds) |
| `LOG_LEVEL` | string | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `LOG_FORMAT` | string | `json` | `json` or `text` |

## 4. Running the Agent

### Local Development
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env

# 3. Start Agent
export PYTHONPATH=.
python app/main.py
```

### Running Tests
```bash
pytest tests/ -v
```
