import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  RotateCcw,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Inbox,
  X,
  Server,
  Eye,
} from 'lucide-react';
import { telemetryService } from '../../../services/telemetryService';
import { K8sEventSeverityBadge } from '../../../components/dashboard/K8sEventSeverityBadge';
import { EventDetailModal } from '../../../components/dashboard/EventDetailModal';

const PRESET_REASONS = [
  { id: 'all', label: 'Tất cả Lý do' },
  { id: 'OOMKilled', label: 'OOMKilled (Hết bộ nhớ RAM)' },
  { id: 'CrashLoopBackOff', label: 'CrashLoopBackOff (Vòng lặp lỗi khởi động)' },
  { id: 'BackOff', label: 'BackOff (Chờ khởi động lại)' },
  { id: 'FailedScheduling', label: 'FailedScheduling (Không thể lập lịch Pod)' },
  { id: 'Unhealthy', label: 'Unhealthy (Thất bại Probe kiểm tra)' },
  { id: 'Killing', label: 'Killing (Đang chấm dứt Container)' },
  { id: 'NodeReady', label: 'NodeReady (Node sẵn sàng)' },
  { id: 'ScalingReplicaSet', label: 'ScalingReplicaSet (Co giãn bản sao)' },
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
  { id: '15m', label: '15 phút qua' },
  { id: '1h', label: '1 giờ qua' },
  { id: '6h', label: '6 giờ qua' },
  { id: '24h', label: '24 giờ qua' },
  { id: '7d', label: '7 ngày qua' },
  { id: 'all', label: 'Tất cả thời gian' },
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

export const EventsPage = () => {
  const { currentOrg, currentEnv, selectedCluster } = useDashboard();

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

  // Available namespaces for filter
  const [namespacesList, setNamespacesList] = useState(['default', 'kube-system', 'production', 'staging']);

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

  const clusterId = selectedCluster?.id || selectedCluster?.name || currentEnv?.clusterId || currentEnv?.id || currentEnv?.cluster_id || undefined;

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

  return (
    <div className="dashboard-events-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Dòng Sự Kiện Cụm Máy Chủ (Kubernetes Events)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Giám sát toàn diện vòng đời Pod, Node, Deployment và các cảnh báo hệ thống
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => fetchEvents(true)}
            disabled={isRefreshing || isLoading}
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
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
              opacity: isRefreshing || isLoading ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới sự kiện'}</span>
          </button>
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
            borderRadius: 'var(--dash-radius-md)',
            color: '#991B1B',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchEvents()}
            style={{
              padding: '4px 12px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--dash-radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Top Filter Row: Type Buttons & Search */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            {/* Event Type Filter Buttons */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(61, 59, 79, 0.05)',
                padding: '2px',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
              }}
            >
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'Warning', label: 'Cảnh báo (Warning)' },
                { id: 'Normal', label: 'Thông thường (Normal)' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`type-filter-${t.id}`}
                  onClick={() => {
                    setSelectedType(t.id);
                    setPage(1);
                  }}
                  style={{
                    padding: '5px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: selectedType === t.id ? '#FFFFFF' : 'transparent',
                    color: selectedType === t.id ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-xs)',
                    boxShadow: selectedType === t.id ? 'var(--dash-shadow-xs)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search Query Input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                data-testid="events-search-input"
                placeholder="Tìm kiếm thông điệp, đối tượng, lý do..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: '34px',
                  width: '260px',
                  padding: '0 28px 0 28px',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-sm)',
                  outline: 'none',
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '10px', color: 'var(--dash-text-muted)' }} />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '8px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--dash-text-muted)',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
            Tổng số: <strong>{pagination.total}</strong> sự kiện &bull; Trang {pagination.page} / {pagination.totalPages}
          </div>
        </div>

        {/* Second Filter Row: Dropdowns (Namespace, Reason, ResourceType, Range, Reset) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Namespace Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Namespace:</span>
            <select
              data-testid="namespace-select"
              value={selectedNamespace}
              onChange={(e) => {
                setSelectedNamespace(e.target.value);
                setPage(1);
              }}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                outline: 'none',
              }}
            >
              <option value="all">Tất cả Namespaces</option>
              {namespacesList.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Lý do:</span>
            <select
              data-testid="reason-select"
              value={selectedReason}
              onChange={(e) => {
                setSelectedReason(e.target.value);
                setPage(1);
              }}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                outline: 'none',
              }}
            >
              {PRESET_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Type Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tài nguyên:</span>
            <select
              data-testid="resource-type-select"
              value={selectedResourceType}
              onChange={(e) => {
                setSelectedResourceType(e.target.value);
                setPage(1);
              }}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                outline: 'none',
              }}
            >
              {PRESET_RESOURCE_TYPES.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} color="var(--dash-text-muted)" />
            <select
              data-testid="time-range-select"
              value={selectedRange}
              onChange={(e) => {
                setSelectedRange(e.target.value);
                setPage(1);
              }}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
                outline: 'none',
              }}
            >
              {PRESET_TIME_RANGES.map((rng) => (
                <option key={rng.id} value={rng.id}>
                  {rng.label}
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
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '32px',
              padding: '0 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--dash-text-secondary)',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-sm)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} />
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      {/* Events Table Container */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '120px' }}>LOẠI</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '160px' }}>LÝ DO</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '220px' }}>ĐỐI TƯỢNG (OBJECT)</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>THÔNG ĐIỆP CHI TIẾT</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '130px' }}>THỜI ĐIỂM</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '90px', textAlign: 'center' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: 'var(--dash-text-secondary)' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={24} className="animate-spin" color="var(--dash-primary)" />
                    <span>Đang truy vấn sự kiện Kubernetes từ hệ thống...</span>
                  </div>
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Inbox size={32} color="var(--dash-text-muted)" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
                      Không tìm thấy sự kiện nào phù hợp với bộ lọc hiện tại
                    </span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: 0 }}>
                      Thử điều chỉnh từ khóa tìm kiếm hoặc chọn khoảng thời gian rộng hơn.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      style={{
                        marginTop: '8px',
                        padding: '6px 14px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--dash-border)',
                        borderRadius: 'var(--dash-radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
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
                const messageText = ev.message || '';
                const isLongMessage = messageText.length > 120;

                return (
                  <React.Fragment key={ev.id}>
                    <tr
                      data-testid={`event-row-${ev.id}`}
                      onClick={() => setSelectedEventDetail(ev)}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Event Type Badge */}
                      <td style={{ padding: '12px 16px' }}>
                        <span data-testid="event-type-badge">
                          <K8sEventSeverityBadge type={ev.event_type} />
                        </span>
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                          {ev.reason}
                        </div>
                        {ev.source_component && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                            by {ev.source_component}
                          </div>
                        )}
                      </td>

                      {/* Object & Namespace */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        <div style={{ color: 'var(--dash-primary)', fontWeight: 600 }}>
                          {ev.resource_type ? `${ev.resource_type}/` : ''}
                          {ev.resource_name || ev.resource_uid}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                          ns: <span style={{ color: 'var(--dash-text-secondary)' }}>{ev.namespace || 'default'}</span>
                        </div>
                      </td>

                      {/* Message with Expand Toggle */}
                      <td style={{ padding: '12px 16px', color: isWarning ? '#991B1B' : 'var(--dash-text-primary)', lineHeight: 1.45 }}>
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
                                color: 'var(--dash-primary)',
                                fontSize: '0.6875rem',
                                fontWeight: 600,
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
                              display: 'inline-block',
                              marginTop: '4px',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              fontSize: '0.6875rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              color: '#4F46E5',
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                            }}
                          >
                            Lặp lại {ev.count} lần
                          </span>
                        )}
                      </td>

                      {/* Time */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)', whiteSpace: 'nowrap' }}>
                        <div title={new Date(ev.last_seen_at).toLocaleString('vi-VN')}>
                          {formatEventAge(ev.last_seen_at)}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                          {new Date(ev.last_seen_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          data-testid={`event-detail-btn-${ev.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventDetail(ev);
                          }}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--dash-border, #E2E8F0)',
                            borderRadius: 'var(--dash-radius-xs, 4px)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--dash-primary, #4F46E5)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
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
              padding: '12px 18px',
              backgroundColor: 'var(--dash-bg-canvas)',
              borderTop: '1px solid var(--dash-border)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
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
                  padding: '2px 6px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-xs)',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
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
                Trang {pagination.page} trên tổng {pagination.totalPages}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  data-testid="prev-page-btn"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 'var(--dash-radius-xs)',
                    backgroundColor: '#FFFFFF',
                    color: pagination.page <= 1 ? 'var(--dash-text-muted)' : 'var(--dash-text-primary)',
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: pagination.page <= 1 ? 0.5 : 1,
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
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 'var(--dash-radius-xs)',
                    backgroundColor: '#FFFFFF',
                    color: pagination.page >= pagination.totalPages ? 'var(--dash-text-muted)' : 'var(--dash-text-primary)',
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
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
