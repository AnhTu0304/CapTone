import React, { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { clusterService } from '../../../services/clusterService';
import {
  Server,
  ArrowLeft,
  Radio,
  CheckCircle2,
  Cpu,
  Layers,
  Activity,
  Globe,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Box,
  KeyRound,
  AlertTriangle,
  HardDrive,
  Clock,
  Search,
  Filter,
  ShieldAlert,
  Trash2,
  X,
  Wifi,
  AlertCircle,
  Building,
  Key,
  Settings,
  Sliders,
  PowerOff,
  FileText,
  Zap,
  CheckCircle,
  Info,
  CheckCheck,
  Sparkles,
} from 'lucide-react';

export const ClusterDetailPage = ({ clusterId, onNavigate, onBack }) => {
  const { currentOrg, isRefreshing: isGlobalRefreshing } = useDashboard();
  const [clusterData, setClusterData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'nodes' | 'pods' | 'logs' | 'config'
  const [copiedField, setCopiedField] = useState(null);

  // Pods search & filter
  const [podSearch, setPodSearch] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('ALL');

  // Token Rotation Modal State (1 Cluster 1 Agent, Xoay vòng thay thế token cũ)
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateExpiresInDays, setRotateExpiresInDays] = useState(90);
  const [rotatedTokenResult, setRotatedTokenResult] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Agent Configuration State
  const [metricInterval, setMetricInterval] = useState(15);
  const [monitoredNs, setMonitoredNs] = useState('ALL');
  const [logLevel, setLogLevel] = useState('INFO');
  const [probesConfig, setProbesConfig] = useState({
    kprobe_syscalls: true,
    process_exec: true,
    tcp_latency: true,
    oom_killer: true,
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

  // Disconnect Agent Modal State
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Remove Cluster Modal State
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [confirmClusterName, setConfirmClusterName] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  // Revoke Token Loading State
  const [isRevokingId, setIsRevokingId] = useState(null);
  const [connectTab, setConnectTab] = useState('quickstart'); // 'quickstart' | 'script' | 'helm' | 'uninstall'
  const [quickstartEnv, setQuickstartEnv] = useState('local'); // 'local' | 'cloud'
  const [scriptOs, setScriptOs] = useState('windows'); // 'windows' | 'linux'

  const fetchDetail = useCallback(async (isSilent = false) => {
    if (!clusterId) return;
    if (!isSilent) setIsLoading(true);

    try {
      const data = await clusterService.getClusterDetail(clusterId, currentOrg?.id);
      if (data) {
        setClusterData(data);
        if (data.agent_config) {
          if (data.agent_config.metric_interval_sec) setMetricInterval(data.agent_config.metric_interval_sec);
          if (data.agent_config.monitored_namespaces) {
            setMonitoredNs(Array.isArray(data.agent_config.monitored_namespaces) ? data.agent_config.monitored_namespaces[0] || 'ALL' : 'ALL');
          }
          if (data.agent_config.log_level) setLogLevel(data.agent_config.log_level);
          if (data.agent_config.probes) {
            setProbesConfig((prev) => ({ ...prev, ...data.agent_config.probes }));
          }
        }
      }
    } catch (err) {
      console.warn('[ClusterDetailPage] Lỗi tải chi tiết cụm:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [clusterId, currentOrg?.id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDetail(true);
  };

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (onNavigate) {
      onNavigate('/dashboard/clusters');
    }
  };

  // 1. Chức năng Xoay Vòng / Đổi Token (Rotate Token) - 1 Cụm 1 Agent, thay thế token cũ bằng token mới
  const handleRotateToken = async (e) => {
    e.preventDefault();
    setIsRotating(true);
    setActionError(null);

    try {
      const res = await clusterService.rotateClusterToken(clusterId, currentOrg?.id, {
        expires_in_days: rotateExpiresInDays === 'never' ? null : Number(rotateExpiresInDays),
        revoke_previous: true, // Luôn thu hồi token cũ theo đúng nghiệp vụ 1 cụm 1 token
      });
      setRotatedTokenResult(res);
      await fetchDetail(true);
    } catch (err) {
      setActionError(err.message || 'Lỗi khi xoay vòng mã token');
    } finally {
      setIsRotating(false);
    }
  };

  const handleCloseRotateModal = () => {
    setShowRotateModal(false);
    setRotatedTokenResult(null);
    setActionError(null);
  };

  // 2. Chức năng Thu Hồi Token
  const handleRevokeToken = async (tokenId) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi Token này? Tác tử đang dùng token này sẽ mất quyền kết nối tới hệ thống.')) {
      return;
    }
    setIsRevokingId(tokenId);
    try {
      await clusterService.revokeClusterToken(clusterId, tokenId, currentOrg?.id);
      await fetchDetail(true);
    } catch (err) {
      alert('Không thể thu hồi token: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsRevokingId(null);
    }
  };

  // 3. Chức năng Lưu Cấu Hình Tác Tử (Agent Configuration)
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigSaveSuccess(false);

    try {
      await clusterService.updateAgentConfig(clusterId, currentOrg?.id, {
        metric_interval_sec: Number(metricInterval),
        monitored_namespaces: monitoredNs === 'ALL' ? ['ALL'] : [monitoredNs],
        log_level: logLevel,
        probes: probesConfig,
      });
      setConfigSaveSuccess(true);
      await fetchDetail(true);
      setTimeout(() => setConfigSaveSuccess(false), 3000);
    } catch (err) {
      alert('Lỗi lưu cấu hình: ' + (err.message || 'Lỗi máy chủ'));
    } finally {
      setIsSavingConfig(false);
    }
  };

  // 4. Chức năng Ngắt Kết Nối Agent (Disconnect Agent)
  const handleDisconnectAgent = async () => {
    setIsDisconnecting(true);
    try {
      await clusterService.disconnectAgent(clusterId, currentOrg?.id);
      setShowDisconnectModal(false);
      await fetchDetail(true);
    } catch (err) {
      alert('Lỗi ngắt kết nối: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsDisconnecting(false);
    }
  };

  // 4b. Chức năng Làm mới trạng thái kết nối Agent thực tế (Refresh Agent Status)
  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      await fetchDetail(true);
    } catch (err) {
      alert('Lỗi làm mới trạng thái: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsRefreshing(false);
    }
  };

  // 5. Chức năng Xóa Cụm Kubernetes (Remove Cluster)
  const handleRemoveCluster = async () => {
    if (confirmClusterName.trim() !== clusterData?.name) {
      alert('Tên cụm xác nhận không trùng khớp.');
      return;
    }
    setIsRemoving(true);
    try {
      await clusterService.removeCluster(clusterId, currentOrg?.id);
      setShowRemoveModal(false);
      if (onNavigate) {
        onNavigate('/dashboard/clusters');
      } else if (onBack) {
        onBack();
      }
    } catch (err) {
      alert('Lỗi xóa cụm: ' + (err.message || 'Lỗi hệ thống'));
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ height: '40px', width: '240px', backgroundColor: '#F1F5F9', borderRadius: '8px' }} />
        <div style={{ height: '140px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--dash-border)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: '100px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!clusterData) {
    return (
      <div className="dash-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <AlertTriangle size={36} color="#F59E0B" style={{ marginBottom: '12px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0' }}>Không tìm thấy thông tin Cụm Kubernetes</h2>
        <p style={{ color: 'var(--dash-text-secondary)', marginBottom: '20px' }}>
          Cụm máy chủ có thể đã bị xóa hoặc bạn không có quyền truy cập.
        </p>
        <button
          onClick={handleBack}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--dash-primary)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Quay lại danh sách Cụm
        </button>
      </div>
    );
  }

  const nodes = clusterData.nodes || [];
  const pods = clusterData.pods || [];
  const tokens = clusterData.tokens && clusterData.tokens.length > 0
    ? clusterData.tokens
    : (clusterData.token ? [clusterData.token] : []);
  const heartbeats = clusterData.recent_heartbeats || [];
  const connectionLogs = clusterData.connection_logs || [];
  const namespaces = clusterData.namespaces && clusterData.namespaces.length > 0
    ? clusterData.namespaces
    : [{ name: 'default' }, { name: 'kube-system' }];

  const isProd = (clusterData.environment_type || '').toUpperCase().includes('PROD');

  // Active Token (1 cluster 1 active token)
  const activeToken = tokens.find((t) => t.is_active) || tokens[0] || null;
  const hasRawToken = Boolean(rotatedTokenResult?.raw_token);
  const activeTokenPrefix = activeToken?.token_prefix || '';
  const tokenDisplay = hasRawToken
    ? rotatedTokenResult.raw_token
    : (activeTokenPrefix ? `${activeTokenPrefix}••••••••••••` : '••••••••••••');
  const tokenCopyValue = hasRawToken
    ? rotatedTokenResult.raw_token
    : '<YOUR_AGENT_TOKEN>';

  // Trạng thái Agent chuẩn hóa: ONLINE | OFFLINE | CONNECTING | DEGRADED | PENDING
  const rawStatus = (clusterData.agent_status || 'PENDING').toUpperCase();
  const isOnline = rawStatus === 'ONLINE';
  const isDegraded = rawStatus === 'DEGRADED';
  const isConnecting = rawStatus === 'CONNECTING' || rawStatus === 'PENDING';
  const isOffline = rawStatus === 'OFFLINE';

  const agentStatusText = isOnline
    ? 'Online'
    : (isDegraded ? 'Degraded' : (isConnecting ? 'Chờ kết nối (Connecting)' : 'Offline'));

  const statusColor = isOnline
    ? '#059669'
    : (isDegraded ? '#D97706' : (isConnecting ? '#2563EB' : '#DC2626'));
  const statusBg = isOnline
    ? '#ECFDF5'
    : (isDegraded ? '#FEF3C7' : (isConnecting ? '#EFF6FF' : '#FEE2E2'));
  const statusDot = isOnline
    ? '#10B981'
    : (isDegraded ? '#F59E0B' : (isConnecting ? '#3B82F6' : '#EF4444'));

  // Chỉ hiển thị độ trễ thực tế khi Agent đã Online thật
  const latestLatency = isOnline && heartbeats[0] ? (heartbeats[0]?.latency_ms ?? 1.2) : null;

  // Filter pods
  const filteredPods = pods.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(podSearch.toLowerCase()) ||
                          (p.image && p.image.toLowerCase().includes(podSearch.toLowerCase()));
    const matchesNs = selectedNamespace === 'ALL' || p.namespace === selectedNamespace;
    return matchesSearch && matchesNs;
  });

  return (
    <div className="cluster-detail-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            padding: '6px 0',
            color: 'var(--dash-primary)',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          <span>Quay lại danh sách Cụm K8s</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Nút Xoay Vòng / Đổi Token (Rotate Token) */}
          <button
            type="button"
            onClick={() => setShowRotateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: '#059669',
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-sm)',
            }}
          >
            <Key size={14} />
            <span>Xoay Vòng / Đổi Token (Rotate Token)</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
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
              boxShadow: 'var(--dash-shadow-sm)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isGlobalRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang đồng bộ...' : 'Đồng bộ Live'}</span>
          </button>
        </div>
      </div>

      {/* 1. View Details: Header Banner Tổng Quan */}
      <div
        className="dash-card"
        style={{
          padding: '28px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--dash-radius-lg)',
          border: '1px solid var(--dash-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '12px',
                backgroundColor: 'var(--dash-mint-100)',
                color: 'var(--dash-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Server size={30} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
                  {clusterData.name}
                </h1>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 'var(--dash-radius-full)',
                    backgroundColor: isProd ? '#ECFDF5' : '#EFF6FF',
                    color: isProd ? '#059669' : '#2563EB',
                    border: `1px solid ${isProd ? '#A7F3D0' : '#BFDBFE'}`,
                    letterSpacing: '0.04em',
                  }}
                >
                  {clusterData.environment_type || 'PRODUCTION'}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 'var(--dash-radius-full)',
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #CBD5E1',
                  }}
                >
                  {clusterData.provider || 'MINIKUBE'}
                </span>
                {/* 4. Agent Status Badge */}
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 'var(--dash-radius-full)',
                    backgroundColor: statusBg,
                    color: statusColor,
                    border: `1px solid ${statusColor}40`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusDot }} />
                  Agent: {agentStatusText}
                </span>
              </div>

              {/* Thông tin Môi Trường & Tổ chức chi tiết */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building size={13} color="var(--dash-text-muted)" />
                  Tổ chức: <strong style={{ color: 'var(--dash-text-primary)' }}>{clusterData.organization_name || currentOrg?.name || 'Doanh Nghiệp'}</strong>
                </span>
                <span>&bull;</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={13} color="var(--dash-text-muted)" />
                  Môi trường: <strong style={{ color: 'var(--dash-text-primary)' }}>{clusterData.environment_name} ({clusterData.environment_code || 'prod'})</strong>
                </span>
                <span>&bull;</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>UUID: {clusterData.id?.slice(0, 18)}...</span>
                <span>&bull;</span>
                <span>K8s: <strong style={{ color: 'var(--dash-text-primary)' }}>{clusterData.kubernetes_version}</strong></span>
                <span>&bull;</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} /> Khởi tạo: {new Date(clusterData.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          </div>

          {/* Endpoint box */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              maxWidth: '420px',
            }}
          >
            <ShieldCheck size={16} color="var(--dash-primary)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>
              {clusterData.endpoint}
            </span>
            <button
              onClick={() => handleCopy(clusterData.endpoint, 'endpoint')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748B' }}
              title="Sao chép Endpoint"
            >
              {copiedField === 'endpoint' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* 4 Quick KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', paddingTop: '10px', borderTop: '1px solid var(--dash-border)' }}>
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} color="#059669" /> Control Plane Health:
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} /> {clusterData.status === 'CONNECTED' ? 'Healthy (100%)' : 'Sẵn sàng'}
            </div>
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={14} color="var(--dash-primary)" /> Tác tử eBPF Agent:
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: statusColor, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusDot }} />
              <span>
                {isOnline ? `Online (${latestLatency || 1.2} ms)` : (isConnecting ? 'Chờ kết nối...' : 'Offline')}
              </span>
            </div>
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color="#2563EB" /> Máy chủ Nodes:
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
              {nodes.length > 0 ? (
                <>{nodes.length} Nodes &bull; <span style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 700 }}>100% Ready</span></>
              ) : (
                <span style={{ fontSize: '0.875rem', color: '#64748B', fontWeight: 600 }}>0 Nodes &bull; Chờ kết nối...</span>
              )}
            </div>
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box size={14} color="#7C3AED" /> Khối lượng Pods:
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
              {pods.length > 0 ? (
                <>{pods.length} Pods &bull; <span style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 700 }}>Đang chạy</span></>
              ) : (
                <span style={{ fontSize: '0.875rem', color: '#64748B', fontWeight: 600 }}>0 Pods &bull; Chưa có dữ liệu</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--dash-border)', paddingBottom: '0px', overflowX: 'auto' }}>
        {[
          { id: 'agent', label: 'Quản Lý & Kết Nối Agent', icon: Radio, count: null },
          { id: 'nodes', label: 'Máy Chủ Nodes', icon: Cpu, count: nodes.length },
          { id: 'pods', label: 'Tài Nguyên Pods Đang Chạy', icon: Box, count: pods.length },
          { id: 'logs', label: 'Nhật Ký Kết Nối (Connection Logs)', icon: FileText, count: connectionLogs.length },
          { id: 'config', label: 'Cấu Hình & Vùng Thao Tác', icon: Settings, count: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                border: 'none',
                background: 'none',
                borderBottom: isActive ? '3px solid var(--dash-primary)' : '3px solid transparent',
                color: isActive ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'var(--dash-mint-100)' : '#F1F5F9',
                    color: isActive ? 'var(--dash-primary)' : '#64748B',
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: QUẢN LÝ AGENT, KẾT NỐI, ROTATE TOKEN & CẤU HÌNH         */}
      {/* ============================================================== */}
      {activeTab === 'agent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 2 Top Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            
            {/* 4. Agent Status Card */}
            <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Radio size={20} color="var(--dash-primary)" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Tác tử Giám Sát eBPF Sensor</h3>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: statusColor, backgroundColor: statusBg, padding: '3px 10px', borderRadius: '6px', border: `1px solid ${statusColor}30` }}>
                  {agentStatusText}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem', backgroundColor: 'var(--dash-bg-canvas)', padding: '14px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Tên Tác Tử:</span>
                  <strong>{clusterData.agent_name || `${clusterData.name}-agent`}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Agent UID:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{clusterData.agent_uid || `agent-${clusterData.id?.slice(0, 8)}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Phiên bản Agent:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{clusterData.agent_version || 'v2.4.1'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Môi trường triển khai:</span>
                  <strong style={{ color: isProd ? '#059669' : '#2563EB' }}>
                    {clusterData.environment_name} ({clusterData.environment_type})
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Độ trễ phản hồi (Latency):</span>
                  <strong style={{ color: isOnline ? 'var(--dash-primary)' : '#64748B' }}>
                    {isOnline ? `${latestLatency || 1.2} ms (Live probe)` : 'Chưa có tín hiệu (Đang chờ kết nối...)'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Nhịp tim gần nhất (Heartbeat):</span>
                  <span>
                    {isOnline && heartbeats[0]
                      ? new Date(heartbeats[0].reported_at).toLocaleTimeString('vi-VN')
                      : 'Chưa nhận tín hiệu (Chờ cài đặt Agent trên K8s)'}
                  </span>
                </div>
              </div>

              {/* 4 Cảm biến eBPF nhân Linux Kernel */}
              <div>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: '0 0 10px 0', textTransform: 'uppercase', color: 'var(--dash-text-muted)' }}>
                  Cảm biến nhân Kernel eBPF đang kích hoạt
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.75rem' }}>
                  {[
                    { key: 'kprobe_syscalls', name: 'Kprobe System Calls', active: probesConfig.kprobe_syscalls },
                    { key: 'process_exec', name: 'Process Exec Tracker', active: probesConfig.process_exec },
                    { key: 'tcp_latency', name: 'TCP Socket Latency', active: probesConfig.tcp_latency },
                    { key: 'oom_killer', name: 'OOM Killer Watcher', active: probesConfig.oom_killer },
                  ].map((probe) => (
                    <div key={probe.key} style={{ padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#334155' }}>{probe.name}</span>
                      <span style={{ color: probe.active ? '#059669' : '#94A3B8', fontWeight: 700 }}>
                        {probe.active ? '● Bật' : '○ Tắt'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Rotate Token & 2. Connect Agent Quick Card */}
            <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <KeyRound size={20} color="var(--dash-primary)" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Mã Token Xác Thực & Xoay Vòng</h3>
                </div>
                {/* Rotate Token Button */}
                <button
                  type="button"
                  onClick={() => setShowRotateModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    backgroundColor: 'var(--dash-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Key size={13} />
                  <span>Xoay Vòng Token (Rotate)</span>
                </button>
              </div>

              {/* Active Token Display */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
                    Active Token (1 Cụm &bull; 1 Agent &bull; 1 Token)
                  </label>
                  {activeToken?.expires_at && (
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Hết hạn: {new Date(activeToken.expires_at).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type={hasRawToken ? 'text' : 'password'}
                    readOnly
                    value={tokenDisplay}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', backgroundColor: '#F8FAFC', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                  />
                  <button
                    onClick={() => handleCopy(tokenCopyValue, 'agent_token')}
                    style={{ padding: '8px 12px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    {copiedField === 'agent_token' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                    <span>{copiedField === 'agent_token' ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
                {!hasRawToken && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    Token gốc chỉ hiển thị một lần lúc khởi tạo và được lưu trữ dưới dạng SHA-256 hash trên server. Nếu chưa lưu mã token, vui lòng nhấn <strong>Rotate Token</strong> ở bên dưới để cấp phát mã mới.
                  </p>
                )}
              </div>

              {/* 2. Connect Agent: Lệnh Helm Triển Khai Nhanh */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: '4px' }}>
                  Lệnh kết nối nhanh Kubernetes (Helm Chart từ <code>deploy/helm/selfheal-agent</code>)
                </label>
                <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '14px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: '1.6', position: 'relative' }}>
                  <code>
                    helm upgrade --install selfheal-agent ./Agent/deploy/helm/selfheal-agent \<br />
                    &nbsp;&nbsp;--namespace selfheal-system --create-namespace \<br />
                    &nbsp;&nbsp;--set config.clusterId="{clusterData.id}" \<br />
                    &nbsp;&nbsp;--set secret.agentToken="{tokenCopyValue}"
                  </code>
                  <button
                    onClick={() => handleCopy(`helm upgrade --install selfheal-agent ./Agent/deploy/helm/selfheal-agent --namespace selfheal-system --create-namespace --set config.clusterId="${clusterData.id}" --set secret.agentToken="${tokenCopyValue}"`, 'helm')}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem' }}
                  >
                    {copiedField === 'helm' ? 'Đã sao chép' : 'Sao chép lệnh'}
                  </button>
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#F0FDF4', borderRadius: '6px', border: '1px solid #BBF7D0', fontSize: '0.75rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0 }} />
                <span>
                  Hệ thống duy trì 1 Agent duy nhất cho cụm này. Khi cần thay đổi, sử dụng chức năng <strong>Rotate Token</strong> để thay thế mã an toàn.
                </span>
              </div>
            </div>
          </div>

          {/* 2. Connect Agent: Hướng Dẫn Cài Đặt Chi Tiết Chuẩn Repo Agent (Connection Guide) */}
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={20} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Hướng Dẫn Cài Đặt & Kết Nối Agent Vào Cụm Kubernetes (Connect Agent)
                </h3>
              </div>

              {/* Method Switcher Tabs */}
              <div style={{ display: 'flex', gap: '6px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setConnectTab('quickstart')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: connectTab === 'quickstart' ? '#FFFFFF' : 'transparent',
                    color: connectTab === 'quickstart' ? 'var(--dash-primary)' : '#64748B',
                    boxShadow: connectTab === 'quickstart' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Sparkles size={13} color={connectTab === 'quickstart' ? 'var(--dash-primary)' : '#64748B'} />
                  Cho Người Mới (Quickstart)
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('script')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: connectTab === 'script' ? '#FFFFFF' : 'transparent',
                    color: connectTab === 'script' ? 'var(--dash-primary)' : '#64748B',
                    boxShadow: connectTab === 'script' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  ⚡ Cài Tự Động (One-Liner)
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('helm')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: connectTab === 'helm' ? '#FFFFFF' : 'transparent',
                    color: connectTab === 'helm' ? 'var(--dash-primary)' : '#64748B',
                    boxShadow: connectTab === 'helm' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  ⚓ Helm Chart (deploy/helm)
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('uninstall')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: connectTab === 'uninstall' ? '#FFFFFF' : 'transparent',
                    color: connectTab === 'uninstall' ? '#DC2626' : '#64748B',
                    boxShadow: connectTab === 'uninstall' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  🗑️ Gỡ Cài Đặt (Uninstall)
                </button>
              </div>
            </div>

            {/* TAB 0: QUICKSTART GUIDE CHO NGƯỜI MỚI */}
            {connectTab === 'quickstart' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header Controls: OS & Cluster Type */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Hệ điều hành của bạn:</span>
                    <div style={{ display: 'inline-flex', gap: '4px', backgroundColor: '#FFFFFF', padding: '2px', border: '1px solid #CBD5E1', borderRadius: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setScriptOs('windows')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: scriptOs === 'windows' ? 'var(--dash-primary)' : 'transparent',
                          color: scriptOs === 'windows' ? '#FFFFFF' : '#475569',
                        }}
                      >
                        Windows (PowerShell)
                      </button>
                      <button
                        type="button"
                        onClick={() => setScriptOs('linux')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: scriptOs === 'linux' ? 'var(--dash-primary)' : 'transparent',
                          color: scriptOs === 'linux' ? '#FFFFFF' : '#475569',
                        }}
                      >
                        Linux / macOS (Bash)
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Loại cụm Kubernetes:</span>
                    <div style={{ display: 'inline-flex', gap: '4px', backgroundColor: '#FFFFFF', padding: '2px', border: '1px solid #CBD5E1', borderRadius: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setQuickstartEnv('local')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: quickstartEnv === 'local' ? 'var(--dash-primary)' : 'transparent',
                          color: quickstartEnv === 'local' ? '#FFFFFF' : '#475569',
                        }}
                      >
                        Local (Minikube / Docker)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickstartEnv('cloud')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: quickstartEnv === 'cloud' ? 'var(--dash-primary)' : 'transparent',
                          color: quickstartEnv === 'cloud' ? '#FFFFFF' : '#475569',
                        }}
                      >
                        Cloud / Remote (K3s/EKS/GKE)
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4 Steps Stepper List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* BƯỚC 1 */}
                  <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--dash-primary)', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800 }}>1</span>
                        <strong style={{ fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>Mở Terminal & Chuyển vào thư mục dự án</strong>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>Quan Trọng</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.8125rem', lineHeight: '1.5' }}>
                      Mở PowerShell / Terminal và chuyển vào thư mục gốc của dự án. <em>Tránh chạy tại thư mục cá nhân mặc định <code>C:\Users\...</code> để không bị lỗi thiếu đường dẫn thư mục <code>Agent</code>.</em>
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      {scriptOs === 'windows' ? (
                        <code>d: ; cd \AISelfHealing</code>
                      ) : (
                        <code>cd ~/AISelfHealing</code>
                      )}
                      <button
                        onClick={() => handleCopy(scriptOs === 'windows' ? 'd:\ncd \\AISelfHealing' : 'cd ~/AISelfHealing', 'qs_step1')}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedField === 'qs_step1' ? <><Check size={12} color="#10B981" /> Đã sao chép</> : <><Copy size={12} /> Sao chép</>}
                      </button>
                    </div>
                  </div>

                  {/* BƯỚC 2 (Local only) */}
                  {quickstartEnv === 'local' && (
                    <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--dash-primary)', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800 }}>2</span>
                          <strong style={{ fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>Build & Nạp Image vào cụm Minikube (Chỉ làm 1 lần)</strong>
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>Cụm Local</span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.8125rem', lineHeight: '1.5' }}>
                        Vì mã nguồn Agent nằm ở máy local, bạn cần build Docker image và nạp vào Minikube để Pod K8s có thể khởi chạy mà không bị lỗi <code>ErrImagePull</code>:
                      </p>
                      <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                        {scriptOs === 'windows' ? (
                          <code>docker build -t captone-agent:1.0.0 -f Agent/Dockerfile Agent ; minikube image load captone-agent:1.0.0</code>
                        ) : (
                          <code>docker build -t captone-agent:1.0.0 -f Agent/Dockerfile Agent && minikube image load captone-agent:1.0.0</code>
                        )}
                        <button
                          onClick={() => handleCopy(
                            scriptOs === 'windows'
                              ? 'docker build -t captone-agent:1.0.0 -f Agent/Dockerfile Agent ; minikube image load captone-agent:1.0.0'
                              : 'docker build -t captone-agent:1.0.0 -f Agent/Dockerfile Agent && minikube image load captone-agent:1.0.0',
                            'qs_step2'
                          )}
                          style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {copiedField === 'qs_step2' ? <><Check size={12} color="#10B981" /> Đã sao chép</> : <><Copy size={12} /> Sao chép</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BƯỚC 3 */}
                  <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--dash-primary)', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800 }}>{quickstartEnv === 'local' ? '3' : '2'}</span>
                        <strong style={{ fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>Chạy Script Cài Đặt Tự Động Với Token Cụm</strong>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>Tự Động Kết Nối</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.8125rem', lineHeight: '1.5' }}>
                      Lệnh dưới đây đã tự động nhúng mã xác thực Token của cụm này. Script sẽ tự tạo namespace <code>selfheal-system</code>, cấu hình RBAC, Secret bảo mật và triển khai Agent Deployment:
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      {scriptOs === 'windows' ? (
                        <code>Set-ExecutionPolicy RemoteSigned -Scope Process; .\Agent\installer\install-agent.ps1 -Token "{tokenCopyValue}"</code>
                      ) : (
                        <code>chmod +x Agent/installer/install-agent.sh && ./Agent/installer/install-agent.sh --token "{tokenCopyValue}"</code>
                      )}
                      <button
                        onClick={() => handleCopy(
                          scriptOs === 'windows'
                            ? `Set-ExecutionPolicy RemoteSigned -Scope Process; .\\Agent\\installer\\install-agent.ps1 -Token "${tokenCopyValue}"`
                            : `chmod +x Agent/installer/install-agent.sh && ./Agent/installer/install-agent.sh --token "${tokenCopyValue}"`,
                          'qs_step3'
                        )}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedField === 'qs_step3' ? <><Check size={12} color="#10B981" /> Đã sao chép</> : <><Copy size={12} /> Sao chép</>}
                      </button>
                    </div>
                  </div>

                  {/* BƯỚC 4 */}
                  <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#10B981', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800 }}>{quickstartEnv === 'local' ? '4' : '3'}</span>
                        <strong style={{ fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>Kiểm Tra Trạng Thái & Nhận Tín Hiệu Online</strong>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#10B981', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>Hoàn Tất</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.8125rem', lineHeight: '1.5' }}>
                      Kiểm tra trạng thái Pod của Agent trong cụm. Khi thấy trạng thái <code>Running</code>, đèn giám sát phía trên sẽ lập tức chuyển sang <strong>Online</strong>:
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      <code>kubectl get pods -n selfheal-system</code>
                      <button
                        onClick={() => handleCopy('kubectl get pods -n selfheal-system', 'qs_step4')}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedField === 'qs_step4' ? <><Check size={12} color="#10B981" /> Đã sao chép</> : <><Copy size={12} /> Sao chép</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: ONE-LINER AUTOMATED SCRIPT */}
            {connectTab === 'script' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* OS Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Hệ điều hành máy chủ quản trị:</span>
                  <div style={{ display: 'inline-flex', gap: '4px', backgroundColor: '#F8FAFC', padding: '2px', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setScriptOs('linux')}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: scriptOs === 'linux' ? 'var(--dash-primary)' : 'transparent',
                        color: scriptOs === 'linux' ? '#FFFFFF' : '#475569',
                      }}
                    >
                      Linux / macOS (Bash)
                    </button>
                    <button
                      type="button"
                      onClick={() => setScriptOs('windows')}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: scriptOs === 'windows' ? 'var(--dash-primary)' : 'transparent',
                        color: scriptOs === 'windows' ? '#FFFFFF' : '#475569',
                      }}
                    >
                      Windows (PowerShell)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {/* Script option 1: Remote One-liner */}
                  <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                        Cách 1: Lệnh Tải & Chạy Trực Tiếp (Qua Installer API)
                      </strong>
                      <span style={{ fontSize: '0.6875rem', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Khuyên Dùng</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      Installer Service trên cổng 8100/80 tự động nhúng cấu hình cluster và token xác thực:
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      {scriptOs === 'linux' ? (
                        <code>curl -sSL http://localhost/agent/install.sh | bash -s -- --token {tokenCopyValue}</code>
                      ) : (
                        <code>irm http://localhost/agent/install.ps1 | iex</code>
                      )}
                      <button
                        onClick={() => handleCopy(
                          scriptOs === 'linux'
                            ? `curl -sSL http://localhost/agent/install.sh | bash -s -- --token ${tokenCopyValue}`
                            : `irm http://localhost/agent/install.ps1 | iex`,
                          'oneliner_install'
                        )}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem' }}
                      >
                        {copiedField === 'oneliner_install' ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                    </div>
                  </div>

                  {/* Script option 2: Local Repo File */}
                  <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                      Cách 2: Chạy Script Có Sẵn Trong Thư Mục <code>Agent/installer/</code>
                    </strong>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      Chạy trực tiếp từ mã nguồn dự án trên máy quản trị có quyền <code>kubectl</code>:
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      {scriptOs === 'linux' ? (
                        <code>chmod +x Agent/installer/install-agent.sh && ./Agent/installer/install-agent.sh --token {tokenCopyValue}</code>
                      ) : (
                        <code>Set-ExecutionPolicy RemoteSigned -Scope Process; .\Agent\installer\install-agent.ps1 -Token "{tokenCopyValue}"</code>
                      )}
                      <button
                        onClick={() => handleCopy(
                          scriptOs === 'linux'
                            ? `chmod +x Agent/installer/install-agent.sh && ./Agent/installer/install-agent.sh --token ${tokenCopyValue}`
                            : `Set-ExecutionPolicy RemoteSigned -Scope Process; .\\Agent\\installer\\install-agent.ps1 -Token "${tokenCopyValue}"`,
                          'local_script_install'
                        )}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem' }}
                      >
                        {copiedField === 'local_script_install' ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Workflow explanation */}
                <div style={{ padding: '12px 14px', backgroundColor: '#EFF6FF', borderRadius: '6px', border: '1px solid #BFDBFE', fontSize: '0.75rem', color: '#1E40AF', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={15} /> Quy trình tự động thực hiện bởi bộ cài đặt:
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.6' }}>
                    <li>Tự động nhận diện Kubernetes Context hiện tại (Minikube, Docker Desktop K8s, Cloud K8s).</li>
                    <li>Khởi tạo Kubernetes Namespace <code>selfheal-system</code> độc lập.</li>
                    <li>Lưu trữ Agent Token an toàn vào Kubernetes Secret <code>selfheal-agent-secret</code> (không lộ plain text trên tiến trình).</li>
                    <li>Tự động kích hoạt Helm triển khai Agent Deployment và theo dõi quá trình Rollout hoàn tất.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* TAB 2: HELM CHART DEPLOYMENT */}
            {connectTab === 'helm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', fontSize: '0.8125rem' }}>
                  {/* Step 1 */}
                  <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <strong style={{ color: 'var(--dash-text-primary)' }}>Bước 1: Tạo Namespace & Secret Bảo Mật</strong>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      Khởi tạo namespace <code>selfheal-system</code> và Kubernetes Secret chứa Token của Agent.
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#E2E8F0', padding: '10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        kubectl create secret generic selfheal-agent-secret -n selfheal-system...
                      </span>
                      <button
                        onClick={() => handleCopy(`kubectl create namespace selfheal-system --dry-run=client -o yaml | kubectl apply -f -\nkubectl create secret generic selfheal-agent-secret -n selfheal-system --from-literal=AGENT_TOKEN="${tokenCopyValue}" --dry-run=client -o yaml | kubectl apply -f -`, 'helm_step1')}
                        style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', padding: '2px 4px' }}
                      >
                        {copiedField === 'helm_step1' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <strong style={{ color: 'var(--dash-text-primary)' }}>Bước 2: Triển Khai Helm Chart Tùy Chỉnh</strong>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      Cài đặt chart từ thư mục nguồn <code>Agent/deploy/helm/selfheal-agent</code>.
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#E2E8F0', padding: '10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        helm upgrade --install selfheal-agent ./Agent/deploy/helm/selfheal-agent...
                      </span>
                      <button
                        onClick={() => handleCopy(`helm upgrade --install selfheal-agent ./Agent/deploy/helm/selfheal-agent --namespace selfheal-system --set config.agentServerUrl="ws://localhost:5000/api/v1/agent/connect" --set config.clusterId="${clusterData.id}" --set secret.existingSecret="selfheal-agent-secret"`, 'helm_step2')}
                        style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', padding: '2px 4px' }}
                      >
                        {copiedField === 'helm_step2' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <strong style={{ color: 'var(--dash-text-primary)' }}>Bước 3: Xác Nhận Pods & Telemetry Logs</strong>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      Kiểm tra trạng thái Agent Pod và theo dõi luồng bắt tay WebSocket trực tiếp.
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#E2E8F0', padding: '10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>kubectl get pods -n selfheal-system</span>
                      <button
                        onClick={() => handleCopy('kubectl get pods -n selfheal-system\nkubectl logs -n selfheal-system -l app.kubernetes.io/name=selfheal-agent -f', 'helm_step3')}
                        style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', padding: '2px 4px' }}
                      >
                        {copiedField === 'helm_step3' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: UNINSTALLATION */}
            {connectTab === 'uninstall' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '14px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <strong style={{ color: '#991B1B', fontSize: '0.8125rem' }}>Gỡ Bỏ Sạch Sẽ Tác Tử SelfHeal Khỏi Cụm Kubernetes:</strong>
                  <p style={{ margin: 0, color: '#7F1D1D', fontSize: '0.75rem' }}>
                    Sử dụng các script gỡ bỏ trong thư mục <code>Agent/installer/</code> hoặc lệnh Helm để thu hồi tài nguyên ServiceAccount, ClusterRole và Secrets.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginTop: '6px' }}>
                    <div style={{ backgroundColor: '#0F172A', color: '#FCA5A5', padding: '10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>./Agent/installer/uninstall-agent.sh</span>
                      <button onClick={() => handleCopy('./Agent/installer/uninstall-agent.sh', 'un_sh')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>
                        {copiedField === 'un_sh' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div style={{ backgroundColor: '#0F172A', color: '#FCA5A5', padding: '10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>.\Agent\installer\uninstall-agent.ps1</span>
                      <button onClick={() => handleCopy('.\\Agent\\installer\\uninstall-agent.ps1', 'un_ps1')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>
                        {copiedField === 'un_ps1' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div style={{ backgroundColor: '#0F172A', color: '#FCA5A5', padding: '10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>helm uninstall selfheal-agent -n selfheal-system</span>
                      <button onClick={() => handleCopy('helm uninstall selfheal-agent -n selfheal-system\nkubectl delete namespace selfheal-system', 'un_helm')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>
                        {copiedField === 'un_helm' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Connection Probe & Simulation Trigger Bar */}
            <div style={{ marginTop: '4px', padding: '12px 16px', backgroundColor: isOnline ? '#F0FDF4' : '#F8FAFC', borderRadius: '8px', border: `1px solid ${isOnline ? '#BBF7D0' : 'var(--dash-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusDot }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                  Trạng Thái Hiện Tại: <strong style={{ color: statusColor }}>{agentStatusText}</strong>
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  {isOnline ? '— Đang truyền nhận telemetry 2 chiều qua WebSocket.' : '— Đang chờ Agent khởi chạy và gửi nhịp tim đầu tiên.'}
                </span>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={isRefreshing}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isOnline ? '#F0FDF4' : '#F8FAFC',
                    border: `1px solid ${isOnline ? '#BBF7D0' : '#CBD5E1'}`,
                    borderRadius: '6px',
                    color: isOnline ? '#15803D' : '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: isRefreshing ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: 'var(--dash-shadow-sm)',
                  }}
                >
                  <RefreshCw size={14} color={isOnline ? '#16A34A' : '#64748B'} />
                  <span>{isRefreshing ? 'Đang kiểm tra...' : (isOnline ? 'Làm Mới Trạng Thái (Online)' : 'Kiểm Tra Trạng Thái Kết Nối')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 6. Agent Configuration Form (Cấu hình namespace giám sát, chu kỳ gửi Metrics, eBPF probes) */}
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Cấu Hình Tác Tử Giám Sát (Agent Configuration)
                </h3>
              </div>
              {configSaveSuccess && (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCheck size={14} /> Đã lưu cấu hình thành công!
                </span>
              )}
            </div>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                    Chu kỳ gửi Metrics Telemetry
                  </label>
                  <select
                    value={metricInterval}
                    onChange={(e) => setMetricInterval(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
                  >
                    <option value={5}>Mỗi 5 giây (Thời gian thực / Tải cao)</option>
                    <option value={15}>Mỗi 15 giây (Khuyên dùng tiêu chuẩn)</option>
                    <option value={30}>Mỗi 30 giây (Tiết kiệm băng thông)</option>
                    <option value={60}>Mỗi 60 giây (Tiết kiệm tài nguyên)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                    Phạm vi Namespaces Giám Sát
                  </label>
                  <select
                    value={monitoredNs}
                    onChange={(e) => setMonitoredNs(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
                  >
                    <option value="ALL">Toàn bộ Namespaces (ALL Namespaces)</option>
                    {namespaces.map((ns) => {
                      const nsName = ns.name || ns;
                      return (
                        <option key={nsName} value={nsName}>
                          Chỉ giám sát: {nsName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                    Mức độ ghi nhật ký Agent (Log Level)
                  </label>
                  <select
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
                  >
                    <option value="INFO">INFO (Thông tin chuẩn)</option>
                    <option value="DEBUG">DEBUG (Chi tiết hỗ trợ gỡ lỗi)</option>
                    <option value="WARN">WARN (Chỉ ghi nhận cảnh báo)</option>
                    <option value="ERROR">ERROR (Chỉ ghi lỗi)</option>
                  </select>
                </div>
              </div>

              {/* Probes Toggles */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '8px' }}>
                  Kích hoạt các cảm biến eBPF Kernel Probes
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {[
                    { key: 'kprobe_syscalls', label: 'Kprobe Syscalls Tracker' },
                    { key: 'process_exec', label: 'Process Exec & Crash Tracker' },
                    { key: 'tcp_latency', label: 'TCP Socket Latency Filter' },
                    { key: 'oom_killer', label: 'OOM Killer Detector' },
                  ].map((item) => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--dash-border)', cursor: 'pointer', fontSize: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={!!probesConfig[item.key]}
                        onChange={(e) => setProbesConfig((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                        style={{ accentColor: 'var(--dash-primary)' }}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: 'var(--dash-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: isSavingConfig ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Check size={14} />
                  <span>{isSavingConfig ? 'Đang lưu...' : 'Lưu Cấu Hình Tác Tử'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MÁY CHỦ NODES                                           */}
      {/* ============================================================== */}
      {activeTab === 'nodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {nodes.length === 0 ? (
            <div className="dash-card" style={{ padding: '48px 24px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={28} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1E293B' }}>Chưa nhận diện máy chủ Node nào</h3>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B', maxWidth: '500px', lineHeight: '1.6' }}>
                Tác tử eBPF Agent đang ở trạng thái <strong>Chờ kết nối...</strong>. Sau khi triển khai và kết nối Agent vào cụm Kubernetes thành công, hệ thống sẽ tự động quét và hiển thị toàn bộ máy chủ Control Plane & Worker Nodes tại đây.
              </p>
            </div>
          ) : (
            <div className="dash-card" style={{ padding: '0px', overflow: 'hidden', border: '1px solid var(--dash-border)', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={18} color="var(--dash-primary)" />
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Danh Sách Máy Chủ Nodes Thực Tế Trong Database ({nodes.length} Nodes)</h3>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>● 100% Sẵn Sàng (Ready)</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--dash-border)', backgroundColor: '#FAFAFA', color: 'var(--dash-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 18px' }}>Tên Node</th>
                      <th style={{ padding: '12px 18px' }}>Vai Trò (Role)</th>
                      <th style={{ padding: '12px 18px' }}>Trạng Thái</th>
                      <th style={{ padding: '12px 18px' }}>CPU Cores</th>
                      <th style={{ padding: '12px 18px' }}>Bộ Nhớ RAM</th>
                      <th style={{ padding: '12px 18px' }}>Dung Lượng Ổ Cứng</th>
                      <th style={{ padding: '12px 18px' }}>Phiên Bản Kubelet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((node, index) => {
                      const ramGb = node.memory_capacity_bytes ? (node.memory_capacity_bytes / (1024 ** 3)).toFixed(1) : '8.0';
                      const diskGb = node.disk_capacity_bytes ? (node.disk_capacity_bytes / (1024 ** 3)).toFixed(0) : '50';
                      const cpuCores = node.cpu_capacity_millicores ? (node.cpu_capacity_millicores / 1000).toFixed(0) : '4';
                      const rolesArr = typeof node.roles === 'string' ? JSON.parse(node.roles || '[]') : (node.roles || []);
                      const roleLabel = rolesArr.includes('control-plane') ? 'control-plane' : 'worker';

                      return (
                        <tr key={node.id || index} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                          <td style={{ padding: '14px 18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>
                            {node.name}
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                backgroundColor: roleLabel === 'control-plane' ? '#F3E8FF' : '#E0E7FF',
                                color: roleLabel === 'control-plane' ? '#7E22CE' : '#4338CA',
                              }}
                            >
                              {roleLabel}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={14} /> Ready
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px' }}>{cpuCores} vCPU</td>
                          <td style={{ padding: '14px 18px' }}>{ramGb} GB</td>
                          <td style={{ padding: '14px 18px' }}>{diskGb} GB</td>
                          <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)' }}>{node.kubelet_version || 'v1.29.4'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: TÀI NGUYÊN PODS ĐANG CHẠY                               */}
      {/* ============================================================== */}
      {activeTab === 'pods' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {pods.length === 0 ? (
            <div className="dash-card" style={{ padding: '48px 24px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box size={28} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1E293B' }}>Chưa có khối lượng Pods nào</h3>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B', maxWidth: '500px', lineHeight: '1.6' }}>
                Cụm chưa nhận dữ liệu viễn trắc. Ngay khi Agent được kết nối thành công, các Pods đang vận hành trên các Namespaces sẽ được đồng bộ theo thời gian thực về màn hình này.
              </p>
            </div>
          ) : (
            <div className="dash-card" style={{ padding: '0px', overflow: 'hidden', border: '1px solid var(--dash-border)', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
              {/* Filter & Search Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Box size={18} color="var(--dash-primary)" />
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>
                    Danh Sách Pods Đang Vận Hành ({filteredPods.length}/{pods.length} Pods)
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                    <input
                      type="text"
                      placeholder="Tìm kiếm Pod hoặc Image..."
                      value={podSearch}
                      onChange={(e) => setPodSearch(e.target.value)}
                      style={{ padding: '7px 12px 7px 30px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem', width: '220px' }}
                    />
                  </div>

                  <select
                    value={selectedNamespace}
                    onChange={(e) => setSelectedNamespace(e.target.value)}
                    style={{ padding: '7px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
                  >
                    <option value="ALL">Tất cả Namespace ({namespaces.length})</option>
                    {namespaces.map((ns) => {
                      const nsName = ns.name || ns;
                      return (
                        <option key={nsName} value={nsName}>
                          Namespace: {nsName}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Pods Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--dash-border)', backgroundColor: '#FAFAFA', color: 'var(--dash-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 18px' }}>Tên Pod</th>
                      <th style={{ padding: '12px 18px' }}>Namespace</th>
                      <th style={{ padding: '12px 18px' }}>Máy Chủ Node</th>
                      <th style={{ padding: '12px 18px' }}>Trạng Thái</th>
                      <th style={{ padding: '12px 18px' }}>Khởi Động Lại (Restarts)</th>
                      <th style={{ padding: '12px 18px' }}>Container Image</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPods.map((pod, idx) => (
                      <tr key={pod.id || idx} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>
                          {pod.name}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                            {pod.namespace || 'default'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                          {pod.node_name || 'k8s-node'}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                            {pod.status || 'Running'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>{pod.restart_count ?? 0}</td>
                        <td style={{ padding: '12px 18px', fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pod.image}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: 5. CONNECTION LOGS (Nhật ký kết nối & xác thực)          */}
      {/* ============================================================== */}
      {activeTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dash-card" style={{ padding: '0px', overflow: 'hidden', border: '1px solid var(--dash-border)', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>
                  Nhật Ký Kết Nối, Lỗi Xác Thực & Tín Hiệu Agent (Connection Logs)
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                Hiển thị {connectionLogs.length} sự kiện kết nối gần nhất
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--dash-border)', backgroundColor: '#FAFAFA', color: 'var(--dash-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 18px' }}>Thời Gian</th>
                    <th style={{ padding: '12px 18px' }}>Loại Sự Kiện</th>
                    <th style={{ padding: '12px 18px' }}>Mức Độ</th>
                    <th style={{ padding: '12px 18px' }}>Chi Tiết Thông Báo Kết Nối</th>
                    <th style={{ padding: '12px 18px' }}>Nguồn IP / Node</th>
                  </tr>
                </thead>
                <tbody>
                  {connectionLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                        Chưa có sự kiện kết nối nào được ghi nhận.
                      </td>
                    </tr>
                  ) : (
                    connectionLogs.map((log, idx) => {
                      const sevColor = log.severity === 'SUCCESS' ? '#059669' : (log.severity === 'WARN' ? '#D97706' : (log.severity === 'ERROR' ? '#DC2626' : '#2563EB'));
                      const sevBg = log.severity === 'SUCCESS' ? '#ECFDF5' : (log.severity === 'WARN' ? '#FEF3C7' : (log.severity === 'ERROR' ? '#FEE2E2' : '#EFF6FF'));

                      return (
                        <tr key={log.id || idx} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                          <td style={{ padding: '12px 18px', color: '#64748B', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem' }}>
                              {log.event_type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, backgroundColor: sevBg, color: sevColor }}>
                              {log.severity}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', color: '#1E293B', fontWeight: 500 }}>
                            {log.message}
                          </td>
                          <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#64748B' }}>
                            {log.source_ip || log.node_name || '10.244.0.12'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: CẤU HÌNH CỤM & 7. DISCONNECT / REMOVE (VÙNG NGUY HIỂM)   */}
      {/* ============================================================== */}
      {activeTab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Cấu hình kỹ thuật */}
            <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Thông Số Kỹ Thuật Kubernetes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Mã Định Danh (Cluster ID):</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{clusterData.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Môi trường triển khai:</span>
                  <strong style={{ color: isProd ? '#059669' : '#2563EB' }}>{clusterData.environment_type}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>Nhà cung cấp hạ tầng:</span>
                  <span>{clusterData.provider}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>API Server Port:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>6443 (HTTPS Secure)</span>
                </div>
              </div>
            </div>

            {/* Self-Healing Status */}
            <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Cơ Chế Tự Phục Hồi (Self-Healing Status)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8125rem' }}>
                <div style={{ padding: '12px', backgroundColor: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                  <strong style={{ color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Chính sách tự chữa lành đang kích hoạt
                  </strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#047857' }}>
                    Tác tử giám sát đã liên kết cụm máy chủ với mô hình AI dự báo RCA và hệ thống Self-Healing tự sửa khi phát hiện sự cố.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 7. Disconnect / Remove: Vùng Thao Tác Nguy Hiểm (Danger Zone) */}
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B' }}>
              <ShieldAlert size={20} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Vùng Thao Tác An Toàn & Gỡ Bỏ (Danger Zone)</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#7F1D1D' }}>
              Các thao tác dưới đây có thể ảnh hưởng trực tiếp đến kết nối của tác tử giám sát hoặc xóa bỏ cấu hình cụm máy chủ.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', paddingTop: '8px' }}>
              {/* Ngắt kết nối Agent */}
              <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #F87171', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#991B1B' }}>Ngắt Kết Nối Agent (Disconnect)</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    Tạm dừng thu thập telemetry và vô hiệu hóa Token xác thực của Agent trên cụm này.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDisconnectModal(true)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #EF4444',
                    borderRadius: '6px',
                    color: '#DC2626',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <PowerOff size={14} />
                  <span>Ngắt Kết Nối Agent</span>
                </button>
              </div>

              {/* Xóa Cấu Hình Cụm */}
              <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #DC2626', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#7F1D1D' }}>Xóa Cụm Kubernetes (Remove Cluster)</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    Gỡ bỏ hoàn toàn cụm này khỏi hệ thống quản lý. Thao tác không thể hoàn tác.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRemoveModal(true)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#DC2626',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Trash2 size={14} />
                  <span>Xóa Cụm Kubernetes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: 3. ROTATE TOKEN (1 Cụm 1 Agent, Xoay vòng thay token cũ) */}
      {/* ============================================================== */}
      {showRotateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
              borderRadius: 'var(--dash-radius-lg)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                  {rotatedTokenResult ? 'Mã Token Mới Đã Tạo Thành Công' : 'Xoay Vòng Mã Token Agent (Rotate Token)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseRotateModal}
                style={{ background: 'none', border: 'none', color: 'var(--dash-text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {rotatedTokenResult ? (
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '14px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065F46', fontWeight: 700, fontSize: '0.875rem' }}>
                    <CheckCircle2 size={18} />
                    <span>Mã Token bí mật mới đã được khởi tạo! Token cũ đã bị thu hồi.</span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#047857' }}>
                    Lưu ý: Vì mục đích bảo mật, mã raw token dưới đây <strong>chỉ hiển thị một lần duy nhất</strong>. Hãy sao chép ngay để cấu hình lại DaemonSet.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: '4px' }}>
                    Mã Token Mới (Raw Token)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={rotatedTokenResult.raw_token}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        border: '1px solid #10B981',
                        borderRadius: '6px',
                        backgroundColor: '#F0FDF4',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: '#065F46',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(rotatedTokenResult.raw_token, 'new_token')}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'var(--dash-primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {copiedField === 'new_token' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedField === 'new_token' ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                </div>

                {rotatedTokenResult.install_command && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: '4px' }}>
                      Lệnh cập nhật Kubernetes DaemonSet với Token mới
                    </label>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '12px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: '1.5' }}>
                      <code>{rotatedTokenResult.install_command}</code>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleCloseRotateModal}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: 'var(--dash-primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Đã Lưu Xong & Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRotateToken} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {actionError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#B91C1C', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>{actionError}</span>
                  </div>
                )}

                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: '1.5' }}>
                  Mỗi Cụm Kubernetes duy trì <strong>1 Agent và 1 Token hoạt động duy nhất</strong>. Thao tác xoay vòng sẽ tự động thu hồi Token cũ và cấp phát Token mới an toàn.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                    Thời hạn hiệu lực của Token mới
                  </label>
                  <select
                    value={rotateExpiresInDays}
                    onChange={(e) => setRotateExpiresInDays(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <option value={30}>30 ngày (Khuyên dùng thử nghiệm)</option>
                    <option value={90}>90 ngày (Tiêu chuẩn bảo mật)</option>
                    <option value={180}>180 ngày (6 tháng)</option>
                    <option value={365}>365 ngày (1 năm)</option>
                    <option value="never">Vô thời hạn (Không bao giờ hết hạn)</option>
                  </select>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--dash-border)', fontSize: '0.75rem', color: '#64748B' }}>
                  Khi xoay vòng thành công, hãy cập nhật Secret hoặc DaemonSet trong cụm K8s với mã token mới để duy trì kết nối liên tục.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleCloseRotateModal}
                    style={{
                      padding: '9px 16px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isRotating}
                    style={{
                      padding: '9px 20px',
                      backgroundColor: 'var(--dash-primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      cursor: isRotating ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Key size={14} />
                    <span>{isRotating ? 'Đang xoay vòng...' : 'Xác Nhận Đổi Token Mới'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: 7. DISCONNECT AGENT                                   */}
      {/* ============================================================== */}
      {showDisconnectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              gap: '16px',
              borderRadius: 'var(--dash-radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626' }}>
              <PowerOff size={22} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Xác Nhận Ngắt Kết Nối Agent</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: '1.5' }}>
              Bạn có chắc chắn muốn ngắt kết nối Agent khỏi cụm <strong>{clusterData.name}</strong>? Tác tử sẽ ngừng gửi viễn trắc telemetry và token hiện tại sẽ bị thu hồi.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                style={{ padding: '8px 14px', border: '1px solid var(--dash-border)', backgroundColor: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDisconnecting}
                onClick={handleDisconnectAgent}
                style={{ padding: '8px 16px', backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: isDisconnecting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.8125rem' }}
              >
                {isDisconnecting ? 'Đang ngắt kết nối...' : 'Xác Nhận Ngắt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: 7. REMOVE CLUSTER                                     */}
      {/* ============================================================== */}
      {showRemoveModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              gap: '16px',
              borderRadius: 'var(--dash-radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#991B1B' }}>
              <ShieldAlert size={22} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Xác Nhận Xóa Cụm Kubernetes</h3>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA', fontSize: '0.8125rem', color: '#991B1B' }}>
              Thao tác này sẽ gỡ bỏ cụm <strong>{clusterData.name}</strong>, thu hồi Agent và xóa toàn bộ cấu hình giám sát. Thao tác không thể hoàn tác!
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Nhập chính xác tên cụm: <strong>{clusterData.name}</strong>
              </label>
              <input
                type="text"
                placeholder={clusterData.name}
                value={confirmClusterName}
                onChange={(e) => setConfirmClusterName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => { setShowRemoveModal(false); setConfirmClusterName(''); }}
                style={{ padding: '8px 14px', border: '1px solid var(--dash-border)', backgroundColor: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isRemoving || confirmClusterName.trim() !== clusterData.name}
                onClick={handleRemoveCluster}
                style={{
                  padding: '8px 16px',
                  backgroundColor: confirmClusterName.trim() === clusterData.name ? '#DC2626' : '#94A3B8',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: confirmClusterName.trim() === clusterData.name && !isRemoving ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                }}
              >
                {isRemoving ? 'Đang xóa cụm...' : 'Tôi Hiểu Hậu Quả, Xóa Cụm Này'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClusterDetailPage;
