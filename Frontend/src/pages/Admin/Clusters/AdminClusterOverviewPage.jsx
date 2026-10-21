import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Server,
  Building2,
  ShieldCheck,
  Radio,
  ExternalLink,
  Clock,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';

const INITIAL_CLUSTERS = [
  {
    id: 'k8s-acme-prod-01',
    name: 'acme-production-us-east',
    companyId: 'org-acme-01',
    companyName: 'Acme Infrastructure Corp',
    environment: 'Production',
    region: 'AWS us-east-1 (N. Virginia)',
    k8sVersion: 'v1.30.2',
    status: 'READY',
    nodeCount: 16,
    podCount: 142,
    agentStatus: 'ONLINE',
    agentVersion: 'v2.4.1-ebpf',
    lastSync: '10 giây trước',
  },
  {
    id: 'k8s-acme-stage-01',
    name: 'acme-staging-us-east',
    companyId: 'org-acme-01',
    companyName: 'Acme Infrastructure Corp',
    environment: 'Staging',
    region: 'AWS us-east-1 (N. Virginia)',
    k8sVersion: 'v1.30.1',
    status: 'READY',
    nodeCount: 6,
    podCount: 48,
    agentStatus: 'ONLINE',
    agentVersion: 'v2.4.1-ebpf',
    lastSync: '30 giây trước',
  },
  {
    id: 'k8s-finflow-prod-01',
    name: 'finflow-prod-hcm',
    companyId: 'org-finflow-02',
    companyName: 'FinFlow Pay Platform',
    environment: 'Production',
    region: 'VNPT IDC Ho Chi Minh',
    k8sVersion: 'v1.29.4',
    status: 'WARNING',
    nodeCount: 12,
    podCount: 96,
    agentStatus: 'DEGRADED',
    agentVersion: 'v2.4.0-ebpf',
    lastSync: '1 phút trước',
  },
  {
    id: 'k8s-nexus-sg-01',
    name: 'nexus-cluster-sg',
    companyId: 'org-nexus-03',
    companyName: 'Nexus Logistics AI',
    environment: 'Production',
    region: 'GCP asia-southeast1 (Singapore)',
    k8sVersion: 'v1.30.0',
    status: 'READY',
    nodeCount: 20,
    podCount: 184,
    agentStatus: 'ONLINE',
    agentVersion: 'v2.4.1-ebpf',
    lastSync: '15 giây trước',
  },
  {
    id: 'k8s-viettel-hn-01',
    name: 'viettel-k8s-hn-01',
    companyId: 'org-viettel-04',
    companyName: 'Viettel SME Cloud',
    environment: 'Staging',
    region: 'Viettel IDC Hoa Lac (Hanoi)',
    k8sVersion: 'v1.28.8',
    status: 'CRITICAL',
    nodeCount: 8,
    podCount: 62,
    agentStatus: 'OFFLINE',
    agentVersion: 'v2.3.9-ebpf',
    lastSync: '14 phút trước',
  },
  {
    id: 'k8s-fpt-retail-01',
    name: 'fpt-retail-edge-cluster',
    companyId: 'org-fpt-05',
    companyName: 'FPT Digital Smart Retail',
    environment: 'Production',
    region: 'FPT Telecom IDC Da Nang',
    k8sVersion: 'v1.30.2',
    status: 'READY',
    nodeCount: 10,
    podCount: 78,
    agentStatus: 'ONLINE',
    agentVersion: 'v2.4.1-ebpf',
    lastSync: '20 giây trước',
  },
];

export const AdminClusterOverviewPage = ({ onNavigate }) => {
  const [clusters, setClusters] = useState(INITIAL_CLUSTERS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [envFilter, setEnvFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const debouncedSearch = useDebounce(search, 250);

  const filteredClusters = useMemo(() => {
    return clusters.filter((c) => {
      const matchSearch =
        !debouncedSearch ||
        c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.companyName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.region.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.k8sVersion.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
      const matchEnv = envFilter === 'ALL' || c.environment === envFilter;
      return matchSearch && matchStatus && matchEnv;
    });
  }, [clusters, debouncedSearch, statusFilter, envFilter]);

  const stats = useMemo(() => {
    let totalNodes = 0;
    let totalPods = 0;
    let ready = 0;
    let warning = 0;
    let critical = 0;

    clusters.forEach((c) => {
      totalNodes += c.nodeCount;
      totalPods += c.podCount;
      if (c.status === 'READY') ready++;
      else if (c.status === 'WARNING') warning++;
      else if (c.status === 'CRITICAL') critical++;
    });

    return {
      totalClusters: clusters.length,
      totalNodes,
      totalPods,
      ready,
      warning,
      critical,
    };
  }, [clusters]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setToastMessage('Đã đồng bộ trạng thái telemetry từ 34 cụm Kubernetes!');
      setTimeout(() => setToastMessage(null), 3500);
    }, 600);
  };

  return (
    <div
      className="admin-clusters-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '48px',
      }}
    >
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                fontWeight: 700,
                fontSize: '0.6875rem',
              }}
            >
              <ShieldCheck size={12} /> Cấp Độ Quản Trị Hệ Thống (Platform Super Admin)
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--dash-text-primary)',
              margin: '8px 0 4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Layers size={26} style={{ color: '#059669' }} />
            Tổng Quan Cụm Kubernetes Toàn Mạng (Cluster Overview)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Quản lý tập trung thông tin kết nối, phiên bản Kubernetes, số Node và tình trạng tác tử viễn trắc trên tất cả các cụm của doanh nghiệp.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
            <span>Đồng Bộ Cụm</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div
          style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Tổng Cụm K8s Đăng Ký
            </span>
            <Layers size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
            {stats.totalClusters} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-secondary)' }}>Clusters</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '6px' }}>
            Phủ khắp 6 vùng đám mây
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #BBF7D0',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              Cụm Sẵn Sàng (Ready)
            </span>
            <CheckCircle2 size={16} color="#15803D" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#14532D' }}>
            {stats.ready} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#166534' }}>Cụm</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: 600, marginTop: '6px' }}>
            Tác tử eBPF 100% Online
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Quy Mô Máy Chủ & Pods
            </span>
            <Server size={16} color="#2563EB" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
            {stats.totalNodes} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-secondary)' }}>Nodes</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600, marginTop: '6px' }}>
            {stats.totalPods.toLocaleString('vi-VN')} Pods vi dịch vụ
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: stats.critical > 0 ? '1px solid #FECACA' : stats.warning > 0 ? '1px solid #FDE68A' : '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: stats.critical > 0 ? '#991B1B' : '#B45309', textTransform: 'uppercase' }}>
              Cảnh Báo & Lỗi
            </span>
            <AlertTriangle size={16} color={stats.critical > 0 ? '#DC2626' : '#D97706'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.critical > 0 ? '#DC2626' : '#B45309' }}>
            {stats.critical + stats.warning} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-secondary)' }}>Cụm</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: stats.critical > 0 ? '#DC2626' : '#D97706', fontWeight: 600, marginTop: '6px' }}>
            {stats.critical} Critical • {stats.warning} Warning
          </div>
        </div>
      </div>

      {/* 3. Filters Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={14} color="var(--dash-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Tìm Cụm K8s, công ty, vùng máy chủ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                fontSize: '0.8125rem',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-primary)',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              fontSize: '0.8125rem',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontWeight: 600,
            }}
          >
            <option value="ALL">Tất Cả Trạng Thái</option>
            <option value="READY">Sẵn Sàng (Ready)</option>
            <option value="WARNING">Cảnh Báo (Warning)</option>
            <option value="CRITICAL">Nghiêm Trọng (Critical)</option>
          </select>

          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              fontSize: '0.8125rem',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontWeight: 600,
            }}
          >
            <option value="ALL">Tất Cả Môi Trường</option>
            <option value="Production">Production</option>
            <option value="Staging">Staging</option>
            <option value="Development">Development</option>
          </select>
        </div>

        <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)' }}>
          Hiển thị <strong>{filteredClusters.length}</strong> / {clusters.length} cụm
        </div>
      </div>

      {/* 4. Clusters Table */}
      <div
        style={{
          border: '1px solid var(--dash-border)',
          borderRadius: '14px',
          overflowX: 'auto',
          backgroundColor: '#FFFFFF',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Tên Cụm K8s & Vùng</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Công Ty Trực Thuộc</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Môi Trường</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Phiên Bản K8s</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Nodes & Pods</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Tác Tử eBPF</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái Cụm</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Đồng Bộ Cuối</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredClusters.map((cluster) => (
              <tr
                key={cluster.id}
                style={{
                  borderBottom: '1px solid var(--dash-border)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Cluster Name & Region */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: '#F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#475569',
                      }}
                    >
                      <Layers size={14} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{cluster.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{cluster.region}</div>
                    </div>
                  </div>
                </td>

                {/* Company Name */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{cluster.companyName}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {cluster.companyId}
                  </div>
                </td>

                {/* Environment */}
                <td style={{ padding: '14px 16px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      backgroundColor: cluster.environment === 'Production' ? '#EFF6FF' : '#F8FAFC',
                      color: cluster.environment === 'Production' ? '#1D4ED8' : '#475569',
                      border: cluster.environment === 'Production' ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                    }}
                  >
                    {cluster.environment}
                  </span>
                </td>

                {/* K8s Version */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0F172A' }}>
                    {cluster.k8sVersion}
                  </div>
                </td>

                {/* Nodes & Pods */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {cluster.nodeCount} Nodes
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                    {cluster.podCount} Pods
                  </div>
                </td>

                {/* eBPF Agent */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Radio
                      size={12}
                      color={
                        cluster.agentStatus === 'ONLINE'
                          ? '#059669'
                          : cluster.agentStatus === 'DEGRADED'
                          ? '#D97706'
                          : '#DC2626'
                      }
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color:
                          cluster.agentStatus === 'ONLINE'
                            ? '#059669'
                            : cluster.agentStatus === 'DEGRADED'
                            ? '#D97706'
                            : '#DC2626',
                      }}
                    >
                      {cluster.agentStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {cluster.agentVersion}
                  </div>
                </td>

                {/* Cluster Status */}
                <td style={{ padding: '14px 16px' }}>
                  {cluster.status === 'READY' ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#ECFDF5',
                        color: '#065F46',
                        border: '1px solid #A7F3D0',
                        fontWeight: 700,
                        fontSize: '0.6875rem',
                      }}
                    >
                      <CheckCircle2 size={11} /> READY
                    </span>
                  ) : cluster.status === 'WARNING' ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#FFFBEB',
                        color: '#92400E',
                        border: '1px solid #FDE68A',
                        fontWeight: 700,
                        fontSize: '0.6875rem',
                      }}
                    >
                      <AlertTriangle size={11} /> WARNING
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#FEF2F2',
                        color: '#991B1B',
                        border: '1px solid #FECACA',
                        fontWeight: 700,
                        fontSize: '0.6875rem',
                      }}
                    >
                      <ShieldAlert size={11} /> CRITICAL
                    </span>
                  )}
                </td>

                {/* Last Sync */}
                <td style={{ padding: '14px 16px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> {cluster.lastSync}
                  </div>
                </td>

                {/* Action */}
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate(`/admin/organizations/${cluster.companyId}`);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--dash-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <span>Xem Công Ty</span>
                    <ArrowUpRight size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminClusterOverviewPage;
