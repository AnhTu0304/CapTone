-- Ensure deployments(workload_id) has a unique index for ON CONFLICT (workload_id) upserts
CREATE UNIQUE INDEX IF NOT EXISTS uq_deployments_workload_id ON public.deployments (workload_id);
