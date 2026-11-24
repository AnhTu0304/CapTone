-- Rollback: 32_sprint_d_tenant_integrity_constraints.sql
ALTER TABLE node_metrics ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE incidents ALTER COLUMN organization_id DROP NOT NULL;
