-- [S3][PB14] 5.2 – Status columns for Node / Pod / Deployment & Replica status API.
-- Populated by AgentService.syncClusterInventory from the Agent k8s_inventory stream (Task 5.1).
-- Idempotent; also applied at runtime by K8sStatusService.ensureStatusColumns().

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::JSONB;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS allocatable JSONB DEFAULT '{}'::JSONB;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;

ALTER TABLE pods ADD COLUMN IF NOT EXISTS containers JSONB DEFAULT '[]'::JSONB;
ALTER TABLE pods ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;

ALTER TABLE workloads ADD COLUMN IF NOT EXISTS desired_replicas INT;
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS ready_replicas INT;
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS available_replicas INT;
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS updated_replicas INT;
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS unavailable_replicas INT;
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS generation BIGINT;
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS observed_generation BIGINT;
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::JSONB;
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS rollout_status VARCHAR(50);
ALTER TABLE workloads ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;
