import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { clusterService } from '../../../services/clusterService';
import { AdminTablePagination } from '../../../components/admin/common';

export const AdminClusterOverviewPage = ({ onNavigate }) => {
  const [clusters, setClusters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [envFilter, setEnvFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const debouncedSearch = useDebounce(search, 250);

  // Reset trang về 1 khi từ khóa hoặc bộ lọc thay đổi
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, envFilter, companyFilter]);

  const fetchRealClusters = useCallback(async (showToast = false) => {
    setIsRefreshing(true);
    try {
      const data = await clusterService.getAllClusters();
      if (Array.isArray(data)) {
        const mapped = data.map((c) => {
          const agStatus = (c.agent_status || 'PENDING').toUpperCase();
          const envRaw = (c.environment_type || c.environment_name || 'PRODUCTION').toUpperCase();
          const environment = envRaw.includes('PROD')
            ? 'Production'
            : envRaw.includes('STAG')
            ? 'Staging'
            : 'Development';
          const status =
            agStatus === 'ONLINE'
              ? 'READY'
              : agStatus === 'PENDING' || agStatus === 'DEGRADED'
              ? 'WARNING'
              : 'CRITICAL';
          return {
            id: c.id,
            name: c.name || (c.id ? `Cụm ${c.id.slice(0, 8)}` : 'k8s-cluster'),
            companyId: c.organization_id || 'org-default',
            companyName: c.organization_name || 'Chưa gán tổ chức',
            environment,
            region: c.provider || 'Kubernetes Cluster',
            endpoint: c.endpoint || null,
            k8sVersion: c.kubernetes_version || 'Chưa xác định',
            status,
            nodeCount: Number(c.nodes_count || 0),
            podCount: Number(c.pods_count || 0),
            agentStatus: agStatus,
            agentVersion: c.agent_name || 'sdas-ebpf-agent',
            lastSync: c.last_heartbeat_at
              ? new Date(c.last_heartbeat_at).toLocaleString('vi-VN')
              : 'Chưa đồng bộ',
          };
        });
        setClusters(mapped);
        if (showToast) {
          setToastMessage(`Đã đồng bộ trạng thái telemetry thực tế từ ${mapped.length} cụm Kubernetes!`);
          setTimeout(() => setToastMessage(null), 3500);
        }
      }
    } catch (err) {
      console.warn('[AdminClusterOverviewPage] Lỗi đồng bộ cụm K8s:', err);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRealClusters(false);
  }, [fetchRealClusters]);

  // Danh sách công ty duy nhất có cụm K8s
  const uniqueCompanies = useMemo(() => {
    const map = new Map();
    clusters.forEach((c) => {
      if (c.companyId && c.companyName) {
        map.set(c.companyId, c.companyName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [clusters]);

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
      const matchCompany = companyFilter === 'ALL' || c.companyId === companyFilter;
      return matchSearch && matchStatus && matchEnv && matchCompany;
    });
  }, [clusters, debouncedSearch, statusFilter, envFilter, companyFilter]);

  const totalPages = Math.ceil(filteredClusters.length / pageSize) || 1;
  const paginatedClusters = useMemo(() => {
    return filteredClusters.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredClusters, page, pageSize]);

  const stats = useMemo(() => {
    let totalNodes = 0;
    let totalPods = 0;
    let ready = 0;
    let warning = 0;
    let critical = 0;
    let onlineAgents = 0;
    const orgsSet = new Set();
    const providersSet = new Set();

    clusters.forEach((c) => {
      totalNodes += c.nodeCount;
      totalPods += c.podCount;
      if (c.status === 'READY') ready++;
      else if (c.status === 'WARNING') warning++;
      else if (c.status === 'CRITICAL') critical++;

      if (c.agentStatus === 'ONLINE') onlineAgents++;
      if (c.companyId) orgsSet.add(c.companyId);
      if (c.region) providersSet.add(c.region);
    });

    return {
      totalClusters: clusters.length,
      totalNodes,
      totalPods,
      ready,
      warning,
      critical,
      onlineAgents,
      uniqueOrgsCount: orgsSet.size,
      uniqueProvidersCount: providersSet.size,
      healthyPct: clusters.length > 0 ? Math.round((ready / clusters.length) * 100) : 100,
      agentOnlinePct: clusters.length > 0 ? Math.round((onlineAgents / clusters.length) * 100) : 100,
    };
  }, [clusters]);

  const handleRefresh = () => {
    fetchRealClusters(true);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)',
              flexShrink: 0,
            }}
          >
            <Layers size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Tổng Quan Cụm Kubernetes Toàn Mạng
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Quản lý tập trung thông tin kết nối, phiên bản Kubernetes, số Node và tình trạng tác tử viễn trắc trên tất cả các cụm của doanh nghiệp.
            </p>
          </div>
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
            {stats.uniqueOrgsCount > 0 ? `Thuộc ${stats.uniqueOrgsCount} doanh nghiệp quản trị` : 'Đồng bộ từ CSDL thời gian thực'}
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
            Tác tử eBPF: {stats.onlineAgents}/{clusters.length} Online ({stats.agentOnlinePct}%)
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

          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
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
            <option value="ALL">Tất Cả Doanh Nghiệp ({uniqueCompanies.length})</option>
            {uniqueCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                Doanh nghiệp: {c.name}
              </option>
            ))}
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
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                  <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  <div style={{ fontSize: '0.8125rem' }}>Đang nạp dữ liệu cụm Kubernetes từ máy chủ...</div>
                </td>
              </tr>
            ) : paginatedClusters.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                  <Server size={24} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Không tìm thấy cụm Kubernetes nào</div>
                </td>
              </tr>
            ) : (
              paginatedClusters.map((cluster) => (
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
                      <div
                        style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}
                        title={cluster.endpoint || undefined}
                      >
                        {cluster.region}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Company Name */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{cluster.companyName}</div>
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
            ))
            )}
          </tbody>
        </table>

        <AdminTablePagination
          page={page}
          pageSize={pageSize}
          total={filteredClusters.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemLabel="cụm Kubernetes"
          pageSizeOptions={[10, 20, 50]}
          isLoading={isRefreshing || isLoading}
        />
      </div>
    </div>
  );
};

export default AdminClusterOverviewPage;
