import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  Search,
  Plus,
  Eye,
  Edit3,
  Trash2,
  Play,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Power,
  Filter,
  Activity,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../../context/AuthContext';
import { useDebounce } from '../../../hooks/useDebounce';
import { alertService, DEFAULT_RULE_METADATA } from '../../../services/alertService';
import { getAuthToken, API_BASE_URL } from '../../../services/apiClient';
import AlertDetailDrawer, {
  OPERATOR_SYMBOLS,
  getSeverityStyle,
  getStatusStyle,
  formatDateTime,
} from './AlertDetailDrawer';
import AlertRuleModal from './AlertRuleModal';

const TIME_RANGE_PRESETS = [
  { key: 'ALL', label: 'Tất cả thời gian', ms: null },
  { key: '15m', label: '15 phút qua', ms: 15 * 60 * 1000 },
  { key: '1h', label: '1 giờ qua', ms: 60 * 60 * 1000 },
  { key: '6h', label: '6 giờ qua', ms: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24 giờ qua', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 ngày qua', ms: 7 * 24 * 60 * 60 * 1000 },
];

export const AlertsPage = () => {
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

  // Active View Tab: 'EVENTS' | 'RULES'
  const [activeTab, setActiveTab] = useState('EVENTS');

  // Summary State
  const [summary, setSummary] = useState({
    total_active: 0,
    total_acknowledged: 0,
    total_resolved: 0,
    by_severity: { CRITICAL: 0, WARNING: 0, INFO: 0 },
    by_category: { RESOURCE: 0, KUBERNETES: 0, APM: 0 },
  });

  // Alert Events State
  const [alerts, setAlerts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  });
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [alertsError, setAlertsError] = useState(null);

  // Alert Rules State
  const [rules, setRules] = useState([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [rulesError, setRulesError] = useState(null);
  const [ruleMetadata, setRuleMetadata] = useState(DEFAULT_RULE_METADATA);

  // Filter States (Events)
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [clusterFilter, setClusterFilter] = useState('ALL');
  const [ruleFilter, setRuleFilter] = useState('ALL');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('ALL');
  const [timeRangeFilter, setTimeRangeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Realtime & Auto Refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toastBanner, setToastBanner] = useState(null);

  // Detail Drawer & Rule Modal
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const showToast = useCallback((type, text) => {
    setToastBanner({ type, text });
    setTimeout(() => {
      setToastBanner((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  // Load Rule Metadata & Rules list (used for Rule filter dropdown and Rules tab)
  const fetchRulesAndMetadata = useCallback(async () => {
    setIsLoadingRules(true);
    setRulesError(null);
    try {
      const [metaRes, rulesRes] = await Promise.all([
        alertService.getRuleMetadata(),
        alertService.getAlertRules({ page: 1, limit: 100 }),
      ]);
      if (metaRes) setRuleMetadata(metaRes);
      if (rulesRes?.items) setRules(rulesRes.items);
    } catch (err) {
      if (!err?.isAborted) {
        setRulesError(err.message || 'Không thể tải danh sách quy tắc cảnh báo');
      }
    } finally {
      setIsLoadingRules(false);
    }
  }, []);

  // Load Summary & Paginated Alerts from Backend
  const fetchAlertsAndSummary = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoadingAlerts(true);
      } else {
        setIsRefreshing(true);
      }
      setAlertsError(null);

      try {
        const timePreset = TIME_RANGE_PRESETS.find((t) => t.key === timeRangeFilter);
        const startTimeIso =
          timePreset && timePreset.ms
            ? new Date(Date.now() - timePreset.ms).toISOString()
            : undefined;

        const queryParams = {
          page,
          limit: pageSize,
          search: debouncedSearch || undefined,
          severity: severityFilter !== 'ALL' ? severityFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          cluster_id: clusterFilter !== 'ALL' ? clusterFilter : undefined,
          rule_id: ruleFilter !== 'ALL' ? ruleFilter : undefined,
          resource_type: resourceTypeFilter !== 'ALL' ? resourceTypeFilter : undefined,
          start_time: startTimeIso,
          sort_by: 'last_seen_at',
          order: 'desc',
        };

        const summaryParams = {
          cluster_id: clusterFilter !== 'ALL' ? clusterFilter : undefined,
          from: startTimeIso,
        };

        const [summaryData, alertsData] = await Promise.all([
          alertService.getAlertSummary(summaryParams),
          alertService.getAlerts(queryParams),
        ]);

        if (summaryData) {
          setSummary({
            total_active: Number(summaryData.total_active || 0),
            total_acknowledged: Number(summaryData.total_acknowledged || 0),
            total_resolved: Number(summaryData.total_resolved || 0),
            by_severity: {
              CRITICAL: Number(summaryData.by_severity?.CRITICAL || 0),
              WARNING: Number(summaryData.by_severity?.WARNING || 0),
              INFO: Number(summaryData.by_severity?.INFO || 0),
            },
            by_category: {
              RESOURCE: Number(summaryData.by_category?.RESOURCE || 0),
              KUBERNETES: Number(summaryData.by_category?.KUBERNETES || 0),
              APM: Number(summaryData.by_category?.APM || 0),
            },
          });
        }

        if (alertsData) {
          setAlerts(alertsData.items || []);
          setPagination(
            alertsData.pagination || {
              page,
              limit: pageSize,
              total: (alertsData.items || []).length,
              total_pages: 1,
            }
          );
        }
      } catch (err) {
        if (!err?.isAborted) {
          setAlertsError(err.message || 'Lỗi kết nối máy chủ khi tải dữ liệu cảnh báo');
        }
      } finally {
        setIsLoadingAlerts(false);
        setIsRefreshing(false);
      }
    },
    [
      page,
      pageSize,
      debouncedSearch,
      severityFilter,
      statusFilter,
      clusterFilter,
      ruleFilter,
      resourceTypeFilter,
      timeRangeFilter,
    ]
  );

  // Initial & filter-driven load
  useEffect(() => {
    fetchAlertsAndSummary(false);
  }, [fetchAlertsAndSummary, currentOrg?.id]);

  useEffect(() => {
    fetchRulesAndMetadata();
  }, [fetchRulesAndMetadata, currentOrg?.id]);

  // Single Polling Loop + Window Focus Refresh (with proper unmount cleanup)
  useEffect(() => {
    if (!autoRefresh) return undefined;

    const intervalId = setInterval(() => {
      fetchAlertsAndSummary(true);
    }, 15000);

    const handleWindowFocus = () => {
      fetchAlertsAndSummary(true);
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [autoRefresh, fetchAlertsAndSummary]);

  // WebSocket Realtime Subscription (Reuses existing /api/v1/telemetry/ws)
  const fetchRef = useRef(fetchAlertsAndSummary);
  useEffect(() => {
    fetchRef.current = fetchAlertsAndSummary;
  }, [fetchAlertsAndSummary]);

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
              fetchRef.current?.(true);
            }
          }
        } catch {
          // Ignore malformed WS messages
        }
      };
    } catch {
      // Fallback gracefully to polling
    }

    return () => {
      if (ws && ws.readyState <= 1) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [currentOrg?.id]);

  // Filter change helpers (reset to page 1)
  const updateFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSeverityFilter('ALL');
    setStatusFilter('ALL');
    setClusterFilter('ALL');
    setRuleFilter('ALL');
    setResourceTypeFilter('ALL');
    setTimeRangeFilter('ALL');
    setPage(1);
  };

  // Manual Evaluate Trigger
  const handleTriggerEvaluation = async () => {
    if (!canManageAlerts) return;
    setIsEvaluating(true);
    try {
      const res = await alertService.triggerEvaluation({
        cluster_id: clusterFilter !== 'ALL' ? clusterFilter : undefined,
      });
      await fetchAlertsAndSummary(true);
      showToast(
        'success',
        `Đã đánh giá ${res?.rules_evaluated ?? 0} quy tắc: ${res?.alerts_triggered ?? 0} kích hoạt, ${res?.alerts_resolved ?? 0} tự giải quyết.`
      );
    } catch (err) {
      showToast('error', err.message || 'Không thể chạy chu kỳ đánh giá Rule Engine');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Quick Acknowledge from table row
  const handleQuickAcknowledge = async (alertItem, e) => {
    e.stopPropagation();
    if (!canManageAlerts || alertItem.status !== 'ACTIVE') return;
    try {
      await alertService.acknowledgeAlert(alertItem.id, 'Xác nhận nhanh từ bảng cảnh báo');
      showToast('success', `Đã xác nhận (ACKNOWLEDGED) cảnh báo "${alertItem.rule_name}"`);
      await fetchAlertsAndSummary(true);
    } catch (err) {
      showToast('error', err.message || 'Không thể xác nhận cảnh báo');
    }
  };

  // Quick Resolve from table row
  const handleQuickResolve = async (alertItem, e) => {
    e.stopPropagation();
    if (!canManageAlerts || alertItem.status === 'RESOLVED') return;
    try {
      await alertService.resolveAlert(alertItem.id, 'Giải quyết thủ công từ bảng cảnh báo');
      showToast('success', `Đã chuyển cảnh báo "${alertItem.rule_name}" sang RESOLVED`);
      await fetchAlertsAndSummary(true);
    } catch (err) {
      showToast('error', err.message || 'Không thể giải quyết cảnh báo');
    }
  };

  // Toggle Rule Enable/Disable
  const handleToggleRuleStatus = async (ruleItem) => {
    if (!canManageAlerts) return;
    const nextEnabled = !ruleItem.enabled;
    try {
      await alertService.toggleAlertRuleStatus(ruleItem.id, nextEnabled);
      setRules((prev) =>
        prev.map((r) => (r.id === ruleItem.id ? { ...r, enabled: nextEnabled } : r))
      );
      showToast(
        'success',
        `Đã ${nextEnabled ? 'bật (Enabled)' : 'tắt (Disabled)'} quy tắc "${ruleItem.name}"`
      );
    } catch (err) {
      showToast('error', err.message || 'Không thể thay đổi trạng thái quy tắc');
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleItem) => {
    if (!canManageAlerts) return;
    try {
      await alertService.deleteAlertRule(ruleItem.id);
      setRules((prev) => prev.filter((r) => r.id !== ruleItem.id));
      showToast('success', `Đã xóa quy tắc "${ruleItem.name}"`);
    } catch (err) {
      showToast('error', err.message || 'Không thể xóa quy tắc cảnh báo');
    }
  };

  const openCreateRuleModal = () => {
    setEditingRule(null);
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (ruleItem) => {
    setEditingRule(ruleItem);
    setIsRuleModalOpen(true);
  };

  const openAlertDetail = (alertItem) => {
    setSelectedAlert(alertItem);
    setIsDetailOpen(true);
  };

  return (
    <div
      data-testid="alerts-dashboard-page"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}
    >
      {/* Top Header */}
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
            <ShieldAlert size={26} color="#DC2626" />
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Trung Tâm Cảnh Báo & Cấu Hình Ngưỡng (Alert Management)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Giám sát sự kiện vượt ngưỡng Hạ tầng (CPU, RAM, Disk), Kubernetes & APM theo thời gian thực
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
            onClick={() => {
              fetchAlertsAndSummary(false);
              fetchRulesAndMetadata();
            }}
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
            <RefreshCw size={14} className={isRefreshing || isLoadingAlerts ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>

          {canManageAlerts && (
            <>
              <button
                type="button"
                data-testid="btn-evaluate-now"
                onClick={handleTriggerEvaluation}
                disabled={isEvaluating}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #3B82F6',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: isEvaluating ? 'not-allowed' : 'pointer',
                }}
              >
                <Play size={14} />
                <span>{isEvaluating ? 'Đang quét...' : 'Đánh Giá Rule Ngay'}</span>
              </button>

              <button
                type="button"
                data-testid="btn-open-create-rule"
                onClick={openCreateRuleModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--dash-primary, #059669)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                }}
              >
                <Plus size={15} />
                <span>Tạo Quy Tắc Ngưỡng</span>
              </button>
            </>
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

      {/* 5 Summary Cards */}
      <div
        data-testid="alert-summary-cards"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        {/* 1. Total Active Alerts */}
        <div
          data-testid="summary-card-active"
          style={{
            padding: '16px 18px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Tổng Cảnh Báo Đang Mở
            </span>
            <ShieldAlert size={18} color="#DC2626" />
          </div>
          <div
            data-testid="summary-value-active"
            style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}
          >
            {summary.total_active}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            Đã xác nhận (ACK): <strong>{summary.total_acknowledged}</strong>
          </div>
        </div>

        {/* 2. Critical Alerts */}
        <div
          data-testid="summary-card-critical"
          style={{
            padding: '16px 18px',
            backgroundColor: '#FEF2F2',
            borderRadius: '12px',
            border: '1px solid #FECACA',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase' }}>
              Khẩn Cấp (CRITICAL)
            </span>
            <ShieldAlert size={18} color="#DC2626" />
          </div>
          <div
            data-testid="summary-value-critical"
            style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626', marginTop: '8px' }}
          >
            {summary.by_severity.CRITICAL}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7F1D1D', marginTop: '4px' }}>
            Yêu cầu can thiệp ưu tiên cao
          </div>
        </div>

        {/* 3. Warning Alerts */}
        <div
          data-testid="summary-card-warning"
          style={{
            padding: '16px 18px',
            backgroundColor: '#FFFBEB',
            borderRadius: '12px',
            border: '1px solid #FDE68A',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase' }}>
              Cảnh Báo (WARNING)
            </span>
            <AlertTriangle size={18} color="#D97706" />
          </div>
          <div
            data-testid="summary-value-warning"
            style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', marginTop: '8px' }}
          >
            {summary.by_severity.WARNING}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#92400E', marginTop: '4px' }}>
            Vượt ngưỡng cảnh báo sớm
          </div>
        </div>

        {/* 4. Info Alerts */}
        <div
          data-testid="summary-card-info"
          style={{
            padding: '16px 18px',
            backgroundColor: '#EFF6FF',
            borderRadius: '12px',
            border: '1px solid #BFDBFE',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase' }}>
              Thông Tin (INFO)
            </span>
            <Info size={18} color="#2563EB" />
          </div>
          <div
            data-testid="summary-value-info"
            style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563EB', marginTop: '8px' }}
          >
            {summary.by_severity.INFO}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#1E3A8A', marginTop: '4px' }}>
            Theo dõi biến động nhẹ
          </div>
        </div>

        {/* 5. Resolved Alerts */}
        <div
          data-testid="summary-card-resolved"
          style={{
            padding: '16px 18px',
            backgroundColor: '#ECFDF5',
            borderRadius: '12px',
            border: '1px solid #A7F3D0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#065F46', textTransform: 'uppercase' }}>
              Đã Giải Quyết (RESOLVED)
            </span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div
            data-testid="summary-value-resolved"
            style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: '8px' }}
          >
            {summary.total_resolved}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '4px' }}>
            Tự phục hồi & xử lý hoàn tất
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--dash-border)',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            data-testid="tab-alert-events"
            onClick={() => setActiveTab('EVENTS')}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === 'EVENTS' ? '3px solid var(--dash-primary, #059669)' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'EVENTS' ? 'var(--dash-primary, #059669)' : 'var(--dash-text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Danh Sách Cảnh Báo ({pagination.total})
          </button>

          <button
            type="button"
            data-testid="tab-alert-rules"
            onClick={() => setActiveTab('RULES')}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === 'RULES' ? '3px solid var(--dash-primary, #059669)' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'RULES' ? 'var(--dash-primary, #059669)' : 'var(--dash-text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Quy Tắc Ngưỡng Cảnh Báo ({rules.length})
          </button>
        </div>
      </div>

      {/* TAB 1: ALERT EVENTS LIST & FILTERS */}
      {activeTab === 'EVENTS' && (
        <>
          {/* Filter Bar */}
          <div
            data-testid="alert-filters-bar"
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              {/* Search */}
              <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                <Search
                  size={15}
                  color="var(--dash-text-muted)"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  data-testid="filter-search-input"
                  value={searchQuery}
                  onChange={(e) => updateFilter(setSearchQuery, e.target.value)}
                  placeholder="Tìm theo tên cảnh báo, tài nguyên (node/pod/service), thông điệp..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Severity Filter */}
              <select
                data-testid="filter-severity-select"
                value={severityFilter}
                onChange={(e) => updateFilter(setSeverityFilter, e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ALL">Mọi mức độ (All Severities)</option>
                <option value="CRITICAL">CRITICAL (Khẩn cấp)</option>
                <option value="WARNING">WARNING (Cảnh báo)</option>
                <option value="INFO">INFO (Thông tin)</option>
              </select>

              {/* Status Filter */}
              <select
                data-testid="filter-status-select"
                value={statusFilter}
                onChange={(e) => updateFilter(setStatusFilter, e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ALL">Mọi trạng thái (All Statuses)</option>
                <option value="ACTIVE">ACTIVE (Đang kích hoạt)</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED (Đã xác nhận)</option>
                <option value="RESOLVED">RESOLVED (Đã giải quyết)</option>
              </select>

              {/* Cluster Filter */}
              <select
                data-testid="filter-cluster-select"
                value={clusterFilter}
                onChange={(e) => updateFilter(setClusterFilter, e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ALL">Mọi cụm K8s (All Clusters)</option>
                {envList.map((c) => (
                  <option key={c.id || c.clusterId} value={c.id || c.clusterId}>
                    {c.cluster || c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', alignItems: 'center' }}>
              {/* Rule Filter */}
              <select
                data-testid="filter-rule-select"
                value={ruleFilter}
                onChange={(e) => updateFilter(setRuleFilter, e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ALL">Mọi quy tắc (All Rules)</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              {/* Resource Type Filter */}
              <select
                data-testid="filter-resource-type-select"
                value={resourceTypeFilter}
                onChange={(e) => updateFilter(setResourceTypeFilter, e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ALL">Mọi loại tài nguyên (Resource Types)</option>
                <option value="node">NODE (Máy chủ Hạ tầng)</option>
                <option value="pod">POD (Kubernetes Pod)</option>
                <option value="service">SERVICE (Dịch vụ APM)</option>
                <option value="container">CONTAINER</option>
                <option value="deployment">DEPLOYMENT</option>
              </select>

              {/* Time Range Filter */}
              <select
                data-testid="filter-time-range-select"
                value={timeRangeFilter}
                onChange={(e) => updateFilter(setTimeRangeFilter, e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {TIME_RANGE_PRESETS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>

              {/* Reset Filters Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  data-testid="btn-reset-filters"
                  onClick={handleResetFilters}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#F8FAFC',
                    color: 'var(--dash-text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Filter size={13} />
                  <span>Đặt lại bộ lọc</span>
                </button>
              </div>
            </div>
          </div>

          {/* Alert List States: Loading / Error / Empty / Table */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              overflow: 'hidden',
            }}
          >
            {isLoadingAlerts ? (
              <div
                data-testid="alerts-loading-state"
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--dash-text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <RefreshCw size={28} className="animate-spin" color="var(--dash-primary)" />
                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                  Đang tải danh sách sự kiện cảnh báo từ máy chủ...
                </div>
              </div>
            ) : alertsError ? (
              <div
                data-testid="alerts-error-state"
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <AlertCircle size={32} color="#DC2626" />
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#DC2626' }}>
                  Không thể tải danh sách cảnh báo
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', maxWidth: '460px' }}>
                  {alertsError}
                </div>
                <button
                  type="button"
                  data-testid="btn-retry-alerts"
                  onClick={() => fetchAlertsAndSummary(false)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: '1px solid #DC2626',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Thử lại (Retry)
                </button>
              </div>
            ) : alerts.length === 0 ? (
              <div
                data-testid="alerts-empty-state"
                style={{
                  padding: '56px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <CheckCircle2 size={36} color="#10B981" />
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--dash-text-primary)' }}>
                  Không có sự kiện cảnh báo nào khớp bộ lọc
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', maxWidth: '480px' }}>
                  Hệ thống hạ tầng hiện đang hoạt động trong ngưỡng an toàn hoặc chưa có cảnh báo phát sinh trong phạm vi đã chọn.
                </div>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    data-testid="alerts-table"
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderBottom: '1px solid var(--dash-border)',
                          color: 'var(--dash-text-muted)',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                        }}
                      >
                        <th style={{ padding: '12px 16px' }}>Tên Cảnh Báo (Alert Name)</th>
                        <th style={{ padding: '12px 12px' }}>Mức Độ (Severity)</th>
                        <th style={{ padding: '12px 12px' }}>Trạng Thái (Status)</th>
                        <th style={{ padding: '12px 12px' }}>Loại & Tên Tài Nguyên</th>
                        <th style={{ padding: '12px 12px' }}>Cụm (Cluster)</th>
                        <th style={{ padding: '12px 12px' }}>Giá Trị / Ngưỡng</th>
                        <th style={{ padding: '12px 12px' }}>First Seen</th>
                        <th style={{ padding: '12px 12px' }}>Last Seen</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((item) => {
                        const sev = getSeverityStyle(item.severity);
                        const st = getStatusStyle(item.status);
                        const SevIcon = sev.icon;
                        const opCode = item.rule_operator || item.details?.operator || 'GREATER_THAN';
                        const opSym = OPERATOR_SYMBOLS[opCode] || '>';
                        const uStr = item.unit ? ` ${item.unit}` : '';

                        return (
                          <tr
                            key={item.id}
                            data-testid={`alert-row-${item.id}`}
                            onClick={() => openAlertDetail(item)}
                            style={{
                              borderBottom: '1px solid var(--dash-border)',
                              cursor: 'pointer',
                              transition: 'background-color 0.12s ease',
                            }}
                          >
                            {/* Alert Name */}
                            <td style={{ padding: '14px 16px', maxWidth: '280px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                                  {item.rule_name}
                                </span>
                                {item.occurrence_count > 1 && (
                                  <span
                                    style={{
                                      padding: '1px 7px',
                                      borderRadius: '999px',
                                      backgroundColor: '#EFF6FF',
                                      color: '#1D4ED8',
                                      border: '1px solid #BFDBFE',
                                      fontSize: '0.6875rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    ×{item.occurrence_count}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--dash-text-secondary)',
                                  marginTop: '3px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.message}
                              </div>
                            </td>

                            {/* Severity */}
                            <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                              <span
                                data-testid={`badge-severity-${item.id}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '3px 9px',
                                  borderRadius: '999px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 800,
                                  backgroundColor: sev.bg,
                                  color: sev.text,
                                  border: `1px solid ${sev.border}`,
                                }}
                              >
                                <SevIcon size={12} />
                                {sev.label}
                              </span>
                            </td>

                            {/* Status */}
                            <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                              <span
                                data-testid={`badge-status-${item.id}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '3px 9px',
                                  borderRadius: '999px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 800,
                                  backgroundColor: st.bg,
                                  color: st.text,
                                  border: `1px solid ${st.border}`,
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: st.dot,
                                  }}
                                />
                                {st.label}
                              </span>
                            </td>

                            {/* Resource Type & Name */}
                            <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: '#F1F5F9',
                                    color: '#334155',
                                    fontSize: '0.6875rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {item.resource_type}
                                </span>
                                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--dash-text-primary)' }}>
                                  {item.resource_id}
                                </span>
                              </div>
                              {item.details?.namespace && (
                                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                                  ns: {item.details.namespace}
                                </div>
                              )}
                            </td>

                            {/* Cluster */}
                            <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                                {item.cluster_name || item.cluster_id || 'Org-Wide'}
                              </span>
                            </td>

                            {/* Metric Value vs Threshold */}
                            <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 800, color: '#DC2626' }}>
                                {item.observed_value !== null && item.observed_value !== undefined
                                  ? `${item.observed_value}${uStr}`
                                  : '—'}
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                                Ngưỡng: {opSym} {item.threshold_value ?? '—'}
                                {uStr}
                              </div>
                            </td>

                            {/* First Seen */}
                            <td style={{ padding: '14px 12px', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                              {formatDateTime(item.first_detected_at)}
                            </td>

                            {/* Last Seen */}
                            <td style={{ padding: '14px 12px', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                              {formatDateTime(item.last_seen_at)}
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {canManageAlerts && item.status === 'ACTIVE' && (
                                  <button
                                    type="button"
                                    data-testid={`btn-row-ack-${item.id}`}
                                    onClick={(e) => handleQuickAcknowledge(item, e)}
                                    title="Xác nhận cảnh báo (Acknowledge)"
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid #FDE68A',
                                      backgroundColor: '#FFFBEB',
                                      color: '#B45309',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ACK
                                  </button>
                                )}

                                {canManageAlerts && item.status !== 'RESOLVED' && (
                                  <button
                                    type="button"
                                    data-testid={`btn-row-resolve-${item.id}`}
                                    onClick={(e) => handleQuickResolve(item, e)}
                                    title="Giải quyết sự cố (Resolve)"
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid #A7F3D0',
                                      backgroundColor: '#ECFDF5',
                                      color: '#065F46',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Resolve
                                  </button>
                                )}

                                <button
                                  type="button"
                                  data-testid={`btn-row-detail-${item.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAlertDetail(item);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
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
                                  <Eye size={13} />
                                  <span>Chi tiết</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Server-Side Pagination Footer */}
                <div
                  data-testid="alerts-pagination-footer"
                  style={{
                    padding: '12px 18px',
                    backgroundColor: '#F8FAFC',
                    borderTop: '1px solid var(--dash-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--dash-text-secondary)' }}>
                    <span>
                      Hiển thị trang <strong>{pagination.page}</strong> / <strong>{pagination.total_pages || 1}</strong> (Tổng{' '}
                      <strong>{pagination.total}</strong> cảnh báo)
                    </span>
                    <select
                      data-testid="select-page-size"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
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
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      data-testid="btn-prev-page"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: page <= 1 ? '#F1F5F9' : '#FFFFFF',
                        color: page <= 1 ? '#94A3B8' : 'var(--dash-text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft size={14} />
                      <span>Trang trước</span>
                    </button>

                    <button
                      type="button"
                      data-testid="btn-next-page"
                      disabled={page >= (pagination.total_pages || 1)}
                      onClick={() => setPage((p) => p + 1)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: page >= (pagination.total_pages || 1) ? '#F1F5F9' : '#FFFFFF',
                        color: page >= (pagination.total_pages || 1) ? '#94A3B8' : 'var(--dash-text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: page >= (pagination.total_pages || 1) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span>Trang sau</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* TAB 2: ALERT RULES CONFIGURATION TABLE */}
      {activeTab === 'RULES' && (
        <div
          data-testid="alert-rules-section"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
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
              backgroundColor: '#F8FAFC',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--dash-text-primary)' }}>
                Danh Sách Quy Tắc Ngưỡng Cảnh Báo (Configured Alert Rules)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                Các quy tắc đang bật sẽ được Rule Engine đánh giá định kỳ theo cửa sổ thời gian
              </div>
            </div>

            {canManageAlerts && (
              <button
                type="button"
                data-testid="btn-rules-tab-create"
                onClick={openCreateRuleModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--dash-primary, #059669)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>Thêm Quy Tắc Mới</span>
              </button>
            )}
          </div>

          {isLoadingRules ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--dash-text-secondary)' }}>
              Đang tải danh sách cấu hình quy tắc...
            </div>
          ) : rulesError ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#DC2626' }}>
              {rulesError}
            </div>
          ) : rules.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--dash-text-secondary)' }}>
              Chưa có quy tắc cảnh báo nào được cấu hình trong tổ chức này.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                data-testid="alert-rules-table"
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderBottom: '1px solid var(--dash-border)',
                      color: 'var(--dash-text-muted)',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '12px 16px' }}>Tên Quy Tắc (Rule Name)</th>
                    <th style={{ padding: '12px 12px' }}>Chỉ Số (Metric)</th>
                    <th style={{ padding: '12px 12px' }}>Điều Kiện Ngưỡng</th>
                    <th style={{ padding: '12px 12px' }}>Mức Độ</th>
                    <th style={{ padding: '12px 12px' }}>Cửa Sổ / Duration / Cooldown</th>
                    <th style={{ padding: '12px 12px' }}>Trạng Thái</th>
                    {canManageAlerts && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => {
                    const sev = getSeverityStyle(r.severity);
                    const opSym = OPERATOR_SYMBOLS[r.operator] || r.operator;
                    return (
                      <tr
                        key={r.id}
                        data-testid={`rule-row-${r.id}`}
                        style={{ borderBottom: '1px solid var(--dash-border)' }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{r.name}</div>
                          {r.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                              {r.description}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                          {r.metric_type}
                        </td>

                        <td style={{ padding: '14px 12px', fontWeight: 800, color: '#DC2626' }}>
                          {opSym} {r.threshold_value} {r.unit}
                        </td>

                        <td style={{ padding: '14px 12px' }}>
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: '999px',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              backgroundColor: sev.bg,
                              color: sev.text,
                              border: `1px solid ${sev.border}`,
                            }}
                          >
                            {sev.label}
                          </span>
                        </td>

                        <td style={{ padding: '14px 12px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                          Window: <strong>{r.evaluation_window}</strong> • Duration: <strong>{r.duration}s</strong> • Cooldown:{' '}
                          <strong>{r.cooldown_seconds}s</strong>
                        </td>

                        <td style={{ padding: '14px 12px' }}>
                          <span
                            data-testid={`rule-status-${r.id}`}
                            style={{
                              padding: '3px 9px',
                              borderRadius: '999px',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              backgroundColor: r.enabled ? '#ECFDF5' : '#F1F5F9',
                              color: r.enabled ? '#059669' : '#64748B',
                              border: r.enabled ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
                            }}
                          >
                            {r.enabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </td>

                        {canManageAlerts && (
                          <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                data-testid={`btn-toggle-rule-${r.id}`}
                                onClick={() => handleToggleRuleStatus(r)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--dash-border)',
                                  backgroundColor: '#FFFFFF',
                                  color: r.enabled ? '#D97706' : '#059669',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <Power size={12} />
                                <span>{r.enabled ? 'Tắt' : 'Bật'}</span>
                              </button>

                              <button
                                type="button"
                                data-testid={`btn-edit-rule-${r.id}`}
                                onClick={() => openEditRuleModal(r)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
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
                                <Edit3 size={12} />
                                <span>Sửa</span>
                              </button>

                              <button
                                type="button"
                                data-testid={`btn-delete-rule-${r.id}`}
                                onClick={() => handleDeleteRule(r)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #FECACA',
                                  backgroundColor: '#FEF2F2',
                                  color: '#DC2626',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Side Drawer: Alert Detail */}
      <AlertDetailDrawer
        alertItem={selectedAlert}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        canManageAlerts={canManageAlerts}
        currentOrgName={currentOrg?.name || ''}
        onAlertUpdated={(updated) => {
          setSelectedAlert(updated);
          fetchAlertsAndSummary(true);
        }}
      />

      {/* Modal: Create / Edit Alert Rule */}
      <AlertRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        editingRule={editingRule}
        clusters={envList}
        metadata={ruleMetadata}
        canManageRules={canManageAlerts}
        onSaved={(_, isEdit) => {
          showToast(
            'success',
            isEdit ? 'Đã cập nhật quy tắc cảnh báo thành công!' : 'Đã tạo quy tắc cảnh báo mới thành công!'
          );
          fetchRulesAndMetadata();
          fetchAlertsAndSummary(true);
        }}
      />
    </div>
  );
};

export default AlertsPage;
