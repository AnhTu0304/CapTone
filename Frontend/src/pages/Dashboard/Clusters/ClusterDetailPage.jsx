import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';
import { useDashboard } from '../context/DashboardContext';
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions';
import { clusterService } from '../../../services/clusterService';
import { useK8sResourcePolling } from '../../../hooks/useK8sResourcePolling';
import {
  Server,
  ArrowLeft,
  Radio,
  CheckCircle2,
  Cpu,
  Layers,
  Activity,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Box,
  KeyRound,
  AlertTriangle,
  Clock,
  Filter,
  ShieldAlert,
  Trash2,
  X,
  AlertCircle,
  Building,
  Key,
  Settings,
  Sliders,
  PowerOff,
  FileText,
  CheckCheck,
  Sparkles,
} from 'lucide-react';

export const ClusterDetailPage = ({ clusterId, onNavigate, onBack }) => {
  const { t, i18n } = useTranslation('dashMonitoring');
  const intlLocale = getIntlLocale(i18n.language);
  const { currentOrg, isRefreshing: isGlobalRefreshing } = useDashboard();
  const [clusterData, setClusterData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'nodes' | 'pods' | 'logs' | 'config'
  const [copiedField, setCopiedField] = useState(null);
  const [logPage, setLogPage] = useState(1);


  const {
    summary: liveSummary,
    nodes: liveNodes,
    pods: livePods,
    deployments: liveDeployments,
    freshness: liveFreshness,
    isLoading: isPollingLoading,
    isRefreshing: isPollingRefreshing,
    error: pollingError,
    lastUpdated,
    refresh: refreshPolling,
  } = useK8sResourcePolling({
    clusterId,
    orgId: currentOrg?.id,
    intervalMs: 20000,
    enabled: Boolean(clusterId),
  });

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
  const [forceRemoveCluster, setForceRemoveCluster] = useState(false);
  const { can } = usePermissions();

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
    // Tự động kiểm tra và đồng bộ trạng thái realtime mỗi 3 giây
    const timer = setInterval(() => {
      fetchDetail(true);
    }, 12000);
    return () => clearInterval(timer);
  }, [fetchDetail]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([fetchDetail(true), refreshPolling()]);
    setIsRefreshing(false);
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
    if (e && e.preventDefault) e.preventDefault();
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
      setActionError(err.message || t('clusters.detail.actions.rotateError'));
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
    if (!window.confirm(t('clusters.detail.actions.revokeConfirm'))) {
      return;
    }
    setIsRevokingId(tokenId);
    try {
      await clusterService.revokeClusterToken(clusterId, tokenId, currentOrg?.id);
      await fetchDetail(true);
    } catch (err) {
      alert(t('clusters.detail.actions.revokeError', { message: err.message || t('clusters.detail.actions.systemError') }));
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
      alert(t('clusters.detail.configForm.saveError', { message: err.message || t('clusters.detail.actions.serverError') }));
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
      alert(t('clusters.detail.actions.disconnectError', { message: err.message || t('clusters.detail.actions.systemError') }));
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
      alert(t('clusters.detail.actions.refreshError', { message: err.message || t('clusters.detail.actions.systemError') }));
    } finally {
      setIsRefreshing(false);
    }
  };

  // 5. Chức năng Xóa Cụm Kubernetes (Remove Cluster)
  const handleRemoveCluster = async () => {
    if (confirmClusterName.trim() !== clusterData?.name) {
      alert(t('clusters.detail.actions.confirmNameMismatch'));
      return;
    }
    setIsRemoving(true);
    try {
      await clusterService.removeCluster(clusterId, currentOrg?.id, forceRemoveCluster);
      setShowRemoveModal(false);
      if (onNavigate) {
        onNavigate('/dashboard/clusters');
      } else if (onBack) {
        onBack();
      }
    } catch (err) {
      alert(t('clusters.detail.actions.removeError', { message: err.message || t('clusters.detail.actions.systemError') }));
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ height: '40px', width: '240px', backgroundColor: '#F1F5F9', borderRadius: '8px' }} />
        <div style={{ height: '140px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--dash-border)' }} />
        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
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
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0' }}>{t('clusters.detail.notFoundTitle')}</h2>
        <p style={{ color: 'var(--dash-text-secondary)', marginBottom: '20px' }}>
          {t('clusters.detail.notFoundDesc')}
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
          {t('clusters.detail.backToList')}
        </button>
      </div>
    );
  }

  const nodes = liveNodes && liveNodes.length > 0 ? liveNodes : (clusterData.nodes || []);
  const pods = livePods && livePods.length > 0 ? livePods : (clusterData.pods || []);
  const deployments = liveDeployments && liveDeployments.length > 0 ? liveDeployments : (clusterData.deployments || []);

  const readyNodesCount = nodes.filter((n) => n.ready === true || n.status === 'Ready').length;
  const crashLoopPodsCount = pods.filter((p) => p.status === 'CrashLoopBackOff' || p.has_crash_loop).length;
  const runningPodsCount = pods.filter((p) => p.phase === 'Running' || p.status === 'Running').length;
  const healthyDeploymentsCount = deployments.filter((d) => d.status === 'Healthy' || d.status === 'ScaledToZero').length;
  const degradedDeploymentsCount = deployments.filter((d) => ['Degraded', 'ProgressDeadlineExceeded', 'ReplicaFailure'].includes(d.status)).length;
  const tokens = clusterData.tokens && clusterData.tokens.length > 0
    ? clusterData.tokens
    : (clusterData.token ? [clusterData.token] : []);
  const heartbeats = clusterData.recent_heartbeats || [];
  const connectionLogs = clusterData.connection_logs || [];
  const LOGS_PER_PAGE = 10;
  const totalLogPages = Math.ceil(connectionLogs.length / LOGS_PER_PAGE) || 1;
  const safeLogPage = Math.min(Math.max(1, logPage), totalLogPages);
  const startLogIdx = (safeLogPage - 1) * LOGS_PER_PAGE;
  const endLogIdx = Math.min(startLogIdx + LOGS_PER_PAGE, connectionLogs.length);
  const paginatedLogs = connectionLogs.slice(startLogIdx, endLogIdx);
  const namespaces = clusterData.namespaces && clusterData.namespaces.length > 0
    ? clusterData.namespaces
    : [{ name: 'default' }, { name: 'kube-system' }];

  const isProd = (clusterData.environment_type || '').toUpperCase().includes('PROD');

  // Active Token (1 cluster 1 active token)
  const activeToken = tokens.find((t) => t.is_active) || tokens[0] || null;
  const hasRawToken = Boolean(rotatedTokenResult?.raw_token || rotatedTokenResult?.token);
  const activeTokenPrefix = activeToken?.token_prefix || '';
  const tokenDisplay = hasRawToken
    ? (rotatedTokenResult.raw_token || rotatedTokenResult.token)
    : (activeTokenPrefix ? `${activeTokenPrefix}••••••••••••` : '••••••••••••');
  const tokenCopyValue = hasRawToken
    ? (rotatedTokenResult.raw_token || rotatedTokenResult.token)
    : '<YOUR_AGENT_TOKEN>';

  const getWsBackendUrl = () => {
    if (typeof window === 'undefined') return 'ws://localhost:5000/api/v1/agent/connect';
    if (process.env.REACT_APP_WS_URL) {
      return process.env.REACT_APP_WS_URL.replace(/\/+$/, '');
    }
    const { protocol, hostname, port } = window.location;
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '80' && port !== '8090') {
      return `${wsProto}//${hostname}:5005/api/v1/agent/connect`;
    }
    return `${wsProto}//${window.location.host}/api/v1/agent/connect`;
  };

  const getInstallerOrigin = () => {
    if (typeof window === 'undefined') return 'http://localhost:8090';
    if (process.env.REACT_APP_INSTALLER_URL) {
      return process.env.REACT_APP_INSTALLER_URL.replace(/\/+$/, '');
    }
    const { protocol, hostname, port } = window.location;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '80' && port !== '8090') {
      return `${protocol}//${hostname}:8090`;
    }
    return window.location.origin;
  };

  const getOneLinerCommand = (os) => {
    const origin = getInstallerOrigin();
    if (os === 'linux') {
      return `curl -fsSL "${origin}/agent/install.sh" | bash`;
    } else {
      return `& ([scriptblock]::Create((irm "${origin}/agent/install.ps1")))`;
    }
  };

  // Trạng thái Agent chuẩn hóa: ONLINE | OFFLINE | CONNECTING | DEGRADED | PENDING
  const rawStatus = (clusterData.agent_status || 'PENDING').toUpperCase();
  const isOnline = rawStatus === 'ONLINE';
  const isDegraded = rawStatus === 'DEGRADED';
  const isConnecting = rawStatus === 'CONNECTING' || rawStatus === 'PENDING';
  const isOffline = rawStatus === 'OFFLINE';

  const agentStatusText = isOnline
    ? 'Online'
    : (isDegraded ? 'Degraded' : (isConnecting ? t('clusters.detail.agentConnecting') : 'Offline'));

  const statusColor = isOnline
    ? '#059669'
    : (isDegraded ? '#D97706' : (isConnecting ? '#2563EB' : '#DC2626'));
  const statusBg = isOnline
    ? '#ECFDF5'
    : (isDegraded ? '#FEF3C7' : (isConnecting ? '#EFF6FF' : '#FEE2E2'));
  const statusDot = isOnline
    ? '#10B981'
    : (isDegraded ? '#F59E0B' : (isConnecting ? '#3B82F6' : '#EF4444'));

  // Hiển thị độ trễ thực tế từ Agent
  const latestLatency = heartbeats[0]?.latency_ms != null ? heartbeats[0].latency_ms : null;
  const isControlPlaneHealthy = (isOnline || isDegraded || nodes.length > 0) && readyNodesCount > 0;
  const isControlPlanePending = isConnecting || (nodes.length === 0 && !isOnline);
  const controlPlaneText = isControlPlaneHealthy
    ? t('clusters.status.cpHealthy')
    : (isControlPlanePending ? t('clusters.status.cpWaitingConn') : t('common.offline'));
  const controlPlaneColor = isControlPlaneHealthy ? '#059669' : (isControlPlanePending ? '#D97706' : '#64748B');


  return (
    <div className="cluster-detail-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            height: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(203, 213, 225, 0.9)',
            borderRadius: '9px',
            padding: '0 12px',
            color: '#047857',
            fontSize: '0.8rem',
            fontWeight: 700,
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          <span>{t('clusters.detail.backBtn')}</span>
        </button>
      </div>

      {/* 1. View Details: Header Banner Tổng Quan */}
      <div
        className="dash-card"
        style={{
          padding: '20px 22px',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#059669',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Server size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  {clusterData.name}
                </h1>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: '999px',
                    backgroundColor: isProd ? '#ECFDF5' : '#EFF6FF',
                    color: isProd ? '#047857' : '#2563EB',
                    border: `1px solid ${isProd ? '#A7F3D0' : '#BFDBFE'}`,
                    letterSpacing: '0.03em',
                  }}
                >
                  {clusterData.environment_type || 'PRODUCTION'}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: '999px',
                    backgroundColor: '#F8FAFC',
                    color: '#475569',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  {clusterData.provider || 'Kubernetes'}
                </span>
                {/* 4. Agent Status Badge */}
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: '999px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '5px', fontSize: '0.78rem', color: '#64748B', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building size={13} color="#94A3B8" />
                  {t('clusters.detail.orgLabel')} <strong style={{ color: '#0F172A' }}>{clusterData.organization_name || currentOrg?.name || t('clusters.orgDisplayFallback')}</strong>
                </span>
                <span>&bull;</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={13} color="#94A3B8" />
                  {t('clusters.detail.envLabel')} <strong style={{ color: '#0F172A' }}>{clusterData.environment_name} ({clusterData.environment_code || 'prod'})</strong>
                </span>
                <span>&bull;</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>UUID: {clusterData.id?.slice(0, 18)}...</span>
                <span>&bull;</span>
                <span>K8s: <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{clusterData.kubernetes_version || t('common.notUpdated')}</strong></span>
                <span>&bull;</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} /> {t('clusters.detail.createdLabel')} {new Date(clusterData.created_at).toLocaleDateString(intlLocale)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Polling Error Banner */}
        {pollingError && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              color: '#991B1B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} />
              <span>
                {t('clusters.detail.pollingError', { message: pollingError.message })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => refreshPolling()}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.74rem',
              }}
            >
              {t('common.retryTitle')}
            </button>
          </div>
        )}

        {/* Stale Data Warning Banner */}
        {liveFreshness && (liveFreshness.state === 'STALE' || !liveFreshness.agent_connected) && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '10px',
              color: '#92400E',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.8rem',
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>
              {liveFreshness.warning || t('clusters.detail.staleDefault')}
            </span>
          </div>
        )}

        {/* 5 Quick KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '10px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ padding: '11px 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: `2.5px solid ${controlPlaneColor}`, borderRadius: '11px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Control Plane</span>
              <Activity size={13} color={controlPlaneColor} />
            </span>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: controlPlaneColor, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {isControlPlaneHealthy ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{controlPlaneText}</span>
            </div>
          </div>

          <div style={{ padding: '11px 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: `2.5px solid ${statusDot}`, borderRadius: '11px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('clusters.card.agentLabel').replace(':', '')}</span>
              <Radio size={13} color="#059669" />
            </span>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: statusColor, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: statusDot }} />
              <span>
                {(isOnline || isDegraded) ? `Online${latestLatency != null ? ` (${latestLatency} ms)` : ''}` : (isConnecting ? t('clusters.detail.agentWaiting') : 'Offline')}
              </span>
            </div>
          </div>

          <div style={{ padding: '11px 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2.5px solid #3B82F6', borderRadius: '11px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('clusters.detail.kpi.nodesTitle')}</span>
              <Cpu size={13} color="#3B82F6" />
            </span>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '5px' }}>
              {nodes.length > 0 ? (
                <>
                  {nodes.length} Nodes &bull;{' '}
                  <span style={{ fontSize: '0.78rem', color: readyNodesCount === nodes.length ? '#059669' : '#DC2626', fontWeight: 700 }}>
                    {readyNodesCount}/{nodes.length} Ready
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>{t('clusters.detail.kpi.nodesZero')}</span>
              )}
            </div>
          </div>

          <div style={{ padding: '11px 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2.5px solid #8B5CF6', borderRadius: '11px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('clusters.detail.kpi.podsTitle')}</span>
              <Box size={13} color="#8B5CF6" />
            </span>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '5px' }}>
              {pods.length > 0 ? (
                <>
                  {pods.length} Pods &bull;{' '}
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: crashLoopPodsCount > 0 ? '#DC2626' : '#059669',
                      fontWeight: 700,
                    }}
                  >
                    {crashLoopPodsCount > 0 ? `${crashLoopPodsCount} CrashLoop` : `${runningPodsCount} Running`}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>{t('clusters.detail.kpi.podsZero')}</span>
              )}
            </div>
          </div>

          <div style={{ padding: '11px 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2.5px solid #10B981', borderRadius: '11px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('clusters.detail.kpi.deploymentsTitle')}</span>
              <Layers size={13} color="#10B981" />
            </span>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '5px' }}>
              {deployments.length > 0 ? (
                <>
                  {deployments.length} Deps &bull;{' '}
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: degradedDeploymentsCount > 0 ? '#DC2626' : '#059669',
                      fontWeight: 700,
                    }}
                  >
                    {healthyDeploymentsCount} Healthy {degradedDeploymentsCount > 0 ? `(${degradedDeploymentsCount} Degraded)` : ''}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>{t('clusters.detail.kpi.deploymentsZero')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar (Segmented Pill Style) */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '12px', alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
        {[
          { id: 'agent', label: t('clusters.detail.tabs.agent'), icon: Radio, count: null },
          { id: 'logs', label: t('clusters.detail.tabs.logs'), icon: FileText, count: connectionLogs.length },
          { id: 'config', label: t('clusters.detail.tabs.config'), icon: Settings, count: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0 14px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#047857' : '#475569',
                boxShadow: isActive ? '0 1px 4px rgba(15, 23, 42, 0.08)' : 'none',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 7px',
                    borderRadius: '999px',
                    backgroundColor: isActive ? '#ECFDF5' : '#E2E8F0',
                    color: isActive ? '#059669' : '#475569',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 2 Top Cards */}
          <div className="dash-grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '14px' }}>
            
            {/* 4. Agent Status Card */}
            <div className="dash-card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '9px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Radio size={16} color="#059669" />
                  </div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{t('clusters.detail.agentCard.title')}</h3>
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: statusColor, backgroundColor: statusBg, padding: '3px 10px', borderRadius: '999px', border: `1px solid ${statusColor}30` }}>
                  {agentStatusText}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '0.8rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.agentCard.agentName')}</span>
                  <strong>{clusterData.agent_name || `${clusterData.name}-agent`}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.agentCard.agentUid')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{clusterData.agent_uid || `agent-${clusterData.id?.slice(0, 8)}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.agentCard.agentVersion')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{clusterData.agent_version || t('common.notUpdated')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.agentCard.deployEnv')}</span>
                  <strong style={{ color: isProd ? '#059669' : '#2563EB' }}>
                    {clusterData.environment_name} ({clusterData.environment_type})
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.agentCard.latencyLabel')}</span>
                  <strong style={{ color: (isOnline || isDegraded) ? 'var(--dash-primary)' : '#64748B' }}>
                    {latestLatency != null
                      ? `${latestLatency} ms (Live probe)`
                      : ((isOnline || isDegraded) ? t('clusters.detail.agentCard.latencyMeasuring') : t('clusters.detail.agentCard.latencyWaiting'))}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.agentCard.heartbeatLabel')}</span>
                  <span>
                    {heartbeats[0]
                      ? `${new Date(heartbeats[0].reported_at).toLocaleTimeString(intlLocale)} (${t('clusters.detail.agentCard.heartbeatSecondsAgo', { sec: Math.max(0, Math.round((Date.now() - new Date(heartbeats[0].reported_at).getTime()) / 1000)) })})`
                      : ((isOnline || isDegraded) ? t('clusters.detail.agentCard.heartbeatJustConnected') : t('clusters.detail.agentCard.heartbeatWaiting'))}
                  </span>
                </div>
              </div>

              {/* 4 Cảm biến eBPF nhân Linux Kernel */}
              <div>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: '0 0 10px 0', textTransform: 'uppercase', color: 'var(--dash-text-muted)' }}>
                  {t('clusters.detail.agentCard.probesTitle')}
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
                        {probe.active ? t('clusters.detail.agentCard.probeOn') : t('clusters.detail.agentCard.probeOff')}
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
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{t('clusters.detail.tokenCard.title')}</h3>
                </div>
                {/* Rotate Token Button */}
                {can(PERMISSIONS.AGENT_MANAGE) && (
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
                  <span>{t('clusters.detail.tokenCard.rotateBtn')}</span>
                </button>
                )}
              </div>

              {/* Active Token Display */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
                    {t('clusters.detail.tokenCard.activeToken')}
                  </label>
                  {activeToken?.expires_at && (
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      {t('clusters.detail.tokenCard.expiresAt', { date: new Date(activeToken.expires_at).toLocaleDateString(intlLocale) })}
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
                    <span>{copiedField === 'agent_token' ? t('common.copiedShort') : t('common.copy')}</span>
                  </button>
                </div>
                {!hasRawToken && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    {t('clusters.detail.tokenCard.oneTimeNotice')}
                  </p>
                )}
              </div>
              <div style={{ padding: '10px 12px', backgroundColor: '#F0FDF4', borderRadius: '6px', border: '1px solid #BBF7D0', fontSize: '0.75rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0 }} />
                <span>
                  {t('clusters.detail.tokenCard.singleAgentNotice')}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Cài Đặt Agent K8s */}
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={20} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  {t('clusters.detail.installer.title')}
                </h3>
              </div>

              {/* Method Switcher Tabs: Chỉ 2 tab Cài Đặt và Gỡ Cài Đặt */}
              <div style={{ display: 'flex', gap: '6px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setConnectTab('install')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: connectTab !== 'uninstall' ? '#FFFFFF' : 'transparent',
                    color: connectTab !== 'uninstall' ? 'var(--dash-primary)' : '#64748B',
                    boxShadow: connectTab !== 'uninstall' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Sparkles size={13} color={connectTab !== 'uninstall' ? 'var(--dash-primary)' : '#64748B'} />
                  {t('clusters.detail.installer.tabInstall')}
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('uninstall')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: connectTab === 'uninstall' ? '#FFFFFF' : 'transparent',
                    color: connectTab === 'uninstall' ? '#DC2626' : '#64748B',
                    boxShadow: connectTab === 'uninstall' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Trash2 size={13} color={connectTab === 'uninstall' ? '#DC2626' : '#64748B'} />
                  {t('clusters.detail.installer.tabUninstall')}
                </button>
              </div>
            </div>

            {/* TAB 1: CÀI ĐẶT AGENT (TỪNG BƯỚC 1 - NHẬP TOKEN SAU) */}
            {connectTab !== 'uninstall' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Header Controls: OS Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.installer.adminOs')}</span>
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

                  <span style={{ fontSize: '0.75rem', color: '#059669', backgroundColor: '#ECFDF5', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    {t('clusters.detail.installer.stepByStepBadge')}
                  </span>
                </div>

                {/* 3 Step List: Cài từng bước 1 rồi nhập token sau */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* BƯỚC 1: CHẠY LỆNH CÀI ĐẶT */}
                  <div style={{ padding: '14px 16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--dash-primary)', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800 }}>1</span>
                        <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{t('clusters.detail.installer.step1Title')}</strong>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{t('clusters.detail.installer.step1Badge')}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {t('clusters.detail.installer.step1Desc')}
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '10px 80px 10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      <code>{getOneLinerCommand(scriptOs)}</code>
                      <button
                        onClick={() => handleCopy(getOneLinerCommand(scriptOs), 'oneliner_cmd')}
                        style={{ position: 'absolute', top: '7px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedField === 'oneliner_cmd' ? <><Check size={12} color="#10B981" /> {t('common.copiedShort')}</> : <><Copy size={12} /> {t('common.copy')}</>}
                      </button>
                    </div>
                  </div>

                  {/* BƯỚC 2: SAO CHÉP & NHẬP TOKEN KHI ĐƯỢC HỎI */}
                  <div style={{ padding: '14px 16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800 }}>2</span>
                        <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{t('clusters.detail.installer.step2Title')}</strong>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{t('clusters.detail.installer.step2Badge')}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {t('clusters.detail.installer.step2DescPrefix')} <code>Nhập Token do SelfHeal cấp:</code>{t('clusters.detail.installer.step2DescSuffix')} <strong>Enter</strong>:
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '10px 105px 10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      <code>{tokenCopyValue || '<YOUR_AGENT_TOKEN>'}</code>
                      <button
                        onClick={() => handleCopy(tokenCopyValue, 'step2_token')}
                        style={{ position: 'absolute', top: '7px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedField === 'step2_token' ? <><Check size={12} color="#10B981" /> {t('common.copiedShort')}</> : <><Copy size={12} /> {t('clusters.detail.installer.step2CopyBtn')}</>}
                      </button>
                    </div>
                  </div>

                  {/* BƯỚC 3: KIỂM TRA TRẠNG THÁI */}
                  <div style={{ padding: '14px 16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#10B981', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800 }}>3</span>
                        <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{t('clusters.detail.installer.step3Title')}</strong>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#10B981', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{t('clusters.detail.installer.step3Badge')}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {t('clusters.detail.installer.step3DescPrefix')} <code>Running</code>{t('clusters.detail.installer.step3DescMiddle')} <strong>Online</strong>:
                    </p>
                    <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '10px 80px 10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      <code>kubectl get pods -n selfheal-system</code>
                      <button
                        onClick={() => handleCopy('kubectl get pods -n selfheal-system', 'qs_step2')}
                        style={{ position: 'absolute', top: '7px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedField === 'qs_step2' ? <><Check size={12} color="#10B981" /> {t('common.copiedShort')}</> : <><Copy size={12} /> {t('common.copy')}</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: UNINSTALLATION (GỠ CÀI ĐẶT) */}
            {connectTab === 'uninstall' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {/* Method 1: Automated Script */}
                  <div style={{ padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.8125rem', color: '#991B1B' }}>{t('clusters.detail.installer.uninstall.method1Title')}</strong>
                      <span style={{ fontSize: '0.6875rem', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{t('clusters.detail.installer.uninstall.method1Badge')}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.6875rem', color: '#7F1D1D', fontWeight: 600, marginBottom: '3px' }}>Linux / macOS (Bash):</div>
                        <div style={{ backgroundColor: '#0F172A', color: '#FCA5A5', padding: '8px 65px 8px 10px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                          <code>curl -fsSL "{getInstallerOrigin()}/agent/uninstall.sh" | bash</code>
                          <button
                            onClick={() => handleCopy(`curl -fsSL "${getInstallerOrigin()}/agent/uninstall.sh" | bash`, 'un_sh')}
                            style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FCA5A5', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem' }}
                          >
                            {copiedField === 'un_sh' ? t('common.copiedShort') : t('common.copy')}
                          </button>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.6875rem', color: '#7F1D1D', fontWeight: 600, marginBottom: '3px' }}>Windows (PowerShell):</div>
                        <div style={{ backgroundColor: '#0F172A', color: '#FCA5A5', padding: '8px 65px 8px 10px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                          <code>&amp; ([scriptblock]::Create((irm "{getInstallerOrigin()}/agent/uninstall.ps1")))</code>
                          <button
                            onClick={() => handleCopy(`& ([scriptblock]::Create((irm "${getInstallerOrigin()}/agent/uninstall.ps1")))`, 'un_ps1')}
                            style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FCA5A5', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem' }}
                          >
                            {copiedField === 'un_ps1' ? t('common.copiedShort') : t('common.copy')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Method 2: Kubectl */}
                  <div style={{ padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.8125rem', color: '#991B1B' }}>{t('clusters.detail.installer.uninstall.method2Title')}</strong>
                      <span style={{ fontSize: '0.6875rem', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>K8s CLI</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#7F1D1D', fontWeight: 600 }}>{t('clusters.detail.installer.uninstall.method2Desc')}</div>
                    <div style={{ backgroundColor: '#0F172A', color: '#FCA5A5', padding: '10px 65px 10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      <code>kubectl delete namespace selfheal-system</code>
                      <button
                        onClick={() => handleCopy('kubectl delete namespace selfheal-system', 'un_k8s')}
                        style={{ position: 'absolute', top: '7px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FCA5A5', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem' }}
                      >
                        {copiedField === 'un_k8s' ? t('common.copiedShort') : t('common.copy')}
                      </button>
                    </div>
                  </div>

                  {/* Method 3: Helm */}
                  <div style={{ padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.8125rem', color: '#991B1B' }}>{t('clusters.detail.installer.uninstall.method3Title')}</strong>
                      <span style={{ fontSize: '0.6875rem', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Package Manager</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#7F1D1D', fontWeight: 600 }}>{t('clusters.detail.installer.uninstall.method3Desc')}</div>
                    <div style={{ backgroundColor: '#0F172A', color: '#FCA5A5', padding: '10px 65px 10px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', wordBreak: 'break-all' }}>
                      <code>{`helm uninstall selfheal-agent -n selfheal-system
kubectl delete namespace selfheal-system`}</code>
                      <button
                        onClick={() => handleCopy(`helm uninstall selfheal-agent -n selfheal-system\nkubectl delete namespace selfheal-system`, 'un_helm')}
                        style={{ position: 'absolute', top: '7px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FCA5A5', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6875rem' }}
                      >
                        {copiedField === 'un_helm' ? t('common.copiedShort') : t('common.copy')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. Agent Configuration Form (Cấu hình namespace giám sát, chu kỳ gửi Metrics, eBPF probes) */}
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  {t('clusters.detail.configForm.title')}
                </h3>
              </div>
              {configSaveSuccess && (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCheck size={14} /> {t('clusters.detail.configForm.saveSuccess')}
                </span>
              )}
            </div>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                    {t('clusters.detail.configForm.intervalLabel')}
                  </label>
                  <select
                    value={metricInterval}
                    onChange={(e) => setMetricInterval(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
                  >
                    <option value={5}>{t('clusters.detail.configForm.interval5')}</option>
                    <option value={15}>{t('clusters.detail.configForm.interval15')}</option>
                    <option value={30}>{t('clusters.detail.configForm.interval30')}</option>
                    <option value={60}>{t('clusters.detail.configForm.interval60')}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                    {t('clusters.detail.configForm.nsScopeLabel')}
                  </label>
                  <select
                    value={monitoredNs}
                    onChange={(e) => setMonitoredNs(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
                  >
                    <option value="ALL">{t('clusters.detail.configForm.nsAll')}</option>
                    {namespaces.map((ns) => {
                      const nsName = ns.name || ns;
                      return (
                        <option key={nsName} value={nsName}>
                          {t('clusters.detail.configForm.nsOnly', { ns: nsName })}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                    {t('clusters.detail.configForm.logLevelLabel')}
                  </label>
                  <select
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
                  >
                    <option value="INFO">{t('clusters.detail.configForm.logInfo')}</option>
                    <option value="DEBUG">{t('clusters.detail.configForm.logDebug')}</option>
                    <option value="WARN">{t('clusters.detail.configForm.logWarn')}</option>
                    <option value="ERROR">{t('clusters.detail.configForm.logError')}</option>
                  </select>
                </div>
              </div>

              {/* Probes Toggles */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '8px' }}>
                  {t('clusters.detail.configForm.probesLabel')}
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
                  <span>{isSavingConfig ? t('clusters.detail.configForm.saving') : t('clusters.detail.configForm.saveBtn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
      {activeTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dash-card" style={{ padding: '0px', overflow: 'hidden', border: '1px solid var(--dash-border)', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>
                  {t('clusters.detail.connLogs.title')}
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                {t('clusters.detail.connLogs.showingCount', { count: connectionLogs.length })}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--dash-border)', backgroundColor: '#FAFAFA', color: 'var(--dash-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 18px' }}>{t('clusters.detail.connLogs.colTime')}</th>
                    <th style={{ padding: '12px 18px' }}>{t('clusters.detail.connLogs.colType')}</th>
                    <th style={{ padding: '12px 18px' }}>{t('clusters.detail.connLogs.colSeverity')}</th>
                    <th style={{ padding: '12px 18px' }}>{t('clusters.detail.connLogs.colDetails')}</th>
                    <th style={{ padding: '12px 18px' }}>{t('clusters.detail.connLogs.colSource')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                        {t('clusters.detail.connLogs.empty')}
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log, idx) => {
                      const sevColor = log.severity === 'SUCCESS' ? '#059669' : (log.severity === 'WARN' ? '#D97706' : (log.severity === 'ERROR' ? '#DC2626' : '#2563EB'));
                      const sevBg = log.severity === 'SUCCESS' ? '#ECFDF5' : (log.severity === 'WARN' ? '#FEF3C7' : (log.severity === 'ERROR' ? '#FEE2E2' : '#EFF6FF'));

                      return (
                        <tr key={log.id || idx} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                          <td style={{ padding: '12px 18px', color: '#64748B', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString(intlLocale)}
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
                            {log.source_ip || log.node_name || 'N/A'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalLogPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '12px 20px',
                  borderTop: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div style={{ fontSize: '0.78125rem', color: '#64748B', fontWeight: 500 }}>
                  {t('clusters.detail.connLogs.pagination', { start: startLogIdx + 1, end: endLogIdx, total: connectionLogs.length, perPage: LOGS_PER_PAGE })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={safeLogPage <= 1}
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: safeLogPage <= 1 ? '#F8FAFC' : '#FFFFFF',
                      color: safeLogPage <= 1 ? '#94A3B8' : '#334155',
                      cursor: safeLogPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {t('clusters.detail.connLogs.prevPage')}
                  </button>

                  {Array.from({ length: totalLogPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setLogPage(pg)}
                      style={{
                        minWidth: '30px',
                        height: '30px',
                        padding: '0 8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        borderRadius: '6px',
                        border: safeLogPage === pg ? '1px solid #2563EB' : '1px solid #CBD5E1',
                        backgroundColor: safeLogPage === pg ? '#2563EB' : '#FFFFFF',
                        color: safeLogPage === pg ? '#FFFFFF' : '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={safeLogPage >= totalLogPages}
                    onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: safeLogPage >= totalLogPages ? '#F8FAFC' : '#FFFFFF',
                      color: safeLogPage >= totalLogPages ? '#94A3B8' : '#334155',
                      cursor: safeLogPage >= totalLogPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {t('clusters.detail.connLogs.nextPage')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: CẤU HÌNH CỤM & 7. DISCONNECT / REMOVE (VÙNG NGUY HIỂM)   */}
      {/* ============================================================== */}
      {activeTab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dash-grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
            {/* Cấu hình kỹ thuật */}
            <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{t('clusters.detail.techTab.specsTitle')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.techTab.clusterId')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{clusterData.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.techTab.deployEnv')}</span>
                  <strong style={{ color: isProd ? '#059669' : '#2563EB' }}>{clusterData.environment_type}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.techTab.provider')}</span>
                  <span>{clusterData.provider}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>{t('clusters.detail.techTab.k8sVersion')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{clusterData.kubernetes_version || t('common.notUpdated')}</span>
                </div>
              </div>
            </div>

            {/* Self-Healing Status */}
            <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{t('clusters.detail.techTab.healingTitle')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8125rem' }}>
                <div style={{ padding: '12px', backgroundColor: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                  <strong style={{ color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> {t('clusters.detail.techTab.healingActive')}
                  </strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#047857' }}>
                    {t('clusters.detail.techTab.healingDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 7. Disconnect / Remove: Vùng Thao Tác Nguy Hiểm (Danger Zone) */}
          {(can(PERMISSIONS.AGENT_MANAGE) || can(PERMISSIONS.ENV_DELETE)) && (
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B' }}>
              <ShieldAlert size={20} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{t('clusters.detail.techTab.dangerTitle')}</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#7F1D1D' }}>
              {t('clusters.detail.techTab.dangerDesc')}
            </p>

            <div className="dash-grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '14px', paddingTop: '8px' }}>
              {/* Ngắt kết nối Agent */}
              {can(PERMISSIONS.AGENT_MANAGE) && (
              <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #F87171', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#991B1B' }}>{t('clusters.detail.techTab.disconnectTitle')}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    {t('clusters.detail.techTab.disconnectDesc')}
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
                  <span>{t('clusters.detail.techTab.disconnectBtn')}</span>
                </button>
              </div>
              )}

              {/* Xóa Cấu Hình Cụm (Chỉ SME_OWNER có quyền) */}
              {can(PERMISSIONS.ENV_DELETE) && (
              <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #DC2626', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#7F1D1D' }}>{t('clusters.detail.techTab.removeTitle')}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    {t('clusters.detail.techTab.removeDesc')}
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
                  <span>{t('clusters.detail.techTab.removeBtn')}</span>
                </button>
              </div>
              )}
            </div>
          </div>
          )}
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
                  {rotatedTokenResult ? t('clusters.detail.rotateModal.titleSuccess') : t('clusters.detail.rotateModal.titleForm')}
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
                    <span>{t('clusters.detail.rotateModal.successTitle')}</span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#047857' }}>
                    {t('clusters.detail.rotateModal.successWarningPrefix')} <strong>{t('clusters.detail.rotateModal.successWarningStrong')}</strong>{t('clusters.detail.rotateModal.successWarningSuffix')}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: '4px' }}>
                    {t('clusters.detail.rotateModal.newTokenLabel')}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={rotatedTokenResult.raw_token || rotatedTokenResult.token}
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
                      onClick={() => handleCopy(rotatedTokenResult.raw_token || rotatedTokenResult.token, 'new_token')}
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
                      <span>{copiedField === 'new_token' ? t('common.copied') : t('common.copy')}</span>
                    </button>
                  </div>
                </div>

                {rotatedTokenResult.install_command && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: '4px' }}>
                      {t('clusters.detail.rotateModal.daemonsetLabel')}
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
                    {t('clusters.detail.rotateModal.doneBtn')}
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
                  {t('clusters.detail.rotateModal.formDescPrefix')} <strong>{t('clusters.detail.rotateModal.formDescStrong')}</strong>{t('clusters.detail.rotateModal.formDescSuffix')}
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                    {t('clusters.detail.rotateModal.expiryLabel')}
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
                    <option value={30}>{t('clusters.detail.rotateModal.expiry30')}</option>
                    <option value={90}>{t('clusters.detail.rotateModal.expiry90')}</option>
                    <option value={180}>{t('clusters.detail.rotateModal.expiry180')}</option>
                    <option value={365}>{t('clusters.detail.rotateModal.expiry365')}</option>
                    <option value="never">{t('clusters.detail.rotateModal.expiryNever')}</option>
                  </select>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--dash-border)', fontSize: '0.75rem', color: '#64748B' }}>
                  {t('clusters.detail.rotateModal.note')}
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
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleRotateToken}
disabled={isRotating}
data-testid="confirm-rotate-token-btn"
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
                    <span>{isRotating ? t('clusters.detail.rotateModal.rotating') : t('clusters.detail.rotateModal.submitBtn')}</span>
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{t('clusters.detail.disconnectModal.title')}</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: '1.5' }}>
              {t('clusters.detail.disconnectModal.descPrefix')} <strong>{clusterData.name}</strong>{t('clusters.detail.disconnectModal.descSuffix')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                style={{ padding: '8px 14px', border: '1px solid var(--dash-border)', backgroundColor: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                {t('common.cancelAction')}
              </button>
              <button
                type="button"
                disabled={isDisconnecting}
                onClick={handleDisconnectAgent}
                style={{ padding: '8px 16px', backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: isDisconnecting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.8125rem' }}
              >
                {isDisconnecting ? t('clusters.detail.disconnectModal.disconnecting') : t('clusters.detail.disconnectModal.confirmBtn')}
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{t('clusters.detail.removeModal.title')}</h3>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA', fontSize: '0.8125rem', color: '#991B1B' }}>
              {t('clusters.detail.removeModal.warningPrefix')} <strong>{clusterData.name}</strong>{t('clusters.detail.removeModal.warningSuffix')}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                {t('clusters.detail.removeModal.inputLabel')} <strong>{clusterData.name}</strong>
              </label>
              <input
                type="text"
                placeholder={clusterData.name}
                value={confirmClusterName}
                onChange={(e) => setConfirmClusterName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
              />
            </div>

            {(isOnline || clusterData.agent_status === 'ONLINE' || clusterData.rawAgentStatus === 'ONLINE') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px' }}>
                <input
                  type="checkbox"
                  id="forceRemoveCluster"
                  data-testid="force-remove-cluster-checkbox"
                  checked={forceRemoveCluster}
                  onChange={(e) => setForceRemoveCluster(e.target.checked)}
                />
                <label htmlFor="forceRemoveCluster" style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600, cursor: 'pointer' }}>
                  {t('clusters.detail.removeModal.forceLabel')}
                </label>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => { setShowRemoveModal(false); setConfirmClusterName(''); }}
                style={{ padding: '8px 14px', border: '1px solid var(--dash-border)', backgroundColor: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                {t('common.cancel')}
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
                {isRemoving ? t('clusters.detail.removeModal.removing') : t('clusters.detail.removeModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClusterDetailPage;