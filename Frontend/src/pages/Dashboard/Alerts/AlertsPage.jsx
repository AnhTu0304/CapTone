import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  Check,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../../context/AuthContext';
import { useDebounce } from '../../../hooks/useDebounce';
import { alertService, DEFAULT_RULE_METADATA, formatAlertApiError } from '../../../services/alertService';
import { getAuthToken, getWsTicket, API_BASE_URL } from '../../../services/apiClient';
import i18n from '../../../i18n';
import AlertHistoryPage from './AlertHistoryPage';
import AlertDetailDrawer, {
  OPERATOR_SYMBOLS,
  getSeverityStyle,
  getStatusStyle,
  formatDateTime,
} from './AlertDetailDrawer';
import AlertRuleModal from './AlertRuleModal';

const TIME_RANGE_PRESETS = [
  { key: 'ALL', labelKey: 'alerts.timePresets.ALL', ms: null },
  { key: '15m', labelKey: 'alerts.timePresets.15m', ms: 15 * 60 * 1000 },
  { key: '1h', labelKey: 'alerts.timePresets.1h', ms: 60 * 60 * 1000 },
  { key: '6h', labelKey: 'alerts.timePresets.6h', ms: 6 * 60 * 60 * 1000 },
  { key: '24h', labelKey: 'alerts.timePresets.24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', labelKey: 'alerts.timePresets.7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', labelKey: 'alerts.timePresets.30d', ms: 30 * 24 * 60 * 60 * 1000 },
];

export const AlertsPage = ({ initialTab = "EVENTS", onNavigate }) => {
  const { t } = useTranslation('dashHealing');
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

  // Active View Tab: 'EVENTS' | 'HISTORY' | 'RULES'
  const [activeTab, setActiveTab] = useState(initialTab || 'EVENTS');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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

  // ==========================================
  // [S5][PBI22 Task 4.1 & 4.2] Alert History State
  // ==========================================
  const [historyAlerts, setHistoryAlerts] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
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

  // History Row Actions & Mark-as-Resolved Confirmation Modal
  const [historyActionLoadingId, setHistoryActionLoadingId] = useState(null);
  const [resolveModalTarget, setResolveModalTarget] = useState(null);
  const [resolveModalNote, setResolveModalNote] = useState('');
  const [resolveNoteError, setResolveNoteError] = useState(null);
  const [resolveModalApiError, setResolveModalApiError] = useState(null);
  const [isSubmittingModalResolve, setIsSubmittingModalResolve] = useState(false);


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
        setRulesError(err.message || i18n.t('dashHealing:alerts.toast.loadRulesError'));
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
        const timePreset = TIME_RANGE_PRESETS.find((preset) => preset.key === timeRangeFilter);
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
          setAlertsError(err.message || i18n.t('dashHealing:alerts.toast.loadAlertsError'));
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

  // Fetch Alert History & Summary [S5][PBI22 Task 4.2 & 4.4]
  const fetchAlertHistoryAndSummary = useCallback(async () => {
    if (historyTimePreset === 'CUSTOM' && historyStartDate && historyEndDate) {
      const startMs = new Date(historyStartDate).getTime();
      const endMs = new Date(historyEndDate).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs > endMs) {
        setHistoryDateValidationError(i18n.t('dashHealing:alerts.toast.invalidDateRange'));
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
        setHistoryError(formatAlertApiError(err, i18n.t('dashHealing:alerts.toast.loadHistoryError')));
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

  const handleHistoryQuickAcknowledge = async (item) => {
    if (!canManageAlerts || !item || item.status !== 'ACTIVE' || historyActionLoadingId) return;
    setHistoryActionLoadingId(item.id);
    try {
      await alertService.acknowledgeAlert(
        item.id,
        t('alerts.toast.historyAckNote'),
        item.version
      );
      showToast('success', t('alerts.toast.historyAckSuccess', { name: item.rule_name || item.title }));
      fetchAlertHistoryAndSummary();
      fetchAlertsAndSummary(true);
    } catch (err) {
      showToast('error', formatAlertApiError(err, t('alerts.toast.historyAckError')));
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
      setResolveNoteError(t('alerts.toast.noteTooLong'));
      return;
    }
    setResolveNoteError(null);
    setResolveModalApiError(null);
    setIsSubmittingModalResolve(true);

    try {
      const noteText =
        resolveModalNote && resolveModalNote.trim()
          ? resolveModalNote.trim()
          : t('alerts.toast.historyResolveNote');
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
      showToast('success', t('alerts.toast.historyResolveSuccess', { name: resolveModalTarget.rule_name || resolveModalTarget.title }));
      fetchAlertHistoryAndSummary();
      fetchAlertsAndSummary(true);
    } catch (err) {
      setResolveModalApiError(formatAlertApiError(err, t('alerts.toast.historyResolveError')));
    } finally {
      setIsSubmittingModalResolve(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchAlertHistoryAndSummary();
    }
  }, [activeTab, fetchAlertHistoryAndSummary]);


  // Single Polling Loop + Window Focus Refresh (with proper unmount cleanup)
  useEffect(() => {
    if (!autoRefresh) return undefined;

    const intervalId = setInterval(() => {
      fetchAlertsAndSummary(true);
    }, 60000);

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
    let cancelled = false;
    (async () => {
      try {
        const token = getAuthToken();
        if (!token) return;
        const ticket = await getWsTicket();
        if (!ticket || cancelled) return;
        const wsBase = API_BASE_URL.replace(/^http/i, 'ws');
        const params = new URLSearchParams();
        params.set('ticket', ticket);
        if (currentOrg?.id) params.set('organization_id', currentOrg.id);
        const wsUrl = `${wsBase}/telemetry/ws?${params.toString()}`;
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
    })();

    return () => {
      cancelled = true;
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
        t('alerts.toast.evalSuccess', {
          evaluated: res?.rules_evaluated ?? 0,
          triggered: res?.alerts_triggered ?? 0,
          resolved: res?.alerts_resolved ?? 0,
        })
      );
    } catch (err) {
      showToast('error', err.message || t('alerts.toast.evalError'));
    } finally {
      setIsEvaluating(false);
    }
  };

  // Quick Acknowledge from table row
  const handleQuickAcknowledge = async (alertItem, e) => {
    e.stopPropagation();
    if (!canManageAlerts || alertItem.status !== 'ACTIVE') return;
    try {
      await alertService.acknowledgeAlert(alertItem.id, t('alerts.toast.quickAckNote'));
      showToast('success', t('alerts.toast.quickAckSuccess', { name: alertItem.rule_name }));
      await fetchAlertsAndSummary(true);
    } catch (err) {
      showToast('error', err.message || t('alerts.toast.quickAckError'));
    }
  };

  // Quick Resolve from table row
  const handleQuickResolve = async (alertItem, e) => {
    e.stopPropagation();
    if (!canManageAlerts || alertItem.status === 'RESOLVED') return;
    try {
      await alertService.resolveAlert(alertItem.id, t('alerts.toast.quickResolveNote'));
      showToast('success', t('alerts.toast.quickResolveSuccess', { name: alertItem.rule_name }));
      await fetchAlertsAndSummary(true);
    } catch (err) {
      showToast('error', err.message || t('alerts.toast.quickResolveError'));
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
        t('alerts.toast.toggleSuccess', {
          state: nextEnabled ? t('alerts.toast.stateEnabled') : t('alerts.toast.stateDisabled'),
          name: ruleItem.name,
        })
      );
    } catch (err) {
      showToast('error', err.message || t('alerts.toast.toggleError'));
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleItem) => {
    if (!canManageAlerts) return;
    try {
      await alertService.deleteAlertRule(ruleItem.id);
      setRules((prev) => prev.filter((r) => r.id !== ruleItem.id));
      showToast('success', t('alerts.toast.deleteSuccess', { name: ruleItem.name }));
    } catch (err) {
      showToast('error', err.message || t('alerts.toast.deleteError'));
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

  // If History tab is requested, render the dedicated AlertHistoryPage without shared layout
  if (initialTab === 'HISTORY' || activeTab === 'HISTORY') {
    return <AlertHistoryPage onNavigate={onNavigate} />;
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={20} color="#DC2626" />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {t('alerts.header.title')}
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px', margin: 0 }}>
              {t('alerts.header.subtitle')}
            </p>
          </div>
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
            <span>{autoRefresh ? t('alerts.header.autoOn') : t('alerts.header.autoOff')}</span>
          </button>

          <button
            type="button"
            data-testid="btn-refresh-alerts"
            onClick={() => {
              fetchAlertsAndSummary(false);
              fetchRulesAndMetadata();
              if (activeTab === 'HISTORY') {
                fetchAlertHistoryAndSummary();
              }
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
            <span>{t('common.refresh')}</span>
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
                <span>{isEvaluating ? t('alerts.header.scanning') : t('alerts.header.evaluateNow')}</span>
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
                <span>{t('alerts.header.createRule')}</span>
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
              {t('alerts.kpi.activeTitle')}
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
            {t('alerts.kpi.activeSub')} <strong>{summary.total_acknowledged}</strong>
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
              {t('alerts.kpi.criticalTitle')}
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
            {t('alerts.kpi.criticalSub')}
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
              {t('alerts.kpi.warningTitle')}
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
            {t('alerts.kpi.warningSub')}
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
              {t('alerts.kpi.infoTitle')}
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
            {t('alerts.kpi.infoSub')}
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
              {t('alerts.kpi.resolvedTitle')}
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
            {t('alerts.kpi.resolvedSub')}
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
            {t('alerts.tabs.events', { count: pagination.total })}
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
            {t('alerts.tabs.rules', { count: rules.length })}
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
                  placeholder={t('alerts.filters.searchPlaceholder')}
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
                <option value="ALL">{t('alerts.filters.allSeverities')}</option>
                <option value="CRITICAL">{t('alerts.filters.sevCritical')}</option>
                <option value="WARNING">{t('alerts.filters.sevWarning')}</option>
                <option value="INFO">{t('alerts.filters.sevInfo')}</option>
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
                <option value="ALL">{t('alerts.filters.allStatuses')}</option>
                <option value="ACTIVE">{t('alerts.filters.statusActive')}</option>
                <option value="ACKNOWLEDGED">{t('alerts.filters.statusAck')}</option>
                <option value="RESOLVED">{t('alerts.filters.statusResolved')}</option>
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
                <option value="ALL">{t('alerts.filters.allClusters')}</option>
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
                <option value="ALL">{t('alerts.filters.allRules')}</option>
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
                <option value="ALL">{t('alerts.filters.allResourceTypes')}</option>
                <option value="node">{t('alerts.filters.resNode')}</option>
                <option value="pod">{t('alerts.filters.resPod')}</option>
                <option value="service">{t('alerts.filters.resService')}</option>
                <option value="container">{t('alerts.filters.resContainer')}</option>
                <option value="deployment">{t('alerts.filters.resDeployment')}</option>
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
                {TIME_RANGE_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {t(preset.labelKey)}
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
                  <span>{t('common.resetFilters')}</span>
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
                  {t('alerts.states.loading')}
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
                  {t('alerts.states.errorTitle')}
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
                  {t('alerts.states.retryBtn')}
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
                  {t('alerts.states.emptyTitle')}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', maxWidth: '480px' }}>
                  {t('alerts.states.emptySub')}
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
                        <th style={{ padding: '12px 16px' }}>{t('alerts.table.colName')}</th>
                        <th style={{ padding: '12px 12px' }}>{t('alerts.table.colSeverity')}</th>
                        <th style={{ padding: '12px 12px' }}>{t('alerts.table.colStatus')}</th>
                        <th style={{ padding: '12px 12px' }}>{t('alerts.table.colResource')}</th>
                        <th style={{ padding: '12px 12px' }}>{t('alerts.table.colCluster')}</th>
                        <th style={{ padding: '12px 12px' }}>{t('alerts.table.colValue')}</th>
                        <th style={{ padding: '12px 12px' }}>{t('alerts.table.colFirstSeen')}</th>
                        <th style={{ padding: '12px 12px' }}>{t('alerts.table.colLastSeen')}</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('alerts.table.colActions')}</th>
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
                                {item.cluster_name || item.cluster_id || t('common.orgWide')}
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
                                {t('alerts.table.thresholdPrefix')} {opSym} {item.threshold_value ?? '—'}
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
                                    title={t('alerts.table.ackTitle')}
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
                                    {t('alerts.table.ackBtn')}
                                  </button>
                                )}

                                {canManageAlerts && item.status !== 'RESOLVED' && (
                                  <button
                                    type="button"
                                    data-testid={`btn-row-resolve-${item.id}`}
                                    onClick={(e) => handleQuickResolve(item, e)}
                                    title={t('alerts.table.resolveTitle')}
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
                                    {t('alerts.table.resolveBtn')}
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
                                  <span>{t('common.details')}</span>
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
                      {t('alerts.pagination.showingPrefix')} <strong>{pagination.page}</strong> / <strong>{pagination.total_pages || 1}</strong> {t('alerts.pagination.totalPrefix')}{' '}
                      <strong>{pagination.total}</strong> {t('alerts.pagination.totalSuffix')}
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
                      <option value={10}>{t('common.perPage', { count: 10 })}</option>
                      <option value={20}>{t('common.perPage', { count: 20 })}</option>
                      <option value={50}>{t('common.perPage', { count: 50 })}</option>
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
                      <span>{t('common.prev')}</span>
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
                      <span>{t('common.next')}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* TAB 2: ALERT HISTORY (PBI22 Task 4.1, 4.2, 4.3 & 4.4) */}
      {activeTab === 'HISTORY' && (
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
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>{t('alertHistory.kpi.total')}</div>
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
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#DC2626' }}>{t('alertHistory.kpi.critical')}</div>
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
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D97706' }}>{t('alertHistory.kpi.warning')}</div>
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
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1D4ED8' }}>{t('alertHistory.kpi.info')}</div>
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
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#EA580C' }}>{t('alertHistory.kpi.active')}</div>
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
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>{t('alertHistory.kpi.resolved')}</div>
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
                  placeholder={t('alertHistory.filters.searchPlaceholder')}
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
                <option value="ALL">{t('alertHistory.filters.allSeverities')}</option>
                <option value="CRITICAL">{t('alerts.filters.sevCritical')}</option>
                <option value="WARNING">{t('alerts.filters.sevWarning')}</option>
                <option value="INFO">{t('alerts.filters.sevInfo')}</option>
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
                <option value="ALL">{t('alertHistory.filters.allStatuses')}</option>
                <option value="ACTIVE">{t('alertHistory.filters.statusActive')}</option>
                <option value="ACKNOWLEDGED">{t('alertHistory.filters.statusAck')}</option>
                <option value="RESOLVED">{t('alertHistory.filters.statusResolved')}</option>
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
                <option value="ALL">{t('alertHistory.filters.allClusters')}</option>
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
                <option value="ALL">{t('alertHistory.filters.allResourceTypes')}</option>
                <option value="node">{t('alertHistory.filters.resNode')}</option>
                <option value="pod">{t('alertHistory.filters.resPod')}</option>
                <option value="service">{t('alertHistory.filters.resService')}</option>
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
                {TIME_RANGE_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {t(preset.labelKey)}
                  </option>
                ))}
                <option value="CUSTOM">{t('alerts.timePresets.CUSTOM')}</option>
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
                <option value="first_detected_at">{t('alertHistory.filters.sortFirstDetected')}</option>
                <option value="last_seen_at">{t('alertHistory.filters.sortLastSeen')}</option>
                <option value="resolved_at">{t('alertHistory.filters.sortResolvedAt')}</option>
                <option value="severity">{t('alertHistory.filters.sortSeverity')}</option>
                <option value="status">{t('alertHistory.filters.sortStatus')}</option>
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
                <option value="desc">{t('alertHistory.filters.sortDesc')}</option>
                <option value="asc">{t('alertHistory.filters.sortAsc')}</option>
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
                {t('common.resetFilters')}
              </button>
            </div>

            {/* Custom Date Pickers */}
            {historyTimePreset === 'CUSTOM' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', fontWeight: 600 }}>
                    {t('alertHistory.filters.fromDate')}
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
                    {t('alertHistory.filters.toDate')}
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
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('alertHistory.states.loading')}</div>
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
                  {t('common.retry')}
                </button>
              </div>
            ) : historyAlerts.length === 0 ? (
              <div
                data-testid="history-empty-state"
                style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}
              >
                <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                  {t('alertHistory.states.emptyTitle')}
                </div>
                <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
                  {t('alertHistory.states.emptySub')}
                </div>
              </div>
            ) : (
              <div data-testid="history-table-scroll" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colAlert')}
                      </th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colSeverity')}
                      </th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colStatus')}
                      </th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colResourceCluster')}
                      </th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colValueThreshold')}
                      </th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colDuration')}
                      </th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colFirstDetected')}
                      </th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colAssignee')}
                      </th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                        {t('alertHistory.table.colResolved')}
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--dash-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem', textAlign: 'right' }}>
                        {t('alertHistory.table.colActions')}
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
                      const assigneeLabel = item.assignee_name || item.assignee_email || t('alertHistory.table.unassigned');

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
                              {item.rule_name || item.title || t('alertDetail.header.defaultName')}
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
                              {item.cluster_name || t('common.orgWide')}
                            </div>
                          </td>

                          <td style={{ padding: '14px 14px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                              {hasObserved ? `${item.observed_value}${unitStr}` : '—'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                              {t('alerts.table.thresholdPrefix')} {hasThreshold ? `${item.threshold_value}${unitStr}` : '—'}
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
                                  {item.resolver_name || item.resolver_email || item.details?.resolved_by || t('alertHistory.table.systemResolver')}
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
                                {t('common.details')}
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
                                  {t('alertHistory.table.ackBtn')}
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
                                  {t('alertHistory.table.resolveBtn')}
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
                  {t('common.page')} <strong>{historyPagination.page}</strong> / <strong>{historyPagination.total_pages || 1}</strong> {t('alertHistory.pagination.totalPrefix')} <strong>{historyPagination.total}</strong> {t('alertHistory.pagination.totalSuffix')}
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
                    <option value={10}>{t('common.perPage', { count: 10 })}</option>
                    <option value={20}>{t('common.perPage', { count: 20 })}</option>
                    <option value={50}>{t('common.perPage', { count: 50 })}</option>
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
                    {t('common.prevShort')}
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
                    {t('common.nextShort')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
                {t('alerts.rules.title')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                {t('alerts.rules.subtitle')}
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
                <span>{t('alerts.rules.addBtn')}</span>
              </button>
            )}
          </div>

          {isLoadingRules ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--dash-text-secondary)' }}>
              {t('alerts.rules.loading')}
            </div>
          ) : rulesError ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#DC2626' }}>
              {rulesError}
            </div>
          ) : rules.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--dash-text-secondary)' }}>
              {t('alerts.rules.empty')}
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
                    <th style={{ padding: '12px 16px' }}>{t('alerts.rules.colName')}</th>
                    <th style={{ padding: '12px 12px' }}>{t('alerts.rules.colMetric')}</th>
                    <th style={{ padding: '12px 12px' }}>{t('alerts.rules.colCondition')}</th>
                    <th style={{ padding: '12px 12px' }}>{t('alerts.rules.colSeverity')}</th>
                    <th style={{ padding: '12px 12px' }}>{t('alerts.rules.colWindow')}</th>
                    <th style={{ padding: '12px 12px' }}>{t('alerts.rules.colStatus')}</th>
                    {canManageAlerts && <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('alerts.rules.colActions')}</th>}
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
                          {t('alerts.rules.windowLabel')} <strong>{r.evaluation_window}</strong> • {t('alerts.rules.durationLabel')} <strong>{r.duration}s</strong> • {t('alerts.rules.cooldownLabel')}{' '}
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
                            {r.enabled ? t('alerts.rules.enabledBadge') : t('alerts.rules.disabledBadge')}
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
                                <span>{r.enabled ? t('alerts.rules.turnOff') : t('alerts.rules.turnOn')}</span>
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
                                <span>{t('alerts.rules.edit')}</span>
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
        currentOrgId={currentOrg?.id || ''}
        currentOrgName={currentOrg?.name || ''}
        onAlertUpdated={(updated) => {
          setSelectedAlert(updated);
          fetchAlertsAndSummary(true);
          if (activeTab === 'HISTORY') {
            fetchAlertHistoryAndSummary();
          }
        }}
      />

      {/* Modal: Mark as Resolved Confirmation Dialog (PBI22 Task 4.4) */}
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
                <span>{t('alerts.resolveModal.title')}</span>
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
                  {resolveModalTarget.rule_name || resolveModalTarget.title || t('alerts.resolveModal.defaultAlertName')}
                </div>
                <div style={{ color: 'var(--dash-text-secondary)', marginTop: '4px', fontSize: '0.75rem' }}>
                  {t('alerts.resolveModal.resourceLabel')} <strong>{resolveModalTarget.resource_id || '—'}</strong> ({resolveModalTarget.resource_type || '—'}) • {t('alerts.resolveModal.clusterLabel')}{' '}
                  <strong>{resolveModalTarget.cluster_name || t('common.orgWide')}</strong>
                </div>
              </div>

              <div>
                <label
                  htmlFor="resolve-modal-note-input"
                  style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}
                >
                  {t('alerts.resolveModal.noteLabel')} <span style={{ fontWeight: 500, color: 'var(--dash-text-muted)' }}>{t('alerts.resolveModal.noteLimit')}</span>
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
                  placeholder={t('alerts.resolveModal.notePlaceholder')}
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
                  <span>{t('alerts.resolveModal.auditHint')}</span>
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
                {t('common.cancelAction')}
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
                <span>{isSubmittingModalResolve ? t('alerts.resolveModal.updating') : t('alerts.resolveModal.confirmBtn')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

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
            isEdit ? t('alerts.toast.ruleUpdated') : t('alerts.toast.ruleCreated')
          );
          fetchRulesAndMetadata();
          fetchAlertsAndSummary(true);
        }}
      />
    </div>
  );
};

export default AlertsPage;
