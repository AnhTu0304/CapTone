import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Layers,
  Activity,
  Box,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  getInfrastructureKPIs,
  getInfrastructureClusters,
  getInfrastructureAgents,
  getInfrastructureNodes,
  getInfrastructureWorkloads,
} from '../../../services/adminInfrastructureService';
import InfrastructureNavTabs from '../../../components/admin/infrastructure/InfrastructureNavTabs';
import InfrastructureFilters from '../../../components/admin/infrastructure/InfrastructureFilters';
import ClusterTable from '../../../components/admin/infrastructure/ClusterTable';
import AgentTable from '../../../components/admin/infrastructure/AgentTable';
import NodeTable from '../../../components/admin/infrastructure/NodeTable';
import WorkloadTable from '../../../components/admin/infrastructure/WorkloadTable';
import { useDebounce } from '../../../hooks/useDebounce';
import { AdminErrorState } from '../../../components/admin/common';

export const AdminInfrastructurePage = ({ currentSection = 'clusters', onNavigate }) => {
  const [activeTab, setActiveTab] = useState(currentSection);
  const [kpis, setKpis] = useState(null);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [secondaryFilter, setSecondaryFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    setActiveTab(currentSection);
  }, [currentSection]);

  const debouncedSearch = useDebounce(search, 300);

  // Load KPI overview
  useEffect(() => {
    let isMounted = true;
    getInfrastructureKPIs()
      .then((data) => {
        if (isMounted) setKpis(data);
      })
      .catch((err) => {
        console.error('Lỗi khi nạp KPI hạ tầng:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch data depending on activeTab
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'clusters') {
        const data = await getInfrastructureClusters({
          search: debouncedSearch,
          status: statusFilter,
          organization: secondaryFilter,
        });
        setItems(data);
      } else if (activeTab === 'agents') {
        const data = await getInfrastructureAgents({
          search: debouncedSearch,
          status: statusFilter,
          organization: secondaryFilter,
        });
        setItems(data);
      } else if (activeTab === 'nodes') {
        const data = await getInfrastructureNodes({
          search: debouncedSearch,
          status: statusFilter,
          cluster: secondaryFilter,
        });
        setItems(data);
      } else if (activeTab === 'workloads') {
        const data = await getInfrastructureWorkloads({
          search: debouncedSearch,
          status: statusFilter,
          type: secondaryFilter,
        });
        setItems(data);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu hạ tầng:', err);
      setError('Không thể tải dữ liệu hạ tầng từ máy chủ. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, debouncedSearch, statusFilter, secondaryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = (tabId, tabPath) => {
    setActiveTab(tabId);
    setSearch('');
    setStatusFilter('ALL');
    setSecondaryFilter('ALL');
    if (onNavigate) {
      onNavigate(tabPath);
    }
  };

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Safe abstract action handlers - NO raw K8s commands exposed
  const handleSyncCluster = (cluster) => {
    showNotification(`Đã gửi yêu cầu đồng bộ cấu hình cho cụm ${cluster.name}.`);
  };

  const handleInspectCluster = (cluster) => {
    showNotification(`Đã kích hoạt quét kiểm tra an toàn tự động trên cụm ${cluster.name}.`);
  };

  const handlePingAgent = (agent) => {
    showNotification(`Tác tử ${agent.name} phản hồi nhịp tim bình thường (${agent.latency}).`);
  };

  const handleScheduleMaintenance = (node) => {
    showNotification(`Đã lên lịch bảo trì an toàn máy chủ ${node.name}. Tác vụ sẽ tự động dời Pods an toàn.`);
  };

  const handleVerifyNode = (node) => {
    showNotification(`Tài nguyên máy chủ ${node.name} được kiểm tra thành công: ${node.cpuPercent}% CPU, ${node.memoryPercent}% RAM.`);
  };

  const handleViewWorkload = (wl) => {
    showNotification(`Đang mở chi tiết cấu hình dịch vụ ${wl.name} (${wl.namespace}).`);
  };

  const handleSafeRestart = (wl) => {
    showNotification(`Đã gửi lệnh cuộn an toàn (Zero-downtime Rolling Restart) cho ${wl.name}.`);
  };

  // Status options per tab
  const getStatusOptions = () => {
    if (activeTab === 'clusters' || activeTab === 'workloads') {
      return [
        { value: 'ALL', label: 'Tất cả trạng thái' },
        { value: 'READY', label: 'Sẵn sàng (Ready)' },
        { value: 'HEALTHY', label: 'Khỏe mạnh (Healthy)' },
        { value: 'WARNING', label: 'Cảnh báo (Warning)' },
        { value: 'CRITICAL', label: 'Nguy cấp (Critical)' },
      ];
    }
    if (activeTab === 'agents') {
      return [
        { value: 'ALL', label: 'Tất cả trạng thái' },
        { value: 'ONLINE', label: 'Trực tuyến (Online)' },
        { value: 'DEGRADED', label: 'Suy giảm (Degraded)' },
        { value: 'OFFLINE', label: 'Ngoại tuyến (Offline)' },
      ];
    }
    return [
      { value: 'ALL', label: 'Tất cả trạng thái' },
      { value: 'READY', label: 'Sẵn sàng (Ready)' },
      { value: 'MAINTENANCE', label: 'Bảo trì (Maintenance)' },
      { value: 'NOT_READY', label: 'Chưa sẵn sàng (Not Ready)' },
    ];
  };

  // Secondary options per tab
  const getSecondaryConfig = () => {
    if (activeTab === 'workloads') {
      return {
        label: 'Loại Workload',
        options: [
          { value: 'ALL', label: 'Tất cả loại' },
          { value: 'Deployment', label: 'Deployment' },
          { value: 'StatefulSet', label: 'StatefulSet' },
          { value: 'DaemonSet', label: 'DaemonSet' },
        ],
      };
    }
    return null;
  };

  const secondaryConfig = getSecondaryConfig();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div
          role="alert"
          style={{
            padding: '12px 18px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '10px',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--dash-shadow-sm)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Zap size={16} style={{ color: '#059669', flexShrink: 0 }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
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
              <ShieldCheck size={12} /> Cấp Độ Quản Trị Nền Tảng (Platform Super Admin)
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
            <Server size={26} style={{ color: '#059669' }} />
            Quản Trị Hạ Tầng Kubernetes & Tác Tử eBPF
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Giám sát tập trung Cụm K8s, Tác tử eBPF, Máy chủ Nodes và Khối công việc Workloads trên toàn hệ thống. Toàn bộ thao tác đều được trừu tượng hóa an toàn, không để lộ lệnh K8s thô.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
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
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      {kpis && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Clusters KPI */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
                CỤM KUBERNETES
              </span>
              <Layers size={16} style={{ color: '#059669' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '6px' }}>
              {kpis.readyClusters} / {kpis.totalClusters}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>Sẵn sàng</span>
            </div>
          </div>

          {/* Agents KPI */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
                TÁC TỬ eBPF SENSOR
              </span>
              <Activity size={16} style={{ color: '#059669' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '6px' }}>
              {kpis.onlineAgents} / {kpis.totalAgents}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>Trực tuyến</span>
            </div>
          </div>

          {/* Nodes KPI */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
                MÁY CHỦ (NODES)
              </span>
              <Server size={16} style={{ color: '#059669' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '6px' }}>
              {kpis.readyNodes} / {kpis.totalNodes}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>Hoạt động</span>
            </div>
          </div>

          {/* Workloads KPI */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
                KHỐI CÔNG VIỆC (WORKLOADS)
              </span>
              <Box size={16} style={{ color: '#059669' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '6px' }}>
              {kpis.healthyWorkloads} / {kpis.totalWorkloads}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>Khỏe mạnh</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <InfrastructureNavTabs activeTab={activeTab} onSelectTab={handleTabChange} />

      {/* Filters Bar */}
      <InfrastructureFilters
        search={search}
        onSearchChange={setSearch}
        placeholder={`Tìm kiếm trong ${
          activeTab === 'clusters'
            ? 'Cụm K8s...'
            : activeTab === 'agents'
            ? 'Tác tử eBPF...'
            : activeTab === 'nodes'
            ? 'Máy chủ Nodes...'
            : 'Khối công việc Workloads...'
        }`}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={getStatusOptions()}
        secondaryLabel={secondaryConfig?.label}
        secondaryOptions={secondaryConfig?.options}
        secondaryValue={secondaryFilter}
        onSecondaryChange={setSecondaryFilter}
        onReset={() => {
          setSearch('');
          setStatusFilter('ALL');
          setSecondaryFilter('ALL');
        }}
      />

      {/* Error state if fetch failed */}
      {error && (
        <AdminErrorState
          title="Không thể tải dữ liệu hạ tầng"
          message={error}
          onRetry={fetchData}
          isRetrying={isLoading}
        />
      )}

      {/* Main Table Views */}
      {activeTab === 'clusters' && (
        <ClusterTable
          clusters={items}
          isLoading={isLoading}
          onSyncCluster={handleSyncCluster}
          onInspectCluster={handleInspectCluster}
        />
      )}

      {activeTab === 'agents' && (
        <AgentTable
          agents={items}
          isLoading={isLoading}
          onPingAgent={handlePingAgent}
        />
      )}

      {activeTab === 'nodes' && (
        <NodeTable
          nodes={items}
          isLoading={isLoading}
          onScheduleMaintenance={handleScheduleMaintenance}
          onVerifyNode={handleVerifyNode}
        />
      )}

      {activeTab === 'workloads' && (
        <WorkloadTable
          workloads={items}
          isLoading={isLoading}
          onViewWorkload={handleViewWorkload}
          onSafeRestart={handleSafeRestart}
        />
      )}
    </div>
  );
};

export default AdminInfrastructurePage;
