import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Activity,
  Check,
  X,
  History,
  ArrowRight,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../../context/AuthContext';
import { useDebounce } from '../../../hooks/useDebounce';
import { alertService, formatAlertApiError } from '../../../services/alertService';
import { getAuthToken, API_BASE_URL } from '../../../services/apiClient';
import AlertDetailDrawer, {
  getSeverityStyle,
  getStatusStyle,
  formatDateTime,
} from './AlertDetailDrawer';

export const TIME_RANGE_PRESETS = [
  { key: 'ALL', label: 'Tất cả thời gian', ms: null },
  { key: '15m', label: '15 phút qua', ms: 15 * 60 * 1000 },
  { key: '1h', label: '1 giờ qua', ms: 60 * 60 * 1000 },
  { key: '6h', label: '6 giờ qua', ms: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24 giờ qua', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 ngày qua', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30 ngày qua', ms: 30 * 24 * 60 * 60 * 1000 },
];

export const AlertHistoryPage = ({ onNavigate }) => {
  const dashboard = useDashboard();
  const auth = useAuth();

  const currentOrg = dashboard?.currentOrg || null;
  const envList = dashboard?.envList || [];
  const currentUserRole = dashboard?.currentUserRole || null;

  const user = auth?.user || null;
  const effectiveRole = useMemo(() => {
    const r =
      currentUserRole ||
      currentOrg?.role_in_org ||
      currentOrg?.role ||
      localStorage.getItem('selfheal_active_org_role') ||
      (auth?.isViewer && auth.isViewer(user)
        ? 'VIEWER'
        : auth?.isDevOps && auth.isDevOps(user)
        ? 'DEVOPS'
        : 'SME_OWNER');
    return String(r).toUpperCase();
  }, [currentUserRole, currentOrg, auth, user]);

  const canManageAlerts = useMemo(() => {
    return ['DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(effectiveRole);
  }, [effectiveRole]);

  // History State
  const [historyAlerts, setHistoryAlerts] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [historySummary, setHistorySummary] = useState({
    total_alerts: 0,
    critical_alerts: 0,
    warning_alerts: 0,
    info_alerts: 0,
    active_alerts: 0,
    resolved_alerts: 0,
  });

  // History Filters & Sorting
  const [historySearch, setHistorySearch] = useState('');
  const debouncedHistorySearch = useDebounce(historySearch, 300);
  const [historySeverity, setHistorySeverity] = useState('ALL');
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyCluster, setHistoryCluster] = useState('ALL');
  const [historyResourceType, setHistoryResourceType] = useState('ALL');
  const [historyTimePreset, setHistoryTimePreset] = useState('ALL');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyDateValidationError, setHistoryDateValidationError] = useState(null);
  const [historySortBy, setHistorySortBy] = useState('first_detected_at');
  const [historySortOrder, setHistorySortOrder] = useState('desc');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const historyReqSeqRef = useRef(0);

  // Realtime & Auto Refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastBanner, setToastBanner] = useState(null);

  // History Row Actions & Mark-as-Resolved Confirmation Modal
  const [historyActionLoadingId, setHistoryActionLoadingId] = useState(null);
  const [resolveModalTarget, setResolveModalTarget] = useState(null);
  const [resolveModalNote, setResolveModalNote] = useState('');
  const [resolveNoteError, setResolveNoteError] = useState(null);
  const [resolveModalApiError, setResolveModalApiError] = useState(null);
  const [isSubmittingModalResolve, setIsSubmittingModalResolve] = useState(false);

  // Side Drawer: Alert Detail
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const showToast = useCallback((type, text) => {
    setToastBanner({ type, text });
    setTimeout(() => {
      setToastBanner((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  // Fetch Alert History & Summary [S5][PBI22 Task 4.2 & 4.4]
  const fetchAlertHistoryAndSummary = useCallback(async () => {
    if (historyTimePreset === 'CUSTOM' && historyStartDate && historyEndDate) {
      const startMs = new Date(historyStartDate).getTime();
      const endMs = new Date(historyEndDate).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs > endMs) {
        setHistoryDateValidationError('Khoảng thời gian không hợp lệ: Ngày bắt đầu không được lớn hơn ngày kết thúc.');
        setIsLoadingHistory(false);
        return;
      }
    }
    setHistoryDateValidationError(null);

    const reqId = ++historyReqSeqRef.current;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      let startIso = undefined;
      let endIso = undefined;

      if (historyTimePreset !== 'ALL' && historyTimePreset !== 'CUSTOM') {
        const preset = TIME_RANGE_PRESETS.find((p) => p.key === historyTimePreset);
        if (preset?.ms) {
          startIso = new Date(Date.now() - preset.ms).toISOString();
        }
      } else if (historyTimePreset === 'CUSTOM') {
        if (historyStartDate) startIso = new Date(historyStartDate).toISOString();
        if (historyEndDate) endIso = new Date(historyEndDate).toISOString();
      }

      const queryParams = {
        page: historyPage,
        limit: historyPageSize,
        search: debouncedHistorySearch || undefined,
        severity: historySeverity !== 'ALL' ? historySeverity : undefined,
        status: historyStatus !== 'ALL' ? historyStatus : undefined,
        clusterId: historyCluster !== 'ALL' ? historyCluster : undefined,
        resourceType: historyResourceType !== 'ALL' ? historyResourceType : undefined,
        startDate: startIso,
        endDate: endIso,
        sortBy: historySortBy,
        sortOrder: historySortOrder,
      };

      const summaryParams = {
        clusterId: historyCluster !== 'ALL' ? historyCluster : undefined,
        startDate: startIso,
        endDate: endIso,
      };

      const [summaryRes, historyRes] = await Promise.all([
        alertService.getAlertHistorySummary(summaryParams).catch(() => null),
        alertService.getAlertHistory(queryParams),
      ]);

      if (reqId !== historyReqSeqRef.current) return;

      if (summaryRes) {
        setHistorySummary({
          total_alerts: Number(summaryRes.total_alerts || 0),
          critical_alerts: Number(summaryRes.critical_alerts || 0),
          warning_alerts: Number(summaryRes.warning_alerts || 0),
          info_alerts: Number(summaryRes.info_alerts || 0),
          active_alerts: Number(summaryRes.active_alerts || 0),
          resolved_alerts: Number(summaryRes.resolved_alerts || 0),
        });
      }

      if (historyRes) {
        setHistoryAlerts(historyRes.items || []);
        if (historyRes.pagination) {
          const totalPages = Number(
            historyRes.pagination.total_pages ?? historyRes.pagination.totalPages ?? 1
          );
          setHistoryPagination({
            page: Number(historyRes.pagination.page || 1),
            limit: Number(historyRes.pagination.limit || 10),
            total: Number(historyRes.pagination.total || 0),
            total_pages: totalPages,
          });
        }
      }
    } catch (err) {
      if (reqId !== historyReqSeqRef.current) return;
      if (!err?.isAborted) {
        setHistoryError(formatAlertApiError(err, 'Không thể tải lịch sử cảnh báo'));
      }
    } finally {
      if (reqId === historyReqSeqRef.current) {
        setIsLoadingHistory(false);
      }
    }
  }, [
    historyPage,
    historyPageSize,
    debouncedHistorySearch,
    historySeverity,
    historyStatus,
    historyCluster,
    historyResourceType,
    historyTimePreset,
    historyStartDate,
    historyEndDate,
    historySortBy,
    historySortOrder,
  ]);

  // Initial & Filter-driven fetch
  useEffect(() => {
    fetchAlertHistoryAndSummary();
  }, [fetchAlertHistoryAndSummary, currentOrg?.id]);

  // Polling Loop + Window Focus Refresh
  useEffect(() => {
    if (!autoRefresh) return undefined;

    const intervalId = setInterval(() => {
      fetchAlertHistoryAndSummary();
    }, 15000);

    const handleWindowFocus = () => {
      fetchAlertHistoryAndSummary();
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [autoRefresh, fetchAlertHistoryAndSummary]);

  // WebSocket Realtime Subscription
  const fetchRef = useRef(fetchAlertHistoryAndSummary);
  useEffect(() => {
    fetchRef.current = fetchAlertHistoryAndSummary;
  }, [fetchAlertHistoryAndSummary]);

  useEffect(() => {
    if (typeof WebSocket === 'undefined' || process.env.NODE_ENV === 'test') {
      return undefined;
    }

    let ws = null;
    try {
      const token = getAuthToken();
      const wsBase = API_BASE_URL.replace(/^http/i, 'ws');
      const wsUrl = `${wsBase}/telemetry/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'alert_updated') {
            if (!currentOrg?.id || !payload.organization_id || payload.organization_id === currentOrg.id) {
              fetchRef.current?.();
            }
          }
        } catch {
          // Ignore malformed WS messages
        }
      };
    } catch {
      // Fallback to polling
    }

    return () => {
      if (ws && ws.readyState <= 1) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [currentOrg?.id]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchAlertHistoryAndSummary().finally(() => setIsRefreshing(false));
  };

  const handleHistoryQuickAcknowledge = async (item) => {
    if (!canManageAlerts || !item || item.status !== 'ACTIVE' || historyActionLoadingId) return;
    setHistoryActionLoadingId(item.id);
    try {
      await alertService.acknowledgeAlert(
        item.id,
        'Đã tiếp nhận xử lý từ bảng Lịch sử Cảnh báo',
        item.version
      );
      showToast('success', `Đã tiếp nhận cảnh báo "${item.rule_name || item.title}".`);
      fetchAlertHistoryAndSummary();
    } catch (err) {
      showToast('error', formatAlertApiError(err, 'Lỗi khi tiếp nhận cảnh báo'));
    } finally {
      setHistoryActionLoadingId(null);
    }
  };

  const openResolveConfirmModal = (item) => {
    if (!canManageAlerts || !item || item.status === 'RESOLVED') return;
    setResolveModalTarget(item);
    setResolveModalNote('');
    setResolveNoteError(null);
    setResolveModalApiError(null);
  };

  const handleConfirmResolveSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canManageAlerts || !resolveModalTarget || isSubmittingModalResolve) return;

    if (resolveModalNote && resolveModalNote.length > 2000) {
      setResolveNoteError('Ghi chú giải quyết không được vượt quá 2000 ký tự.');
      return;
    }
    setResolveNoteError(null);
    setResolveModalApiError(null);
    setIsSubmittingModalResolve(true);

    try {
      const noteText =
        resolveModalNote && resolveModalNote.trim()
          ? resolveModalNote.trim()
          : 'Đã đánh dấu xử lý từ bảng Lịch sử Cảnh báo';
      const updated = await alertService.resolveAlert(
        resolveModalTarget.id,
        noteText,
        resolveModalTarget.version
      );
      setResolveModalTarget(null);
      setResolveModalNote('');
      if (selectedAlert?.id === resolveModalTarget.id) {
        setSelectedAlert((prev) => ({ ...prev, ...updated, status: 'RESOLVED' }));
      }
      showToast('success', `Đã đánh dấu xử lý cảnh báo "${resolveModalTarget.rule_name || resolveModalTarget.title}".`);
      fetchAlertHistoryAndSummary();
    } catch (err) {
      setResolveModalApiError(formatAlertApiError(err, 'Không thể cập nhật trạng thái Đã xử lý'));
    } finally {
      setIsSubmittingModalResolve(false);
    }
  };

  const openAlertDetail = (alertItem) => {
    setSelectedAlert(alertItem);
    setIsDetailOpen(true);
  };

  return (
    <div
      data-testid="alert-history-page"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}
    >
      {/* Top Header Dedicated for Alert History */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={26} color="var(--dash-primary, #059669)" />
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Lịch Sử Cảnh Báo & Nhật Ký Kiểm Toán (Alert History)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Tra cứu, lọc đa chiều, theo dõi thời lượng, phân công người phụ trách và kiểm toán xử lý toàn bộ sự kiện cảnh báo
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="btn-toggle-autorefresh"
            onClick={() => setAutoRefresh((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: autoRefresh ? '1px solid #10B981' : '1px solid var(--dash-border)',
              backgroundColor: autoRefresh ? '#ECFDF5' : '#FFFFFF',
              color: autoRefresh ? '#065F46' : 'var(--dash-text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Activity size={14} />
            <span>{autoRefresh ? 'Auto 15s: BẬT' : 'Auto 15s: TẮT'}</span>
          </button>

          <button
            type="button"
            data-testid="btn-refresh-alerts"
            onClick={handleManualRefresh}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoadingHistory ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>

          {onNavigate && (
            <button
              type="button"
              data-testid="btn-goto-rules"
              onClick={() => onNavigate('/dashboard/alerts')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>Cấu Hình Ngưỡng & Cảnh Báo Đang Mở</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastBanner && (
        <div
          data-testid="alerts-toast-banner"
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: toastBanner.type === 'error' ? '#FEF2F2' : '#ECFDF5',
            border: toastBanner.type === 'error' ? '1px solid #FECACA' : '1px solid #A7F3D0',
            color: toastBanner.type === 'error' ? '#DC2626' : '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toastBanner.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toastBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 800 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Dedicated Alert History Section */}
      <div data-testid="alert-history-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* History KPI Summary Cards (All 6 Metrics) */}
        <div
          data-testid="history-kpi-cards"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
            gap: '14px',
          }}
        >
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB',
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>Tổng Lịch Sử</div>
              <div data-testid="kpi-history-total" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                {historySummary.total_alerts}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #FECACA',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#DC2626',
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#DC2626' }}>Khẩn cấp (Critical)</div>
              <div data-testid="kpi-history-critical" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626' }}>
                {historySummary.critical_alerts}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#FFFBEB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D97706',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D97706' }}>Cảnh báo (Warning)</div>
              <div data-testid="kpi-history-warning" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706' }}>
                {historySummary.warning_alerts}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1D4ED8',
              }}
            >
              <Info size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1D4ED8' }}>Thông tin (Info)</div>
              <div data-testid="kpi-history-info" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1D4ED8' }}>
                {historySummary.info_alerts}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #FED7AA',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#FFF7ED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EA580C',
              }}
            >
              <AlertCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#EA580C' }}>Chưa giải quyết</div>
              <div data-testid="kpi-history-active" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#EA580C' }}>
                {historySummary.active_alerts}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>Đã giải quyết (Resolved)</div>
              <div data-testid="kpi-history-resolved" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
                {historySummary.resolved_alerts}
              </div>
            </div>
          </div>
        </div>

        {/* History Advanced Filter & Sort Bar */}
        <div
          data-testid="history-filter-bar"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            {/* Search */}
            <div
              style={{
                flex: '1 1 240px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
              }}
            >
              <Search size={16} color="var(--dash-text-muted)" />
              <input
                type="text"
                data-testid="history-search-input"
                placeholder="Tìm kiếm quy tắc, tài nguyên, namespace, message..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  width: '100%',
                  color: 'var(--dash-text-primary)',
                }}
              />
            </div>

            {/* Severity */}
            <select
              data-testid="history-filter-severity"
              value={historySeverity}
              onChange={(e) => {
                setHistorySeverity(e.target.value);
                setHistoryPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="ALL">Tất cả Mức độ</option>
              <option value="CRITICAL">CRITICAL (Khẩn cấp)</option>
              <option value="WARNING">WARNING (Cảnh báo)</option>
              <option value="INFO">INFO (Thông tin)</option>
            </select>

            {/* Status */}
            <select
              data-testid="history-filter-status"
              value={historyStatus}
              onChange={(e) => {
                setHistoryStatus(e.target.value);
                setHistoryPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="ALL">Tất cả Trạng thái</option>
              <option value="ACTIVE">ACTIVE (Đang diễn ra)</option>
              <option value="ACKNOWLEDGED">ACKNOWLEDGED (Đã tiếp nhận)</option>
              <option value="RESOLVED">RESOLVED (Đã giải quyết)</option>
            </select>

            {/* Cluster */}
            <select
              data-testid="history-filter-cluster"
              value={historyCluster}
              onChange={(e) => {
                setHistoryCluster(e.target.value);
                setHistoryPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="ALL">Tất cả Cụm K8s</option>
              {(envList || []).map((env) => {
                const cid = env.cluster_id || env.id;
                const cname = env.cluster || env.name || cid;
                return (
                  <option key={cid} value={cid}>
                    {cname}
                  </option>
                );
              })}
            </select>

            {/* Resource Type */}
            <select
              data-testid="history-filter-resource-type"
              value={historyResourceType}
              onChange={(e) => {
                setHistoryResourceType(e.target.value);
                setHistoryPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="ALL">Tất cả Loại tài nguyên</option>
              <option value="node">Node (Máy chủ)</option>
              <option value="pod">Pod (Kubernetes)</option>
              <option value="service">Service (Dịch vụ APM)</option>
            </select>

            {/* Time Range Preset */}
            <select
              data-testid="history-filter-time"
              value={historyTimePreset}
              onChange={(e) => {
                setHistoryTimePreset(e.target.value);
                setHistoryDateValidationError(null);
                setHistoryPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
              }}
            >
              {TIME_RANGE_PRESETS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
              <option value="CUSTOM">Tùy chỉnh khoảng thời gian...</option>
            </select>

            {/* Sort By */}
            <select
              data-testid="history-sort-by"
              value={historySortBy}
              onChange={(e) => {
                setHistorySortBy(e.target.value);
                setHistoryPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="first_detected_at">Sắp xếp: Phát hiện lần đầu</option>
              <option value="last_seen_at">Sắp xếp: Ghi nhận gần nhất</option>
              <option value="resolved_at">Sắp xếp: Thời gian xử lý</option>
              <option value="severity">Sắp xếp: Mức độ nghiêm trọng</option>
              <option value="status">Sắp xếp: Trạng thái</option>
            </select>

            {/* Sort Order */}
            <select
              data-testid="history-sort-order"
              value={historySortOrder}
              onChange={(e) => {
                setHistorySortOrder(e.target.value);
                setHistoryPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
              }}
            >
              <option value="desc">Mới nhất / Cao nhất (DESC)</option>
              <option value="asc">Cũ nhất / Thấp nhất (ASC)</option>
            </select>

            {/* Reset Filter Button */}
            <button
              type="button"
              data-testid="history-btn-clear-filters"
              onClick={() => {
                setHistorySearch('');
                setHistorySeverity('ALL');
                setHistoryStatus('ALL');
                setHistoryCluster('ALL');
                setHistoryResourceType('ALL');
                setHistoryTimePreset('ALL');
                setHistoryStartDate('');
                setHistoryEndDate('');
                setHistorySortBy('first_detected_at');
                setHistorySortOrder('desc');
                setHistoryDateValidationError(null);
                setHistoryPage(1);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đặt lại bộ lọc
            </button>
          </div>

          {/* Custom Date Pickers */}
          {historyTimePreset === 'CUSTOM' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', fontWeight: 600 }}>
                  Từ ngày:
                </span>
                <input
                  type="datetime-local"
                  data-testid="history-start-date"
                  value={historyStartDate}
                  onChange={(e) => {
                    setHistoryStartDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                  }}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', fontWeight: 600 }}>
                  Đến ngày:
                </span>
                <input
                  type="datetime-local"
                  data-testid="history-end-date"
                  value={historyEndDate}
                  onChange={(e) => {
                    setHistoryEndDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>
              {historyDateValidationError && (
                <div
                  data-testid="history-date-validation-error"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  {historyDateValidationError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* History Data Table */}
        <div
          data-testid="history-table-container"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
            overflow: 'hidden',
          }}
        >
          {isLoadingHistory ? (
            <div
              data-testid="history-loading-state"
              style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--dash-text-secondary)' }}
            >
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Đang tải danh sách lịch sử cảnh báo...</div>
            </div>
          ) : historyError ? (
            <div
              data-testid="history-error-state"
              style={{ padding: '40px 20px', textAlign: 'center', color: '#DC2626' }}
            >
              <AlertCircle size={28} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>{historyError}</div>
              <button
                type="button"
                data-testid="history-btn-retry"
                onClick={fetchAlertHistoryAndSummary}
                style={{
                  marginTop: '12px',
                  padding: '6px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Thử lại
              </button>
            </div>
          ) : historyAlerts.length === 0 ? (
            <div
              data-testid="history-empty-state"
              style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}
            >
              <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                Không tìm thấy sự kiện lịch sử nào
              </div>
              <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
                Không có cảnh báo nào thỏa mãn bộ lọc hiện tại hoặc hệ thống hoạt động ổn định.
              </div>
            </div>
          ) : (
            <div data-testid="history-table-scroll" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Cảnh báo / Quy tắc
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Mức độ
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Trạng thái
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Tài nguyên / Cụm K8s
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Giá trị đo / Ngưỡng
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Thời lượng
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Phát hiện lần đầu
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Người phụ trách
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                      Giải quyết lúc / Bởi
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem', textAlign: 'right' }}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyAlerts.map((item) => {
                    const sev = getSeverityStyle(item.severity);
                    const st = getStatusStyle(item.status);
                    const unitStr = item.unit ? ` ${item.unit}` : '';
                    const hasObserved = item.observed_value !== null && item.observed_value !== undefined;
                    const hasThreshold = item.threshold_value !== null && item.threshold_value !== undefined;
                    const assigneeLabel = item.assignee_name || item.assignee_email || 'Chưa phân công';

                    return (
                      <tr
                        key={item.id}
                        data-testid="history-row"
                        style={{
                          borderBottom: '1px solid var(--dash-border)',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                            {item.rule_name || item.title || 'Cảnh báo hệ thống'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.message || '—'}
                          </div>
                        </td>

                        <td style={{ padding: '14px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: sev.bg,
                              color: sev.text,
                              border: `1px solid ${sev.border}`,
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                            }}
                          >
                            {item.severity || 'INFO'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: st.bg,
                              color: st.text,
                              border: `1px solid ${st.border}`,
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: st.dot }} />
                            {item.status || 'ACTIVE'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 14px' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                            {item.resource_id || '—'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--dash-text-muted)' }}>
                            <span style={{ textTransform: 'uppercase' }}>{item.resource_type || '—'}</span>
                            {item.namespace ? ` | ns: ${item.namespace}` : ''}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--dash-text-secondary)', fontWeight: 600, marginTop: '2px' }}>
                            {item.cluster_name || 'Toàn tổ chức'}
                          </div>
                        </td>

                        <td style={{ padding: '14px 14px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                            {hasObserved ? `${item.observed_value}${unitStr}` : '—'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                            Ngưỡng: {hasThreshold ? `${item.threshold_value}${unitStr}` : '—'}
                          </div>
                        </td>

                        <td style={{ padding: '14px 14px' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: item.status === 'RESOLVED' ? '#059669' : '#D97706',
                            }}
                          >
                            {item.duration_formatted || (item.duration_seconds ? `${item.duration_seconds}s` : '—')}
                          </span>
                        </td>

                        <td style={{ padding: '14px 14px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                          {formatDateTime(item.first_detected_at)}
                        </td>

                        <td
                          data-testid={`history-assignee-${item.id}`}
                          style={{ padding: '14px 14px', fontSize: '0.75rem', fontWeight: 600, color: item.assigned_to ? '#1D4ED8' : 'var(--dash-text-muted)' }}
                        >
                          {assigneeLabel}
                        </td>

                        <td style={{ padding: '14px 14px', fontSize: '0.75rem' }}>
                          {item.resolved_at ? (
                            <div>
                              <div style={{ color: '#059669', fontWeight: 600 }}>{formatDateTime(item.resolved_at)}</div>
                              <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.6875rem' }}>
                                {item.resolver_name || item.resolver_email || item.details?.resolved_by || 'Hệ thống'}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--dash-text-muted)' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              data-testid="history-btn-detail"
                              onClick={() => openAlertDetail(item)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--dash-border)',
                                backgroundColor: '#FFFFFF',
                                color: 'var(--dash-text-primary)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Chi tiết
                            </button>

                            {canManageAlerts && item.status === 'ACTIVE' && (
                              <button
                                type="button"
                                data-testid={`history-btn-ack-${item.id}`}
                                disabled={historyActionLoadingId === item.id}
                                onClick={() => handleHistoryQuickAcknowledge(item)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #FDE68A',
                                  backgroundColor: '#FFFBEB',
                                  color: '#B45309',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: historyActionLoadingId === item.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Tiếp nhận
                              </button>
                            )}

                            {canManageAlerts && item.status !== 'RESOLVED' && (
                              <button
                                type="button"
                                data-testid={`history-btn-resolve-${item.id}`}
                                onClick={() => openResolveConfirmModal(item)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #A7F3D0',
                                  backgroundColor: '#ECFDF5',
                                  color: '#059669',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Đã xử lý
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {historyAlerts.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}>
                Trang <strong>{historyPagination.page}</strong> / <strong>{historyPagination.total_pages || 1}</strong> (Tổng <strong>{historyPagination.total}</strong> bản ghi)
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  data-testid="history-page-size-select"
                  value={historyPageSize}
                  onChange={(e) => {
                    setHistoryPageSize(Number(e.target.value));
                    setHistoryPage(1);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.75rem',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>

                <button
                  type="button"
                  data-testid="history-btn-prev-page"
                  disabled={historyPagination.page <= 1}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: historyPagination.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: historyPagination.page <= 1 ? 0.5 : 1,
                  }}
                >
                  Trước
                </button>

                <button
                  type="button"
                  data-testid="history-btn-next-page"
                  disabled={historyPagination.page >= (historyPagination.total_pages || 1)}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: historyPagination.page >= (historyPagination.total_pages || 1) ? 'not-allowed' : 'pointer',
                    opacity: historyPagination.page >= (historyPagination.total_pages || 1) ? 0.5 : 1,
                  }}
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Drawer: Alert Detail */}
      <AlertDetailDrawer
        alertItem={selectedAlert}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        canManageAlerts={canManageAlerts}
        currentOrgId={currentOrg?.id || ''}
        currentOrgName={currentOrg?.name || ''}
        onAlertUpdated={(updated) => {
          setSelectedAlert(updated);
          fetchAlertHistoryAndSummary();
        }}
      />

      {/* Modal: Mark as Resolved Confirmation Dialog */}
      {resolveModalTarget && (
        <div
          data-testid="resolve-confirm-modal"
          onClick={() => {
            if (!isSubmittingModalResolve) setResolveModalTarget(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            padding: '16px',
          }}
        >
          <form
            onSubmit={handleConfirmResolveSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid var(--dash-border)',
              boxShadow: '0 20px 45px rgba(15, 23, 42, 0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ECFDF5',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065F46', fontWeight: 800, fontSize: '0.95rem' }}>
                <CheckCircle2 size={20} color="#059669" />
                <span>Xác nhận Đánh dấu Đã xử lý (Mark as Resolved)</span>
              </div>
              <button
                type="button"
                disabled={isSubmittingModalResolve}
                onClick={() => setResolveModalTarget(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: isSubmittingModalResolve ? 'not-allowed' : 'pointer',
                  color: '#065F46',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                  {resolveModalTarget.rule_name || resolveModalTarget.title || 'Cảnh báo hệ thống'}
                </div>
                <div style={{ color: 'var(--dash-text-secondary)', marginTop: '4px', fontSize: '0.75rem' }}>
                  Tài nguyên: <strong>{resolveModalTarget.resource_id || '—'}</strong> ({resolveModalTarget.resource_type || '—'}) • Cụm:{' '}
                  <strong>{resolveModalTarget.cluster_name || 'Toàn tổ chức'}</strong>
                </div>
              </div>

              <div>
                <label
                  htmlFor="resolve-modal-note-input"
                  style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}
                >
                  Ghi chú xử lý (Resolution Note) <span style={{ fontWeight: 500, color: 'var(--dash-text-muted)' }}>(tối đa 2000 ký tự)</span>
                </label>
                <textarea
                  id="resolve-modal-note-input"
                  data-testid="resolve-modal-note-input"
                  rows={4}
                  value={resolveModalNote}
                  onChange={(e) => {
                    setResolveModalNote(e.target.value);
                    if (resolveNoteError) setResolveNoteError(null);
                  }}
                  placeholder="Mô tả nguyên nhân gốc rễ và hành động khắc phục đã thực hiện..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: resolveNoteError ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.72rem', color: 'var(--dash-text-muted)' }}>
                  <span>Sẽ được lưu vào Audit Trail kèm người thực hiện & dấu thời gian</span>
                  <span>{resolveModalNote.length} / 2000</span>
                </div>
              </div>

              {resolveNoteError && (
                <div
                  data-testid="resolve-note-error"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  {resolveNoteError}
                </div>
              )}

              {resolveModalApiError && (
                <div
                  data-testid="resolve-modal-error"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {resolveModalApiError}
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                data-testid="btn-cancel-resolve-modal"
                disabled={isSubmittingModalResolve}
                onClick={() => setResolveModalTarget(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: isSubmittingModalResolve ? 'not-allowed' : 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                data-testid="btn-confirm-resolve-submit"
                disabled={isSubmittingModalResolve}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: isSubmittingModalResolve ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingModalResolve ? 0.7 : 1,
                }}
              >
                <Check size={15} />
                <span>{isSubmittingModalResolve ? 'Đang cập nhật...' : 'Xác nhận Đã xử lý'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AlertHistoryPage;
