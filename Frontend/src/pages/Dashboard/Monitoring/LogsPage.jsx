import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { telemetryService } from '../../../services/telemetryService';
import { clusterService } from '../../../services/clusterService';
import { deploymentService } from '../../../services/deploymentService';
import { podService } from '../../../services/podService';
import { LogDetailModal, getLogLevelBadgeStyle, formatLogTimestamp, maskSensitiveData } from '../../../components/dashboard/LogDetailModal';
import {
  Terminal,
  Search,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export const LogsPage = () => {
  const { currentOrg, currentEnv } = useDashboard();

  // Filter States
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedNamespace, setSelectedNamespace] = useState('ALL');
  const [selectedDeployment, setSelectedDeployment] = useState('ALL');
  const [selectedPod, setSelectedPod] = useState('ALL');
  const [selectedRange, setSelectedRange] = useState('1h');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Data & Async States
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [servicesList, setServicesList] = useState([]);

  // K8s Resources States
  const [namespacesList, setNamespacesList] = useState(['default', 'kube-system', 'production', 'staging']);
  const [deploymentsList, setDeploymentsList] = useState([]);
  const [podsList, setPodsList] = useState([]);

  // UX & Live Streaming Controls
  const [isLive, setIsLive] = useState(false);
  const [streamNotice, setStreamNotice] = useState(null);
  const [autoScroll, setAutoScroll] = useState(false);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const logContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load available services for dropdown
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const services = await telemetryService.getApmServices({ windowMinutes: 1440 });
        if (isMounted && Array.isArray(services)) {
          setServicesList(services);
        }
      } catch (err) {
        console.warn('[LogsPage] Could not pre-fetch services:', err.message);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // [4.36] Load Cluster Namespaces
  useEffect(() => {
    let isMounted = true;
    const clusterId = currentEnv?.clusterId || currentEnv?.id;
    if (!clusterId || clusterId === 'k8s-cluster-01') {
      setNamespacesList(['default', 'kube-system', 'production', 'staging']);
      return;
    }
    (async () => {
      try {
        const ns = await Promise.resolve(clusterService?.getClusterNamespaces?.(clusterId, currentOrg?.id)).catch(() => []);
        if (isMounted && Array.isArray(ns) && ns.length > 0) {
          const names = Array.from(
            new Set(ns.map((n) => (typeof n === 'string' ? n : n.name || n.id)).filter(Boolean))
          );
          setNamespacesList(names);
        } else if (isMounted) {
          setNamespacesList(['default', 'kube-system', 'production', 'staging']);
        }
      } catch (err) {
        console.warn('[LogsPage] Could not load namespaces:', err.message);
        if (isMounted) setNamespacesList(['default', 'kube-system', 'production', 'staging']);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentOrg?.id, currentEnv?.clusterId, currentEnv?.id]);

  // [4.36] Load Deployments & Pods based on selected Namespace
  useEffect(() => {
    let isMounted = true;
    const clusterId = currentEnv?.clusterId || currentEnv?.id;
    if (!clusterId || clusterId === 'k8s-cluster-01') return;

    (async () => {
      try {
        const [deps, pods] = await Promise.all([
          Promise.resolve(
            deploymentService?.getDeploymentsByCluster?.(clusterId, {
              orgId: currentOrg?.id,
              namespace: selectedNamespace !== 'ALL' ? selectedNamespace : undefined,
            })
          ).catch(() => []),
          Promise.resolve(
            podService?.getPodsByCluster?.(clusterId, {
              orgId: currentOrg?.id,
              namespace: selectedNamespace !== 'ALL' ? selectedNamespace : undefined,
            })
          ).catch(() => []),
        ]);
        if (isMounted) {
          if (Array.isArray(deps)) {
            const uniqueDeps = Array.from(
              new Map(deps.map((d) => [d.name || d.id, d])).values()
            );
            setDeploymentsList(uniqueDeps);
          }
          if (Array.isArray(pods)) {
            const uniquePods = Array.from(
              new Map(pods.map((p) => [p.name || p.id, p])).values()
            );
            setPodsList(uniquePods);
          }
        }
      } catch (err) {
        console.warn('[LogsPage] Could not load K8s resources:', err.message);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentOrg?.id, currentEnv?.clusterId, currentEnv?.id, selectedNamespace]);

  // [4.36] Filter pods by selected deployment
  const filteredPodsList = useMemo(() => {
    if (selectedDeployment === 'ALL') return podsList;
    return podsList.filter((p) => {
      const pName = p.name || '';
      const wName = p.workload_name || p.workload || p.deployment_name || '';
      return wName === selectedDeployment || pName.startsWith(selectedDeployment);
    });
  }, [podsList, selectedDeployment]);

  // Fetch logs with race condition prevention
  const fetchLogs = useCallback(
    async (silent = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentSeq = ++requestSeqRef.current;

      if (!silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const res = await telemetryService.getLogs(
          {
            level: selectedLevel,
            serviceId: selectedService,
            namespace: selectedNamespace !== 'ALL' ? selectedNamespace : undefined,
            deployment: selectedDeployment !== 'ALL' ? selectedDeployment : undefined,
            pod: selectedPod !== 'ALL' ? selectedPod : undefined,
            range: selectedRange,
            search: debouncedSearch,
            clusterId: currentEnv?.clusterId || currentEnv?.id,
            page,
            limit,
          },
          { signal: controller.signal }
        );

        if (currentSeq !== requestSeqRef.current || controller.signal.aborted) {
          return;
        }

        setLogs(Array.isArray(res?.logs) ? res.logs : []);
        if (res?.pagination) {
          setPagination(res.pagination);
        }
      } catch (err) {
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          return;
        }
        if (currentSeq !== requestSeqRef.current) {
          return;
        }
        setErrorMessage(err.message || 'Không thể tải nhật ký từ máy chủ');
        if (!silent) {
          setLogs([]);
        }
      } finally {
        if (currentSeq === requestSeqRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [
      selectedLevel,
      selectedService,
      selectedNamespace,
      selectedDeployment,
      selectedPod,
      selectedRange,
      debouncedSearch,
      page,
      limit,
      currentEnv?.clusterId,
      currentEnv?.id,
    ]
  );

  // Trigger fetch when filters or pagination change
  useEffect(() => {
    fetchLogs(false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchLogs]);

  // Real-time SSE Logs Stream [S4][PB17] 3.3
  useEffect(() => {
    if (!isLive) {
      setStreamNotice(null);
      return;
    }

    let unsubscribe = null;
    let fallbackTicker = null;

    if (typeof telemetryService?.streamLogs === 'function') {
      try {
        unsubscribe = telemetryService.streamLogs(
          {
            serviceId: selectedService,
            namespace: selectedNamespace !== 'ALL' ? selectedNamespace : undefined,
            deployment: selectedDeployment !== 'ALL' ? selectedDeployment : undefined,
            pod: selectedPod !== 'ALL' ? selectedPod : undefined,
            level: selectedLevel !== 'ALL' ? selectedLevel : undefined,
            search: debouncedSearch ? debouncedSearch : undefined,
            clusterId: currentEnv?.clusterId || currentEnv?.id,
            tail: 20,
          },
          (eventType, data) => {
            if (eventType === 'log' && data) {
              setLogs((prev) => {
                const logKey = data.id || `${data.occurred_at || data.timestamp}_${data.message}`;
                if (prev.some((item) => (item.id || `${item.occurred_at || item.timestamp}_${item.message}`) === logKey)) return prev;
                const nextLogs = [data, ...prev];
                return nextLogs.length > 500 ? nextLogs.slice(0, 500) : nextLogs;
              });
            } else if (eventType === 'overflow' && data) {
              setStreamNotice(`Đã giảm tải: bỏ qua ${data.dropped} log do backpressure`);
            }
          },
          (err) => {
            console.warn('[LogsPage] Realtime stream disconnected:', err.message);
          }
        );
      } catch (err) {
        console.warn('[LogsPage] Could not start streamLogs, falling back to interval:', err.message);
      }
    }

    // Safety fallback ticker for mock environments
    if (!unsubscribe) {
      fallbackTicker = setInterval(() => {
        fetchLogs(true);
      }, 8000);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (fallbackTicker) clearInterval(fallbackTicker);
    };
  }, [
    isLive,
    selectedService,
    selectedNamespace,
    selectedDeployment,
    selectedPod,
    selectedLevel,
    debouncedSearch,
    currentEnv?.clusterId,
    currentEnv?.id,
    fetchLogs,
  ]);

  // Auto-scroll to newest (top of list in DESC mode) if enabled
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const hasMore = pagination.page < pagination.totalPages;

  // Load More Older Logs (Tải thêm nhật ký cũ) [S4][PB17] 3.4
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await telemetryService.getLogs({
        level: selectedLevel,
        serviceId: selectedService,
        namespace: selectedNamespace !== 'ALL' ? selectedNamespace : undefined,
        deployment: selectedDeployment !== 'ALL' ? selectedDeployment : undefined,
        pod: selectedPod !== 'ALL' ? selectedPod : undefined,
        range: selectedRange,
        search: debouncedSearch,
        clusterId: currentEnv?.clusterId || currentEnv?.id,
        page: nextPage,
        limit,
      });

      const nextLogs = Array.isArray(res?.logs) ? res.logs : [];
      setPage(nextPage);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
      setLogs((prev) => {
        const existingKeys = new Set(
          prev.map((l) => l.id || `${l.occurred_at || l.timestamp}_${l.message}`)
        );
        const filteredNew = nextLogs.filter(
          (l) => !existingKeys.has(l.id || `${l.occurred_at || l.timestamp}_${l.message}`)
        );
        const combined = [...prev, ...filteredNew];
        return combined.length > 500 ? combined.slice(0, 500) : combined;
      });
    } catch (err) {
      console.warn('[LogsPage] Could not load more logs:', err.message);
      setErrorMessage(err.message || 'Không thể tải thêm nhật ký cũ');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleContainerScroll = (e) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop > 80) {
      setShowJumpLatest(true);
    } else {
      setShowJumpLatest(false);
    }
  };

  const handleJumpToLatest = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setShowJumpLatest(false);
  };

  const handleLevelChange = (e) => {
    setSelectedLevel(e.target.value);
    setPage(1);
  };

  const handleServiceChange = (e) => {
    setSelectedService(e.target.value);
    setPage(1);
  };

  const handleNamespaceChange = (e) => {
    setSelectedNamespace(e.target.value);
    setSelectedDeployment('ALL');
    setSelectedPod('ALL');
    setPage(1);
  };

  const handleDeploymentChange = (e) => {
    setSelectedDeployment(e.target.value);
    setSelectedPod('ALL');
    setPage(1);
  };

  const handlePodChange = (e) => {
    setSelectedPod(e.target.value);
    setPage(1);
  };

  const handleRangeChange = (e) => {
    setSelectedRange(e.target.value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedLevel('all');
    setSelectedService('all');
    setSelectedNamespace('ALL');
    setSelectedDeployment('ALL');
    setSelectedPod('ALL');
    setSelectedRange('1h');
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
  };

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${formatLogTimestamp(l.occurred_at || l.timestamp).local}] [${l.level}] [${l.service_name || l.service_id || 'unknown'}/${l.pod_id || 'pod'}] ${l.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${formatLogTimestamp(l.occurred_at || l.timestamp).utc}] [${l.level}] [${l.service_name || l.service_id || 'unknown'}/${l.pod_id || 'pod'}] ${l.message}`
      )
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis-k8s-logs-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    selectedLevel !== 'all' ||
    selectedService !== 'all' ||
    selectedNamespace !== 'ALL' ||
    selectedDeployment !== 'ALL' ||
    selectedPod !== 'ALL' ||
    selectedRange !== '1h' ||
    searchQuery.trim().length > 0;

  return (
    <div className="dashboard-logs-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Nhật Ký Hệ Thống Tập Trung (Centralized Logs Stream)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg?.name || 'Tổ chức'} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.name || 'Production'}</span> &bull; Thu thập nhật ký container từ DaemonSet eBPF Agent thời gian thực
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Live stream toggle */}
          <button
            type="button"
            data-testid="logs-live-toggle"
            onClick={() => setIsLive(!isLive)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: isLive ? 'rgba(5, 150, 105, 0.1)' : '#FFFFFF',
              border: isLive ? '1px solid #059669' : '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: isLive ? '#059669' : 'var(--dash-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {isLive ? <Pause size={14} /> : <Play size={14} />}
            <span>{isLive ? 'Tạm dừng Live' : 'Bật Live Stream'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            data-testid="logs-refresh-btn"
            onClick={() => fetchLogs(false)}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--dash-text-secondary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>

          {/* Copy logs */}
          <button
            type="button"
            data-testid="logs-copy-btn"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
          </button>

          {/* Download logs */}
          <button
            type="button"
            data-testid="logs-download-btn"
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <Download size={14} />
            <span>Tải .log</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="dash-card"
        data-testid="logs-filter-toolbar"
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Namespace Filter [4.36] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Namespace:</span>
            <select
              data-testid="logs-namespace-select"
              value={selectedNamespace}
              onChange={handleNamespaceChange}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="ALL">Tất cả Namespaces</option>
              {namespacesList.map((ns) => {
                const name = typeof ns === 'string' ? ns : ns.name || ns.id;
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Deployment Filter [4.36] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Deployment:</span>
            <select
              data-testid="logs-deployment-select"
              value={selectedDeployment}
              onChange={handleDeploymentChange}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                maxWidth: '180px',
              }}
            >
              <option value="ALL">Tất cả Deployments</option>
              {deploymentsList.map((dep) => {
                const name = dep.name || dep.id;
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Pod Filter [4.36] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Pod:</span>
            <select
              data-testid="logs-pod-select"
              value={selectedPod}
              onChange={handlePodChange}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                maxWidth: '180px',
              }}
            >
              <option value="ALL">Tất cả Pods ({filteredPodsList.length})</option>
              {filteredPodsList.map((pod) => {
                const name = pod.name || pod.id;
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Level Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Cấp độ:</span>
            <select
              data-testid="logs-level-select"
              value={selectedLevel}
              onChange={handleLevelChange}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="all">Tất cả cấp độ</option>
              <option value="INFO">INFO (Thông tin)</option>
              <option value="WARN">WARN (Cảnh báo)</option>
              <option value="ERROR">ERROR (Lỗi)</option>
              <option value="FATAL">FATAL (Nghiêm trọng)</option>
              <option value="DEBUG">DEBUG (Gỡ lỗi)</option>
            </select>
          </div>

          {/* Service Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Dịch vụ:</span>
            <select
              data-testid="logs-service-select"
              value={selectedService}
              onChange={handleServiceChange}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                maxWidth: '180px',
              }}
            >
              <option value="all">Tất cả dịch vụ</option>
              {servicesList.map((svc) => (
                <option key={svc.service_id || svc.service_name} value={svc.service_name || svc.service_id}>
                  {svc.service_name || svc.service_id}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Khoảng thời gian:</span>
            <select
              data-testid="logs-range-select"
              value={selectedRange}
              onChange={handleRangeChange}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="15m">15 phút qua</option>
              <option value="1h">1 giờ qua</option>
              <option value="24h">24 giờ qua</option>
              <option value="7d">7 ngày qua</option>
              <option value="all">Toàn bộ thời gian</option>
            </select>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              data-testid="logs-search-input"
              placeholder="Tìm kiếm nội dung, pod, từ khóa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: '32px',
                width: '260px',
                padding: '0 28px 0 28px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                outline: 'none',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--dash-text-muted)' }} />
            {searchQuery && (
              <button
                type="button"
                data-testid="logs-search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '7px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--dash-text-muted)',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              data-testid="logs-reset-filters-btn"
              onClick={handleResetFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                backgroundColor: '#F1F5F9',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                fontSize: '0.75rem',
                color: 'var(--dash-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} />
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        {/* Auto Scroll Checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            data-testid="logs-autoscroll-checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          <span>Tự cuộn xuống dưới cùng</span>
        </label>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div
          data-testid="logs-error-banner"
          style={{
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            color: '#B91C1C',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            data-testid="logs-error-retry-btn"
            onClick={() => fetchLogs(false)}
            style={{
              padding: '4px 10px',
              backgroundColor: '#B91C1C',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Terminal Display Window */}
      <div
        data-testid="logs-terminal-window"
        style={{
          position: 'relative',
          backgroundColor: '#1E1E1E',
          border: '1px solid #334155',
          borderRadius: '6px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}
      >
        {/* Terminal Title Bar */}
        <div
          style={{
            backgroundColor: '#0F172A',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ marginLeft: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94A3B8' }}>
              k8s-pod-stream &bull; Đang hiển thị {logs.length} / tổng số {pagination.total} dòng nhật ký
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {streamNotice && (
              <span data-testid="logs-overflow-notice" style={{ fontSize: '0.6875rem', color: '#FBBF24', fontFamily: 'var(--font-mono)' }}>
                ⚠️ {streamNotice}
              </span>
            )}
            <div
              data-testid="logs-live-status-indicator"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: isLive ? '#34D399' : '#94A3B8' }}
            >
              {isLive ? '● ĐANG TRUYỀN DỮ LIỆU TRỰC TIẾP' : '○ TẠM DỪNG'}
            </div>
          </div>
        </div>

        {/* Log Lines Content */}
        <div
          ref={logContainerRef}
          data-testid="logs-container"
          onScroll={handleContainerScroll}
          style={{
            height: '480px',
            overflowY: 'auto',
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            color: '#E2E8F0',
            position: 'relative',
          }}
        >
          {isLoading && logs.length === 0 ? (
            <div
              data-testid="logs-loading-state"
              style={{
                padding: '60px',
                textAlign: 'center',
                color: '#94A3B8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <RefreshCw size={24} className="animate-spin" color="#38BDF8" />
              <span>Đang kết nối và tải chuỗi nhật ký container từ PostgreSQL...</span>
            </div>
          ) : logs.length === 0 ? (
            <div
              data-testid="logs-empty-state"
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                color: '#94A3B8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Filter size={24} color="#64748B" />
              <span style={{ fontSize: '0.875rem', color: '#E2E8F0', fontWeight: 600 }}>
                Không tìm thấy nhật ký phù hợp với bộ lọc hiện tại.
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                Hãy thử nới lỏng bộ lọc cấp độ, mở rộng thời gian hoặc tìm kiếm từ khóa khác.
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  data-testid="logs-empty-reset-btn"
                  onClick={handleResetFilters}
                  style={{
                    marginTop: '8px',
                    padding: '6px 14px',
                    backgroundColor: '#334155',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            logs.map((item, idx) => {
              const badge = getLogLevelBadgeStyle(item.level);
              const timeDisplay = formatLogTimestamp(item.occurred_at || item.timestamp).local;
              const svcName = item.service_name || item.service_id || 'service';
              const podName = item.pod_id || item.pod || 'container';

              return (
                <div
                  key={item.id || idx}
                  data-testid={`log-row-${item.id || idx}`}
                  onClick={() => setSelectedLog(item)}
                  title="Nhấp để xem chi tiết bản ghi nhật ký này"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '4px 6px',
                    borderRadius: '3px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ color: '#64748B', width: '28px', textAlign: 'right', flexShrink: 0, userSelect: 'none' }}>
                    {(pagination.page - 1) * pagination.limit + idx + 1}
                  </span>
                  <span style={{ color: '#94A3B8', flexShrink: 0, userSelect: 'none' }}>
                    [{timeDisplay}]
                  </span>
                  <span
                    style={{
                      padding: '0 5px',
                      borderRadius: '3px',
                      fontSize: '0.625rem',
                      fontWeight: 800,
                      backgroundColor: badge.bg,
                      color: badge.text,
                      border: `1px solid ${badge.border}`,
                      flexShrink: 0,
                    }}
                  >
                    {item.level || 'INFO'}
                  </span>
                  <span style={{ color: '#38BDF8', flexShrink: 0 }}>
                    [{item.namespace ? `${item.namespace}/` : ''}{svcName}/{item.pod_name || podName}]
                  </span>
                  <span
                    data-testid={`log-msg-${item.id || idx}`}
                    style={{
                      color:
                        item.level === 'FATAL' || item.level === 'CRITICAL' || item.level === 'ERROR'
                          ? '#FCA5A5'
                          : item.level === 'WARN' || item.level === 'WARNING'
                          ? '#FDE68A'
                          : '#F1F5F9',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      whiteSpace: 'pre-wrap',
                      fontFamily: "var(--font-mono, 'Menlo', 'Monaco', 'Courier New', monospace)",
                      flex: 1,
                    }}
                  >
                    {maskSensitiveData(item.message || item.msg)}
                  </span>
                </div>
              );
            })
          )}

          {/* Load More Button or End of History Indicator [S4][PB17] 3.4 */}
          {logs.length > 0 && (
            <div
              data-testid="logs-load-more-container"
              style={{
                marginTop: '12px',
                padding: '10px 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {hasMore ? (
                <button
                  type="button"
                  data-testid="logs-load-more-btn"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    backgroundColor: '#1E293B',
                    color: '#38BDF8',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RefreshCw size={13} className={isLoadingMore ? 'animate-spin' : ''} />
                  <span>
                    {isLoadingMore
                      ? 'Đang tải thêm nhật ký cũ...'
                      : `Tải thêm nhật ký cũ hơn (Trang ${pagination.page + 1} / ${pagination.totalPages})`}
                  </span>
                </button>
              ) : (
                <div
                  data-testid="logs-end-of-history"
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748B',
                    fontFamily: 'var(--font-mono)',
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>✓ Đã tải toàn bộ lịch sử ({pagination.total} bản ghi)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Jump to Newest Button */}
        {showJumpLatest && (
          <button
            type="button"
            data-testid="logs-jump-latest-btn"
            onClick={handleJumpToLatest}
            style={{
              position: 'absolute',
              bottom: '56px',
              right: '24px',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              cursor: 'pointer',
            }}
          >
            <ArrowUp size={13} />
            <span>Cuộn về log mới nhất</span>
          </button>
        )}

        {/* Pagination Bar */}
        <div
          data-testid="logs-pagination-bar"
          style={{
            padding: '10px 16px',
            backgroundColor: '#0F172A',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '0.75rem',
            color: '#94A3B8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Số bản ghi / trang:</span>
            <select
              data-testid="logs-page-size-select"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              style={{
                height: '26px',
                padding: '0 6px',
                fontSize: '0.75rem',
                backgroundColor: '#1E293B',
                color: '#E2E8F0',
                border: '1px solid #334155',
                borderRadius: '4px',
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span>
              &bull; Trang <strong style={{ color: '#E2E8F0' }}>{pagination.page}</strong> / {pagination.totalPages} (Tổng số {pagination.total} logs)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              data-testid="logs-prev-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                backgroundColor: pagination.page <= 1 ? '#1E293B' : '#334155',
                color: pagination.page <= 1 ? '#64748B' : '#FFFFFF',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: pagination.page <= 1 || isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
              <span>Trước</span>
            </button>

            <button
              type="button"
              data-testid="logs-next-page-btn"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                backgroundColor: pagination.page >= pagination.totalPages ? '#1E293B' : '#334155',
                color: pagination.page >= pagination.totalPages ? '#64748B' : '#FFFFFF',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: pagination.page >= pagination.totalPages || isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <span>Sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
};

export default LogsPage;
