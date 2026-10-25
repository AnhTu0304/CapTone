import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import NodeMetricsChartsPanel from '../../../components/dashboard/NodeMetricsChartsPanel';
import { nodeService } from '../../../services/nodeService';
import { formatBytes, formatThroughput } from '../../../utils/nodeMetricsChartUtils';
import {
  Activity,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
} from 'lucide-react';

export const MetricsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [clusterNodes, setClusterNodes] = useState([]);
  const [latestNodeSnapshots, setLatestNodeSnapshots] = useState([]);

  const activeClusterId = currentEnv?.clusterId || currentEnv?.id || '';

  const loadClusterNodes = useCallback(async () => {
    if (!activeClusterId || activeClusterId.startsWith('org-') || activeClusterId.startsWith('sandbox-')) {
      setClusterNodes([]);
      return;
    }
    try {
      const nodes = await nodeService.getNodesByCluster(activeClusterId, currentOrg?.id);
      setClusterNodes(Array.isArray(nodes) ? nodes : []);
    } catch (err) {
      console.warn('[MetricsPage] Không thể tải danh sách Nodes:', err.message);
    }
  }, [activeClusterId, currentOrg?.id]);

  useEffect(() => {
    loadClusterNodes();
  }, [loadClusterNodes]);

  // Build per-node latest summary rows from real metrics + cluster nodes
  const handleRawMetricsLoaded = useCallback((items = []) => {
    if (!Array.isArray(items)) return;
    const latestByNode = new Map();
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!row?.node_name) continue;
      const prev = latestByNode.get(row.node_name);
      const rowTime = Date.parse(row.collected_at || '') || 0;
      const prevTime = prev ? Date.parse(prev.collected_at || '') || 0 : -1;
      if (rowTime >= prevTime) {
        latestByNode.set(row.node_name, row);
      }
    }
    setLatestNodeSnapshots(Array.from(latestByNode.values()));
  }, []);

  const tableRows = useMemo(() => {
    const snapMap = new Map();
    for (let i = 0; i < latestNodeSnapshots.length; i++) {
      const s = latestNodeSnapshots[i];
      snapMap.set(s.node_name, s);
    }

    const mergedNames = new Set([
      ...clusterNodes.map((n) => n.name).filter(Boolean),
      ...latestNodeSnapshots.map((s) => s.node_name).filter(Boolean),
    ]);

    const rows = Array.from(mergedNames).map((name) => {
      const nodeMeta = clusterNodes.find((n) => n.name === name);
      const snap = snapMap.get(name);

      const cpuPercent = snap ? Number(snap.cpu_usage_percent || 0) : 0;
      const cpuCores = snap
        ? `${snap.cpu_cores || 1} vCPU`
        : nodeMeta?.cpu_capacity_millicores
          ? `${Math.round(nodeMeta.cpu_capacity_millicores / 1000)} vCPU`
          : '—';

      const memPercent = snap ? Number(snap.ram_usage_percent || 0) : 0;
      const memText = snap
        ? `${formatBytes(snap.ram_used_bytes)} / ${formatBytes(snap.ram_total_bytes)}`
        : nodeMeta?.memory_capacity_bytes
          ? formatBytes(nodeMeta.memory_capacity_bytes)
          : '—';

      const diskPercent = snap ? Number(snap.disk_usage_percent || 0) : 0;
      const netRx = snap ? formatThroughput(snap.net_rx_bytes_per_sec) : '0 B/s';
      const netTx = snap ? formatThroughput(snap.net_tx_bytes_per_sec) : '0 B/s';

      const isHighLoad = cpuPercent >= 80 || memPercent >= 85;
      const statusLabel = isHighLoad
        ? 'Cảnh báo Tải'
        : nodeMeta?.status === 'NotReady'
          ? 'NotReady'
          : 'Sẵn sàng';

      return {
        name,
        status: statusLabel,
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        cpuCores,
        memPercent: Math.round(memPercent * 10) / 10,
        memGb: memText,
        diskPercent: Math.round(diskPercent * 10) / 10,
        netRx,
        netTx,
        hasTelemetry: Boolean(snap),
      };
    });

    return rows.filter((n) => n.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clusterNodes, latestNodeSnapshots, searchTerm]);

  return (
    <div className="dashboard-metrics-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Chỉ Số Viễn Trắc Hạ Tầng Thời Gian Thực (Node Metrics)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg?.name || 'Chưa chọn Tổ chức'} &bull;{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.name || 'Môi trường mặc định'}</span> &bull; Biểu đồ chuỗi thời gian CPU, RAM, Disk &amp; Network I/O (Lightweight Charts)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              triggerRefresh();
              loadClusterNodes();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Đồng bộ Cụm</span>
          </button>
        </div>
      </div>

      {/* Main Lightweight-Charts Node Metrics Dashboard Panel */}
      <NodeMetricsChartsPanel
        orgId={currentOrg?.id}
        clusterId={activeClusterId}
        nodesOverride={clusterNodes.length > 0 ? clusterNodes : null}
        onRawItemsLoaded={handleRawMetricsLoaded}
      />

      {/* Breakdown: Real Node Telemetry Table */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Phân Bổ Tải Theo Máy Chủ (Nodes)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Trọng số tài nguyên CPU, RAM, Disk và băng thông mạng mới nhất ghi nhận trên từng Node
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Tìm kiếm máy chủ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  height: '32px',
                  padding: '0 10px 0 28px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-sm)',
                  outline: 'none',
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--dash-text-muted)' }} />
            </div>
          </div>
        </div>

        {tableRows.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
            <Server size={24} style={{ marginBottom: '6px', opacity: 0.6 }} />
            <div>Chưa có máy chủ Node nào được ghi nhận trong cụm hiện tại.</div>
          </div>
        ) : (
          <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>MÁY CHỦ</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>TRẠNG THÁI</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>TẢI CPU (%)</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>DÙNG RAM (%)</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>DUNG LƯỢNG ĐĨA</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>BĂNG THÔNG MẠNG (RX / TX)</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((node) => (
                  <tr key={node.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                      {node.name}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: node.status === 'Sẵn sàng' ? 'rgba(5, 150, 105, 0.1)' : '#FFF1F2',
                          color: node.status === 'Sẵn sàng' ? '#059669' : '#E11D48',
                          border: node.status === 'Sẵn sàng' ? '1px solid #34D399' : '1px solid #FDA4AF',
                        }}
                      >
                        {node.status === 'Sẵn sàng' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        <span>{node.status}</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '70px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, node.cpuPercent)}%`,
                              height: '100%',
                              backgroundColor: node.cpuPercent >= 80 ? '#E11D48' : 'var(--dash-primary)',
                            }}
                          />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{node.cpuPercent}%</span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>({node.cpuCores})</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '70px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, node.memPercent)}%`,
                              height: '100%',
                              backgroundColor: node.memPercent >= 80 ? '#E11D48' : '#2563EB',
                            }}
                          />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{node.memPercent}%</span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>({node.memGb})</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>
                      {node.diskPercent}%
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                      &darr; {node.netRx} &bull; &uarr; {node.netTx}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsPage;
