import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { telemetryService } from '../../../services/telemetryService';
import { clusterService } from '../../../services/clusterService';
import { deploymentService } from '../../../services/deploymentService';
import { podService } from '../../../services/podService';
import { aiService } from '../../../services/aiService';
import { extractActiveK8sServices, isExcludedSystemService } from '../../../utils/k8sServiceFilter';
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
  FileText,
  Radio,
  ShieldAlert,
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

  // K8s Resources States (100% nạp từ K8s cluster thực tế, không code cứng)
  const [namespacesList, setNamespacesList] = useState([]);
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

  // Load available services for dropdown (đồng bộ theo workloads đang chạy thực tế trên K8s, không lấy dịch vụ cũ đã xóa)
  useEffect(() => {
    let isMounted = true;
    const clusterId = currentEnv?.clusterId || currentEnv?.id;
    const orgId = currentOrg?.id;
    (async () => {
      try {
        const [liveWorkloads, apmServices] = await Promise.all([
          aiService.getWorkloads(clusterId, orgId).catch(() => null),
          telemetryService
            .getApmServices(1440, { clusterId, organizationId: orgId })
            .catch(() => []),
        ]);
        if (!isMounted) return;

        if (Array.isArray(liveWorkloads)) {
          const activeNames = extractActiveK8sServices(liveWorkloads);
          setServicesList(activeNames.map((name) => ({ service_id: name, service_name: name })));
          return;
        }
        if (Array.isArray(apmServices)) {
          setServicesList(
            apmServices.filter((s) => !isExcludedSystemService(s.service_name || s.service_id))
          );
        }
      } catch (err) {
        console.warn('[LogsPage] Could not pre-fetch services:', err.message);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentEnv?.clusterId, currentEnv?.id, currentOrg?.id]);

  // [4.36] Load Cluster Namespaces
  useEffect(() => {
    let isMounted = true;
    const clusterId = currentEnv?.clusterId || currentEnv?.id;
    if (!clusterId || clusterId === 'k8s-cluster-01') {
      setNamespacesList([]);
      return;
    }
    (async () => {
      try {
        const ns = await Promise.resolve(clusterService?.getClusterNamespaces?.(clusterId, currentOrg?.id)).catch(() => []);
        if (isMounted && Array.isArray(ns) && ns.length > 0) {
          const names = Array.from(
            new Set(ns.map((n) => (typeof n === 'string' ? n : n.name || n.id)).filter(Boolean))
          ).sort();
          setNamespacesList(names);
        } else if (isMounted) {
          setNamespacesList([]);
        }
      } catch (err) {
        console.warn('[LogsPage] Could not load namespaces:', err.message);
        if (isMounted) setNamespacesList([]);
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

  const logStats = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    for (let i = 0; i < logs.length; i++) {
      const lv = String(logs[i]?.level || '').toUpperCase();
      if (lv === 'ERROR' || lv === 'FATAL' || lv === 'CRITICAL') errorCount++;
      else if (lv === 'WARN' || lv === 'WARNING') warnCount++;
    }
    return { errorCount, warnCount };
  }, [logs]);

  const activeClusterLabel = currentEnv?.cluster || currentEnv?.name || 'Toàn hệ thống';

  const kpiCardStyle = (accent) => ({
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(226, 232, 240, 0.95)',
    borderTop: `2.5px solid ${accent}`,
    borderRadius: '12px',
    padding: '11px 14px',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
    minWidth: 0,
    transition: 'transform 0.14s ease, box-shadow 0.14s ease',
  });

  const actionBtnStyle = (active = false, disabled = false) => ({
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    backgroundColor: active ? '#ECFDF5' : '#FFFFFF',
    border: active ? '1px solid #10B981' : '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
    fontSize: '0.8rem',
    fontWeight: active ? 700 : 600,
    color: active ? '#047857' : disabled ? '#94A3B8' : '#334155',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  });

  const selectControlStyle = {
    height: '32px',
    padding: '0 10px',
    fontSize: '0.75rem',
    fontWeight: 600,
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div className="dashboard-logs-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Page Header (đồng bộ phong cách sạch, gọn của Dashboard mới) */}
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
            <Terminal size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Nhật Ký Container Tập Trung
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Thu thập &amp; tra cứu nhật ký container thời gian thực từ cụm{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{activeClusterLabel}</strong>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="logs-live-toggle"
            onClick={() => setIsLive(!isLive)}
            style={actionBtnStyle(isLive, false)}
          >
            {isLive ? <Pause size={14} /> : <Play size={14} />}
            <span>{isLive ? 'Đang Live Stream' : 'Bật Live Stream'}</span>
          </button>

          <button
            type="button"
            data-testid="logs-refresh-btn"
            onClick={() => fetchLogs(false)}
            disabled={isLoading}
            style={actionBtnStyle(false, isLoading)}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            data-testid="logs-copy-btn"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            style={actionBtnStyle(copied, logs.length === 0)}
          >
            {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>

          <button
            type="button"
            data-testid="logs-download-btn"
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
            style={actionBtnStyle(false, logs.length === 0)}
          >
            <Download size={14} />
            <span>Tải .log</span>
          </button>
        </div>
      </div>

      {/* Hàng KPI Tóm Tắt (đồng bộ 4 thẻ kính/viền màu giống Dashboard & Node Metrics) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div style={kpiCardStyle('#059669')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỔNG NHẬT KÝ</span>
            <FileText size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {(pagination.total || 0).toLocaleString('vi-VN')}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
              Hiển thị {logs.length} dòng
            </span>
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedLevel((prev) => (prev === 'ERROR' ? 'all' : 'ERROR'));
            setPage(1);
          }}
          title="Nhấp để lọc nhanh log lỗi ERROR"
          style={{ ...kpiCardStyle('#EF4444'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>LỖI (ERROR / FATAL)</span>
            <ShieldAlert size={14} color="#EF4444" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: logStats.errorCount > 0 ? '#DC2626' : '#0F172A' }}>
              {logStats.errorCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>trong trang hiện tại</span>
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedLevel((prev) => (prev === 'WARN' ? 'all' : 'WARN'));
            setPage(1);
          }}
          title="Nhấp để lọc nhanh log cảnh báo WARN"
          style={{ ...kpiCardStyle('#F59E0B'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>CẢNH BÁO (WARN)</span>
            <AlertTriangle size={14} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: logStats.warnCount > 0 ? '#D97706' : '#0F172A' }}>
              {logStats.warnCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>trong trang hiện tại</span>
          </div>
        </div>

        <div style={kpiCardStyle(isLive ? '#10B981' : '#3B82F6')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>LUỒNG STREAM</span>
            <Radio size={14} color={isLive ? '#10B981' : '#3B82F6'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 9px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: isLive ? '#ECFDF5' : '#F1F5F9',
                color: isLive ? '#059669' : '#475569',
                border: isLive ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isLive ? '#10B981' : '#94A3B8' }} />
              {isLive ? 'Trực tiếp (SSE)' : 'Chế độ tĩnh'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
              {filteredPodsList.length} Pods
            </span>
          </div>
        </div>
      </div>

      {/* Bộ Lọc Gọn 2 Hàng (Hàng 1: Tìm kiếm + Cấp độ + Thời gian • Hàng 2: Namespace / Deployment / Pod / Dịch vụ) */}
      <div
        className="dash-card"
        data-testid="logs-filter-toolbar"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '12px 16px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Hàng 1: Tìm kiếm + Chọn nhanh cấp độ + Chọn nhanh thời gian */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
            <input
              type="text"
              data-testid="logs-search-input"
              placeholder="Tìm kiếm nội dung log, pod, từ khóa lỗi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: '34px',
                width: '100%',
                padding: '0 30px 0 32px',
                fontSize: '0.78rem',
                border: '1px solid #CBD5E1',
                borderRadius: '9px',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
            {searchQuery && (
              <button
                type="button"
                data-testid="logs-search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Chọn nhanh Cấp độ (giữ nguyên select ẩn hoặc pills trực quan + data-testid) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#F8FAFC', padding: '3px', borderRadius: '9px', border: '1px solid #E2E8F0' }}>
            {[
              { id: 'all', label: 'Tất cả', color: '#059669', bg: '#ECFDF5' },
              { id: 'INFO', label: 'INFO', color: '#2563EB', bg: '#EFF6FF' },
              { id: 'WARN', label: 'WARN', color: '#D97706', bg: '#FFFBEB' },
              { id: 'ERROR', label: 'ERROR', color: '#DC2626', bg: '#FEF2F2' },
              { id: 'FATAL', label: 'FATAL', color: '#991B1B', bg: '#FEE2E2' },
              { id: 'DEBUG', label: 'DEBUG', color: '#475569', bg: '#F1F5F9' },
            ].map((lv) => {
              const active = selectedLevel === lv.id;
              return (
                <button
                  key={lv.id}
                  type="button"
                  onClick={() => {
                    setSelectedLevel(lv.id);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: active ? `1px solid ${lv.color}55` : '1px solid transparent',
                    backgroundColor: active ? lv.bg : 'transparent',
                    color: active ? lv.color : '#64748B',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {lv.label}
                </button>
              );
            })}
          </div>

          {/* Chọn nhanh Khung thời gian */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#F8FAFC', padding: '3px', borderRadius: '9px', border: '1px solid #E2E8F0' }}>
            {[
              { id: '15m', label: '15m' },
              { id: '1h', label: '1h' },
              { id: '24h', label: '24h' },
              { id: '7d', label: '7d' },
              { id: 'all', label: 'Tất cả' },
            ].map((r) => {
              const active = selectedRange === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRange(r.id);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: active ? '1px solid #10B981' : '1px solid transparent',
                    backgroundColor: active ? '#ECFDF5' : 'transparent',
                    color: active ? '#047857' : '#64748B',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hàng 2: Bộ lọc tài nguyên K8s (Namespace / Deployment / Pod / Dịch vụ) + Đặt lại + Tự cuộn */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #F1F5F9',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <select
              data-testid="logs-namespace-select"
              value={selectedNamespace}
              onChange={handleNamespaceChange}
              style={selectControlStyle}
            >
              <option value="ALL">Namespace: Tất cả</option>
              {namespacesList.map((ns) => {
                const name = typeof ns === 'string' ? ns : ns.name || ns.id;
                return (
                  <option key={name} value={name}>
                    NS: {name}
                  </option>
                );
              })}
            </select>

            <select
              data-testid="logs-deployment-select"
              value={selectedDeployment}
              onChange={handleDeploymentChange}
              style={{ ...selectControlStyle, maxWidth: '190px' }}
            >
              <option value="ALL">Deployment: Tất cả</option>
              {deploymentsList.map((dep) => {
                const name = dep.name || dep.id;
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>

            <select
              data-testid="logs-pod-select"
              value={selectedPod}
              onChange={handlePodChange}
              style={{ ...selectControlStyle, maxWidth: '210px' }}
            >
              <option value="ALL">Pod: Tất cả ({filteredPodsList.length})</option>
              {filteredPodsList.map((pod) => {
                const name = pod.name || pod.id;
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>

            <select
              data-testid="logs-service-select"
              value={selectedService}
              onChange={handleServiceChange}
              style={{ ...selectControlStyle, maxWidth: '190px' }}
            >
              <option value="all">Dịch vụ: Tất cả</option>
              {servicesList.map((svc) => (
                <option key={svc.service_id || svc.service_name} value={svc.service_name || svc.service_id}>
                  {svc.service_name || svc.service_id}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                data-testid="logs-reset-filters-btn"
                onClick={handleResetFilters}
                style={{
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '0 10px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  color: '#DC2626',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} />
                <span>Đặt lại</span>
              </button>
            )}
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: '8px',
              backgroundColor: autoScroll ? '#ECFDF5' : '#F8FAFC',
              border: autoScroll ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
            }}
          >
            <input
              type="checkbox"
              data-testid="logs-autoscroll-checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ accentColor: '#059669' }}
            />
            <span>Tự cuộn mới nhất</span>
          </label>
        </div>
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

      {/* Terminal Display Window (bo tròn đồng bộ 14px & nền console slate sâu) */}
      <div
        data-testid="logs-terminal-window"
        style={{
          position: 'relative',
          backgroundColor: '#0B1120',
          border: '1px solid #1E293B',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.14)',
        }}
      >
        {/* Terminal Title Bar */}
        <div
          style={{
            backgroundColor: '#0F172A',
            padding: '11px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ marginLeft: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94A3B8' }}>
              k8s-pod-stream &bull; Đang hiển thị <strong style={{ color: '#E2E8F0' }}>{logs.length}</strong> /{' '}
              {(pagination.total || 0).toLocaleString('vi-VN')} dòng nhật ký
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {streamNotice && (
              <span data-testid="logs-overflow-notice" style={{ fontSize: '0.6875rem', color: '#FBBF24', fontFamily: 'var(--font-mono)' }}>
                ⚠️ {streamNotice}
              </span>
            )}
            <div
              data-testid="logs-live-status-indicator"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '999px',
                backgroundColor: isLive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(148, 163, 184, 0.12)',
                color: isLive ? '#34D399' : '#94A3B8',
                border: isLive ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(148, 163, 184, 0.2)',
              }}
            >
              {isLive ? '● TRỰC TIẾP' : '○ TẠM DỪNG'}
            </div>
          </div>
        </div>

        {/* Log Lines Content */}
        <div
          ref={logContainerRef}
          data-testid="logs-container"
          onScroll={handleContainerScroll}
          style={{
            height: 'calc(100vh - 385px)',
            minHeight: '420px',
            maxHeight: '620px',
            overflowY: 'auto',
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.65,
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

              const isErrRow = item.level === 'FATAL' || item.level === 'CRITICAL' || item.level === 'ERROR';
              const isWarnRow = item.level === 'WARN' || item.level === 'WARNING';

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
                    padding: '5px 8px',
                    borderRadius: '6px',
                    borderLeft: isErrRow
                      ? '2.5px solid #EF4444'
                      : isWarnRow
                        ? '2.5px solid #F59E0B'
                        : '2.5px solid transparent',
                    backgroundColor: isErrRow
                      ? 'rgba(239, 68, 68, 0.06)'
                      : isWarnRow
                        ? 'rgba(245, 158, 11, 0.04)'
                        : 'transparent',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                    cursor: 'pointer',
                    transition: 'background-color 0.14s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isErrRow
                      ? 'rgba(239, 68, 68, 0.06)'
                      : isWarnRow
                        ? 'rgba(245, 158, 11, 0.04)'
                        : 'transparent';
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
