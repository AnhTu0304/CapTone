import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { exportToCsv, exportToJson } from '../../../utils/exportUtils';
import { exportReportsToExcel } from '../../../utils/reportExcelExport';
import {
  fetchOrganizationSLAReport,
  fetchActionAnalyticsReport,
} from '../../../services/reportService';
import { aiService } from '../../../services/aiService';
import {
  extractActiveK8sServices,
  isExcludedSystemService,
} from '../../../utils/k8sServiceFilter';
import IncidentSeverityBreakdown from '../../../components/dashboard/IncidentSeverityBreakdown';
import ActionFailureReasonsChart from '../../../components/dashboard/ActionFailureReasonsChart';
import ExcelExportModal from '../../../components/dashboard/ExcelExportModal';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
  FileJson,
  Printer,
  Search,
  Filter,
  X,
  Lock,
  ArrowUpRight,
  Download,
  ChevronDown,
  Building2,
  Server,
  Layers,
  RotateCcw,
} from 'lucide-react';

const formatDateTimeLocale = (iso, intlLocale) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const TIME_RANGE_OPTIONS = [
  { id: '7D', labelKey: 'reports.timeRanges.7D' },
  { id: '1M', labelKey: 'reports.timeRanges.1M' },
  { id: '3M', labelKey: 'reports.timeRanges.3M' },
  { id: '6M', labelKey: 'reports.timeRanges.6M' },
  { id: '1Y', labelKey: 'reports.timeRanges.1Y' },
];

export const ReportsPage = () => {
  const { t, i18n } = useTranslation('dashAdmin');
  const intlLocale = getIntlLocale(i18n.language);
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh, currentUserRole, onNavigate } =
    useDashboard();
  const { success: toastSuccess, error: toastError } = useToast();
  const isViewer = currentUserRole === 'VIEWER';
  const canExport = !isViewer;

  const [timeRange, setTimeRange] = useState('1M');
  const [reportScope, setReportScope] = useState('CLUSTER');
  const [selectedService, setSelectedService] = useState('ALL');
  const [exportNotice, setExportNotice] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [liveWorkloads, setLiveWorkloads] = useState([]);
  const [hasLoadedWorkloads, setHasLoadedWorkloads] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Service SLA Table filters
  const [searchService, setSearchService] = useState('');
  const [selectedTier, setSelectedTier] = useState('ALL');

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const exportMenuRef = useRef(null);
  const slaRequestSeqRef = useRef(0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const headerClusterId =
    currentEnv?.clusterId || (currentEnv?.cluster ? currentEnv?.id : null) || null;
  const headerEnvId =
    currentEnv?.environment_id || (!currentEnv?.cluster ? currentEnv?.id : null) || null;
  const hasHeaderCluster = Boolean(headerClusterId || headerEnvId);
  const headerClusterName = hasHeaderCluster
    ? currentEnv?.cluster || currentEnv?.name || t('reports.currentClusterFallback')
    : null;

  const scopeIds = useMemo(() => {
    const isClusterScope = reportScope === 'CLUSTER' && hasHeaderCluster;
    return {
      activeClusterId: isClusterScope ? headerClusterId : null,
      activeEnvId: isClusterScope ? headerEnvId : null,
    };
  }, [reportScope, hasHeaderCluster, headerClusterId, headerEnvId]);

  const currentScopeTuple = `${currentOrg?.id || ''}|${scopeIds.activeEnvId || ''}|${scopeIds.activeClusterId || ''}|${reportScope}`;
  const prevScopeTupleRef = useRef(currentScopeTuple);
  const isScopeTransition = prevScopeTupleRef.current !== currentScopeTuple;
  const effectiveService = isScopeTransition ? 'ALL' : selectedService;

  useEffect(() => {
    if (prevScopeTupleRef.current !== currentScopeTuple) {
      prevScopeTupleRef.current = currentScopeTuple;
      if (selectedService !== 'ALL') {
        setSelectedService('ALL');
      }
    }
  }, [currentScopeTuple, selectedService]);

  const loadReport = useCallback(async () => {
    if (!currentOrg?.id) {
      setReportData(null);
      return;
    }

    const slaSeq = ++slaRequestSeqRef.current;
    setIsLoadingReport(true);
    setReportError(null);

    try {
      const data = await fetchOrganizationSLAReport({
        organizationId: currentOrg.id,
        environmentId: scopeIds.activeEnvId,
        clusterId: scopeIds.activeClusterId,
        serviceName: effectiveService,
        timeRange,
      });

      if (slaSeq !== slaRequestSeqRef.current) return;
      if (data) setReportData(data);
    } catch (err) {
      if (slaSeq !== slaRequestSeqRef.current) return;
      console.warn('[ReportsPage] Lỗi khi tải dữ liệu báo cáo:', err);
      if (err?.status === 403 || err?.message?.includes('403') || err?.message?.includes('Từ chối')) {
        setReportError(t('reports.errors.forbidden'));
      } else {
        setReportError(err?.message || t('reports.errors.connectFailed'));
      }
      setReportData(null);
    } finally {
      if (slaSeq === slaRequestSeqRef.current) {
        setIsLoadingReport(false);
      }
    }
  }, [currentOrg?.id, scopeIds.activeEnvId, scopeIds.activeClusterId, effectiveService, timeRange, t]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    let isMounted = true;
    const orgId =
      currentOrg?.id && !String(currentOrg.id).startsWith('sandbox-') && currentOrg.id !== 'org-acme'
        ? currentOrg.id
        : undefined;
    aiService
      .getWorkloads(scopeIds.activeClusterId || undefined, orgId)
      .then((workloads) => {
        if (isMounted && Array.isArray(workloads)) {
          setLiveWorkloads(workloads);
          setHasLoadedWorkloads(true);
        }
      })
      .catch(() => {
        if (isMounted) setHasLoadedWorkloads(false);
      });
    return () => {
      isMounted = false;
    };
  }, [scopeIds.activeClusterId, currentOrg?.id]);

  const activeServices = useMemo(() => reportData?.services || [], [reportData?.services]);
  const actionAnalytics = reportData?.actionAnalytics || null;
  const actionSummary = actionAnalytics?.summary || {
    totalActions: 0,
    succeededActions: 0,
    failedActions: 0,
    cancelledActions: 0,
    successRate: 0,
    autoActionsTotal: 0,
    autoSucceeded: 0,
    manualActionsTotal: 0,
    manualSucceeded: 0,
    avgExecutionSeconds: 0,
    medianExecutionSeconds: 0,
    verifiedCount: 0,
    verifiedSuccessRate: 0,
    totalIncidents: 0,
  };
  const actionRows = actionAnalytics?.actionHistory || [];

  const uniqueServices = useMemo(() => {
    if (hasLoadedWorkloads) {
      return extractActiveK8sServices(liveWorkloads);
    }
    const svcSet = new Set();
    const normalizeName = (n) => {
      if (!n) return '';
      const s = String(n).trim();
      const l = s.toLowerCase();
      if (l === 'otel-collector-opentelemetry-collector') return 'opentelemetry-collector';
      if (l === 'prometheus-kube-state-metrics') return 'kube-state-metrics';
      if (l === 'prometheus-kube-prometheus-operator') return 'kube-prometheus-stack-operator';
      if (l === 'ecommerce-store') return 'ecommerce-store-app';
      if (/^mongodb-\d+$/i.test(l)) return 'mongodb';
      return s;
    };
    const candidates = [
      ...(reportData?.availableServices || []),
      ...(actionAnalytics?.filterOptions?.services || []),
      ...(activeServices || []).map((s) => s?.name),
    ];
    candidates.forEach((name) => {
      const clean = normalizeName(name);
      if (clean && !isExcludedSystemService(clean)) svcSet.add(clean);
    });
    if (selectedService && selectedService !== 'ALL') {
      const cleanSel = normalizeName(selectedService);
      if (cleanSel && !isExcludedSystemService(cleanSel)) svcSet.add(cleanSel);
    }
    return Array.from(svcSet).sort((a, b) => a.localeCompare(b));
  }, [
    hasLoadedWorkloads,
    liveWorkloads,
    reportData?.availableServices,
    actionAnalytics?.filterOptions?.services,
    activeServices,
    selectedService,
  ]);

  const filteredServices = useMemo(() => {
    return activeServices.filter((svc) => {
      const matchTier = selectedTier === 'ALL' || (svc.tier && svc.tier.includes(selectedTier));
      const matchSearch =
        !searchService ||
        (svc.name && svc.name.toLowerCase().includes(searchService.toLowerCase().trim()));
      return matchTier && matchSearch;
    });
  }, [activeServices, selectedTier, searchService]);

  const actualUptimeStr = reportData?.summary?.actualUptime || '100.00%';
  const targetSlaStr = reportData?.summary?.targetSla || '99.90%';
  const isSlaCompliant = (parseFloat(actualUptimeStr) || 100) >= (parseFloat(targetSlaStr) || 99.9);

  const documentId = useMemo(() => {
    const orgCode = (currentOrg?.name || 'SME')
      .substring(0, 4)
      .toUpperCase()
      .replace(/[^A-Z]/g, 'S');
    const d = new Date();
    return `SLA-RPT-${orgCode}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }, [currentOrg?.name]);

  const timeRangeLabel = useMemo(() => {
    switch (timeRange) {
      case '7D':
        return t('reports.timeRangeLabels.7D');
      case '1M':
        return t('reports.timeRangeLabels.1M');
      case '3M':
        return t('reports.timeRangeLabels.3M');
      case '1Y':
        return t('reports.timeRangeLabels.1Y');
      default:
        return t('reports.timeRangeLabels.6M');
    }
  }, [timeRange, t]);

  const activeScopeLabel = useMemo(() => {
    const baseLabel =
      reportScope === 'ALL' || !hasHeaderCluster
        ? t('reports.scopeAllCompany')
        : t('reports.scopeCluster', { name: headerClusterName });
    return effectiveService !== 'ALL'
      ? t('reports.scopeWithService', { base: baseLabel, service: effectiveService })
      : baseLabel;
  }, [reportScope, hasHeaderCluster, headerClusterName, effectiveService, t]);

  const hasAnyGlobalFilter =
    (reportScope === 'ALL' && hasHeaderCluster) || effectiveService !== 'ALL' || timeRange !== '1M';

  const handleResetAllFilters = () => {
    if (hasHeaderCluster) setReportScope('CLUSTER');
    setSelectedService('ALL');
    setTimeRange('1M');
    setSearchService('');
    setSelectedTier('ALL');
  };

  const guardExport = () => {
    if (canExport) return true;
    if (toastError) {
      toastError(t('reports.errors.rbacDeniedMsg'), t('reports.errors.rbacDeniedTitle'));
    }
    return false;
  };

  const handleExportCsv = () => {
    if (!guardExport()) return;
    const headers = [
      t('reports.exportToasts.csvHeaders.actionId'),
      t('reports.exportToasts.csvHeaders.createdAt'),
      t('reports.exportToasts.csvHeaders.target'),
      t('reports.exportToasts.csvHeaders.incidentType'),
      t('reports.exportToasts.csvHeaders.severity'),
      t('reports.exportToasts.csvHeaders.action'),
      t('reports.exportToasts.csvHeaders.mode'),
      t('reports.exportToasts.csvHeaders.actor'),
      t('reports.exportToasts.csvHeaders.approver'),
      t('reports.exportToasts.csvHeaders.result'),
      t('reports.exportToasts.csvHeaders.duration'),
      t('reports.exportToasts.csvHeaders.failureReason'),
    ];
    const rows = actionRows.map((row) => [
      row.shortId,
      formatDateTimeLocale(row.createdAt, intlLocale),
      row.targetName,
      row.incidentType,
      row.severity,
      row.actionCode,
      row.executionMode,
      row.actorName,
      row.approverName || '—',
      row.executionStatus,
      row.durationSeconds ?? '—',
      row.failureReason || t('reports.exportToasts.csvResultSuccess'),
    ]);
    exportToCsv(`bao-cao-sla-action-${timeRange.toLowerCase()}.csv`, headers, rows);
    setExportNotice('CSV');
    toastSuccess(t('reports.exportToasts.csvSuccess'), t('reports.exportToasts.csvTitle'));
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleExportJson = () => {
    if (!guardExport()) return;
    exportToJson(`bao-cao-sla-action-${timeRange.toLowerCase()}.json`, {
      title: t('reports.exportToasts.jsonPayloadTitle'),
      organization: currentOrg?.name || t('reports.defaultOrgFallback'),
      organizationId: currentOrg?.id,
      clusterId: scopeIds.activeClusterId,
      environmentId: scopeIds.activeEnvId,
      clusterName: scopeIds.activeClusterId ? headerClusterName : null,
      serviceName: effectiveService !== 'ALL' ? effectiveService : null,
      scope: reportScope === 'CLUSTER' && hasHeaderCluster ? 'CLUSTER' : 'ALL',
      scopeLabel: activeScopeLabel,
      timeRange,
      exportTimestamp: new Date().toISOString(),
      summary: reportData?.summary || {},
      services: activeServices,
      incidentBreakdown: reportData?.incidentBreakdown || {},
      actionAnalytics: actionAnalytics || {},
    });
    setExportNotice('JSON');
    toastSuccess(t('reports.exportToasts.jsonSuccess'), t('reports.exportToasts.jsonTitle'));
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handlePrintPdf = () => {
    if (!guardExport()) return;
    setExportNotice('PDF');
    toastSuccess(t('reports.exportToasts.pdfSuccess'), t('reports.exportToasts.pdfTitle'));
    setTimeout(() => window.print(), 250);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleOpenExcelModal = () => {
    if (!guardExport()) return;
    setIsExportMenuOpen(false);
    setIsExcelModalOpen(true);
  };

  const handleConfirmExcelExport = async ({
    selectedSections,
    includeChartImages,
    actionScopeMode,
    fileName,
  }) => {
    if (!canExport) return;
    setIsExportingExcel(true);
    try {
      let rowsForExcel = actionRows;
      if (
        selectedSections.includes('action_history') &&
        actionScopeMode === 'UP_TO_500' &&
        currentOrg?.id
      ) {
        const fullRes = await fetchActionAnalyticsReport({
          organizationId: currentOrg.id,
          environmentId: scopeIds.activeEnvId,
          clusterId: scopeIds.activeClusterId,
          serviceName: effectiveService,
          timeRange,
          page: 1,
          limit: 500,
        });
        if (fullRes?.actionHistory) rowsForExcel = fullRes.actionHistory;
      }

      const hasServiceFilter =
        effectiveService !== 'ALL' || Boolean(searchService.trim()) || selectedTier !== 'ALL';

      const result = await exportReportsToExcel({
        selectedSections,
        reportData,
        actionAnalytics,
        actionRows: rowsForExcel,
        services: hasServiceFilter ? filteredServices : activeServices,
        meta: {
          orgName: currentOrg?.name || 'SME Retail Enterprise',
          scopeLabel: activeScopeLabel,
          timeRange,
          timeRangeLabel,
          documentId,
        },
        includeChartImages,
        fileName,
      });

      setIsExcelModalOpen(false);
      setExportNotice('EXCEL');
      toastSuccess(
        t('reports.exportToasts.excelSuccess', {
          sheets: result.sheetNames.length,
          fileName: result.fileName,
        }),
        t('reports.exportToasts.excelTitle')
      );
      setTimeout(() => setExportNotice(null), 4500);
    } catch (err) {
      console.warn('[ReportsPage] Lỗi xuất báo cáo Excel:', err);
      toastError(err?.message || t('reports.errors.excelFailed'), t('reports.errors.excelErrorTitle'));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const kpiCards = [
    {
      label: t('reports.kpis.uptimeLabel'),
      value: actualUptimeStr,
      color: '#0284C7',
      sub: isSlaCompliant
        ? t('reports.kpis.uptimeCompliant', { target: targetSlaStr })
        : t('reports.kpis.uptimeNonCompliant', { target: targetSlaStr }),
      subColor: isSlaCompliant ? '#059669' : '#DC2626',
      Icon: isSlaCompliant ? TrendingUp : AlertTriangle,
    },
    {
      label: t('reports.kpis.mttrLabel'),
      value: t('reports.kpis.mttrValue', { seconds: reportData?.summary?.mttrAvgSeconds ?? 0 }),
      color: '#059669',
      sub: t('reports.kpis.mttrSub', {
        avg: actionSummary.avgExecutionSeconds,
        median: actionSummary.medianExecutionSeconds,
      }),
      subColor: '#059669',
    },
    {
      label: t('reports.kpis.actionsLabel'),
      value: t('reports.kpis.actionsValue', { count: actionSummary.totalActions.toLocaleString(intlLocale) }),
      color: '#2563EB',
      sub: t('reports.kpis.actionsSub', {
        ok: actionSummary.succeededActions.toLocaleString(intlLocale),
        failed: actionSummary.failedActions.toLocaleString(intlLocale),
        cancelled: actionSummary.cancelledActions.toLocaleString(intlLocale),
      }),
      subColor: '#475569',
    },
    {
      label: t('reports.kpis.successRateLabel'),
      value: t('reports.kpis.successRateValue', { rate: actionSummary.successRate }),
      color: '#8B5CF6',
      sub: t('reports.kpis.successRateSub', {
        autoOk: actionSummary.autoSucceeded,
        autoTotal: actionSummary.autoActionsTotal,
        manualOk: actionSummary.manualSucceeded,
        manualTotal: actionSummary.manualActionsTotal,
      }),
      subColor: '#475569',
    },
  ];

  return (
    <div className="dashboard-reports-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '48px' }}>
      {/* Print Header */}
      <div className="print-only" style={{ borderBottom: '2px solid #0F172A', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
              {currentOrg?.name || 'SME Retail Enterprise'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px', fontWeight: 600 }}>
              {t('reports.printTitle', { range: timeRangeLabel })}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#64748B' }}>
            {t('reports.documentIdLabel')} <strong style={{ fontFamily: 'var(--font-mono)' }}>{documentId}</strong>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
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
            }}
          >
            <BarChart3 size={19} color="#059669" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                {t('reports.title')}
              </h1>
              {currentOrg?.name && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 9px',
                    borderRadius: '9999px',
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    color: '#047857',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <Building2 size={12} />
                  <span>{currentOrg.name}</span>
                </span>
              )}
              {hasHeaderCluster && headerClusterName && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 9px',
                    borderRadius: '9999px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    color: '#475569',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <Server size={12} />
                  <span>
                    {reportScope === 'CLUSTER'
                      ? t('reports.scopeCluster', { name: headerClusterName })
                      : t('reports.scopeAllCompany')}
                  </span>
                </span>
              )}
              {effectiveService !== 'ALL' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 9px',
                    borderRadius: '9999px',
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    color: '#047857',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <Layers size={12} />
                  <span>{t('reports.serviceBadge', { name: effectiveService })}</span>
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('reports.subtitle')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              triggerRefresh();
              loadReport();
            }}
            disabled={isLoadingReport || isRefreshing}
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#334155',
              cursor: isLoadingReport || isRefreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isLoadingReport || isRefreshing ? 'animate-spin' : ''} />
            <span>{isLoadingReport ? t('reports.loading') : t('reports.refresh')}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenExcelModal}
            disabled={!canExport || isExportingExcel}
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#047857',
              cursor: !canExport ? 'not-allowed' : 'pointer',
            }}
          >
            <FileSpreadsheet size={14} />
            <span>{t('reports.exportExcelBtn')}</span>
          </button>

          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((v) => !v)}
              aria-expanded={isExportMenuOpen}
              aria-haspopup="true"
              style={{
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                backgroundColor: canExport ? '#059669' : '#94A3B8',
                border: '1px solid transparent',
                borderRadius: '10px',
                color: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {canExport ? <Download size={14} /> : <Lock size={14} />}
              <span>{t('reports.exportMenuBtn')}</span>
              <ChevronDown size={14} />
            </button>

            {isExportMenuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: '230px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
                  padding: '6px',
                  zIndex: 50,
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleOpenExcelModal}
                  aria-label={t('reports.menu.excelAria')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <FileSpreadsheet size={16} color="#047857" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>{t('reports.menu.excel')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleExportCsv();
                    setIsExportMenuOpen(false);
                  }}
                  aria-label={t('reports.menu.csvAria')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <FileSpreadsheet size={16} color="#059669" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>{t('reports.menu.csv')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleExportJson();
                    setIsExportMenuOpen(false);
                  }}
                  aria-label={t('reports.menu.jsonAria')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <FileJson size={16} color="#0284C7" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>{t('reports.menu.json')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handlePrintPdf();
                    setIsExportMenuOpen(false);
                  }}
                  aria-label={t('reports.menu.pdfAria')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Printer size={16} color="#475569" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>{t('reports.menu.pdf')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {hasHeaderCluster && headerClusterName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>{t('reports.filters.clusterLabel')}</span>
              <div
                role="group"
                aria-label={t('reports.filters.clusterScopeAria')}
                style={{
                  display: 'inline-flex',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '3px',
                  height: '34px',
                  alignItems: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <button
                  type="button"
                  onClick={() => setReportScope('CLUSTER')}
                  aria-pressed={reportScope === 'CLUSTER'}
                  style={{
                    height: '28px',
                    padding: '0 11px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: reportScope === 'CLUSTER' ? '#FFFFFF' : 'transparent',
                    color: reportScope === 'CLUSTER' ? '#047857' : '#64748B',
                    boxShadow: reportScope === 'CLUSTER' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Server size={12} />
                  <span>{headerClusterName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportScope('ALL')}
                  aria-pressed={reportScope === 'ALL'}
                  style={{
                    height: '28px',
                    padding: '0 11px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: reportScope === 'ALL' ? '#FFFFFF' : 'transparent',
                    color: reportScope === 'ALL' ? '#0F172A' : '#64748B',
                    boxShadow: reportScope === 'ALL' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t('reports.filters.allCompany')}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>{t('reports.filters.serviceLabel')}</span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Layers size={13} color="#64748B" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
              <select
                aria-label={t('reports.filters.serviceAria')}
                value={effectiveService}
                onChange={(e) => setSelectedService(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 12px 0 30px',
                  fontSize: '0.78rem',
                  border: effectiveService !== 'ALL' ? '1px solid #059669' : '1px solid #E2E8F0',
                  borderRadius: '10px',
                  backgroundColor: effectiveService !== 'ALL' ? '#ECFDF5' : '#F8FAFC',
                  color: effectiveService !== 'ALL' ? '#047857' : '#0F172A',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '240px',
                }}
              >
                <option value="ALL">{t('reports.filters.allServices', { count: uniqueServices.length })}</option>
                {uniqueServices.map((svc) => (
                  <option key={svc} value={svc}>
                    {t('reports.filters.serviceOption', { name: svc })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasAnyGlobalFilter && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '34px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                color: '#475569',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} />
              <span>{t('reports.filters.reset')}</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>{t('reports.filters.periodLabel')}</span>
          <div
            style={{
              display: 'inline-flex',
              gap: '3px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '3px',
            }}
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeRange(opt.id)}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: timeRange === opt.id ? '#059669' : 'transparent',
                  color: timeRange === opt.id ? '#FFFFFF' : '#64748B',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {exportNotice && (
        <div
          className="no-print"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {t('reports.exportNotice', { format: exportNotice })}
        </div>
      )}

      {reportError && (
        <div
          role="alert"
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <AlertTriangle size={18} />
            <span>{reportError}</span>
          </div>
          <button
            type="button"
            onClick={loadReport}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #FCA5A5',
              backgroundColor: '#FFFFFF',
              color: '#B91C1C',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('reports.errors.retry')}
          </button>
        </div>
      )}

      {/* 1. 4 THẺ KPI RÚT GỌN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="dash-card"
            style={{
              padding: '16px 18px',
              borderTop: `3px solid ${card.color}`,
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
              {card.label}
            </div>
            <div
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: card.color,
                margin: '6px 0 4px 0',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: card.subColor,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {card.Icon && <card.Icon size={13} />}
              <span>{card.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. BÁO CÁO 2: CƠ CẤU SỰ CỐ & NGUYÊN NHÂN THẤT BẠI (2 CỘT GỌN) */}
      <div className="dash-grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px', alignItems: 'stretch' }}>
        <IncidentSeverityBreakdown breakdown={reportData?.incidentBreakdown} />
        <ActionFailureReasonsChart
          reasons={actionAnalytics?.failureReasons}
          failedTotal={actionSummary.failedActions}
          cancelledTotal={actionSummary.cancelledActions}
        />
      </div>

      {/* 4. BÁO CÁO 3: BẢNG PHÂN TÍCH SLA THEO TỪNG DỊCH VỤ MICROSERVICE */}
      <div
        className="dash-card"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              {t('reports.serviceTable.title')}
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('reports.serviceTable.subtitle', { org: currentOrg?.name || t('reports.orgFallbackShort') })}
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            {t('reports.serviceTable.period', { label: timeRangeLabel })}
          </span>
        </div>

        <div
          className="no-print"
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="dash-search-box" style={{ position: 'relative', width: '240px', maxWidth: '100%' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
              />
              <input
                type="text"
                value={searchService}
                onChange={(e) => setSearchService(e.target.value)}
                placeholder={t('reports.serviceTable.searchPlaceholder')}
                aria-label={t('reports.serviceTable.searchAria')}
                style={{
                  width: '100%',
                  padding: '6px 28px 6px 30px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {searchService && (
                <button
                  type="button"
                  onClick={() => setSearchService('')}
                  aria-label={t('reports.serviceTable.clearSearchAria')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#64748B',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="#64748B" />
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                aria-label={t('reports.serviceTable.tierAria')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">{t('reports.serviceTable.tierAll')}</option>
                <option value="Tier 1">{t('reports.serviceTable.tier1')}</option>
                <option value="Tier 2">{t('reports.serviceTable.tier2')}</option>
                <option value="Tier 3">{t('reports.serviceTable.tier3')}</option>
              </select>
            </div>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            {t('reports.serviceTable.showing', { shown: filteredServices.length, total: activeServices.length })}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>{t('reports.serviceTable.colService')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>{t('reports.serviceTable.colTargetSla')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>{t('reports.serviceTable.colActualUptime')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>{t('reports.serviceTable.colAvgExec')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>{t('reports.serviceTable.colActions')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>{t('reports.serviceTable.colCompliance')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                    {activeServices.length === 0
                      ? t('reports.serviceTable.emptyNoData', { org: currentOrg?.name || t('reports.orgFallbackTitle') })
                      : t('reports.serviceTable.emptyNoMatch')}
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => {
                  const hasErr = (svc.actionsFailed || 0) > 0;
                  return (
                    <tr key={svc.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div
                          onClick={() => onNavigate && onNavigate('/dashboard/workloads')}
                          title={t('reports.serviceTable.viewServiceTitle', { name: svc.name })}
                          style={{
                            fontWeight: 700,
                            color: '#0F172A',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>{svc.name}</span>
                          <ArrowUpRight size={13} color="#64748B" />
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                          {svc.tier || 'Tier 2'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: '#475569' }}>
                        {svc.targetSla || '99.90%'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                        {svc.actualUptime || '100.00%'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                        {svc.mttrAvg || '0s'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        <span style={{ color: '#059669', fontWeight: 700 }}>
                          {svc.incidentsResolved ?? 0} {t('reports.serviceTable.okUnit')}
                        </span>
                        {' / '}
                        <span style={{ color: '#DC2626' }}>
                          {svc.actionsFailed ?? 0} {t('reports.serviceTable.failedUnit')}
                        </span>
                        {' / '}
                        <span style={{ color: '#D97706' }}>
                          {svc.actionsCancelled ?? 0} {t('reports.serviceTable.cancelledUnit')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: hasErr ? '#FEF2F2' : '#ECFDF5',
                            color: hasErr ? '#B91C1C' : '#047857',
                            border: hasErr ? '1px solid #FECACA' : '1px solid #A7F3D0',
                          }}
                        >
                          {!hasErr && <CheckCircle2 size={12} />}
                          <span>
                            {svc.status || (hasErr ? t('reports.serviceTable.statusWarning') : t('reports.serviceTable.statusPass'))}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onConfirmExport={handleConfirmExcelExport}
        isExporting={isExportingExcel}
        meta={{
          orgName: currentOrg?.name || 'SME Retail Enterprise',
          scopeLabel: activeScopeLabel,
          timeRange,
          timeRangeLabel,
        }}
        counts={{
          slaTrendPoints: reportData?.monthlyTrends?.length || 0,
          actionTrendPoints: actionAnalytics?.trends?.length || 0,
          incidentTypesCount: Object.keys(reportData?.incidentBreakdown?.byType || {}).length,
          actorsCount: actionAnalytics?.byActor?.length || 0,
          matrixCellsCount: actionAnalytics?.errorActionMatrix?.length || 0,
          failureReasonsCount: actionAnalytics?.failureReasons?.length || 0,
          currentActionRows: actionRows.length,
          totalMatchedActions: actionAnalytics?.pagination?.total || actionRows.length,
          servicesCount: (effectiveService !== 'ALL' || Boolean(searchService.trim()) || selectedTier !== 'ALL'
            ? filteredServices
            : activeServices
          ).length,
        }}
      />
    </div>
  );
};

export default ReportsPage;
