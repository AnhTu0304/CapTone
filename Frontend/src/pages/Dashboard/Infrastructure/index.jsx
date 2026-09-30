import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Layers,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Database,
  Box,
  HardDrive,
  ShieldCheck,
  Search,
  ExternalLink,
} from 'lucide-react';

export const InfrastructurePage = () => {
  const { isRefreshing, triggerRefresh, onNavigate } = useDashboard();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const nodes = [
    {
      id: 'node-cp-01',
      name: 'k8s-control-plane-01',
      role: 'Control Plane',
      status: 'Ready',
      cpuAllocated: '1.2 / 4 vCPUs (30%)',
      memAllocated: '6.4 / 16 GB (40%)',
      pods: '11 / 110',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-101-generic',
      kubelet: 'v1.29.4',
      ip: '192.168.10.10',
    },
    {
      id: 'node-w-01',
      name: 'k8s-worker-01',
      role: 'Worker',
      status: 'Ready',
      cpuAllocated: '2.1 / 4 vCPUs (52%)',
      memAllocated: '11.2 / 16 GB (70%)',
      pods: '14 / 110',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-101-generic',
      kubelet: 'v1.29.4',
      ip: '192.168.10.11',
    },
    {
      id: 'node-w-02',
      name: 'k8s-worker-02',
      role: 'Worker',
      status: 'Ready',
      cpuAllocated: '1.9 / 4 vCPUs (48%)',
      memAllocated: '10.8 / 16 GB (68%)',
      pods: '13 / 110',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-101-generic',
      kubelet: 'v1.29.4',
      ip: '192.168.10.12',
    },
    {
      id: 'node-w-03',
      name: 'k8s-worker-03',
      role: 'Worker',
      status: 'Ready',
      cpuAllocated: '2.8 / 4 vCPUs (70%)',
      memAllocated: '13.1 / 16 GB (82%)',
      pods: '16 / 110',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-101-generic',
      kubelet: 'v1.29.4',
      ip: '192.168.10.13',
    },
    {
      id: 'node-w-04',
      name: 'k8s-worker-04',
      role: 'Worker',
      status: 'Ready',
      cpuAllocated: '1.4 / 4 vCPUs (35%)',
      memAllocated: '9.2 / 16 GB (58%)',
      pods: '10 / 110',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-101-generic',
      kubelet: 'v1.29.4',
      ip: '192.168.10.14',
    },
    {
      id: 'node-w-05',
      name: 'k8s-worker-05',
      role: 'Worker',
      status: 'Ready',
      cpuAllocated: '1.6 / 4 vCPUs (40%)',
      memAllocated: '10.0 / 16 GB (62%)',
      pods: '11 / 110',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-101-generic',
      kubelet: 'v1.29.4',
      ip: '192.168.10.15',
    },
    {
      id: 'node-w-06',
      name: 'k8s-worker-06',
      role: 'Worker',
      status: 'Ready',
      cpuAllocated: '1.2 / 4 vCPUs (30%)',
      memAllocated: '8.5 / 16 GB (53%)',
      pods: '9 / 110',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-101-generic',
      kubelet: 'v1.29.4',
      ip: '192.168.10.16',
    },
    {
      id: 'node-w-07',
      name: 'k8s-worker-07',
      role: 'Worker',
      status: 'Ready',
      cpuAllocated: '1.2 / 4 vCPUs (30%)',
      memAllocated: '7.8 / 16 GB (49%)',
      pods: '8 / 110',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-101-generic',
      kubelet: 'v1.29.4',
      ip: '192.168.10.17',
    },
  ];

  const filteredNodes = nodes.filter((node) => {
    const matchesSearch =
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.ip.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      roleFilter === 'ALL' ||
      (roleFilter === 'CP' && node.role === 'Control Plane') ||
      (roleFilter === 'WORKER' && node.role === 'Worker');
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header with Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Hạ Tầng Cụm Máy Chủ Kubernetes
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: 'var(--dash-mint-100)',
                color: 'var(--dash-mint-600)',
                border: '1px solid var(--dash-mint-200)',
              }}
            >
              8 Nodes Sẵn Sàng
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Quản lý năng lực tính toán phần cứng, dung lượng CPU / RAM phân bổ và trạng thái sức khỏe từng Node trong cụm
          </p>
        </div>

        <button
          onClick={triggerRefresh}
          disabled={isRefreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: 'var(--dash-radius-md)',
            color: 'var(--dash-text-primary)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Làm mới Nodes</span>
        </button>
      </div>

      {/* 2. Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng số Nodes</span>
            <Layers size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              8
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>1 CP / 7 Workers</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            100% Sẵn sàng (Ready)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng vCPU Khả dụng</span>
            <Cpu size={16} color="var(--dash-info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              32
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>vCPUs</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Đã phân bổ: 13.4 vCPUs (42%)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng Bộ nhớ RAM</span>
            <Database size={16} color="var(--dash-mint-600)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              128
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>GB</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Đã phân bổ: 87.0 GB (68%)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sức chứa Pods</span>
            <Box size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              84 / 880
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>Dư địa dồi dào</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Tỷ lệ lấp đầy Pod: 9.5%
          </div>
        </div>
      </div>

      {/* 3. Nodes Table */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <input
              type="text"
              placeholder="Tìm theo tên máy chủ hoặc IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.8125rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                backgroundColor: 'var(--dash-bg-canvas)',
                outline: 'none',
                color: 'var(--dash-text-primary)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'CP', label: 'Control Plane' },
              { id: 'WORKER', label: 'Worker Nodes' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRoleFilter(r.id)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: roleFilter === r.id ? 600 : 500,
                  backgroundColor: roleFilter === r.id ? 'var(--dash-primary-light)' : 'transparent',
                  color: roleFilter === r.id ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                  borderRadius: 'var(--dash-radius-md)',
                  border: roleFilter === r.id ? '1px solid var(--dash-mint-200)' : '1px solid var(--dash-border)',
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Tên Máy Chủ (Node)</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Vai Trò</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Trạng Thái</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>CPU Đã Cấp</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>RAM Đã Cấp</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Số Lượng Pods</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Hệ Điều Hành / Kubelet</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredNodes.map((node) => (
                <tr
                  key={node.id}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Server size={14} color="var(--dash-primary)" />
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{node.name}</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginLeft: '22px' }}>
                      IP: {node.ip}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--dash-radius-full)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: node.role === 'Control Plane' ? 'var(--dash-info-bg)' : 'var(--dash-bg-subtle)',
                        color: node.role === 'Control Plane' ? 'var(--dash-info-text)' : 'var(--dash-text-primary)',
                        border: '1px solid var(--dash-border)',
                      }}
                    >
                      {node.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--dash-success)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--dash-success)' }}>Ready</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {node.cpuAllocated}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {node.memAllocated}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {node.pods}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-primary)' }}>{node.os}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Kubelet {node.kubelet}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button
                      onClick={() => onNavigate && onNavigate('/dashboard/self-healing/approvals')}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--dash-border)',
                        borderRadius: 'var(--dash-radius-sm)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--dash-text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Tháo tải an toàn (Drain)
                    </button>
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

export default InfrastructurePage;
