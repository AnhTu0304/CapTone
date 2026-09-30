# =============================================================================
# Stage 1: Base & Dependencies
# =============================================================================
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install root CA certificates for secure HTTPS backend/k8s communication
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# =============================================================================
# Stage 2: Test Runner (Automated CI Verification)
# =============================================================================
FROM base AS test
RUN pip install --no-cache-dir pytest pytest-asyncio
COPY app ./app
COPY tests ./tests
RUN pytest tests/ -v

# =============================================================================
# Stage 3: Production Runtime (Hardened Non-root Daemon)
# =============================================================================
FROM base AS runner

# Create dedicated non-root user and group
RUN groupadd -g 10001 agentgroup && \
    useradd -u 10001 -g agentgroup -s /bin/sh -m agentuser

# Copy application code with non-root ownership
COPY --chown=agentuser:agentgroup app ./app

# Default runtime configuration
ENV SELFHEAL_BACKEND_URL=http://main-backend:5000 \
    SELFHEAL_KUBERNETES_MODE=IN_CLUSTER \
    SELFHEAL_HEARTBEAT_INTERVAL=10 \
    LOG_LEVEL=INFO \
    LOG_FORMAT=json

USER agentuser

# Use python -m app.main to preserve standard module namespace resolution
ENTRYPOINT ["python", "-u", "-m", "app.main"]
