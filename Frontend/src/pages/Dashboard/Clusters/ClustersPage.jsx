import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../context/DashboardContext';
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions';
import { clusterService } from '../../../services/clusterService';
import { ClusterDetailPage } from './ClusterDetailPage';
import {
  Server,
  Plus,
  X,
  Radio,
  CheckCircle2,
  Cpu,
  Layers,
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  Key,
  Copy,
  Check
} from 'lucide-react';



export const ClustersPage = ({ onNavigate }) => {
  const { t } = useTranslation('dashMonitoring');
  const { currentOrg, setCurrentOrg, orgList, isRefreshing: isGlobalRefreshing, triggerRefresh: triggerGlobalRefresh } = useDashboard();
  const [rawClusters, setRawClusters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedClusterId, setSelectedClusterId] = useState(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [newClusterEnv, setNewClusterEnv] = useState('PRODUCTION');
  const [newClusterRegion, setNewClusterRegion] = useState('MINIKUBE');
  const [newlyCreatedClusterToken, setNewlyCreatedClusterToken] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const { can } = usePermissions();

  // Chuẩn hóa dữ liệu cụm 100% THẬT từ Database PostgreSQL
  const normalizeCluster = useCallback((c) => {
    const envRaw = (c.environment_type || c.environment_name || 'PRODUCTION').toUpperCase();
    const isProd = envRaw.includes('PROD');
    const isStaging = envRaw.includes('STAGING');

    // Lấy trạng thái Agent thật từ CSDL
    let displayAgentStatus = t('clusters.status.noAgent');
    if (c.agent_status === 'ONLINE') {
      displayAgentStatus = t('clusters.status.agentOnline');
    } else if (c.agent_status === 'PENDING') {
      displayAgentStatus = t('clusters.status.agentPending');
    } else if (c.agent_status === 'OFFLINE') {
      displayAgentStatus = t('clusters.status.agentOffline');
    } else if (c.agent_name) {
      displayAgentStatus = `${c.agent_name} (${c.agent_status || t('clusters.status.agentWaiting')})`;
    }

    const nodesCount = typeof c.nodes_count === 'number' ? c.nodes_count : (parseInt(c.nodes_count, 10) || 0);
    const podsCount = typeof c.pods_count === 'number' ? c.pods_count : (parseInt(c.pods_count, 10) || 0);

    // Tính trạng thái Control Plane thật theo kết nối thực tế
    let controlPlaneHealth = t('clusters.status.cpWaitingCheck');
    if (c.agent_status === 'ONLINE' && nodesCount > 0) {
      controlPlaneHealth = t('clusters.status.cpHealthy');
    } else if (c.agent_status === 'PENDING' || nodesCount === 0) {
      controlPlaneHealth = t('clusters.status.cpWaitingConn');
    } else if (c.agent_status === 'OFFLINE') {
      controlPlaneHealth = t('clusters.status.cpOffline');
    } else if (c.status) {
      controlPlaneHealth = c.status;
    }

    return {
      id: c.id,
      name: c.name,
      environment: isProd ? 'production' : (isStaging ? 'staging' : 'development'),
      environmentName: c.environment_name || (isProd ? 'Production' : 'Staging'),
      region: c.provider === 'MINIKUBE' ? t('clusters.status.minikubeRegion') : (c.provider || 'Kubernetes Cluster'),
      version: c.kubernetes_version || t('common.notUpdated'),
      nodes: nodesCount,
      pods: podsCount,
      agentStatus: displayAgentStatus,
      rawAgentStatus: c.agent_status,
      tokenPrefix: c.token_prefix,
      controlPlaneHealth,
      apiEndpoint: c.endpoint || null,
      status: c.status || 'PENDING',
      createdAt: c.created_at || new Date().toISOString(),
      agentName: c.agent_name,
    };
  }, [t]);

  const clusters = useMemo(() => rawClusters.map(normalizeCluster), [rawClusters, normalizeCluster]);

  // Tải danh sách cụm Kubernetes từ Database API theo đúng Tổ chức đang chọn
  const fetchClusters = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);

    try {
      let activeOrgId = currentOrg?.id;

      // Nếu đang dùng mock org mà đã có org thật trong orgList, ưu tiên chuyển sang org thật đầu tiên
      if ((!activeOrgId || activeOrgId.startsWith('org-')) && orgList && orgList.length > 0) {
        const firstReal = orgList.find((o) => o.id && !o.id.startsWith('org-'));
        if (firstReal) {
          activeOrgId = firstReal.id;
          if (setCurrentOrg) {
            setCurrentOrg(firstReal);
          }
        }
      }

      if (activeOrgId && !activeOrgId.startsWith('org-')) {
        // Chỉ tải chính xác các cụm K8s thuộc riêng tổ chức này trong Database
        const rawData = await clusterService.getClustersByOrg(activeOrgId);
        setRawClusters(rawData || []);
      } else {
        // Dữ liệu mẫu ban đầu cho mock organization
        setRawClusters([]);
      }
    } catch (err) {
      console.warn('[ClustersPage] Lỗi kết nối API cụm K8s:', err);
      setError(t('clusters.apiError'));
      setRawClusters([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentOrg?.id, orgList, setCurrentOrg, t]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // Đồng bộ thủ công
  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (triggerGlobalRefresh) triggerGlobalRefresh();
    await fetchClusters(true);
  };

  // Thêm cụm mới kết nối Database (Tự động khởi tạo Agent + Token)
  const handleAddCluster = async (e) => {
    e.preventDefault();
    if (!newClusterName.trim()) return;

    setIsSubmitting(true);
    try {
      const orgId = currentOrg?.id;
      let createdCluster = null;
      if (orgId && !orgId.startsWith('org-')) {
        createdCluster = await clusterService.createCluster(orgId, {
          name: newClusterName.trim(),
          environment_type: newClusterEnv,
          provider: newClusterRegion,
        });
      }

      await fetchClusters(true);
      if (triggerGlobalRefresh) triggerGlobalRefresh();
      setShowAddModal(false);
      setNewClusterName('');

      // Nếu Backend trả về token khởi tạo một lần duy nhất, hiển thị modal sao chép bảo mật
      if (createdCluster?.token?.token) {
        setNewlyCreatedClusterToken({
          clusterId: createdCluster.cluster?.id || createdCluster.id,
          clusterName: createdCluster.cluster?.name || newClusterName.trim(),
          rawToken: createdCluster.token.token,
          prefix: createdCluster.token.token_prefix,
          expiresAt: createdCluster.token.expires_at,
        });
      } else if (createdCluster?.id) {
        handleOpenCluster(createdCluster.id);
      }
    } catch (err) {
      alert(t('clusters.createError', { message: err.message || t('clusters.cannotCreate') }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCluster = (clusterId) => {
    if (onNavigate) {
      onNavigate(`/dashboard/clusters/${clusterId}`);
    } else {
      setSelectedClusterId(clusterId);
    }
  };

  if (selectedClusterId) {
    return (
      <ClusterDetailPage
        clusterId={selectedClusterId}
        onBack={() => {
          setSelectedClusterId(null);
          if (onNavigate) onNavigate('/dashboard/clusters');
        }}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="dashboard-clusters-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
            }}
          >
            <Server size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              {t('clusters.title')}
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('clusters.subtitlePrefix')}{' '}
              <strong style={{ color: '#0F172A' }}>{currentOrg?.name || t('clusters.orgFallback')}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {can(PERMISSIONS.ENV_MANAGE) && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                backgroundColor: '#059669',
                border: '1px solid #059669',
                borderRadius: '10px',
                color: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
              }}
            >
              <Plus size={15} />
              <span>{t('clusters.addBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hàng 4 Thẻ KPI Tóm Tắt */}
      <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            borderTop: '2.5px solid #059669',
            borderRadius: '12px',
            padding: '11px 14px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('clusters.kpi.totalClusters')}</span>
            <Server size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{clusters.length}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('clusters.kpi.registeredSuffix')}</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            borderTop: '2.5px solid #10B981',
            borderRadius: '12px',
            padding: '11px 14px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('clusters.kpi.onlineAgents')}</span>
            <Radio size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#059669' }}>
              {clusters.filter((c) => c.rawAgentStatus === 'ONLINE').length}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
              {t('clusters.kpi.activeClustersSuffix', { total: clusters.length })}
            </span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            borderTop: '2.5px solid #3B82F6',
            borderRadius: '12px',
            padding: '11px 14px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('clusters.kpi.totalNodes')}</span>
            <Cpu size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {clusters.reduce((acc, c) => acc + (Number(c.nodes) || 0), 0)}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('clusters.kpi.nodesSuffix')}</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            borderTop: '2.5px solid #8B5CF6',
            borderRadius: '12px',
            padding: '11px 14px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('clusters.kpi.totalPods')}</span>
            <Layers size={14} color="#8B5CF6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {clusters.reduce((acc, c) => acc + (Number(c.pods) || 0), 0)}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('clusters.kpi.podsSuffix')}</span>
          </div>
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '12px',
          color: '#B45309',
          fontSize: '0.8125rem',
          fontWeight: 500,
        }}>
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="dash-grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '14px' }}>
          {[1, 2].map((i) => (
            <div key={i} className="dash-card" style={{ padding: '20px', minHeight: '210px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#F1F5F9' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ height: '16px', width: '60%', backgroundColor: '#F1F5F9', borderRadius: '6px' }} />
                  <div style={{ height: '12px', width: '40%', backgroundColor: '#F1F5F9', borderRadius: '6px' }} />
                </div>
              </div>
              <div style={{ height: '84px', backgroundColor: '#F8FAFC', borderRadius: '10px' }} />
            </div>
          ))}
        </div>
      ) : clusters.length === 0 ? (
        /* Empty State */
        <div className="dash-card" style={{
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Server size={26} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
            {t('clusters.empty.title')}
          </h3>
          <p style={{ fontSize: '0.825rem', color: '#64748B', maxWidth: '460px', margin: 0 }}>
            {t('clusters.empty.description', { orgName: currentOrg?.name || '' })}
          </p>
          {can(PERMISSIONS.ENV_MANAGE) && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              marginTop: '6px',
              height: '36px',
              padding: '0 18px',
              backgroundColor: '#059669',
              color: '#FFFFFF',
              border: '1px solid #059669',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
            }}
          >
            {t('clusters.empty.cta')}
          </button>
          )}
        </div>
      ) : (
        /* Clusters Grid */
        <div className="dash-grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '14px' }}>
          {clusters.map((cls) => (
            <div
              key={cls.id}
              className="dash-card"
              onClick={() => handleOpenCluster(cls.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.08)';
                e.currentTarget.style.borderColor = '#10B981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(15, 23, 42, 0.04)';
                e.currentTarget.style.borderColor = '#E2E8F0';
              }}
              style={{
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                borderTop: `2.5px solid ${cls.rawAgentStatus === 'ONLINE' ? '#10B981' : cls.rawAgentStatus === 'PENDING' ? '#F59E0B' : '#94A3B8'}`,
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                cursor: 'pointer',
              }}
            >
              {/* Card Top */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '11px',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0F172A', wordBreak: 'break-word' }}>
                      {cls.name}
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      {cls.provider || 'Kubernetes'}
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    backgroundColor: cls.environment === 'production' ? '#ECFDF5' : '#EFF6FF',
                    color: cls.environment === 'production' ? '#047857' : '#2563EB',
                    border: `1px solid ${cls.environment === 'production' ? '#A7F3D0' : '#BFDBFE'}`,
                    letterSpacing: '0.03em',
                    flexShrink: 0,
                  }}
                >
                  {cls.environment.toUpperCase()}
                </span>
              </div>

              {/* Cluster Specifications Box (100% Real from DB) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '9px',
                  fontSize: '0.8rem',
                  backgroundColor: '#F8FAFC',
                  padding: '12px 14px',
                  borderRadius: '11px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} color="#94A3B8" /> {t('clusters.card.version')}
                  </span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{cls.version}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={14} color="#94A3B8" /> {t('clusters.card.nodesPods')}
                  </span>
                  <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                    {t('clusters.card.nodesPodsValue', { nodes: cls.nodes, pods: cls.pods })}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Radio size={14} color="#94A3B8" /> {t('clusters.card.agentLabel')}
                  </span>
                  <span style={{
                    color: cls.rawAgentStatus === 'ONLINE' ? '#059669' : (cls.rawAgentStatus === 'PENDING' ? '#D97706' : '#64748B'),
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    <span style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: cls.rawAgentStatus === 'ONLINE' ? '#10B981' : (cls.rawAgentStatus === 'PENDING' ? '#F59E0B' : '#94A3B8'),
                      display: 'inline-block',
                    }} />
                    {cls.agentStatus}
                  </span>
                </div>
              </div>

              {/* Action Button: Chi Tiết Cụm */}
              <div style={{ marginTop: 'auto', paddingTop: '2px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCluster(cls.id);
                  }}
                  style={{
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0 14px',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#059669';
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ECFDF5';
                    e.currentTarget.style.color = '#047857';
                    e.currentTarget.style.borderColor = '#A7F3D0';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={14} />
                    {t('clusters.card.openDetail')}
                  </span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Cluster Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
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
              border: '1px solid #E2E8F0',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Server size={16} color="#059669" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                  {t('clusters.addModal.title')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddCluster} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  {t('clusters.addModal.orgLabel')}
                </label>
                <div
                  style={{
                    padding: '9px 12px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Building2 size={15} />
                  <span>{currentOrg?.name || t('clusters.orgDisplayFallback')}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  {t('clusters.addModal.nameLabel')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('clusters.addModal.namePlaceholder')}
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    fontSize: '0.84rem',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  {t('clusters.addModal.envLabel')}
                </label>
                <select
                  value={newClusterEnv}
                  onChange={(e) => setNewClusterEnv(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    fontSize: '0.84rem',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="PRODUCTION">{t('clusters.addModal.envProd')}</option>
                  <option value="STAGING">{t('clusters.addModal.envStaging')}</option>
                  <option value="DEV">{t('clusters.addModal.envDev')}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  {t('clusters.addModal.providerLabel')}
                </label>
                <select
                  value={newClusterRegion}
                  onChange={(e) => setNewClusterRegion(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    fontSize: '0.84rem',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="MINIKUBE">{t('clusters.addModal.providerMinikube')}</option>
                  <option value="AWS EKS (ap-southeast-1)">{t('clusters.addModal.providerEks')}</option>
                  <option value="GCP GKE (asia-southeast1)">{t('clusters.addModal.providerGke')}</option>
                  <option value="Azure AKS (Southeast Asia)">{t('clusters.addModal.providerAks')}</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '10px',
                    color: '#475569',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    height: '36px',
                    padding: '0 18px',
                    backgroundColor: '#059669',
                    border: '1px solid #059669',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting ? t('clusters.addModal.submitting') : t('clusters.addModal.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Hiển Thị Raw Token 1 Lần Duy Nhất */}
      {newlyCreatedClusterToken && (
        <div
          data-testid="token-display-modal"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
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
              maxWidth: '560px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
              padding: '22px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#059669' }}>
                <Key size={20} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                  {t('clusters.tokenModal.title')}
                </h3>
              </div>
              <span style={{ fontSize: '0.67rem', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', whiteSpace: 'nowrap' }}>
                {t('clusters.tokenModal.oneTimeBadge')}
              </span>
            </div>

            <div style={{ padding: '12px 14px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', fontSize: '0.8rem', color: '#92400E', lineHeight: '1.5' }}>
              {t('clusters.tokenModal.warningPrefix')} <strong>{newlyCreatedClusterToken.clusterName}</strong>
              {t('clusters.tokenModal.warningMiddle')} <strong>{t('clusters.tokenModal.warningStrong')}</strong> {t('clusters.tokenModal.warningSuffix')}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' }}>
                {t('clusters.tokenModal.secretLabel')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  data-testid="raw-token-input"
                  value={newlyCreatedClusterToken.rawToken}
                  style={{
                    flex: 1,
                    height: '38px',
                    padding: '0 12px',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.8125rem',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    color: '#0F172A',
                    fontWeight: 600,
                  }}
                />
                <button
                  type="button"
                  data-testid="copy-raw-token-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(newlyCreatedClusterToken.rawToken);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  style={{
                    height: '38px',
                    padding: '0 14px',
                    backgroundColor: copiedToken ? '#047857' : '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedToken ? t('common.copiedShort') : t('common.copy')}</span>
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' }}>
                {t('clusters.tokenModal.quickCmdLabel')}
              </label>
              <div style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '12px 14px', borderRadius: '10px', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
{`kubectl create secret generic selfheal-agent-token \\
  --namespace selfheal-system \\
  --from-literal=token="${newlyCreatedClusterToken.rawToken}"`}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                type="button"
                data-testid="close-token-modal-btn"
                onClick={() => {
                  const targetId = newlyCreatedClusterToken.clusterId;
                  setNewlyCreatedClusterToken(null);
                  if (targetId) handleOpenCluster(targetId);
                }}
                style={{
                  height: '36px',
                  padding: '0 18px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: '1px solid #059669',
                  borderRadius: '10px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
                  cursor: 'pointer',
                }}
              >
                {t('clusters.tokenModal.doneBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClustersPage;
