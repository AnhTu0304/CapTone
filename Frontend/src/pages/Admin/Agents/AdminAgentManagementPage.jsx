import React, { useState, useMemo } from 'react';
import {
  Bot,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  KeyRound,
  RotateCw,
  Ban,
  Activity,
  Layers,
  Building2,
  ShieldCheck,
  Radio,
  ExternalLink,
  ChevronRight,
  X,
  Send,
  Zap,
} from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';

// Mock danh sách Agents toàn hệ thống
const INITIAL_AGENTS = [
  {
    id: 'agent-acme-01',
    nodeName: 'worker-node-us-east-01',
    companyId: 'org-acme-01',
    companyName: 'Acme Infrastructure Corp',
    clusterName: 'acme-production-us-east',
    version: 'v2.4.1-ebpf',
    kernelVersion: '5.15.0-89-generic',
    status: 'ONLINE',
    heartbeat: '5 giây trước',
    latency: '1.0ms',
    telemetryStatus: 'NORMAL',
    tokenExpires: '28 ngày',
    tokenMasked: 'selfai_agent_live_948f2a...88e1',
    podCount: 24,
  },
  {
    id: 'agent-acme-02',
    nodeName: 'worker-node-us-east-02',
    companyId: 'org-acme-01',
    companyName: 'Acme Infrastructure Corp',
    clusterName: 'acme-production-us-east',
    version: 'v2.4.1-ebpf',
    kernelVersion: '5.15.0-89-generic',
    status: 'ONLINE',
    heartbeat: '8 giây trước',
    latency: '1.2ms',
    telemetryStatus: 'NORMAL',
    tokenExpires: '28 ngày',
    tokenMasked: 'selfai_agent_live_382c1b...29b7',
    podCount: 18,
  },
  {
    id: 'agent-finflow-01',
    nodeName: 'finflow-k8s-master-01',
    companyId: 'org-finflow-02',
    companyName: 'FinFlow Pay Platform',
    clusterName: 'finflow-prod-hcm',
    version: 'v2.4.0-ebpf',
    kernelVersion: '5.19.0-42-generic',
    status: 'DEGRADED',
    heartbeat: '48 giây trước',
    latency: '8.4ms',
    telemetryStatus: 'ANOMALY_SLOW',
    tokenExpires: '12 ngày',
    tokenMasked: 'selfai_agent_live_190a4e...71c0',
    podCount: 32,
  },
  {
    id: 'agent-finflow-02',
    nodeName: 'finflow-k8s-worker-01',
    companyId: 'org-finflow-02',
    companyName: 'FinFlow Pay Platform',
    clusterName: 'finflow-prod-hcm',
    version: 'v2.4.0-ebpf',
    kernelVersion: '5.19.0-42-generic',
    status: 'ONLINE',
    heartbeat: '12 giây trước',
    latency: '1.5ms',
    telemetryStatus: 'NORMAL',
    tokenExpires: '12 ngày',
    tokenMasked: 'selfai_agent_live_449d01...99f4',
    podCount: 22,
  },
  {
    id: 'agent-nexus-01',
    nodeName: 'nexus-logistics-node-a',
    companyId: 'org-nexus-03',
    companyName: 'Nexus Logistics AI',
    clusterName: 'nexus-cluster-sg',
    version: 'v2.4.1-ebpf',
    kernelVersion: '6.1.0-18-amd64',
    status: 'ONLINE',
    heartbeat: '4 giây trước',
    latency: '0.9ms',
    telemetryStatus: 'NORMAL',
    tokenExpires: '45 ngày',
    tokenMasked: 'selfai_agent_live_773f8a...33a2',
    podCount: 14,
  },
  {
    id: 'agent-viettel-01',
    nodeName: 'vt-cloud-worker-03',
    companyId: 'org-viettel-04',
    companyName: 'Viettel SME Cloud',
    clusterName: 'viettel-k8s-hn-01',
    version: 'v2.3.9-ebpf',
    kernelVersion: '5.10.0-23-cloud',
    status: 'OFFLINE',
    heartbeat: '14 phút trước',
    latency: 'N/A',
    telemetryStatus: 'NO_DATA',
    tokenExpires: 'Hết hạn',
    tokenMasked: 'selfai_agent_live_551e22...1109',
    podCount: 0,
  },
  {
    id: 'agent-fpt-01',
    nodeName: 'fpt-edge-node-01',
    companyId: 'org-fpt-05',
    companyName: 'FPT Digital Smart Retail',
    clusterName: 'fpt-retail-edge-cluster',
    version: 'v2.4.1-ebpf',
    kernelVersion: '5.15.0-89-generic',
    status: 'ONLINE',
    heartbeat: '6 giây trước',
    latency: '1.1ms',
    telemetryStatus: 'NORMAL',
    tokenExpires: '60 ngày',
    tokenMasked: 'selfai_agent_live_883a99...45bc',
    podCount: 19,
  },
];

export const AdminAgentManagementPage = ({ onNavigate }) => {
  const [agents, setAgents] = useState(INITIAL_AGENTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Modal Xoay vòng Token / Thu hồi Token
  const [tokenModal, setTokenModal] = useState({ open: false, type: '', agent: null });
  // Drawer Chi tiết Agent
  const [selectedAgent, setSelectedAgent] = useState(null);
  // State test ping pipeline
  const [pingStatus, setPingStatus] = useState({});

  const debouncedSearch = useDebounce(search, 250);

  // Danh sách công ty duy nhất
  const uniqueCompanies = useMemo(() => {
    const map = new Map();
    INITIAL_AGENTS.forEach((a) => {
      map.set(a.companyId, a.companyName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, []);

  // Lọc agents
  const filteredAgents = useMemo(() => {
    return agents.filter((item) => {
      const matchSearch =
        !debouncedSearch ||
        item.nodeName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        item.companyName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        item.clusterName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        item.version.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchCompany = companyFilter === 'ALL' || item.companyId === companyFilter;
      return matchSearch && matchStatus && matchCompany;
    });
  }, [agents, debouncedSearch, statusFilter, companyFilter]);

  // Thống kê
  const stats = useMemo(() => {
    let online = 0;
    let degraded = 0;
    let offline = 0;
    agents.forEach((a) => {
      if (a.status === 'ONLINE') online++;
      else if (a.status === 'DEGRADED') degraded++;
      else if (a.status === 'OFFLINE') offline++;
    });
    return {
      total: agents.length,
      online,
      degraded,
      offline,
      healthyPct: Math.round((online / (agents.length || 1)) * 100),
    };
  }, [agents]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Đã làm mới dữ liệu nhịp tim và trạng thái tác tử viễn trắc!');
    }, 600);
  };

  const handleOpenTokenModal = (agent, actionType) => {
    setTokenModal({ open: true, type: actionType, agent });
  };

  const handleConfirmTokenAction = () => {
    const { agent, type } = tokenModal;
    if (!agent) return;

    if (type === 'ROTATE') {
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? {
                ...a,
                tokenMasked: `selfai_agent_live_${randomSuffix}...${Math.random().toString(36).substring(2, 6)}`,
                tokenExpires: '60 ngày',
              }
            : a
        )
      );
      showToast(`Đã xoay vòng Agent Token cho node "${agent.nodeName}". Token mới có hiệu lực 60 ngày!`);
    } else if (type === 'REVOKE') {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? {
                ...a,
                status: 'OFFLINE',
                tokenExpires: 'Đã thu hồi',
                telemetryStatus: 'TOKEN_REVOKED',
              }
            : a
        )
      );
      showToast(`Đã thu hồi quyền kết nối của tác tử "${agent.nodeName}". Tác tử đã bị ngắt kết nối an toàn!`);
    }

    setTokenModal({ open: false, type: '', agent: null });
  };

  const handleTestPing = (agentId) => {
    setPingStatus((prev) => ({ ...prev, [agentId]: 'testing' }));
    setTimeout(() => {
      setPingStatus((prev) => ({ ...prev, [agentId]: 'success' }));
      setTimeout(() => {
        setPingStatus((prev) => ({ ...prev, [agentId]: null }));
      }, 3000);
    }, 800);
  };

  return (
    <div
      className="admin-agents-page"
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
            <Bot size={26} style={{ color: '#059669' }} />
            Quản Lý Tác Tử Toàn Hệ Thống (Agent Management)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Giám sát vòng đời, trạng thái nhịp tim (Heartbeat), xoay vòng Token bảo mật và kênh truyền viễn trắc eBPF của tất cả Agent trên mọi công ty.
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
            <span>Làm Mới</span>
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

      {/* 2. Architecture Notice Alert */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: '12px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#334155',
          }}
        >
          <Zap size={16} />
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
          <strong style={{ color: '#0F172A' }}>Phân biệt phạm vi quản trị:</strong> Super Admin quản lý việc cấp phát mã xác thực (Agent Token), trạng thái kết nối nhịp tim và luồng truyền dữ liệu viễn trắc cấp nền tảng. Các thao tác điều khiển ứng dụng Kubernetes cụ thể (Pod restart, Scale) do chính kỹ sư DevOps của từng công ty điều hành tại Dashboard riêng.
        </div>
      </div>

      {/* 3. KPI Statistics Cards */}
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
              Tổng Tác Tử eBPF
            </span>
            <Bot size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
            {stats.total} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-secondary)' }}>Nodes</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '6px' }}>
            100% Kernel CO-RE 5.4+
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
              Trực Tuyến (Online)
            </span>
            <CheckCircle2 size={16} color="#15803D" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#14532D' }}>
            {stats.online} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#166534' }}>({stats.healthyPct}%)</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: 600, marginTop: '6px' }}>
            Độ trễ trung bình: 1.1ms
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: stats.degraded > 0 ? '1px solid #FDE68A' : '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>
              Suy Giảm (Degraded)
            </span>
            <AlertTriangle size={16} color="#D97706" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#B45309' }}>
            {stats.degraded} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#92400E' }}>Node</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 600, marginTop: '6px' }}>
            Trễ nhịp tim &gt; 30 giây
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: stats.offline > 0 ? '1px solid #FECACA' : '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
              Ngoại Tuyến (Offline)
            </span>
            <ShieldAlert size={16} color="#DC2626" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626' }}>
            {stats.offline} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#991B1B' }}>Node</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600, marginTop: '6px' }}>
            Token hết hạn hoặc mất kết nối
          </div>
        </div>
      </div>

      {/* 4. Connection Pipeline Health */}
      <div
        style={{
          padding: '18px 20px',
          borderRadius: '12px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '14px' }}>
          Đường Ống Kết Nối Viễn Trắc Toàn Mạng (Agent Connection Pipeline)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>128 eBPF Probes</div>
              <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>Tác tử thu thập Kernel</div>
            </div>
          </div>

          <ChevronRight size={18} color="#94A3B8" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>Ingestion Gateway</div>
              <div style={{ fontSize: '0.6875rem', color: '#2563EB', fontWeight: 600 }}>Cổng tiếp nhận gRPC</div>
            </div>
          </div>

          <ChevronRight size={18} color="#94A3B8" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#F0FDF4', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>Main Backend (Node.js)</div>
              <div style={{ fontSize: '0.6875rem', color: '#15803D', fontWeight: 600 }}>Port 5000 - Khỏe mạnh</div>
            </div>
          </div>

          <ChevronRight size={18} color="#94A3B8" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FAF5FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>AI Engine (FastAPI)</div>
              <div style={{ fontSize: '0.6875rem', color: '#7E22CE', fontWeight: 600 }}>Port 8000 - p50 1.2ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Filters Bar */}
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
          {/* Search */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={14} color="var(--dash-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Tìm Node, công ty, cụm cluster, phiên bản..."
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

          {/* Status Filter */}
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
            <option value="ONLINE">Trực Tuyến (Online)</option>
            <option value="DEGRADED">Suy Giảm (Degraded)</option>
            <option value="OFFLINE">Ngoại Tuyến (Offline)</option>
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
            <option value="ALL">Tất Cả Công Ty ({uniqueCompanies.length})</option>
            {uniqueCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)' }}>
          Hiển thị <strong>{filteredAgents.length}</strong> / {agents.length} tác tử
        </div>
      </div>

      {/* 6. Agents Table */}
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
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Node Máy Chủ</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Công Ty & Cụm K8s</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>eBPF & Kernel Linux</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Nhịp Tim / Độ Trễ</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Agent Token</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Thao Tác Bảo Mật</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((agent) => (
              <tr
                key={agent.id}
                style={{
                  borderBottom: '1px solid var(--dash-border)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Node Name */}
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
                      <Bot size={14} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{agent.nodeName}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {agent.id} • {agent.podCount} Pods giám sát
                      </div>
                    </div>
                  </div>
                </td>

                {/* Company & Cluster */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{agent.companyName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={11} /> {agent.clusterName}
                  </div>
                </td>

                {/* eBPF & Kernel */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0F172A' }}>{agent.version}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {agent.kernelVersion}
                  </div>
                </td>

                {/* Status */}
                <td style={{ padding: '14px 16px' }}>
                  {agent.status === 'ONLINE' ? (
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
                      <CheckCircle2 size={11} /> Trực Tuyến
                    </span>
                  ) : agent.status === 'DEGRADED' ? (
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
                      <AlertTriangle size={11} /> Suy Giảm
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
                      <ShieldAlert size={11} /> Ngoại Tuyến
                    </span>
                  )}
                </td>

                {/* Heartbeat / Latency */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--dash-text-secondary)' }}>
                    <Clock size={12} /> {agent.heartbeat}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    Độ trễ: {agent.latency}
                  </div>
                </td>

                {/* Token */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)' }}>
                    {agent.tokenMasked}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: agent.tokenExpires.includes('Hết') ? '#DC2626' : '#059669', fontWeight: 600 }}>
                    Hết hạn: {agent.tokenExpires}
                  </div>
                </td>

                {/* Actions */}
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {/* Ping Test */}
                    <button
                      type="button"
                      onClick={() => handleTestPing(agent.id)}
                      disabled={pingStatus[agent.id] === 'testing' || agent.status === 'OFFLINE'}
                      title="Kiểm tra kết nối pipeline"
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: '#FFFFFF',
                        color: pingStatus[agent.id] === 'success' ? '#059669' : 'var(--dash-text-secondary)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        cursor: agent.status === 'OFFLINE' ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      {pingStatus[agent.id] === 'testing' ? (
                        <RefreshCw size={11} className="spin-icon" />
                      ) : (
                        <Activity size={11} />
                      )}
                      <span>{pingStatus[agent.id] === 'success' ? 'OK (1.1ms)' : 'Ping'}</span>
                    </button>

                    {/* Rotate Token */}
                    <button
                      type="button"
                      onClick={() => handleOpenTokenModal(agent, 'ROTATE')}
                      title="Xoay vòng Agent Token"
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid #BBF7D0',
                        backgroundColor: '#F0FDF4',
                        color: '#15803D',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <RotateCw size={11} />
                      <span>Xoay Token</span>
                    </button>

                    {/* Revoke Token */}
                    <button
                      type="button"
                      onClick={() => handleOpenTokenModal(agent, 'REVOKE')}
                      title="Thu hồi Agent Token"
                      disabled={agent.status === 'OFFLINE'}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid #FECACA',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        cursor: agent.status === 'OFFLINE' ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Ban size={11} />
                      <span>Thu Hồi</span>
                    </button>

                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => setSelectedAgent(agent)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: '#FFFFFF',
                        color: 'var(--dash-text-primary)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Chi Tiết
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 7. Modal Xoay Vòng / Thu Hồi Token */}
      {tokenModal.open && tokenModal.agent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {tokenModal.type === 'ROTATE' ? (
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RotateCw size={18} />
                  </div>
                ) : (
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ban size={18} />
                  </div>
                )}
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  {tokenModal.type === 'ROTATE' ? 'Xác Nhận Xoay Vòng Agent Token' : 'Thu Hồi Quyền Kết Nối Của Tác Tử'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTokenModal({ open: false, type: '', agent: null })}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              {tokenModal.type === 'ROTATE' ? (
                <>
                  Hệ thống sẽ cấp một token xác thực mới cho tác tử trên node{' '}
                  <strong style={{ color: '#0F172A' }}>{tokenModal.agent.nodeName}</strong> thuộc công ty{' '}
                  <strong style={{ color: '#0F172A' }}>{tokenModal.agent.companyName}</strong>. Token cũ sẽ có thời gian chuyển tiếp 24 giờ trước khi bị vô hiệu hóa hoàn toàn.
                </>
              ) : (
                <>
                  <span style={{ color: '#DC2626', fontWeight: 700 }}>CẢNH BÁO:</span> Bạn đang thu hồi Token của tác tử trên node{' '}
                  <strong style={{ color: '#0F172A' }}>{tokenModal.agent.nodeName}</strong>. Tác tử này sẽ bị từ chối kết nối vào Ingestion API và không thể gửi dữ liệu viễn trắc eBPF cho đến khi được cấp lại Token mới.
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setTokenModal({ open: false, type: '', agent: null })}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmTokenAction}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: tokenModal.type === 'ROTATE' ? '#059669' : '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {tokenModal.type === 'ROTATE' ? 'Tiến Hành Xoay Vòng' : 'Thu Hồi Ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Drawer Chi Tiết Agent */}
      {selectedAgent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#FFFFFF',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              padding: '24px',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--dash-border)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                  Hồ Sơ Tác Tử eBPF
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: '4px 0 0 0' }}>
                  {selectedAgent.nodeName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '4px' }}>Công Ty Sở Hữu</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>{selectedAgent.companyName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>Cluster: {selectedAgent.clusterName}</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '4px' }}>Thông Tin Môi Trường Nhân (Kernel)</div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>Linux Kernel: {selectedAgent.kernelVersion}</div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>Probe Version: {selectedAgent.version}</div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>eBPF Map Memory: 42.4 MB</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '4px' }}>Trạng Thái Kênh Viễn Trắc</div>
                <div style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 700 }}>
                  Telemetry Stream: {selectedAgent.telemetryStatus}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                  Lần phát hiện bất thường gần nhất: Không có (Bình thường)
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '4px' }}>Bảo Mật & Khóa Kết Nối</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{selectedAgent.tokenMasked}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>Thời hạn còn lại: {selectedAgent.tokenExpires}</div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--dash-border)' }}>
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--dash-text-primary)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Đóng Ngăn Thông Tin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAgentManagementPage;
