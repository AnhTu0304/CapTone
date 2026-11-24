import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

const formatDateTimeVn = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const TIME_RANGE_OPTIONS = [
  { id: '7D', label: '7 Ngày' },
  { id: '1M', label: '30 Ngày' },
  { id: '3M', label: '3 Tháng' },
  { id: '6M', label: '6 Tháng' },
  { id: '1Y', label: '1 Năm' },
];

export const ReportsPage = () => {
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
    ? currentEnv?.cluster || currentEnv?.name || 'Cụm hiện tại'
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
        setReportError(
          'Từ chối truy cập (403 Forbidden): Bạn không thuộc tổ chức này hoặc chưa được cấp quyền truy cập theo chính sách RBAC.'
        );
      } else {
        setReportError(err?.message || 'Không thể kết nối máy chủ để tải dữ liệu báo cáo.');
      }
      setReportData(null);
    } finally {
      if (slaSeq === slaRequestSeqRef.current) {
        setIsLoadingReport(false);
      }
    }
  }, [currentOrg?.id, scopeIds.activeEnvId, scopeIds.activeClusterId, effectiveService, timeRange]);

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
        return '7 Ngày gần nhất';
      case '1M':
        return '30 Ngày gần nhất';
      case '3M':
        return '90 Ngày gần nhất (3 Tháng)';
      case '1Y':
        return 'Cả năm (12 Tháng)';
      default:
        return '6 Tháng qua';
    }
  }, [timeRange]);

  const activeScopeLabel = useMemo(() => {
    const baseLabel =
      reportScope === 'ALL' || !hasHeaderCluster
        ? 'Phạm vi: Toàn công ty'
        : `Cụm K8s: ${headerClusterName}`;
    return effectiveService !== 'ALL' ? `${baseLabel} · Dịch vụ: ${effectiveService}` : baseLabel;
  }, [reportScope, hasHeaderCluster, headerClusterName, effectiveService]);

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
      toastError(
        'Quyền hạn bị giới hạn (RBAC): Chỉ Quản trị viên hoặc Kỹ sư DevOps mới có quyền xuất báo cáo kỹ thuật.',
        'Từ Chối Xuất File'
      );
    }
    return false;
  };

  const handleExportCsv = () => {
    if (!guardExport()) return;
    const headers = [
      'Mã Action',
      'Thời Điểm Tạo',
      'Dịch Vụ / Target',
      'Loại Sự Cố',
      'Mức Độ',
      'Hành Động',
      'Chế Độ',
      'AI / Người Thực Hiện',
      'Người Duyệt HITL',
      'Kết Quả',
      'Thời Lượng (giây)',
      'Nguyên Nhân Lỗi / Hủy',
    ];
    const rows = actionRows.map((row) => [
      row.shortId,
      formatDateTimeVn(row.createdAt),
      row.targetName,
      row.incidentType,
      row.severity,
      row.actionCode,
      row.executionMode,
      row.actorName,
      row.approverName || '—',
      row.executionStatus,
      row.durationSeconds ?? '—',
      row.failureReason || 'Thành công',
    ]);
    exportToCsv(`bao-cao-sla-action-${timeRange.toLowerCase()}.csv`, headers, rows);
    setExportNotice('CSV');
    toastSuccess('Báo cáo truy vết Action & SLA đã được tải xuống dưới định dạng CSV!', 'Xuất Báo Cáo CSV');
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleExportJson = () => {
    if (!guardExport()) return;
    exportToJson(`bao-cao-sla-action-${timeRange.toLowerCase()}.json`, {
      title: 'Báo Cáo SLA & Vận Hành',
      organization: currentOrg?.name || 'Tổ chức mặc định',
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
    toastSuccess('Báo cáo SLA & Action Analytics đã được tải xuống dưới định dạng JSON!', 'Xuất Báo Cáo JSON');
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handlePrintPdf = () => {
    if (!guardExport()) return;
    setExportNotice('PDF');
    toastSuccess('Đang mở hộp thoại In / Lưu PDF của trình duyệt...', 'In / Lưu PDF');
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
        `Đã tải xuống file Excel (${result.sheetNames.length} sheet biểu đồ/dữ liệu): ${result.fileName}`,
        'Xuất Excel Thành Công'
      );
      setTimeout(() => setExportNotice(null), 4500);
    } catch (err) {
      console.warn('[ReportsPage] Lỗi xuất báo cáo Excel:', err);
      toastError(err?.message || 'Không thể tạo file Excel (.xlsx).', 'Lỗi Xuất Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const kpiCards = [
    {
      label: 'ĐỘ SẴN SÀNG (SLA UPTIME)',
      value: actualUptimeStr,
      color: '#0284C7',
      sub: isSlaCompliant ? `Đạt cam kết SLA (${targetSlaStr})` : `Dưới mục tiêu SLA (${targetSlaStr})`,
      subColor: isSlaCompliant ? '#059669' : '#DC2626',
      Icon: isSlaCompliant ? TrendingUp : AlertTriangle,
    },
    {
      label: 'THỜI GIAN PHỤC HỒI (MTTR)',
      value: `${reportData?.summary?.mttrAvgSeconds ?? 0} giây`,
      color: '#059669',
      sub: `Thực thi TB: ${actionSummary.avgExecutionSeconds}s · Trung vị ${actionSummary.medianExecutionSeconds}s`,
      subColor: '#059669',
    },
    {
      label: 'TỔNG TÁC VỤ TỰ PHỤC HỒI',
      value: `${actionSummary.totalActions.toLocaleString('vi-VN')} action`,
      color: '#2563EB',
      sub: `${actionSummary.succeededActions.toLocaleString('vi-VN')} OK · ${actionSummary.failedActions.toLocaleString('vi-VN')} Lỗi · ${actionSummary.cancelledActions.toLocaleString('vi-VN')} Hủy`,
      subColor: '#475569',
    },
    {
      label: 'TỶ LỆ ĐẠT & TỰ TRỊ',
      value: `${actionSummary.successRate}% đạt`,
      color: '#8B5CF6',
      sub: `AI Auto: ${actionSummary.autoSucceeded}/${actionSummary.autoActionsTotal} · HITL: ${actionSummary.manualSucceeded}/${actionSummary.manualActionsTotal}`,
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
              BÁO CÁO SLA &amp; VẬN HÀNH ({timeRangeLabel})
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#64748B' }}>
            Mã số: <strong style={{ fontFamily: 'var(--font-mono)' }}>{documentId}</strong>
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
                Báo Cáo SLA &amp; Vận Hành
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
                  <span>{reportScope === 'CLUSTER' ? `Cụm K8s: ${headerClusterName}` : 'Phạm vi: Toàn công ty'}</span>
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
                  <span>{`Dịch vụ: ${effectiveService}`}</span>
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Tổng quan cam kết SLA, mức độ sự cố, nguyên nhân lỗi &amp; hiệu suất từng microservice
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
            <span>{isLoadingReport ? 'Đang tải...' : 'Làm mới'}</span>
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
            <span>Xuất Excel</span>
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
              <span>Xuất Báo Cáo</span>
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
                  aria-label="Xuất Excel (.xlsx) theo biểu đồ"
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
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>Xuất Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleExportCsv();
                    setIsExportMenuOpen(false);
                  }}
                  aria-label="Xuất CSV"
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
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>Xuất CSV</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleExportJson();
                    setIsExportMenuOpen(false);
                  }}
                  aria-label="Xuất JSON"
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
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>Xuất JSON</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handlePrintPdf();
                    setIsExportMenuOpen(false);
                  }}
                  aria-label="In / Lưu PDF"
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
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>In / Lưu PDF</span>
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
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>Cụm K8s:</span>
              <div
                role="group"
                aria-label="Phạm vi cụm Kubernetes"
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
                  Toàn công ty
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>Dịch Vụ:</span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Layers size={13} color="#64748B" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
              <select
                aria-label="Lọc theo dịch vụ K8s"
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
                <option value="ALL">Tất cả dịch vụ ({uniqueServices.length})</option>
                {uniqueServices.map((svc) => (
                  <option key={svc} value={svc}>
                    Dịch vụ: {svc}
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
              <span>Đặt lại lọc</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>Kỳ Báo Cáo:</span>
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
                {opt.label}
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
          Đã xử lý xuất báo cáo định dạng {exportNotice}.
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
            Thử lại
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
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
              Bảng Phân Tích SLA Theo Từng Dịch Vụ Microservice
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Số liệu đối chiếu trực tiếp theo từng dịch vụ của {currentOrg?.name || 'tổ chức'}
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            Chu kỳ: {timeRangeLabel}
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
            <div style={{ position: 'relative', width: '240px' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
              />
              <input
                type="text"
                value={searchService}
                onChange={(e) => setSearchService(e.target.value)}
                placeholder="Tìm theo tên dịch vụ..."
                aria-label="Tìm theo tên dịch vụ"
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
                  aria-label="Xóa từ khóa tìm kiếm"
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
                aria-label="Lọc theo phân cấp Tier"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">Tất Cả Phân Cấp</option>
                <option value="Tier 1">Tier 1 (Tối quan trọng)</option>
                <option value="Tier 2">Tier 2 (Nghiệp vụ cốt lõi)</option>
                <option value="Tier 3">Tier 3 (Dịch vụ phụ trợ)</option>
              </select>
            </div>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            Hiển thị {filteredServices.length} / {activeServices.length} dịch vụ
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Dịch Vụ &amp; Phân Hạng</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Cam Kết SLA</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Uptime Thực Tế</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Thực Thi TB</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Action (OK / Lỗi / Hủy)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Trạng Thái Tuân Thủ</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                    {activeServices.length === 0
                      ? `${currentOrg?.name || 'Tổ chức'} chưa ghi nhận dịch vụ hoặc hành động phục hồi nào.`
                      : 'Không tìm thấy dịch vụ vi mô nào phù hợp với điều kiện lọc.'}
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
                          title={`Xem chi tiết ${svc.name}`}
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
                        <span style={{ color: '#059669', fontWeight: 700 }}>{svc.incidentsResolved ?? 0} OK</span>
                        {' / '}
                        <span style={{ color: '#DC2626' }}>{svc.actionsFailed ?? 0} Lỗi</span>
                        {' / '}
                        <span style={{ color: '#D97706' }}>{svc.actionsCancelled ?? 0} Hủy</span>
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
                          <span>{svc.status || (hasErr ? 'Cảnh báo lỗi' : 'Đạt SLA')}</span>
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
