import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import InteractiveResourceChart from '../../../components/dashboard/InteractiveResourceChart';
import {
  Activity,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

// Node telemetry stats
const NODE_METRICS = [
  { name: 'worker-01', status: 'Sẵn sàng', cpuPercent: 68, cpuCores: '5.4 / 8.0 vCPU', memPercent: 74, memGb: '11.8 / 16 GB', diskPercent: 32, netRx: '42.5 MB/s', netTx: '38.1 MB/s' },
  { name: 'worker-02', status: 'Sẵn sàng', cpuPercent: 54, cpuCores: '4.3 / 8.0 vCPU', memPercent: 62, memGb: '9.9 / 16 GB', diskPercent: 28, netRx: '31.2 MB/s', netTx: '29.4 MB/s' },
  { name: 'worker-03', status: 'Cảnh báo Tải', cpuPercent: 88, cpuCores: '7.0 / 8.0 vCPU', memPercent: 86, memGb: '13.7 / 16 GB', diskPercent: 45, netRx: '68.9 MB/s', netTx: '64.2 MB/s' },
  { name: 'worker-04', status: 'Sẵn sàng', cpuPercent: 41, cpuCores: '3.3 / 8.0 vCPU', memPercent: 58, memGb: '9.3 / 16 GB', diskPercent: 22, netRx: '18.7 MB/s', netTx: '16.3 MB/s' },
  { name: 'master-01', status: 'Sẵn sàng', cpuPercent: 24, cpuCores: '1.9 / 8.0 vCPU', memPercent: 42, memGb: '6.7 / 16 GB', diskPercent: 18, netRx: '12.4 MB/s', netTx: '15.1 MB/s' },
  { name: 'master-02', status: 'Sẵn sàng', cpuPercent: 22, cpuCores: '1.8 / 8.0 vCPU', memPercent: 39, memGb: '6.2 / 16 GB', diskPercent: 17, netRx: '11.8 MB/s', netTx: '14.6 MB/s' },
];

// Top consuming workloads
const WORKLOAD_METRICS = [
  { pod: 'payment-service-7f8d-x9b2q', ns: 'production', cpu: '1,420m', mem: '2,048 MiB', restarts: 0, status: 'Running' },
  { pod: 'api-gateway-55c8b-mk42p', ns: 'production', cpu: '860m', mem: '1,120 MiB', restarts: 0, status: 'Running' },
  { pod: 'order-processor-66bf-aa18x', ns: 'production', cpu: '780m', mem: '950 MiB', restarts: 1, status: 'Running' },
  { pod: 'redis-cluster-leader-0', ns: 'redis', cpu: '450m', mem: '3,840 MiB', restarts: 0, status: 'Running' },
  { pod: 'ingress-nginx-controller-abcde', ns: 'ingress-nginx', cpu: '510m', mem: '680 MiB', restarts: 0, status: 'Running' },
  { pod: 'selfheal-agent-daemon-tk98', ns: 'selfheal-system', cpu: '45m', mem: '58 MiB', restarts: 0, status: 'Running' },
];

export const MetricsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredNodes = useMemo(() => {
    return NODE_METRICS.filter((n) => n.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm]);

  const filteredWorkloads = useMemo(() => {
    return WORKLOAD_METRICS.filter((w) => {
      const matchNs = selectedNamespace === 'all' || w.ns === selectedNamespace;
      const matchSearch = w.pod.toLowerCase().includes(searchTerm.toLowerCase()) || w.ns.toLowerCase().includes(searchTerm.toLowerCase());
      return matchNs && matchSearch;
    });
  }, [selectedNamespace, searchTerm]);

  return (
    <div className="dashboard-metrics-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Chỉ Số Viễn Trắc Hạ Tầng Thời Gian Thực
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Phân tích viễn trắc eBPF độ phân giải cao
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={triggerRefresh}
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
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Resource Chart */}
      <InteractiveResourceChart
        title="Biểu Đồ Tài Nguyên Cụm Máy Chủ (CPU & RAM Thời Gian Thực)"
        subtitle="Dữ liệu cảm biến trực tiếp từ 8 Nodes Kubernetes thu thập qua eBPF DaemonSet"
        totalCpuCores={48}
        totalMemoryGb={96}
        height={280}
      />

      {/* Breakdown 1: Node Telemetry Table */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Phân Bổ Tải Theo Máy Chủ (Nodes)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Trọng số tài nguyên và băng thông mạng trên từng nút trong cụm
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
              {filteredNodes.map((node) => (
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
                            width: `${node.cpuPercent}%`,
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
                            width: `${node.memPercent}%`,
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
      </div>

      {/* Breakdown 2: Top Workloads Table */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Workloads Chiếm Dụng Tài Nguyên Cao Nhất
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Danh sách các Pods tiêu thụ nhiều CPU và RAM nhất trong phiên viễn trắc
            </p>
          </div>

          {/* Namespace Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>Namespace:</span>
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="all">Tất cả namespaces</option>
              <option value="production">production</option>
              <option value="redis">redis</option>
              <option value="ingress-nginx">ingress-nginx</option>
              <option value="selfheal-system">selfheal-system</option>
            </select>
          </div>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>POD NAME</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>NAMESPACE</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>CPU (mCores)</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>BỘ NHỚ (MiB)</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>SỐ LẦN RESTARTS</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkloads.map((wl) => (
                <tr key={wl.pod} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    {wl.pod}
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-secondary)' }}>
                    {wl.ns}
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                    {wl.cpu}
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2563EB' }}>
                    {wl.mem}
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>
                    {wl.restarts}
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
                        backgroundColor: 'rgba(5, 150, 105, 0.1)',
                        color: '#059669',
                      }}
                    >
                      {wl.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MetricsPage;
