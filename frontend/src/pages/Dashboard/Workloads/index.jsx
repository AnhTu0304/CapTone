import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Box,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  Search,
  ExternalLink,
} from 'lucide-react';

export const WorkloadsPage = () => {
  const { isRefreshing, triggerRefresh, onNavigate } = useDashboard();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  const namespaces = ['ALL', 'production', 'default', 'kube-system', 'monitoring', 'selfheal-system'];

  const workloads = [
    {
      id: 'wl-01',
      name: 'payment-gateway',
      type: 'Deployment',
      namespace: 'production',
      podsReady: '3 / 3',
      status: 'WARNING', // AI noted memory risk
      statusLabel: 'Cảnh báo rủi ro RAM',
      cpuUsage: '450m / 1000m',
      memUsage: '1.2 GB / 1.5 GB',
      restarts: 0,
      age: '18 ngày',
    },
    {
      id: 'wl-02',
      name: 'auth-service',
      type: 'Deployment',
      namespace: 'production',
      podsReady: '3 / 3',
      status: 'HEALTHY',
      statusLabel: 'Khỏe mạnh',
      cpuUsage: '180m / 800m',
      memUsage: '512 MB / 1 GB',
      restarts: 0,
      age: '24 ngày',
    },
    {
      id: 'wl-03',
      name: 'orders-db',
      type: 'StatefulSet',
      namespace: 'production',
      podsReady: '3 / 3',
      status: 'HEALTHY',
      statusLabel: 'Khỏe mạnh',
      cpuUsage: '820m / 2000m',
      memUsage: '3.8 GB / 6 GB',
      restarts: 0,
      age: '45 ngày',
    },
    {
      id: 'wl-04',
      name: 'redis-cache',
      type: 'StatefulSet',
      namespace: 'production',
      podsReady: '2 / 2',
      status: 'HEALTHY',
      statusLabel: 'Khỏe mạnh',
      cpuUsage: '120m / 500m',
      memUsage: '1.1 GB / 2 GB',
      restarts: 0,
      age: '30 ngày',
    },
    {
      id: 'wl-05',
      name: 'web-frontend',
      type: 'Deployment',
      namespace: 'default',
      podsReady: '4 / 4',
      status: 'HEALTHY',
      statusLabel: 'Khỏe mạnh',
      cpuUsage: '220m / 800m',
      memUsage: '480 MB / 1 GB',
      restarts: 0,
      age: '12 ngày',
    },
    {
      id: 'wl-06',
      name: 'selfheal-agent',
      type: 'DaemonSet',
      namespace: 'selfheal-system',
      podsReady: '8 / 8',
      status: 'HEALTHY',
      statusLabel: 'Khỏe mạnh',
      cpuUsage: '150m / 500m',
      memUsage: '344 MB / 1 GB',
      restarts: 0,
      age: '60 ngày',
    },
    {
      id: 'wl-07',
      name: 'ingress-nginx-controller',
      type: 'Deployment',
      namespace: 'kube-system',
      podsReady: '2 / 2',
      status: 'HEALTHY',
      statusLabel: 'Khỏe mạnh',
      cpuUsage: '320m / 1000m',
      memUsage: '620 MB / 1 GB',
      restarts: 0,
      age: '60 ngày',
    },
    {
      id: 'wl-08',
      name: 'prometheus-k8s',
      type: 'Deployment',
      namespace: 'monitoring',
      podsReady: '2 / 2',
      status: 'HEALTHY',
      statusLabel: 'Khỏe mạnh',
      cpuUsage: '600m / 1500m',
      memUsage: '2.4 GB / 4 GB',
      restarts: 0,
      age: '40 ngày',
    },
  ];

  const filteredWorkloads = workloads.filter((wl) => {
    const matchesSearch =
      wl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wl.namespace.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesNs = selectedNamespace === 'ALL' || wl.namespace === selectedNamespace;
    const matchesType = selectedType === 'ALL' || wl.type === selectedType;
    return matchesSearch && matchesNs && matchesType;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header with Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Khối Lượng Công Việc & Pods
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
              84 Pods Đang Chạy
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Giám sát trạng thái Deployments, StatefulSets, DaemonSets và chu kỳ sống của containers theo từng Namespace
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
          <span>Làm mới Workloads</span>
        </button>
      </div>

      {/* 2. Stat Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng số Workloads</span>
            <Layers size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              18
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>Workloads</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            12 Deployments, 4 Stateful, 2 Daemon
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Pods Sẵn sàng</span>
            <Box size={16} color="var(--dash-mint-600)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              84 / 84
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>100% Running</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Không có Pods CrashLoopBackOff
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Khởi động lại (24h)</span>
            <RotateCcw size={16} color="var(--dash-success)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              0
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>Tuyệt đối ổn định</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Không ghi nhận OOMKilled
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Số Namespaces</span>
            <CheckCircle2 size={16} color="var(--dash-info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              6
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>Không gian</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Phân lập tài nguyên chuẩn k8s
          </div>
        </div>
      </div>

      {/* 3. Filter & Workloads Table */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {/* Search box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Tìm theo tên workload hoặc namespace..."
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

          {/* Filters: Namespace & Type */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {/* Namespace selector */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {namespaces.map((ns) => (
                <button
                  key={ns}
                  onClick={() => setSelectedNamespace(ns)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.75rem',
                    fontWeight: selectedNamespace === ns ? 600 : 500,
                    backgroundColor: selectedNamespace === ns ? 'var(--dash-primary-light)' : 'transparent',
                    color: selectedNamespace === ns ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                    borderRadius: 'var(--dash-radius-md)',
                    border: selectedNamespace === ns ? '1px solid var(--dash-mint-200)' : '1px solid var(--dash-border)',
                    cursor: 'pointer',
                  }}
                >
                  {ns === 'ALL' ? 'Mọi Namespace' : ns}
                </button>
              ))}
            </div>

            {/* Type selector */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'ALL', label: 'Mọi loại' },
                { id: 'Deployment', label: 'Deployments' },
                { id: 'StatefulSet', label: 'StatefulSets' },
                { id: 'DaemonSet', label: 'DaemonSets' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.75rem',
                    fontWeight: selectedType === t.id ? 600 : 500,
                    backgroundColor: selectedType === t.id ? 'var(--dash-bg-subtle)' : 'transparent',
                    color: selectedType === t.id ? 'var(--dash-text-primary)' : 'var(--dash-text-muted)',
                    borderRadius: 'var(--dash-radius-md)',
                    border: selectedType === t.id ? '1px solid var(--dash-border)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Workloads Table */}
        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Tên Khối Công Việc</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Loại</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Namespace</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Pods Sẵn Sàng</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Trạng Thái Sức Khỏe</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>CPU / RAM Sử Dụng</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Khởi Động Lại</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkloads.map((wl) => (
                <tr
                  key={wl.id}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Box size={14} color="var(--dash-primary)" />
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{wl.name}</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginLeft: '22px' }}>
                      Thời gian chạy: {wl.age}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--dash-radius-full)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--dash-bg-subtle)',
                        color: 'var(--dash-text-secondary)',
                        border: '1px solid var(--dash-border)',
                      }}
                    >
                      {wl.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                    {wl.namespace}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 700, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {wl.podsReady}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: 'var(--dash-radius-full)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor:
                          wl.status === 'WARNING' ? 'var(--dash-warning-bg)' : 'var(--dash-success-bg)',
                        color:
                          wl.status === 'WARNING' ? 'var(--dash-warning-text)' : 'var(--dash-success-text)',
                        border:
                          wl.status === 'WARNING'
                            ? '1px solid var(--dash-warning-border)'
                            : '1px solid var(--dash-success-border)',
                      }}
                    >
                      {wl.status === 'WARNING' ? (
                        <AlertTriangle size={11} />
                      ) : (
                        <CheckCircle2 size={11} />
                      )}
                      <span>{wl.statusLabel}</span>
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--dash-text-primary)' }}>{wl.cpuUsage}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{wl.memUsage}</div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--dash-text-secondary)' }}>
                    {wl.restarts}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        if (wl.status === 'WARNING') {
                          if (onNavigate) onNavigate('/dashboard/ai/predictions');
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: wl.status === 'WARNING' ? 'var(--dash-warning-bg)' : 'transparent',
                        border: wl.status === 'WARNING' ? '1px solid var(--dash-warning-border)' : '1px solid var(--dash-border)',
                        borderRadius: 'var(--dash-radius-sm)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: wl.status === 'WARNING' ? 'var(--dash-warning-text)' : 'var(--dash-text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {wl.status === 'WARNING' ? 'Xem AI Khuyến nghị' : 'Khởi động cuốn chiếu'}
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

export default WorkloadsPage;
