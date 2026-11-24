import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Inbox,
  X,
  Eye,
  Activity,
  Repeat,
} from 'lucide-react';
import { telemetryService } from '../../../services/telemetryService';
import { clusterService } from '../../../services/clusterService';
import { K8sEventSeverityBadge } from '../../../components/dashboard/K8sEventSeverityBadge';
import {
  EventDetailModal,
  translateK8sEventMessageVi,
  translateK8sEventReasonVi,
} from '../../../components/dashboard/EventDetailModal';

const PRESET_REASONS = [
  { id: 'all', label: 'Tất cả Lý do' },
  { id: 'DeploymentRecovered', label: 'DeploymentRecovered (Phục hồi Deployment)' },
  { id: 'DeploymentRollout', label: 'DeploymentRollout (Triển khai phiên bản mới)' },
  { id: 'MinimumReplicasUnavailable', label: 'MinimumReplicasUnavailable (Thiếu bản sao khả dụng)' },
  { id: 'ScalingReplicaSet', label: 'ScalingReplicaSet (Co giãn bản sao)' },
  { id: 'SuccessfulCreate', label: 'SuccessfulCreate (Khởi tạo Pod mới)' },
  { id: 'SuccessfulDelete', label: 'SuccessfulDelete (Xóa / Thu hồi Pod)' },
  { id: 'Scheduled', label: 'Scheduled (Đã lập lịch vào Node)' },
  { id: 'OOMKilled', label: 'OOMKilled (Hết bộ nhớ RAM)' },
  { id: 'CrashLoopBackOff', label: 'CrashLoopBackOff (Vòng lặp lỗi khởi động)' },
  { id: 'BackOff', label: 'BackOff (Chờ khởi động lại)' },
  { id: 'FailedScheduling', label: 'FailedScheduling (Không thể lập lịch Pod)' },
  { id: 'Unhealthy', label: 'Unhealthy (Thất bại Probe kiểm tra)' },
  { id: 'Killing', label: 'Killing (Đang dừng Container)' },
  { id: 'Error', label: 'Error (Container dừng do lỗi)' },
  { id: 'NodeReady', label: 'NodeReady (Node sẵn sàng)' },
  { id: 'Pulled', label: 'Pulled (Đã tải Container Image)' },
  { id: 'Created', label: 'Created (Đã tạo Container)' },
  { id: 'Started', label: 'Started (Đã khởi chạy Container)' },
];

const PRESET_RESOURCE_TYPES = [
  { id: 'all', label: 'Tất cả Tài nguyên' },
  { id: 'Pod', label: 'Pod' },
  { id: 'Node', label: 'Node' },
  { id: 'Deployment', label: 'Deployment' },
  { id: 'ReplicaSet', label: 'ReplicaSet' },
  { id: 'Service', label: 'Service' },
  { id: 'ConfigMap', label: 'ConfigMap' },
];

const PRESET_TIME_RANGES = [
  { id: '15m', label: '15 phút qua', shortLabel: '15m' },
  { id: '1h', label: '1 giờ qua', shortLabel: '1h' },
  { id: '6h', label: '6 giờ qua', shortLabel: '6h' },
  { id: '24h', label: '24 giờ qua', shortLabel: '24h' },
  { id: '7d', label: '7 ngày qua', shortLabel: '7d' },
  { id: 'all', label: 'Tất cả thời gian', shortLabel: 'Tất cả' },
];

export const formatEventAge = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 0) return 'Vừa xong';
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;

  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const getDisplayNamespace = (ev) => {
  if (!ev) return 'default';
  if (ev.namespace && ev.namespace !== 'default') return ev.namespace;
  if (ev.metadata?.namespace && ev.metadata.namespace !== 'default') return ev.metadata.namespace;
  // Trích xuất namespace từ message nếu có dạng pod 'namespace/pod-name' hoặc Deployment 'namespace/name'
  const match = typeof ev.message === 'string' ? ev.message.match(/(?:pod|Deployment)\s+['"]([^/'"\s]+)\//i) : null;
  if (match && match[1]) return match[1];
  return ev.namespace || ev.metadata?.namespace || 'default';
};

export const EventsPage = () => {
  const { currentOrg, currentEnv, selectedCluster } = useDashboard();
  const clusterId = selectedCluster?.id || selectedCluster?.name || currentEnv?.clusterId || currentEnv?.id || currentEnv?.cluster_id || undefined;

  // Filters state
  const [selectedType, setSelectedType] = useState('all');
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [selectedReason, setSelectedReason] = useState('all');
  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [selectedRange, setSelectedRange] = useState('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });

  // Data & status state
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState(null);

  const handleApplyFilterFromDetail = useCallback((filterUpdate) => {
    if (!filterUpdate) return;
    if (filterUpdate.namespace) setSelectedNamespace(filterUpdate.namespace);
    if (filterUpdate.eventType) setSelectedType(filterUpdate.eventType);
    if (filterUpdate.reason) setSelectedReason(filterUpdate.reason);
    if (filterUpdate.resourceType) setSelectedResourceType(filterUpdate.resourceType);
    setPage(1);
  }, []);

  // Available namespaces for filter (100% nạp từ K8s cluster thực tế, xóa sạch code cứng)
  const [namespacesList, setNamespacesList] = useState([]);

  // Dynamically load namespaces for the cluster từ API thật của cụm
  useEffect(() => {
    if (!clusterId) {
      setNamespacesList([]);
      return;
    }
    let isMounted = true;
    clusterService.getClusterNamespaces(clusterId, currentOrg?.id)
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
          if (names.length > 0) {
            setNamespacesList(Array.from(new Set(names)).sort());
          }
        }
      })
      .catch((err) => {
        console.warn('[EventsPage] Không thể lấy danh sách namespaces từ cụm:', err?.message || err);
      });
    return () => {
      isMounted = false;
    };
  }, [clusterId, currentOrg?.id]);

  // Hợp nhất danh sách namespace thực tế từ cụm và filter đang chọn (nếu có)
  const allNamespaces = useMemo(() => {
    const set = new Set(namespacesList);
    if (selectedNamespace && selectedNamespace !== 'all') {
      set.add(selectedNamespace);
    }
    return Array.from(set).sort();
  }, [namespacesList, selectedNamespace]);

  // Bổ sung các lý do (Reason) thực tế xuất hiện trong sự kiện
  const availableReasons = useMemo(() => {
    const map = new Map();
    PRESET_REASONS.forEach((r) => map.set(r.id, r));
    events.forEach((ev) => {
      if (ev.reason && !map.has(ev.reason)) {
        const reasonVi = translateK8sEventReasonVi(ev.reason);
        map.set(ev.reason, { id: ev.reason, label: reasonVi ? `${ev.reason} (${reasonVi})` : ev.reason });
      }
    });
    return Array.from(map.values());
  }, [events]);

  // Refs for race-condition prevention & abort controller
  const queryTokenRef = useRef(0);
  const abortControllerRef = useRef(null);

  // 1. Debounce search query input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1); // Reset to page 1 on new search keyword
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Fetch events function
  const fetchEvents = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      setErrorMessage(null);

      // Increment query token to discard stale responses
      const currentToken = ++queryTokenRef.current;

      // Abort previous in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const res = await telemetryService.getKubernetesEvents(
          {
            clusterId,
            namespace: selectedNamespace,
            eventType: selectedType,
            reason: selectedReason,
            resourceType: selectedResourceType,
            search: debouncedSearch,
            range: selectedRange,
            page,
            limit: pageSize,
          },
          { signal: abortControllerRef.current.signal }
        );

        // Check race condition: only update state if this is the newest query
        if (currentToken === queryTokenRef.current) {
          const fetchedEvents = Array.isArray(res?.events) ? res.events : [];
          setEvents(fetchedEvents);
          if (res?.pagination) {
            setPagination(res.pagination);
          }
          // Tự động bổ sung namespace từ telemetry events thực tế
          const eventNs = fetchedEvents.map((e) => e.namespace).filter(Boolean);
          if (eventNs.length > 0) {
            setNamespacesList((prev) => Array.from(new Set([...prev, ...eventNs])));
          }
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (currentToken === queryTokenRef.current) {
          setErrorMessage(err.message || 'Không thể tải danh sách sự kiện Kubernetes');
        }
      } finally {
        if (currentToken === queryTokenRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [
      clusterId,
      selectedNamespace,
      selectedType,
      selectedReason,
      selectedResourceType,
      debouncedSearch,
      selectedRange,
      page,
      pageSize,
    ]
  );

  // 3. Trigger fetch when filters or pagination change
  useEffect(() => {
    fetchEvents();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchEvents]);

  // 4. Reset filters
  const handleResetFilters = () => {
    setSelectedType('all');
    setSelectedNamespace('all');
    setSelectedReason('all');
    setSelectedResourceType('all');
    setSelectedRange('24h');
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
  };

  // Toggle row expansion
  const toggleRow = (id) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const isWarningEvent = (type) => String(type).toUpperCase() === 'WARNING';

  const hasActiveFilters =
    selectedType !== 'all' ||
    selectedNamespace !== 'all' ||
    selectedReason !== 'all' ||
    selectedResourceType !== 'all' ||
    selectedRange !== '24h' ||
    searchQuery.trim().length > 0;

  const eventStats = useMemo(() => {
    let warningCount = 0;
    let normalCount = 0;
    let totalRepeatCount = 0;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (String(ev?.event_type || '').toUpperCase() === 'WARNING') {
        warningCount++;
      } else {
        normalCount++;
      }
      totalRepeatCount += Math.max(1, Number(ev?.count) || 1);
    }
    return { warningCount, normalCount, totalRepeatCount };
  }, [events]);

  const activeClusterLabel =
    selectedCluster?.name || selectedCluster?.id || currentEnv?.cluster || currentEnv?.name || 'Toàn hệ thống';

  const kpiCardStyle = (accent, isSelected = false) => ({
    backgroundColor: '#FFFFFF',
    border: isSelected ? `1px solid ${accent}` : '1px solid rgba(226, 232, 240, 0.95)',
    borderTop: `2.5px solid ${accent}`,
    borderRadius: '12px',
    padding: '11px 14px',
    boxShadow: isSelected
      ? `0 6px 18px ${accent}22`
      : '0 4px 16px rgba(15, 23, 42, 0.04)',
    minWidth: 0,
    transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
  });

  const actionBtnStyle = (disabled = false) => ({
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: disabled ? '#94A3B8' : '#334155',
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
    <div className="dashboard-events-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .events-table-row {
          transition: background-color 0.14s ease;
        }
        .events-table-row:hover {
          background-color: #F8FAFC !important;
        }
        .events-table-row--warning:hover {
          background-color: #FEF2F2 !important;
        }
        .events-detail-btn:hover {
          background-color: #ECFDF5 !important;
          border-color: #10B981 !important;
          color: #047857 !important;
        }
      `}</style>

      {/* Page Header (đồng bộ phong cách sạch, gọn của Dashboard & Nhật ký container) */}
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
            <Bell size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Sự Kiện Kubernetes
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Giám sát vòng đời Pod, Node, Deployment &amp; cảnh báo hệ thống từ cụm{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{activeClusterLabel}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => fetchEvents(true)}
            disabled={isRefreshing || isLoading}
            style={actionBtnStyle(isRefreshing || isLoading)}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Hàng KPI Tóm Tắt (đồng bộ 4 thẻ viền màu giống Dashboard & Nhật ký container) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div style={kpiCardStyle('#059669')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỔNG SỰ KIỆN</span>
            <Activity size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {(pagination.total || 0).toLocaleString('vi-VN')}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
              Hiển thị {events.length} mục
            </span>
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedType((prev) => (prev === 'Warning' ? 'all' : 'Warning'));
            setPage(1);
          }}
          title="Nhấp để lọc nhanh sự kiện Cảnh báo (Warning)"
          style={{ ...kpiCardStyle('#EF4444', selectedType === 'Warning'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>CẢNH BÁO (WARNING)</span>
            <AlertTriangle size={14} color="#EF4444" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: eventStats.warningCount > 0 ? '#DC2626' : '#0F172A',
              }}
            >
              {eventStats.warningCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>trong trang hiện tại</span>
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedType((prev) => (prev === 'Normal' ? 'all' : 'Normal'));
            setPage(1);
          }}
          title="Nhấp để lọc nhanh sự kiện Thông thường (Normal)"
          style={{ ...kpiCardStyle('#10B981', selectedType === 'Normal'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>THÔNG THƯỜNG (NORMAL)</span>
            <CheckCircle2 size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {eventStats.normalCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>trong trang hiện tại</span>
          </div>
        </div>

        <div style={kpiCardStyle('#3B82F6')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỔNG LƯỢT LẶP</span>
            <Repeat size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {eventStats.totalRepeatCount.toLocaleString('vi-VN')}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
              Trang {pagination.page}/{pagination.totalPages}
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          data-testid="events-error-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '12px',
            color: '#991B1B',
            fontSize: '0.825rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={17} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchEvents()}
            style={{
              padding: '5px 12px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar (Gọn 2 hàng đồng bộ với Nhật ký container) */}
      <div
        className="dash-card"
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
        {/* Hàng 1: Tìm kiếm + Loại sự kiện + Khung thời gian */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          {/* Search Query Input */}
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
            <input
              type="text"
              data-testid="events-search-input"
              placeholder="Tìm kiếm thông điệp, đối tượng, lý do..."
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
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '9px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Event Type Filter Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#F8FAFC',
              padding: '3px',
              border: '1px solid #E2E8F0',
              borderRadius: '9px',
            }}
          >
            {[
              { id: 'all', label: 'Tất cả', color: '#059669', bg: '#ECFDF5' },
              { id: 'Warning', label: 'Cảnh báo', color: '#DC2626', bg: '#FEF2F2' },
              { id: 'Normal', label: 'Thông thường', color: '#047857', bg: '#ECFDF5' },
            ].map((t) => {
              const active = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`type-filter-${t.id}`}
                  onClick={() => {
                    setSelectedType(t.id);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 11px',
                    borderRadius: '6px',
                    border: active ? `1px solid ${t.color}55` : '1px solid transparent',
                    backgroundColor: active ? t.bg : 'transparent',
                    color: active ? t.color : '#64748B',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Quick Time Range Pills (+ hidden select to preserve time-range-select testid compatibility) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: '#F8FAFC',
              padding: '3px',
              border: '1px solid #E2E8F0',
              borderRadius: '9px',
            }}
          >
            {PRESET_TIME_RANGES.map((rng) => {
              const active = selectedRange === rng.id;
              return (
                <button
                  key={rng.id}
                  type="button"
                  onClick={() => {
                    setSelectedRange(rng.id);
                    setPage(1);
                  }}
                  title={rng.label}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: active ? '1px solid #10B981' : '1px solid transparent',
                    backgroundColor: active ? '#ECFDF5' : 'transparent',
                    color: active ? '#047857' : '#64748B',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {rng.shortLabel}
                </button>
              );
            })}
            <select
              data-testid="time-range-select"
              value={selectedRange}
              onChange={(e) => {
                setSelectedRange(e.target.value);
                setPage(1);
              }}
              aria-label="Khung thời gian sự kiện"
              style={{ display: 'none' }}
            >
              {PRESET_TIME_RANGES.map((rng) => (
                <option key={rng.id} value={rng.id}>
                  {rng.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hàng 2: Namespace, Lý do, Tài nguyên, Đặt lại & Tổng số */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #F1F5F9',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            {/* Namespace Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>Namespace</span>
              <select
                data-testid="namespace-select"
                value={selectedNamespace}
                onChange={(e) => {
                  setSelectedNamespace(e.target.value);
                  setPage(1);
                }}
                style={selectControlStyle}
              >
                <option value="all">Tất cả Namespaces</option>
                {allNamespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            </div>

            {/* Reason Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>Lý do</span>
              <select
                data-testid="reason-select"
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value);
                  setPage(1);
                }}
                style={{ ...selectControlStyle, maxWidth: '230px' }}
              >
                {availableReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Resource Type Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>Tài nguyên</span>
              <select
                data-testid="resource-type-select"
                value={selectedResourceType}
                onChange={(e) => {
                  setSelectedResourceType(e.target.value);
                  setPage(1);
                }}
                style={selectControlStyle}
              >
                {PRESET_RESOURCE_TYPES.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters Button */}
            <button
              type="button"
              data-testid="reset-filters-btn"
              onClick={handleResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '32px',
                padding: '0 10px',
                fontSize: '0.73rem',
                fontWeight: 700,
                color: hasActiveFilters ? '#DC2626' : '#64748B',
                backgroundColor: hasActiveFilters ? '#FEF2F2' : '#FFFFFF',
                border: hasActiveFilters ? '1px solid #FECACA' : '1px solid #E2E8F0',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.14s ease',
              }}
            >
              <RotateCcw size={12} />
              <span>Đặt lại</span>
            </button>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: '#64748B' }}>
            Tổng <strong style={{ color: '#0F172A' }}>{(pagination.total || 0).toLocaleString('vi-VN')}</strong> sự kiện &bull; Trang{' '}
            <strong style={{ color: '#0F172A' }}>{pagination.page}</strong>/{pagination.totalPages}
          </div>
        </div>
      </div>

      {/* Events Table Container */}
      <div
        className="dash-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', width: '125px' }}>
                  LOẠI
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', width: '175px' }}>
                  LÝ DO
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', width: '235px' }}>
                  ĐỐI TƯỢNG (OBJECT)
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                  THÔNG ĐIỆP CHI TIẾT
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', width: '130px' }}>
                  THỜI ĐIỂM
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', width: '98px', textAlign: 'center' }}>
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '56px 20px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={22} className="animate-spin" color="#059669" />
                      <span style={{ fontSize: '0.825rem', fontWeight: 500 }}>Đang truy vấn sự kiện Kubernetes từ hệ thống...</span>
                    </div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '14px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Inbox size={24} color="#94A3B8" />
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginTop: '4px' }}>
                        Không tìm thấy sự kiện nào phù hợp với bộ lọc hiện tại
                      </span>
                      <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                        Thử điều chỉnh từ khóa tìm kiếm hoặc mở rộng khung thời gian truy vấn.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        style={{
                          marginTop: '8px',
                          padding: '7px 14px',
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          border: '1px solid #A7F3D0',
                          borderRadius: '9px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Đặt lại toàn bộ bộ lọc
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const isWarning = isWarningEvent(ev.event_type);
                  const isExpanded = expandedRowId === ev.id;
                  const messageText = translateK8sEventMessageVi(ev.message || '');
                  const reasonVi = translateK8sEventReasonVi(ev.reason);
                  const isLongMessage = messageText.length > 120;

                  return (
                    <React.Fragment key={ev.id}>
                      <tr
                        data-testid={`event-row-${ev.id}`}
                        className={`events-table-row${isWarning ? ' events-table-row--warning' : ''}`}
                        onClick={() => setSelectedEventDetail({ ...ev, namespace: getDisplayNamespace(ev) })}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isExpanded
                            ? 'rgba(16, 185, 129, 0.04)'
                            : isWarning
                            ? 'rgba(254, 242, 242, 0.35)'
                            : '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        {/* Event Type Badge */}
                        <td
                          style={{
                            padding: '12px 16px',
                            borderLeft: isWarning ? '3px solid #EF4444' : '3px solid transparent',
                          }}
                        >
                          <span data-testid="event-type-badge">
                            <K8sEventSeverityBadge type={ev.event_type} />
                          </span>
                        </td>

                        {/* Reason */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.78rem', color: '#0F172A' }}>
                            {ev.reason}
                          </div>
                          {reasonVi && (
                            <div style={{ fontSize: '0.71rem', fontWeight: 600, color: '#059669', marginTop: '1px' }}>
                              {reasonVi}
                            </div>
                          )}
                          {ev.source_component && (
                            <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '2px' }}>
                              bởi {ev.source_component}
                            </div>
                          )}
                        </td>

                        {/* Object & Namespace */}
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          <div style={{ color: '#047857', fontWeight: 700, wordBreak: 'break-word' }}>
                            {ev.resource_type ? `${ev.resource_type}/` : ''}
                            {ev.resource_name || ev.resource_uid}
                          </div>
                          <div style={{ marginTop: '3px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: '5px',
                                backgroundColor: '#F1F5F9',
                                border: '1px solid #E2E8F0',
                                fontSize: '0.66rem',
                                fontWeight: 600,
                                color: '#475569',
                              }}
                            >
                              ns: {getDisplayNamespace(ev)}
                            </span>
                          </div>
                        </td>

                        {/* Message with Expand Toggle */}
                        <td style={{ padding: '12px 16px', color: isWarning ? '#991B1B' : '#334155', lineHeight: 1.5, fontSize: '0.8rem' }}>
                          <div>
                            {isExpanded || !isLongMessage ? (
                              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{messageText}</span>
                            ) : (
                              <span>{messageText.slice(0, 120)}...</span>
                            )}
                            {isLongMessage && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRow(ev.id);
                                }}
                                style={{
                                  marginLeft: '6px',
                                  border: 'none',
                                  background: 'none',
                                  color: '#059669',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                              </button>
                            )}
                          </div>
                          {ev.count > 1 && (
                            <span
                              data-testid="event-count-badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginTop: '5px',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontSize: '0.68rem',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                backgroundColor: isWarning ? '#FEF2F2' : '#EFF6FF',
                                color: isWarning ? '#DC2626' : '#2563EB',
                                border: isWarning ? '1px solid #FECACA' : '1px solid #BFDBFE',
                              }}
                            >
                              <Repeat size={10} />
                              Lặp lại {ev.count} lần
                            </span>
                          )}
                        </td>

                        {/* Time */}
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: '#475569', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#0F172A' }} title={new Date(ev.last_seen_at).toLocaleString('vi-VN')}>
                            {formatEventAge(ev.last_seen_at)}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '2px' }}>
                            {new Date(ev.last_seen_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="events-detail-btn"
                            data-testid={`event-detail-btn-${ev.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventDetail({ ...ev, namespace: getDisplayNamespace(ev) });
                            }}
                            style={{
                              height: '28px',
                              padding: '0 10px',
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.14s ease',
                            }}
                          >
                            <Eye size={12} />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Event Detail Modal [S4][PB18] 4.3 */}
        {selectedEventDetail && (
          <EventDetailModal
            event={selectedEventDetail}
            clusterContext={{
              clusterName: selectedCluster?.name,
              environmentName: currentEnv?.name,
            }}
            onClose={() => setSelectedEventDetail(null)}
            onApplyFilter={handleApplyFilterFromDetail}
          />
        )}

        {/* Pagination Toolbar */}
        {!isLoading && events.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '11px 16px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: '#475569',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Hiển thị mỗi trang:</span>
              <select
                data-testid="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  height: '28px',
                  padding: '0 8px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  borderRadius: '7px',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>
                Trang <strong style={{ color: '#0F172A' }}>{pagination.page}</strong> / {pagination.totalPages}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  data-testid="prev-page-btn"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    height: '28px',
                    padding: '0 10px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '7px',
                    backgroundColor: '#FFFFFF',
                    color: pagination.page <= 1 ? '#94A3B8' : '#0F172A',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: pagination.page <= 1 ? 0.55 : 1,
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Trước</span>
                </button>
                <button
                  type="button"
                  data-testid="next-page-btn"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    height: '28px',
                    padding: '0 10px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '7px',
                    backgroundColor: '#FFFFFF',
                    color: pagination.page >= pagination.totalPages ? '#94A3B8' : '#0F172A',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    opacity: pagination.page >= pagination.totalPages ? 0.55 : 1,
                  }}
                >
                  <span>Sau</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsPage;
