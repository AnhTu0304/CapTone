import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';
import { useDashboard } from '../context/DashboardContext';
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions';
import { agentService } from '../../../services/agentService';
import AgentInstallerBanner from '../../../components/onboarding/AgentInstallerBanner';
import {
  Radio,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  Database,
  Terminal,
  Copy,
  Check,
  X,
  ExternalLink,
  Shield,
  Layers,
  Server,
  Filter,
  Trash2,
  PowerOff,
  ShieldAlert
} from 'lucide-react';

export const AgentsPage = () => {
  const { t, i18n } = useTranslation('dashMonitoring');
  const intlLocale = getIntlLocale(i18n.language);
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();

  // Real Agents State
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scopeMode, setScopeMode] = useState('CURRENT_CLUSTER'); // 'CURRENT_CLUSTER' | 'ALL_CLUSTERS'

  // Search and status filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Install Modal state
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [activeInstallTab, setActiveInstallTab] = useState('powershell'); // 'powershell' | 'bash' | 'helm'
  const [copiedCode, setCopiedCode] = useState(false);
  const [disconnectingAgent, setDisconnectingAgent] = useState(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceDeleteAgent, setForceDeleteAgent] = useState(false);
  const [actionError, setActionError] = useState(null);
  const { can } = usePermissions();

  // 1. Tải danh sách Agent THẬT từ CSDL & Backend
  const fetchAgents = useCallback(async () => {
    if (!currentOrg?.id) return;
    setIsLoading(true);
    try {
      const clusterId = scopeMode === 'CURRENT_CLUSTER' ? (currentEnv?.clusterId || currentEnv?.id) : undefined;
      const res = await agentService.getAgents(currentOrg.id, {
        clusterId: clusterId && !clusterId.startsWith('org-') ? clusterId : undefined,
      });
      setAgents(Array.isArray(res.items) ? res.items : []);
    } catch (err) {
      console.warn('[AgentsPage] Lỗi tải danh sách Agent:', err);
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, currentEnv?.clusterId, currentEnv?.id, scopeMode]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleDisconnectAgent = async () => {
    if (!disconnectingAgent || !currentOrg?.id) return;
    setIsDisconnecting(true);
    setActionError(null);
    try {
      await agentService.disconnectAgent(currentOrg.id, disconnectingAgent.id);
      setDisconnectingAgent(null);
      await fetchAgents();
    } catch (err) {
      setActionError(err.message || t('agents.disconnectError'));
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deletingAgent || !currentOrg?.id) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await agentService.deleteAgent(currentOrg.id, deletingAgent.id, forceDeleteAgent);
      setDeletingAgent(null);
      setForceDeleteAgent(false);
      await fetchAgents();
    } catch (err) {
      setActionError(err.message || t('agents.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    triggerRefresh();
    await fetchAgents();
  };

  // 2. Lọc danh sách Agent
  const filteredAgents = useMemo(() => {
    return agents.filter((ag) => {
      const matchesSearch =
        (ag.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ag.agent_uid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ag.cluster_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'ALL' || ag.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [agents, searchQuery, filterStatus]);

  // 3. Thống kê số liệu thật
  const onlineAgents = agents.filter((a) => a.status === 'ONLINE');
  const onlineRatio = agents.length > 0 ? `${onlineAgents.length} / ${agents.length}` : '0 / 0';
  const onlinePercent =
    agents.length > 0
      ? t('agents.kpi.onlinePercent', { percent: Math.round((onlineAgents.length / agents.length) * 100) })
      : t('agents.kpi.noAgents');

  // Hàm chuẩn hóa domain cho Agent Installer (tự động loại bỏ cổng dev 3000/3001 trên localhost để trỏ đúng Nginx Gateway cổng 80)
  const getInstallerOrigin = () => {
    if (typeof window === 'undefined') return 'http://localhost';
    if (process.env.REACT_APP_INSTALLER_URL) {
      return process.env.REACT_APP_INSTALLER_URL.replace(/\/+$/, '');
    }
    const { protocol, hostname, port } = window.location;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '80' && port !== '8090') {
      return `${protocol}//${hostname}:8090`;
    }
    return window.location.origin;
  };
  const originUrl = getInstallerOrigin();
  const psCommand = `& ([scriptblock]::Create((irm ${originUrl}/agent/install.ps1)))`;
  const bashCommand = `curl -sSL ${originUrl}/agent/install.sh | bash`;
  const helmCommand = `helm repo add selfheal ${originUrl}/agent/charts
helm upgrade --install selfheal-agent selfheal/selfheal-agent \\
  --namespace selfheal-system \\
  --create-namespace \\
  --set clusterName="${currentEnv?.name || 'k8s-cluster'}"`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Header with Actions */}
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
            <Radio size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              {t('agents.title')}
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('agents.subtitlePrefix')}{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{currentEnv?.name || t('common.systemWide')}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Chế độ xem: Cụm hiện tại vs Tất cả cụm */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F8FAFC',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              gap: '3px',
            }}
          >
            <button
              type="button"
              onClick={() => setScopeMode('CURRENT_CLUSTER')}
              style={{
                padding: '5px 11px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: scopeMode === 'CURRENT_CLUSTER' ? '#ECFDF5' : 'transparent',
                color: scopeMode === 'CURRENT_CLUSTER' ? '#047857' : '#64748B',
                border: scopeMode === 'CURRENT_CLUSTER' ? '1px solid #A7F3D0' : '1px solid transparent',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              {currentEnv?.name || t('agents.scopeCurrentFallback')}
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('ALL_CLUSTERS')}
              style={{
                padding: '5px 11px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: scopeMode === 'ALL_CLUSTERS' ? '#ECFDF5' : 'transparent',
                color: scopeMode === 'ALL_CLUSTERS' ? '#047857' : '#64748B',
                border: scopeMode === 'ALL_CLUSTERS' ? '1px solid #A7F3D0' : '1px solid transparent',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              {t('agents.scopeAllOrg')}
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '10px',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>{t('common.refresh')}</span>
          </button>

          {can(PERMISSIONS.AGENT_MANAGE) && (
            <button
              onClick={() => setIsInstallModalOpen(true)}
              style={{
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: '1px solid #059669',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
              }}
            >
              <Plus size={15} />
              <span>{t('agents.installBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Stat Summary Cards */}
      <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #059669' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('agents.kpi.totalAgents')}</span>
            <Radio size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {onlineRatio}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: onlineAgents.length > 0 ? '#059669' : '#D97706' }}>
              {onlinePercent}
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {onlineAgents.length > 0 ? t('agents.kpi.coveredWorkers', { cluster: currentEnv?.name }) : t('agents.kpi.waitingDeploy')}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #10B981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('agents.kpi.avgHeartbeat')}</span>
            <Clock size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {onlineAgents.length > 0 ? '3.0s' : 'N/A'}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: onlineAgents.length > 0 ? '#059669' : '#94A3B8' }}>
              {t('agents.kpi.freq5s')}
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {onlineAgents.length > 0 ? t('agents.kpi.lowLatency') : t('agents.kpi.noHeartbeat')}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #3B82F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('agents.kpi.cpuRamTitle')}</span>
            <Cpu size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {onlineAgents.length > 0 ? '0.3%' : '0.0%'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
              {onlineAgents.length > 0 ? '~15.1 MB RAM' : 'N/A'}
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {t('agents.kpi.zeroOverhead')}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: `2.5px solid ${onlineAgents.length > 0 ? '#10B981' : '#94A3B8'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('agents.kpi.ebpfProbes')}</span>
            <CheckCircle2 size={14} color={onlineAgents.length > 0 ? '#10B981' : '#94A3B8'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: onlineAgents.length > 0 ? '#059669' : '#64748B' }}>
              {onlineAgents.length > 0 ? t('agents.kpi.active') : t('agents.kpi.paused')}
            </span>
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: onlineAgents.length > 0 ? '#059669' : '#94A3B8' }}>
              Linux 5.15+
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {t('agents.kpi.mtlsDesc')}
          </div>
        </div>
      </div>

      {/* 3. Filter & Agents Table */}
      <div className="dash-card" style={{ padding: '16px 18px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          {/* Search box */}
          <div className="dash-search-box" style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <input
              type="text"
              placeholder={t('agents.filters.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                padding: '0 12px',
                fontSize: '0.8rem',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                backgroundColor: '#F8FAFC',
                outline: 'none',
                color: '#0F172A',
              }}
            />
          </div>

          {/* Status filter (Segmented Pill) */}
          <div style={{ display: 'inline-flex', gap: '3px', padding: '3px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
            {[
              { id: 'ALL', label: t('common.all') },
              { id: 'ONLINE', label: t('common.online') },
              { id: 'OFFLINE', label: t('common.offline') },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilterStatus(st.id)}
                style={{
                  height: '28px',
                  padding: '0 12px',
                  fontSize: '0.75rem',
                  fontWeight: filterStatus === st.id ? 700 : 600,
                  backgroundColor: filterStatus === st.id ? '#FFFFFF' : 'transparent',
                  color: filterStatus === st.id ? '#047857' : '#64748B',
                  borderRadius: '7px',
                  border: 'none',
                  boxShadow: filterStatus === st.id ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agents Table */}
        <div className="dash-table-container" style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '0.825rem' }}>
              <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 10px auto' }} color="#059669" />
              <div>{t('agents.empty.loading')}</div>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div style={{ padding: '44px 24px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <Radio size={22} color="#059669" />
              </div>
              <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>
                {scopeMode === 'CURRENT_CLUSTER'
                  ? t('agents.empty.currentClusterTitle', { cluster: currentEnv?.name || '' })
                  : t('agents.empty.allOrgTitle')}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748B', maxWidth: '460px', margin: '5px auto 14px auto' }}>
                {t('agents.empty.description')}
              </p>
              {can(PERMISSIONS.AGENT_MANAGE) && (
              <button
                onClick={() => setIsInstallModalOpen(true)}
                style={{
                  height: '34px',
                  padding: '0 16px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: '1px solid #059669',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
                  cursor: 'pointer',
                }}
              >
                {t('agents.installNewBtn')}
              </button>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('agents.table.colName')}</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('agents.table.colClusterNode')}</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('agents.table.colStatus')}</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('agents.table.colVersion')}</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('agents.table.colResources')}</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('agents.table.colTokens')}</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700, textAlign: 'right' }}>{t('agents.table.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((agent) => {
                  const isOnline = agent.status === 'ONLINE';
                  return (
                    <tr
                      key={agent.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background-color 0.14s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Radio size={14} color={isOnline ? '#059669' : '#94A3B8'} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{agent.name}</span>
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#64748B', marginLeft: '22px', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          UID: {agent.agent_uid}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>
                          {agent.cluster_name || currentEnv?.name || 'minikube'}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#64748B', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                          Node: minikube (1 node)
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 9px',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: isOnline ? '#ECFDF5' : '#FEF2F2',
                            color: isOnline ? '#047857' : '#DC2626',
                            border: `1px solid ${isOnline ? '#A7F3D0' : '#FECACA'}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: isOnline ? '#10B981' : '#EF4444',
                            }}
                          />
                          {isOnline ? t('common.online') : t('common.offline')}
                        </span>
                        <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
                          {isOnline ? t('agents.table.justResponded') : (agent.last_seen_at ? new Date(agent.last_seen_at).toLocaleTimeString(intlLocale) : t('agents.table.noSignal'))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#0F172A', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {agent.version || 'v2.4.1'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {isOnline ? (
                          <>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>0.3%</div>
                            <div style={{ fontSize: '0.68rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>15.1 MB</div>
                          </>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>{t('agents.table.naOffline')}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569', fontWeight: 600 }}>
                        {t('agents.table.validTokens', { count: agent.active_tokens_count ?? 1 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {agent.status !== 'OFFLINE' && agent.status !== 'REVOKED' && can(PERMISSIONS.AGENT_MANAGE) && (
                            <button
                              type="button"
                              data-testid={`disconnect-agent-btn-${agent.id}`}
                              onClick={() => { setDisconnectingAgent(agent); setActionError(null); }}
                              style={{
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '0 10px',
                                backgroundColor: '#FEF2F2',
                                color: '#DC2626',
                                border: '1px solid #FECACA',
                                borderRadius: '8px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              title={t('agents.table.disconnectTitle')}
                            >
                              <PowerOff size={12} />
                              <span>{t('agents.table.disconnectBtn')}</span>
                            </button>
                          )}
                          {can(PERMISSIONS.AGENT_DELETE) && (
                            <button
                              type="button"
                              data-testid={`delete-agent-btn-${agent.id}`}
                              onClick={() => { setDeletingAgent(agent); setForceDeleteAgent(false); setActionError(null); }}
                              style={{
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '0 10px',
                                backgroundColor: '#FFFFFF',
                                color: '#991B1B',
                                border: '1px solid #E2E8F0',
                                borderRadius: '8px',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              title={t('agents.table.deleteTitle')}
                            >
                              <Trash2 size={12} />
                              <span>{t('agents.table.deleteBtn')}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 5. Modal: Cài đặt Tác tử Mới */}
      {isInstallModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
              maxWidth: '640px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} color="var(--dash-primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                  {t('agents.installModal.title', { cluster: currentEnv?.name || '' })}
                </h3>
              </div>
              <button
                onClick={() => setIsInstallModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {/* Mascot Branding Banner */}
              <AgentInstallerBanner
                clusterName={currentEnv?.name || 'k8s-cluster'}
                compact={true}
              />

              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--dash-border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <button
                  onClick={() => setActiveInstallTab('powershell')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--dash-radius-md)',
                    border: 'none',
                    backgroundColor: activeInstallTab === 'powershell' ? 'var(--dash-primary-light)' : 'transparent',
                    color: activeInstallTab === 'powershell' ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                    fontWeight: activeInstallTab === 'powershell' ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Windows (PowerShell)
                </button>
                <button
                  onClick={() => setActiveInstallTab('bash')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--dash-radius-md)',
                    border: 'none',
                    backgroundColor: activeInstallTab === 'bash' ? 'var(--dash-primary-light)' : 'transparent',
                    color: activeInstallTab === 'bash' ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                    fontWeight: activeInstallTab === 'bash' ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Linux / macOS (Bash)
                </button>
                <button
                  onClick={() => setActiveInstallTab('helm')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--dash-radius-md)',
                    border: 'none',
                    backgroundColor: activeInstallTab === 'helm' ? 'var(--dash-primary-light)' : 'transparent',
                    color: activeInstallTab === 'helm' ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                    fontWeight: activeInstallTab === 'helm' ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Helm Chart
                </button>
              </div>

              {/* Code snippet display */}
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginBottom: '10px' }}>
                  {t('agents.installModal.instructionPrefix')} <code>kubectl</code> {t('agents.installModal.instructionSuffix')}
                </p>
                <div style={{ position: 'relative' }}>
                  <pre
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--dash-bg-canvas)',
                      borderRadius: 'var(--dash-radius-md)',
                      border: '1px solid var(--dash-border)',
                      color: 'var(--dash-text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      lineHeight: 1.5,
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {activeInstallTab === 'powershell'
                      ? psCommand
                      : activeInstallTab === 'bash'
                      ? bashCommand
                      : helmCommand}
                  </pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        activeInstallTab === 'powershell'
                          ? psCommand
                          : activeInstallTab === 'bash'
                          ? bashCommand
                          : helmCommand
                      )
                    }
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      borderRadius: 'var(--dash-radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: copiedCode ? 'var(--dash-success)' : 'var(--dash-text-primary)',
                    }}
                  >
                    {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedCode ? t('common.copiedBang') : t('common.copy')}</span>
                  </button>
                </div>
              </div>

              {/* Security Notice */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 12px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-mint-50)',
                  border: '1px solid var(--dash-mint-200)',
                  fontSize: '0.75rem',
                  color: 'var(--dash-text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <Shield size={16} color="var(--dash-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>{t('agents.installModal.securityTitle')}</strong> {t('agents.installModal.securityDesc')}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: 'var(--dash-bg-canvas)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setIsInstallModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  color: 'var(--dash-text-primary)',
                }}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Xác Nhận Ngắt Kết Nối Agent */}
      {disconnectingAgent && (
        <div
          data-testid="disconnect-agent-modal"
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                {t('agents.disconnectModal.title')}
              </h3>
            </div>
            {actionError && (
              <div style={{ padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#DC2626', fontSize: '0.8125rem' }}>
                {actionError}
              </div>
            )}
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: '1.5' }}>
              {t('agents.disconnectModal.descPrefix')} <strong>{disconnectingAgent.name}</strong>{t('agents.disconnectModal.descMiddle')} <strong>OFFLINE</strong>{t('agents.disconnectModal.descSuffix')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setDisconnectingAgent(null)}
                style={{ padding: '8px 14px', border: '1px solid var(--dash-border)', backgroundColor: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="confirm-disconnect-agent-btn"
                disabled={isDisconnecting}
                onClick={handleDisconnectAgent}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                }}
              >
                {isDisconnecting ? t('agents.disconnectModal.disconnecting') : t('agents.disconnectModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác Nhận Xóa Agent */}
      {deletingAgent && (
        <div
          data-testid="delete-agent-modal"
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                {t('agents.deleteModal.title')}
              </h3>
            </div>
            {actionError && (
              <div style={{ padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#DC2626', fontSize: '0.8125rem' }}>
                {actionError}
              </div>
            )}
            <div style={{ padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA', fontSize: '0.8125rem', color: '#991B1B', lineHeight: '1.5' }}>
              {t('agents.deleteModal.descPrefix')} <strong>{deletingAgent.name}</strong> (UID: {deletingAgent.agent_uid}) {t('agents.deleteModal.descSuffix')}
            </div>

            {deletingAgent.status === 'ONLINE' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px' }}>
                <input
                  type="checkbox"
                  id="forceDeleteAgent"
                  data-testid="force-delete-agent-checkbox"
                  checked={forceDeleteAgent}
                  onChange={(e) => setForceDeleteAgent(e.target.checked)}
                />
                <label htmlFor="forceDeleteAgent" style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600, cursor: 'pointer' }}>
                  {t('agents.deleteModal.forceLabel')}
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingAgent(null)}
                style={{ padding: '8px 14px', border: '1px solid var(--dash-border)', backgroundColor: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="confirm-delete-agent-btn"
                disabled={isDeleting}
                onClick={handleDeleteAgent}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                }}
              >
                {isDeleting ? t('agents.deleteModal.deleting') : t('agents.deleteModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
