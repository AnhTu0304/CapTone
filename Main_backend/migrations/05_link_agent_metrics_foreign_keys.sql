-- ====================================================================
-- Migration: 05_link_agent_metrics_foreign_keys.sql
-- Mô tả: Nối khóa ngoại (Foreign Keys) cho bảng agent_metrics trỏ đến
--       agents(id), clusters(id) và các tài nguyên liên quan.
-- ====================================================================

DO $$
BEGIN
    -- 1. Đảm bảo cột namespace_id, service_id, pod_id tồn tại
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_metrics' AND column_name = 'namespace_id') THEN
        ALTER TABLE agent_metrics ADD COLUMN namespace_id UUID;
    END IF;

    -- 2. Đồng bộ cluster_id từ dạng tên sang UUID cluster tương ứng nếu có
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'agent_metrics' AND column_name = 'cluster_id') != 'uuid' THEN
        -- Map 'cluster-k8s-sme-01' về UUID nếu tồn tại
        UPDATE agent_metrics m
        SET cluster_id = c.id::text
        FROM clusters c
        WHERE m.cluster_id = c.name
          AND m.cluster_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

        ALTER TABLE agent_metrics 
        ALTER COLUMN cluster_id TYPE UUID USING (
            CASE 
                WHEN cluster_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN cluster_id::uuid 
                ELSE NULL 
            END
        );
    END IF;

    -- 3. Chuyển agent_id sang UUID
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'agent_metrics' AND column_name = 'agent_id') != 'uuid' THEN
        ALTER TABLE agent_metrics 
        ALTER COLUMN agent_id TYPE UUID USING (
            CASE 
                WHEN agent_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN agent_id::uuid 
                ELSE NULL 
            END
        );
    END IF;

    -- 4. Xóa ràng buộc cũ nếu có
    ALTER TABLE agent_metrics DROP CONSTRAINT IF EXISTS fk_agent_metrics_agent;
    ALTER TABLE agent_metrics DROP CONSTRAINT IF EXISTS fk_agent_metrics_cluster;

    -- 5. Nối khóa ngoại tới bảng agents và clusters
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') THEN
        DELETE FROM agent_metrics WHERE agent_id IS NOT NULL AND agent_id NOT IN (SELECT id FROM agents);
        ALTER TABLE agent_metrics
            ADD CONSTRAINT fk_agent_metrics_agent
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clusters') THEN
        DELETE FROM agent_metrics WHERE cluster_id IS NOT NULL AND cluster_id NOT IN (SELECT id FROM clusters);
        ALTER TABLE agent_metrics
            ADD CONSTRAINT fk_agent_metrics_cluster
            FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE;
    END IF;

    -- 6. Nếu bảng services và pods tồn tại (ở schema đầy đủ), nối tiếp khóa ngoại
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
        ALTER TABLE agent_metrics DROP CONSTRAINT IF EXISTS fk_agent_metrics_service;
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'agent_metrics' AND column_name = 'service_id') = 'uuid' THEN
            ALTER TABLE agent_metrics
                ADD CONSTRAINT fk_agent_metrics_service
                FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pods') THEN
        ALTER TABLE agent_metrics DROP CONSTRAINT IF EXISTS fk_agent_metrics_pod;
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'agent_metrics' AND column_name = 'pod_id') = 'uuid' THEN
            ALTER TABLE agent_metrics
                ADD CONSTRAINT fk_agent_metrics_pod
                FOREIGN KEY (pod_id) REFERENCES pods(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 7. Indexes tối ưu hiệu năng
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_cluster ON agent_metrics(cluster_id);
