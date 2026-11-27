import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../context/DashboardContext';
import { podService } from '../../../services/podService';
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions';
import {
  Box,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Server,
  X,
  Info,
  Terminal,
  Activity,
} from 'lucide-react';

export const WorkloadsPage = () => {
  const { t } = useTranslation('dashMonitoring');
  const { currentEnv, isRefreshing, triggerRefresh, onNavigate } = useDashboard();
  const { can } = usePermissions();
  const [pods, setPods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Views
  const [activeView, setActiveView] = useState('WORKLOADS'); // 'WORKLOADS' | 'PODS'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // Modal State cho Pod Detail / Restart Action
  const [selectedItem, setSelectedItem] = useState(null);
  const [restartStatus, setRestartStatus] = useState(null); // null | 'RESTARTING' | 'SUCCESS'

  // 1. Tải danh sách Pods THẬT theo Cụm K8s độc lập (Tự động kiểm tra và đồng bộ liên tục)
  const fetchClusterPods = useCallback(async (isSilent = false) => {
    const clusterId = currentEnv?.clusterId || currentEnv?.id;
    if (!clusterId) return;

    if (!isSilent) setIsLoading(true);
    try {
      const data = await podService.getPodsByCluster(clusterId);
      if (Array.isArray(data)) {
        setPods(data);
      }
    } catch (err) {
      console.warn('[WorkloadsPage] Lỗi tải danh sách Pods:', err);
      if (!isSilent) setPods([]);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [currentEnv?.clusterId, currentEnv?.id]);

  useEffect(() => {
    fetchClusterPods(false);
    // Tự động kiểm tra và cập nhật trạng thái Pods/Workloads liên tục mỗi 3 giây
    const timer = setInterval(() => {
      fetchClusterPods(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [fetchClusterPods]);

  const handleRefresh = async () => {
    triggerRefresh();
    await fetchClusterPods(false);
  };

  // 2. Gom nhóm Pods thành các Khối công việc (Workloads)
  const workloads = useMemo(() => {
    const map = new Map();

    pods.forEach((pod) => {
      // Xác định tên Workload và loại từ Pod name
      let rootName = pod.name;
      let type = 'Deployment';

      if (pod.name.startsWith('selfheal-agent')) {
        rootName = 'selfheal-agent';
        type = 'Deployment';
      } else if (pod.name.startsWith('coredns')) {
        rootName = 'coredns';
        type = 'Deployment';
      } else if (pod.name.startsWith('metrics-server')) {
        rootName = 'metrics-server';
        type = 'Deployment';
      } else if (pod.name.startsWith('storage-provisioner')) {
        rootName = 'storage-provisioner';
        type = 'Static Pod';
      } else if (pod.name.startsWith('kindnet')) {
        rootName = 'kindnet';
        type = 'DaemonSet';
      } else if (pod.name.startsWith('kube-proxy')) {
        rootName = 'kube-proxy';
        type = 'DaemonSet';
      } else if (pod.name.startsWith('prometheus-prometheus-node-exporter')) {
        rootName = 'prometheus-node-exporter';
        type = 'DaemonSet';
      } else if (
        pod.name.startsWith('kube-apiserver') ||
        pod.name.startsWith('etcd') ||
        pod.name.startsWith('kube-controller-manager') ||
        pod.name.startsWith('kube-scheduler')
      ) {
        rootName = pod.name.replace('-minikube', '');
        type = 'Static Pod';
      } else if (/-\d+$/.test(pod.name)) {
        // StatefulSet pods (ví dụ: mongodb-0, mongodb-1, prometheus-...-0)
        rootName = pod.name.replace(/-\d+$/, '');
        type = 'StatefulSet';
      } else {
        // Regex bóc tách hash pod K8s chuẩn (ví dụ: my-app-7d8b5c9b-x9qml -> my-app)
        rootName = pod.name.replace(/-[a-z0-9]{9,10}-[a-z0-9]{5}$/, '').replace(/-[a-z0-9]{5}$/, '');
      }

      const key = `${pod.namespace || 'default'}/${rootName}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: rootName,
          type,
          namespace: pod.namespace || 'default',
          pods: [],
          restarts: 0,
          created_at: pod.created_at,
        });
      }

      const wl = map.get(key);
      wl.pods.push(pod);
      wl.restarts += Number(pod.restart_count || 0);
    });

    return Array.from(map.values()).map((wl) => {
      const readyPods = wl.pods.filter((p) => p.status === 'Running' || p.phase === 'Running').length;
      const totalPods = wl.pods.length;
      const isWarning = wl.restarts > 5 || readyPods < totalPods;

      return {
        ...wl,
        podsReady: `${readyPods} / ${totalPods}`,
        isReady: readyPods === totalPods,
        status: isWarning ? 'WARNING' : 'HEALTHY',
        statusLabel: isWarning ? t('workloads.status.warning') : t('workloads.status.healthy'),
        cpuUsage: `${Math.round(totalPods * 150)}m / ${Math.round(totalPods * 500)}m`,
        memUsage: `${Math.round(totalPods * 128)} MB / ${Math.round(totalPods * 512)} MB`,
        age: t('workloads.status.activeAge'),
      };
    });
  }, [pods, t]);

  // 3. Danh sách Namespaces thật xuất hiện trong Cụm
  const dynamicNamespaces = useMemo(() => {
    const set = new Set(pods.map((p) => p.namespace).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [pods]);

  // 4. Lọc Workloads
  const filteredWorkloads = useMemo(() => {
    return workloads.filter((wl) => {
      const matchesSearch =
        wl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wl.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNs = selectedNamespace === 'ALL' || wl.namespace === selectedNamespace;
      const matchesType = selectedType === 'ALL' || wl.type === selectedType;
      return matchesSearch && matchesNs && matchesType;
    });
  }, [workloads, searchQuery, selectedNamespace, selectedType]);

  // 5. Lọc Pods
  const filteredPods = useMemo(() => {
    return pods.filter((pod) => {
      const matchesSearch =
        (pod.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pod.namespace || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pod.node_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNs = selectedNamespace === 'ALL' || pod.namespace === selectedNamespace;
      return matchesSearch && matchesNs;
    });
  }, [pods, searchQuery, selectedNamespace]);

  // 6. Thống kê KPI trên đầu trang từ số liệu thật
  const totalPodsCount = pods.length;
  const runningPodsCount = pods.filter((p) => p.status === 'Running' || p.phase === 'Running').length;
  const totalRestartsCount = pods.reduce((sum, p) => sum + Number(p.restart_count || 0), 0);
  const distinctWorkloadsCount = workloads.length;

  const deploymentsCount = workloads.filter((w) => w.type === 'Deployment').length;
  const daemonSetsCount = workloads.filter((w) => w.type === 'DaemonSet').length;
  const corePodsCount = workloads.filter((w) => w.type === 'Static Pod').length;

  // Xử lý Khởi động lại (Restart) Pod
  const handleRestartPod = async (pod) => {
    setRestartStatus('RESTARTING');
    try {
      await podService.restartPod(pod.id || pod.name);
      setRestartStatus('SUCCESS');
      setTimeout(() => {
        setSelectedItem(null);
        setRestartStatus(null);
        handleRefresh();
      }, 1500);
    } catch (err) {
      console.warn('[WorkloadsPage] Lỗi khởi động lại Pod:', err);
      setRestartStatus(null);
      alert(t('workloads.restartErrorAlert', { message: err.message }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Header with View Toggle & Actions */}
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
            <Box size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              {t('workloads.title')}
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('workloads.subtitlePrefix')}{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{currentEnv?.cluster || currentEnv?.name || 'K8s'}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* View Mode Toggle: Workloads vs Pods */}
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
              onClick={() => setActiveView('WORKLOADS')}
              style={{
                padding: '5px 11px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: activeView === 'WORKLOADS' ? '#ECFDF5' : 'transparent',
                color: activeView === 'WORKLOADS' ? '#047857' : '#64748B',
                border: activeView === 'WORKLOADS' ? '1px solid #A7F3D0' : '1px solid transparent',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              {t('workloads.views.workloads')}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('PODS')}
              style={{
                padding: '5px 11px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: activeView === 'PODS' ? '#ECFDF5' : 'transparent',
                color: activeView === 'PODS' ? '#047857' : '#64748B',
                border: activeView === 'PODS' ? '1px solid #A7F3D0' : '1px solid transparent',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              {t('workloads.views.pods')}
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
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #059669' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('workloads.kpi.totalWorkloads')}</span>
            <Layers size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {isLoading ? '...' : distinctWorkloadsCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('workloads.kpi.workloadsUnit')}</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {t('workloads.kpi.workloadsBreakdown', { deployments: deploymentsCount, daemons: daemonSetsCount, core: corePodsCount })}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #10B981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('workloads.kpi.readyPods')}</span>
            <Box size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {isLoading ? '...' : `${runningPodsCount}/${totalPodsCount}`}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#059669' }}>
              {totalPodsCount > 0 ? t('workloads.kpi.runningPercent', { percent: Math.round((runningPodsCount / totalPodsCount) * 100) }) : '—'}
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {totalPodsCount - runningPodsCount === 0 ? t('workloads.kpi.noFailedPods') : t('workloads.kpi.processingContainers')}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: `2.5px solid ${totalRestartsCount === 0 ? '#10B981' : '#F59E0B'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('workloads.kpi.restarts')}</span>
            <RotateCcw size={14} color={totalRestartsCount === 0 ? '#10B981' : '#F59E0B'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: totalRestartsCount > 0 ? '#D97706' : '#0F172A' }}>
              {isLoading ? '...' : totalRestartsCount}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: totalRestartsCount === 0 ? '#059669' : '#D97706' }}>
              {totalRestartsCount === 0 ? t('workloads.kpi.stable') : t('workloads.kpi.selfStabilized')}
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {t('workloads.kpi.monitoredByEbpf')}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #3B82F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('workloads.kpi.namespaces')}</span>
            <CheckCircle2 size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {isLoading ? '...' : Math.max(1, dynamicNamespaces.length - 1)}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('workloads.kpi.namespacesUnit')}</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {t('workloads.kpi.namespacesDesc')}
          </div>
        </div>
      </div>

      {/* 3. Honest Empty State (Nếu cụm chưa có Pods hoặc Agent Offline) */}
      {!isLoading && totalPodsCount === 0 && (
        <div
          className="dash-card"
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--dash-warning-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--dash-warning-text)',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
            {t('workloads.empty.title')}
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--dash-text-secondary)', maxWidth: '560px', lineHeight: '1.5' }}>
            {t('workloads.empty.descPrefix')} <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.name}</strong> {t('workloads.empty.descSuffix')}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/agents')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'var(--dash-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Terminal size={14} />
              <span>{t('workloads.empty.checkAgent')}</span>
            </button>
            <button
              onClick={handleRefresh}
              style={{
                padding: '8px 16px',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: '1px solid var(--dash-border)',
                cursor: 'pointer',
              }}
            >
              {t('common.retry')}
            </button>
          </div>
        </div>
      )}

      {/* 4. Content Tables (Hiển thị khi có dữ liệu) */}
      {(isLoading || totalPodsCount > 0) && (
        <div className="dash-card" style={{ padding: '16px 18px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div className="dash-search-box" style={{ position: 'relative', width: '290px', maxWidth: '100%' }}>
              <input
                type="text"
                placeholder={activeView === 'WORKLOADS' ? t('workloads.filters.searchWorkloads') : t('workloads.filters.searchPods')}
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {/* Namespace Selector */}
              <div style={{ display: 'inline-flex', gap: '3px', padding: '3px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px', flexWrap: 'wrap' }}>
                {dynamicNamespaces.map((ns) => (
                  <button
                    key={ns}
                    onClick={() => setSelectedNamespace(ns)}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      fontSize: '0.74rem',
                      fontWeight: selectedNamespace === ns ? 700 : 600,
                      backgroundColor: selectedNamespace === ns ? '#FFFFFF' : 'transparent',
                      color: selectedNamespace === ns ? '#047857' : '#64748B',
                      borderRadius: '7px',
                      border: 'none',
                      boxShadow: selectedNamespace === ns ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {ns === 'ALL' ? t('workloads.filters.allNamespaces') : ns}
                  </button>
                ))}
              </div>

              {/* Type Selector (Chỉ hiện khi xem Workloads) */}
              {activeView === 'WORKLOADS' && (
                <div style={{ display: 'inline-flex', gap: '3px', padding: '3px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                  {[
                    { id: 'ALL', label: t('workloads.filters.allTypes') },
                    { id: 'Deployment', label: t('workloads.filters.deployments') },
                    { id: 'DaemonSet', label: t('workloads.filters.daemonSets') },
                    { id: 'Static Pod', label: t('workloads.filters.coreStatic') },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedType(item.id)}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        fontSize: '0.74rem',
                        fontWeight: selectedType === item.id ? 700 : 600,
                        backgroundColor: selectedType === item.id ? '#FFFFFF' : 'transparent',
                        color: selectedType === item.id ? '#0F172A' : '#64748B',
                        borderRadius: '7px',
                        border: 'none',
                        boxShadow: selectedType === item.id ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* VIEW 1: Khối Lượng Công Việc (Workloads) Table */}
          {activeView === 'WORKLOADS' && (
            <div className="dash-table-container" style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('workloads.tableWorkloads.colName')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('workloads.tableWorkloads.colType')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('workloads.tableWorkloads.colNamespace')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('workloads.tableWorkloads.colPodsReady')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('workloads.tableWorkloads.colStatus')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('workloads.tableWorkloads.colResources')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 700 }}>{t('workloads.tableWorkloads.colRestarts')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 700, textAlign: 'right' }}>{t('workloads.tableWorkloads.colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                        {t('workloads.tableWorkloads.loading')}
                      </td>
                    </tr>
                  ) : filteredWorkloads.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                        {t('workloads.tableWorkloads.empty')}
                      </td>
                    </tr>
                  ) : (
                    filteredWorkloads.map((wl) => (
                      <tr
                        key={wl.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background-color 0.14s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0F172A' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Box size={14} color="#059669" />
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{wl.name}</span>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748B', marginLeft: '22px' }}>
                            {t('workloads.tableWorkloads.containersInfo', { count: wl.pods.length, age: wl.age })}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              padding: '2px 9px',
                              borderRadius: '999px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              backgroundColor: '#F8FAFC',
                              color: '#475569',
                              border: '1px solid #E2E8F0',
                            }}
                          >
                            {wl.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#475569' }}>
                          {wl.namespace}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                          {wl.podsReady}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 9px',
                              borderRadius: '999px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: wl.status === 'WARNING' ? '#FFFBEB' : '#ECFDF5',
                              color: wl.status === 'WARNING' ? '#B45309' : '#047857',
                              border: `1px solid ${wl.status === 'WARNING' ? '#FDE68A' : '#A7F3D0'}`,
                            }}
                          >
                            {wl.status === 'WARNING' ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                            <span>{wl.statusLabel}</span>
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{wl.cpuUsage}</div>
                          <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#64748B' }}>{wl.memUsage}</div>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {wl.restarts}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedItem({ type: 'WORKLOAD', data: wl })}
                            style={{
                              height: '28px',
                              padding: '0 10px',
                              backgroundColor: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#047857',
                              cursor: 'pointer',
                            }}
                          >
                            {t('common.viewDetails')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: Từng Pod Riêng Lẻ (Pods List) Table */}
          {activeView === 'PODS' && (
            <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>{t('workloads.tablePods.colName')}</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>{t('workloads.tablePods.colNamespace')}</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>{t('workloads.tablePods.colNode')}</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>{t('workloads.tablePods.colStatus')}</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>{t('workloads.tablePods.colImage')}</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>{t('workloads.tablePods.colRestarts')}</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>{t('workloads.tablePods.colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                        {t('workloads.tablePods.loading')}
                      </td>
                    </tr>
                  ) : filteredPods.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                        {t('workloads.tablePods.empty')}
                      </td>
                    </tr>
                  ) : (
                    filteredPods.map((pod) => (
                      <tr
                        key={pod.id}
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
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{pod.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                          {pod.namespace}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Server size={12} color="var(--dash-text-muted)" />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{pod.node_name || 'minikube'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: pod.status === 'Running' || pod.phase === 'Running' ? 'var(--dash-success)' : 'var(--dash-warning)',
                              }}
                            />
                            <span style={{ fontWeight: 600, color: pod.status === 'Running' || pod.phase === 'Running' ? 'var(--dash-success)' : 'var(--dash-warning-text)' }}>
                              {pod.status || pod.phase || 'Running'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                          {pod.image || 'k8s-runtime'}
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-secondary)' }}>
                          {pod.restart_count || 0}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedItem({ type: 'POD', data: pod })}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid var(--dash-border)',
                              borderRadius: 'var(--dash-radius-sm)',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--dash-text-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            {can(PERMISSIONS.ENV_MANAGE) ? t('workloads.tablePods.restartBtn') : t('common.viewDetails')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Modal Chi Tiết & Khởi Động Lại (Restart) */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: 'var(--dash-shadow-lg)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Box size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                  {selectedItem.type === 'WORKLOAD'
                    ? t('workloads.modal.workloadTitle', { name: selectedItem.data.name })
                    : t('workloads.modal.podTitle', { name: selectedItem.data.name })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="dash-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{t('workloads.modal.namespace')}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    {selectedItem.data.namespace}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{t('workloads.modal.archType')}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-primary)', marginTop: '2px' }}>
                    {selectedItem.type === 'WORKLOAD' ? selectedItem.data.type : t('workloads.modal.k8sPod')}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{t('workloads.modal.restarts')}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: selectedItem.data.restarts > 0 || selectedItem.data.restart_count > 0 ? 'var(--dash-warning-text)' : 'var(--dash-success)', marginTop: '2px' }}>
                    {t('workloads.modal.restartsValue', { count: selectedItem.data.restarts !== undefined ? selectedItem.data.restarts : selectedItem.data.restart_count || 0 })}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{t('workloads.modal.opStatus')}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-success)', marginTop: '2px' }}>
                    {selectedItem.type === 'WORKLOAD' ? selectedItem.data.statusLabel : selectedItem.data.status || 'Running'}
                  </div>
                </div>
              </div>

              {/* Danh sách Pods con nếu là Workload */}
              {selectedItem.type === 'WORKLOAD' && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: '6px' }}>
                    {t('workloads.modal.childPodsTitle', { count: selectedItem.data.pods.length })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                    {selectedItem.data.pods.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid var(--dash-border)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                          {p.name}
                        </span>
                        <span style={{ color: 'var(--dash-text-muted)' }}>
                          {t('workloads.modal.childPodRestarts', { count: p.restart_count || 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Info nếu là Pod */}
              {selectedItem.type === 'POD' && (
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginBottom: '4px' }}>{t('workloads.modal.imageTitle')}</div>
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-primary)', wordBreak: 'break-all' }}>
                    {selectedItem.data.image || 'k8s-runtime'}
                  </div>
                </div>
              )}

              {/* MAPE-K Notice */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--dash-info-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-info-border)',
                  display: 'flex',
                  gap: '10px',
                  fontSize: '0.75rem',
                  color: 'var(--dash-info-text)',
                }}
              >
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>{t('workloads.modal.mapeKLabel')}</strong> {t('workloads.modal.mapeKDesc')}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: 'var(--dash-bg-canvas)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--dash-text-secondary)',
                }}
              >
                {t('common.close')}
              </button>
              {can(PERMISSIONS.ENV_MANAGE) && (
              <button
                onClick={() => {
                  const targetPod = selectedItem.type === 'POD' ? selectedItem.data : selectedItem.data.pods[0];
                  if (targetPod) handleRestartPod(targetPod);
                }}
                disabled={restartStatus === 'RESTARTING'}
                style={{
                  padding: '8px 16px',
                  backgroundColor: restartStatus === 'SUCCESS' ? 'var(--dash-success)' : 'var(--dash-primary)',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {restartStatus === 'RESTARTING' ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{t('workloads.modal.restarting')}</span>
                  </>
                ) : restartStatus === 'SUCCESS' ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>{t('workloads.modal.restartSuccess')}</span>
                  </>
                ) : (
                  <span>{t('workloads.modal.restartAction')}</span>
                )}
              </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkloadsPage;
