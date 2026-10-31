import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { podService } from '../../../services/podService';
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
  const { currentEnv, isRefreshing, triggerRefresh, onNavigate } = useDashboard();
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

  // 1. Tải danh sách Pods THẬT theo Cụm K8s độc lập
  const fetchClusterPods = useCallback(async () => {
    const clusterId = currentEnv?.clusterId || currentEnv?.id;
    if (!clusterId) return;

    setIsLoading(true);
    try {
      const data = await podService.getPodsByCluster(clusterId);
      setPods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[WorkloadsPage] Lỗi tải danh sách Pods:', err);
      setPods([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentEnv?.clusterId, currentEnv?.id]);

  useEffect(() => {
    fetchClusterPods();
  }, [fetchClusterPods]);

  const handleRefresh = async () => {
    triggerRefresh();
    await fetchClusterPods();
  };

  // 2. Gom nhóm Pods thành các Khối công việc (Workloads)
  const workloads = useMemo(() => {
    const map = new Map();

    pods.forEach((pod) => {
      // Xác định tên Workload và loại từ Pod name
      let rootName = pod.name;
      let type = 'Deployment';

      if (pod.name.startsWith('sme-order-service')) {
        rootName = 'sme-order-service';
        type = 'Deployment';
      } else if (pod.name.startsWith('selfheal-agent')) {
        rootName = 'selfheal-agent';
        type = 'DaemonSet';
      } else if (pod.name.startsWith('coredns')) {
        rootName = 'coredns';
        type = 'Deployment';
      } else if (pod.name.startsWith('metrics-server')) {
        rootName = 'metrics-server';
        type = 'Deployment';
      } else if (pod.name.startsWith('storage-provisioner')) {
        rootName = 'storage-provisioner';
        type = 'Deployment';
      } else if (pod.name.startsWith('kindnet')) {
        rootName = 'kindnet';
        type = 'DaemonSet';
      } else if (pod.name.startsWith('kube-proxy')) {
        rootName = 'kube-proxy';
        type = 'DaemonSet';
      } else if (
        pod.name.startsWith('kube-apiserver') ||
        pod.name.startsWith('etcd') ||
        pod.name.startsWith('kube-controller-manager') ||
        pod.name.startsWith('kube-scheduler')
      ) {
        rootName = pod.name.replace('-minikube', '');
        type = 'Static Pod';
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
        statusLabel: isWarning ? 'Cảnh báo rủi ro' : 'Khỏe mạnh',
        cpuUsage: `${Math.round(totalPods * 150)}m / ${Math.round(totalPods * 500)}m`,
        memUsage: `${Math.round(totalPods * 128)} MB / ${Math.round(totalPods * 512)} MB`,
        age: 'Hoạt động liên tục',
      };
    });
  }, [pods]);

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
      alert('Không thể khởi động lại Pod: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header with View Toggle & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Khối Lượng Công Việc & Pods
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: runningPodsCount > 0 ? 'var(--dash-mint-100)' : 'var(--dash-warning-bg)',
                color: runningPodsCount > 0 ? 'var(--dash-mint-600)' : 'var(--dash-warning-text)',
                border: runningPodsCount > 0 ? '1px solid var(--dash-mint-200)' : '1px solid var(--dash-warning-border)',
              }}
            >
              {totalPodsCount > 0 ? `${runningPodsCount} / ${totalPodsCount} Pods Đang Chạy` : '0 Pods Ngoại Tuyến'}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Giám sát chu kỳ sống của ứng dụng, số lần restart và phân phối containers theo từng Namespace
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View Mode Toggle: Workloads vs Pods */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              padding: '2px',
              borderRadius: '6px',
              border: '1px solid var(--dash-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveView('WORKLOADS')}
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: activeView === 'WORKLOADS' ? 700 : 500,
                backgroundColor: activeView === 'WORKLOADS' ? '#FFFFFF' : 'transparent',
                color: activeView === 'WORKLOADS' ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeView === 'WORKLOADS' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Khối Công Việc ({distinctWorkloadsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('PODS')}
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: activeView === 'PODS' ? 700 : 500,
                backgroundColor: activeView === 'PODS' ? '#FFFFFF' : 'transparent',
                color: activeView === 'PODS' ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeView === 'PODS' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Từng Pod Riêng Lẻ ({totalPodsCount})
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
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
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (Dữ liệu thật từ CSDL Cụm) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Tổng số Workloads */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng số Workloads</span>
            <Layers size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : distinctWorkloadsCount}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>Khối công việc</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            {deploymentsCount} Deployments, {daemonSetsCount} Daemon, {corePodsCount} Core
          </div>
        </div>

        {/* Card 2: Pods Sẵn sàng */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Pods Sẵn sàng</span>
            <Box size={16} color="var(--dash-mint-600)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : `${runningPodsCount} / ${totalPodsCount}`}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>
              {totalPodsCount > 0 ? `${Math.round((runningPodsCount / totalPodsCount) * 100)}% Running` : 'Chưa có dữ liệu'}
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            {totalPodsCount - runningPodsCount === 0 ? 'Không có Pods CrashLoopBackOff' : 'Đang xử lý container'}
          </div>
        </div>

        {/* Card 3: Khởi động lại */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Khởi động lại (Restarts)</span>
            <RotateCcw size={16} color={totalRestartsCount === 0 ? 'var(--dash-success)' : 'var(--dash-warning)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : totalRestartsCount}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: totalRestartsCount === 0 ? 'var(--dash-success)' : 'var(--dash-warning-text)' }}>
              {totalRestartsCount === 0 ? 'Tuyệt đối ổn định' : 'Đã tự ổn định'}
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Giám sát qua cảm biến nhân Linux eBPF
          </div>
        </div>

        {/* Card 4: Số Namespaces */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Số Namespaces</span>
            <CheckCircle2 size={16} color="var(--dash-info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : Math.max(1, dynamicNamespaces.length - 1)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>Không gian</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Phân lập tài nguyên theo chuẩn K8s
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
            Chưa có Pods nào được phát hiện trong cụm này
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--dash-text-secondary)', maxWidth: '560px', lineHeight: '1.5' }}>
            Cụm <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.name}</strong> hiện chưa gửi số liệu Pods về máy chủ. Vui lòng kiểm tra trạng thái tác tử eBPF Agent hoặc cài đặt Agent vào cụm để bắt đầu đồng bộ.
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
              <span>Kiểm Tra Agent</span>
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
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* 4. Content Tables (Hiển thị khi có dữ liệu) */}
      {(isLoading || totalPodsCount > 0) && (
        <div className="dash-card" style={{ padding: '20px' }}>
          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                placeholder={activeView === 'WORKLOADS' ? "Tìm theo tên workload hoặc namespace..." : "Tìm theo tên Pod hoặc Node..."}
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {/* Namespace Selector */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {dynamicNamespaces.map((ns) => (
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

              {/* Type Selector (Chỉ hiện khi xem Workloads) */}
              {activeView === 'WORKLOADS' && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { id: 'ALL', label: 'Mọi loại' },
                    { id: 'Deployment', label: 'Deployments' },
                    { id: 'DaemonSet', label: 'DaemonSets' },
                    { id: 'Static Pod', label: 'Core / Static' },
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
              )}
            </div>
          </div>

          {/* VIEW 1: Khối Lượng Công Việc (Workloads) Table */}
          {activeView === 'WORKLOADS' && (
            <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Tên Khối Công Việc</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Loại</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Namespace</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Pods Sẵn Sàng</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Trạng Thái</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>CPU / RAM Ước Tính</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Khởi Động Lại</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                        Đang tải danh sách Workloads từ cụm Kubernetes...
                      </td>
                    </tr>
                  ) : filteredWorkloads.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                        Không tìm thấy khối công việc nào khớp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkloads.map((wl) => (
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
                            {wl.pods.length} containers • {wl.age}
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
                            {wl.status === 'WARNING' ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                            <span>{wl.statusLabel}</span>
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--dash-text-primary)' }}>{wl.cpuUsage}</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{wl.memUsage}</div>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {wl.restarts}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedItem({ type: 'WORKLOAD', data: wl })}
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
                            Xem Chi Tiết
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
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Tên Pod Container</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Namespace</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Node Máy Chủ</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Trạng Thái</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Container Image</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Restarts</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                        Đang tải danh sách Pods...
                      </td>
                    </tr>
                  ) : filteredPods.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                        Không tìm thấy Pod nào.
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
                            Khởi động lại (Restart)
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
                  {selectedItem.type === 'WORKLOAD' ? `Khối Công Việc: ${selectedItem.data.name}` : `Pod: ${selectedItem.data.name}`}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Namespace</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    {selectedItem.data.namespace}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Loại / Kiến Trúc</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-primary)', marginTop: '2px' }}>
                    {selectedItem.type === 'WORKLOAD' ? selectedItem.data.type : 'Kubernetes Pod'}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Số Lượng Khởi Động Lại (Restarts)</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: selectedItem.data.restarts > 0 || selectedItem.data.restart_count > 0 ? 'var(--dash-warning-text)' : 'var(--dash-success)', marginTop: '2px' }}>
                    {selectedItem.data.restarts !== undefined ? selectedItem.data.restarts : selectedItem.data.restart_count || 0} lần
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Trạng Thái Vận Hành</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-success)', marginTop: '2px' }}>
                    {selectedItem.type === 'WORKLOAD' ? selectedItem.data.statusLabel : selectedItem.data.status || 'Running'}
                  </div>
                </div>
              </div>

              {/* Danh sách Pods con nếu là Workload */}
              {selectedItem.type === 'WORKLOAD' && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: '6px' }}>
                    Các Pods thuộc khối công việc này ({selectedItem.data.pods.length}):
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
                          Restarts: {p.restart_count || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Info nếu là Pod */}
              {selectedItem.type === 'POD' && (
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginBottom: '4px' }}>Container Image:</div>
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
                  <strong>Hệ Thống Tự Chữa Lành MAPE-K:</strong> Khi bạn thực hiện Khởi động lại (Restart), hệ thống sẽ gửi lệnh điều phối đến cụm Kubernetes và ghi nhận vào nhật ký kiểm toán (Audit Trail) để đối chiếu hiệu năng.
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
                Đóng
              </button>
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
                    <span>Đang gửi lệnh MAPE-K...</span>
                  </>
                ) : restartStatus === 'SUCCESS' ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Đã gửi lệnh thành công!</span>
                  </>
                ) : (
                  <span>Khởi Động Lại (Restart)</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkloadsPage;
