import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { exportToCsv, exportToJson } from '../../../utils/exportUtils';
import { exportReportsToExcel } from '../../../utils/reportExcelExport';
import {
  fetchOrganizationSLAReport,
  fetchActionAnalyticsReport,
} from '../../../services/reportService';
import SLACostSavingsChart from '../../../components/dashboard/SLACostSavingsChart';
import IncidentSeverityBreakdown from '../../../components/dashboard/IncidentSeverityBreakdown';
import ActionActorBreakdownChart from '../../../components/dashboard/ActionActorBreakdownChart';
import ErrorActionMatrixChart from '../../../components/dashboard/ErrorActionMatrixChart';
import ActionFailureReasonsChart from '../../../components/dashboard/ActionFailureReasonsChart';
import ExcelExportModal from '../../../components/dashboard/ExcelExportModal';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  PieChart,
  Cpu,
  UserCheck,
  Activity,
  Building2,
  Server,
  Layers,
  RotateCcw,
} from 'lucide-react';

const INCIDENT_TYPE_META = {
  CPU_OVERLOAD: {
    label: 'Quá tải CPU',
    color: '#3B82F6',
    bgLight: '#EFF6FF',
    actionText: 'Tự cân bằng tải & Co giãn Pod (Scale / Restart Pod)',
  },
  OOM: {
    label: 'Tràn RAM (OOM)',
    color: '#8B5CF6',
    bgLight: '#F5F3FF',
    actionText: 'Tự cô lập & Thay thế Pod tức thì (Replace Pod)',
  },
  HIGH_LATENCY: {
    label: 'Độ trễ cao',
    color: '#F59E0B',
    bgLight: '#FEF3C7',
    actionText: 'Co giãn bản sao & Điều phối lưu lượng (Scale Replicas)',
  },
  HTTP_5XX_SPIKE: {
    label: 'Lỗi HTTP 5XX',
    color: '#F43F5E',
    bgLight: '#FFE4E6',
    actionText: 'Ngắt mạch & Khởi động lại / Rollback Deployment',
  },
  DISK_FULL: {
    label: 'Đầy dung lượng ổ đĩa (Disk Full)',
    color: '#0D9488',
    bgLight: '#F0FDFA',
    actionText: 'Dọn dẹp tệp tạm & Cô lập workload (Cleanup / Restart)',
  },
  TRAFFIC_OVERLOAD: {
    label: 'Quá tải lưu lượng',
    color: '#6366F1',
    bgLight: '#EEF2FF',
    actionText: 'Tự động tăng bản sao Pod theo lưu lượng',
  },
};

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

export const ReportsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh, currentUserRole, onNavigate } =
    useDashboard();
  const { success: toastSuccess, error: toastError } = useToast();
  const isViewer = currentUserRole === 'VIEWER';
  const canExport = !isViewer;

  const [timeRange, setTimeRange] = useState('1M');
  const [reportScope, setReportScope] = useState('CLUSTER'); // Mặc định đồng bộ theo cụm K8s trên TopHeader
  const [selectedService, setSelectedService] = useState('ALL');
  const [exportNotice, setExportNotice] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Service SLA Table filters
  const [searchService, setSearchService] = useState('');
  const [selectedTier, setSelectedTier] = useState('ALL');

  // Action Traceability filters & paginated data
  const [actionFilters, setActionFilters] = useState({
    actor: 'ALL',
    status: 'ALL',
    incidentType: 'ALL',
    actionCode: 'ALL',
    search: '',
    page: 1,
    limit: 25,
  });
  const [actionHistoryState, setActionHistoryState] = useState(null);
  const [isLoadingActions, setIsLoadingActions] = useState(false);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const exportMenuRef = useRef(null);
  const traceabilityRef = useRef(null);

  const actionFiltersRef = useRef(actionFilters);
  actionFiltersRef.current = actionFilters;
  const lastScopeKeyRef = useRef(null);
  const slaRequestSeqRef = useRef(0);
  const actionRequestSeqRef = useRef(0);
  const prevActionFiltersRef = useRef(actionFilters);
  const skipFilterFetchRef = useRef(false);

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
      setActionHistoryState(null);
      return;
    }

    const scopeKey = `${currentOrg.id}|${scopeIds.activeEnvId || ''}|${scopeIds.activeClusterId || ''}|${effectiveService}|${timeRange}`;
    const scopeChanged = lastScopeKeyRef.current !== null && lastScopeKeyRef.current !== scopeKey;
    lastScopeKeyRef.current = scopeKey;

    let effectiveFilters = actionFiltersRef.current;
    if (scopeChanged && effectiveFilters.page !== 1) {
      skipFilterFetchRef.current = true;
      effectiveFilters = { ...effectiveFilters, page: 1 };
      setActionFilters((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }

    const hasFilterOrCustomPage =
      effectiveFilters.actor !== 'ALL' ||
      effectiveFilters.status !== 'ALL' ||
      effectiveFilters.incidentType !== 'ALL' ||
      effectiveFilters.actionCode !== 'ALL' ||
      Boolean(effectiveFilters.search) ||
      effectiveFilters.page > 1;

    const slaSeq = ++slaRequestSeqRef.current;
    const reqSeq = ++actionRequestSeqRef.current;
    setIsLoadingReport(true);
    if (hasFilterOrCustomPage) {
      setIsLoadingActions(true);
    }
    setReportError(null);

    try {
      const [data, filteredData] = await Promise.all([
        fetchOrganizationSLAReport({
          organizationId: currentOrg.id,
          environmentId: scopeIds.activeEnvId,
          clusterId: scopeIds.activeClusterId,
          serviceName: effectiveService,
          timeRange,
        }),
        hasFilterOrCustomPage
          ? fetchActionAnalyticsReport({
              organizationId: currentOrg.id,
              environmentId: scopeIds.activeEnvId,
              clusterId: scopeIds.activeClusterId,
              serviceName: effectiveService,
              timeRange,
              actor: effectiveFilters.actor,
              status: effectiveFilters.status,
              incidentType: effectiveFilters.incidentType,
              actionCode: effectiveFilters.actionCode,
              search: effectiveFilters.search,
              page: effectiveFilters.page,
              limit: effectiveFilters.limit,
            })
          : Promise.resolve(null),
      ]);

      if (slaSeq !== slaRequestSeqRef.current) return;

      if (data) {
        setReportData(data);
        if (reqSeq === actionRequestSeqRef.current) {
          setActionHistoryState(
            hasFilterOrCustomPage ? filteredData || data.actionAnalytics || null : data.actionAnalytics || null
          );
        }
      }
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
      setActionHistoryState(null);
    } finally {
      if (slaSeq === slaRequestSeqRef.current) {
        setIsLoadingReport(false);
      }
      if (hasFilterOrCustomPage && reqSeq === actionRequestSeqRef.current) {
        setIsLoadingActions(false);
      }
    }
  }, [currentOrg?.id, scopeIds.activeEnvId, scopeIds.activeClusterId, effectiveService, timeRange]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Fetch filtered / paginated action history when interactive filters change
  const loadFilteredActions = useCallback(
    async (filters) => {
      if (!currentOrg?.id) return;
      const reqSeq = ++actionRequestSeqRef.current;
      setIsLoadingActions(true);
      try {
        const res = await fetchActionAnalyticsReport({
          organizationId: currentOrg.id,
          environmentId: scopeIds.activeEnvId,
          clusterId: scopeIds.activeClusterId,
          serviceName: effectiveService,
          timeRange,
          actor: filters.actor,
          status: filters.status,
          incidentType: filters.incidentType,
          actionCode: filters.actionCode,
          search: filters.search,
          page: filters.page,
          limit: filters.limit,
        });
        if (res && reqSeq === actionRequestSeqRef.current) {
          setActionHistoryState(res);
        }
      } catch (err) {
        console.warn('[ReportsPage] Lỗi lọc lịch sử action:', err);
      } finally {
        if (reqSeq === actionRequestSeqRef.current) {
          setIsLoadingActions(false);
        }
      }
    },
    [currentOrg?.id, scopeIds.activeEnvId, scopeIds.activeClusterId, effectiveService, timeRange]
  );

  // Trigger action-analytics fetch when user updates filters (debounce only search typing)
  useEffect(() => {
    const prev = prevActionFiltersRef.current;
    prevActionFiltersRef.current = actionFilters;

    if (prev === actionFilters) {
      return;
    }

    if (skipFilterFetchRef.current) {
      skipFilterFetchRef.current = false;
      return;
    }

    if (prev.search !== actionFilters.search) {
      const timer = setTimeout(() => {
        loadFilteredActions(actionFilters);
      }, 250);
      return () => clearTimeout(timer);
    }

    loadFilteredActions(actionFilters);
  }, [actionFilters, loadFilteredActions]);

  const activeServices = useMemo(() => reportData?.services || [], [reportData?.services]);
  const actionAnalytics = actionHistoryState || reportData?.actionAnalytics || null;
  const actionSummary = actionAnalytics?.summary || {
    totalActions: 0,
    succeededActions: 0,
    failedActions: 0,
    cancelledActions: 0,
    pendingActions: 0,
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
    incidentsWithAction: 0,
    incidentsWithoutAction: 0,
  };
  const actionRows = actionAnalytics?.actionHistory || [];
  const actionPagination = actionAnalytics?.pagination || {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  };
  const filterOptions = actionAnalytics?.filterOptions || {
    actors: [],
    incidentTypes: [],
    actionCodes: [],
    services: [],
  };

  // Danh sách Dịch vụ K8s thực tế trong phạm vi Cụm / Toàn công ty hiện tại
  const uniqueServices = useMemo(() => {
    const svcSet = new Set();
    const candidates = [
      ...(reportData?.availableServices || []),
      ...(filterOptions?.services || []),
      ...(reportData?.actionAnalytics?.filterOptions?.services || []),
      ...(activeServices || []).map((s) => s?.name),
    ];
    candidates.forEach((name) => {
      const trimmed = String(name || '').trim();
      if (trimmed) svcSet.add(trimmed);
    });
    if (selectedService && selectedService !== 'ALL' && String(selectedService).trim()) {
      svcSet.add(String(selectedService).trim());
    }
    return Array.from(svcSet).sort((a, b) => a.localeCompare(b));
  }, [
    reportData?.availableServices,
    filterOptions?.services,
    reportData?.actionAnalytics?.filterOptions?.services,
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
  const actualUptimeVal = parseFloat(actualUptimeStr) || 100;
  const targetSlaVal = parseFloat(targetSlaStr) || 99.9;
  const isSlaCompliant = actualUptimeVal >= targetSlaVal;

  // Cơ cấu phân loại các nhóm sự cố hoàn toàn động từ DB (bao gồm DISK_FULL, TRAFFIC_OVERLOAD...)
  const incidentBreakdownList = useMemo(() => {
    const rawMap = reportData?.incidentBreakdown?.byType || {};
    const entries = Object.entries(rawMap);

    const knownKeys = Object.keys(INCIDENT_TYPE_META);
    const items = [];
    let otherCount = 0;
    let total = 0;

    for (const [k, rawVal] of entries) {
      const count = Number(rawVal) || 0;
      total += count;
      if (knownKeys.includes(k)) {
        const meta = INCIDENT_TYPE_META[k];
        items.push({
          key: k,
          label: meta.label,
          color: meta.color,
          bgLight: meta.bgLight,
          actionText: meta.actionText,
          count,
        });
      } else {
        otherCount += count;
      }
    }

    if (otherCount > 0) {
      items.push({
        key: 'OTHER',
        label: 'Sự cố khác',
        color: '#64748B',
        bgLight: '#F1F5F9',
        actionText: 'Phân tích RCA & Kích hoạt chính sách tự phục hồi phù hợp',
        count: otherCount,
      });
    }

    items.sort((a, b) => b.count - a.count);

    const circumference = 2 * Math.PI * 68;
    let accumulatedPercent = 0;

    return {
      total,
      circumference,
      items: items.map((item) => {
        const percent = total > 0 ? parseFloat(((item.count / total) * 100).toFixed(1)) : 0;
        const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
        const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
        accumulatedPercent += percent;
        return {
          ...item,
          percent,
          strokeDasharray,
          strokeDashoffset,
        };
      }),
    };
  }, [reportData?.incidentBreakdown?.byType]);

  const documentId = useMemo(() => {
    const orgCode = (currentOrg?.name || 'SME')
      .substring(0, 4)
      .toUpperCase()
      .replace(/[^A-Z]/g, 'S');
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return `SLA-RPT-${orgCode}-${dateStr}`;
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

  const scrollToTraceability = () => {
    if (traceabilityRef.current && typeof traceabilityRef.current.scrollIntoView === 'function') {
      traceabilityRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleExportCsv = () => {
    if (!canExport) {
      if (toastError) {
        toastError(
          'Quyền hạn bị giới hạn (RBAC): Chỉ Quản trị viên hoặc Kỹ sư DevOps mới có quyền xuất báo cáo kỹ thuật.',
          'Từ Chối Xuất File'
        );
      }
      return;
    }
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
    toastSuccess(
      'Báo cáo truy vết Action & SLA đã được tải xuống dưới định dạng CSV!',
      'Xuất Báo Cáo CSV'
    );
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleExportJson = () => {
    if (!canExport) {
      if (toastError) {
        toastError(
          'Quyền hạn bị giới hạn (RBAC): Chỉ Quản trị viên hoặc Kỹ sư DevOps mới có quyền xuất báo cáo kỹ thuật.',
          'Từ Chối Xuất File'
        );
      }
      return;
    }
    const exportPayload = {
      title: 'Báo Cáo SLA, Sự Cố & Hành Động Tự Phục Hồi Doanh Nghiệp',
      organization: currentOrg?.name || 'Tổ chức mặc định',
      organizationId: currentOrg?.id,
      environment: currentEnv?.name || 'Môi trường mặc định',
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
    };
    exportToJson(`bao-cao-sla-action-${timeRange.toLowerCase()}.json`, exportPayload);
    setExportNotice('JSON');
    toastSuccess(
      'Báo cáo SLA & Action Analytics đã được tải xuống dưới định dạng JSON!',
      'Xuất Báo Cáo JSON'
    );
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handlePrintPdf = () => {
    if (!canExport) {
      if (toastError) {
        toastError(
          'Quyền hạn bị giới hạn (RBAC): Chỉ Quản trị viên hoặc Kỹ sư DevOps mới có quyền xuất báo cáo kỹ thuật.',
          'Từ Chối Xuất File'
        );
      }
      return;
    }
    setExportNotice('PDF');
    toastSuccess('Đang mở hộp thoại In / Lưu PDF của trình duyệt...', 'In / Lưu PDF');
    setTimeout(() => {
      window.print();
    }, 250);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleOpenExcelModal = () => {
    if (!canExport) {
      if (toastError) {
        toastError(
          'Quyền hạn bị giới hạn (RBAC): Chỉ Quản trị viên hoặc Kỹ sư DevOps mới có quyền xuất báo cáo Excel.',
          'Từ Chối Xuất File'
        );
      }
      return;
    }
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
          actor: actionFilters.actor,
          status: actionFilters.status,
          incidentType: actionFilters.incidentType,
          actionCode: actionFilters.actionCode,
          search: actionFilters.search,
          page: 1,
          limit: 500,
        });
        if (fullRes?.actionHistory) {
          rowsForExcel = fullRes.actionHistory;
        }
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
      if (toastSuccess) {
        toastSuccess(
          `Đã tải xuống file Excel (${result.sheetNames.length} sheet biểu đồ/dữ liệu): ${result.fileName}`,
          'Xuất Excel Thành Công'
        );
      }
      setTimeout(() => setExportNotice(null), 4500);
    } catch (err) {
      console.warn('[ReportsPage] Lỗi xuất báo cáo Excel:', err);
      if (toastError) {
        toastError(err?.message || 'Không thể tạo file Excel (.xlsx).', 'Lỗi Xuất Excel');
      }
    } finally {
      setIsExportingExcel(false);
    }
  };

  const activeScopeLabel = useMemo(() => {
    const baseLabel =
      reportScope === 'ALL' || !hasHeaderCluster
        ? 'Toàn công ty'
        : `Cụm K8s: ${headerClusterName}`;
    return effectiveService !== 'ALL'
      ? `${baseLabel} · Dịch vụ: ${effectiveService}`
      : baseLabel;
  }, [reportScope, hasHeaderCluster, headerClusterName, effectiveService]);

  const hasActiveActionFilter =
    actionFilters.actor !== 'ALL' ||
    actionFilters.status !== 'ALL' ||
    actionFilters.incidentType !== 'ALL' ||
    actionFilters.actionCode !== 'ALL' ||
    Boolean(actionFilters.search);

  const hasAnyGlobalFilter =
    effectiveService !== 'ALL' ||
    hasActiveActionFilter ||
    Boolean(searchService.trim()) ||
    selectedTier !== 'ALL';

  const handleResetAllFilters = () => {
    const serviceWasFiltered = selectedService !== 'ALL';
    if (serviceWasFiltered) {
      setSelectedService('ALL');
    }
    if (searchService) setSearchService('');
    if (selectedTier !== 'ALL') setSelectedTier('ALL');
    if (hasActiveActionFilter) {
      if (serviceWasFiltered) {
        skipFilterFetchRef.current = true;
      }
      setActionFilters({
        actor: 'ALL',
        status: 'ALL',
        incidentType: 'ALL',
        actionCode: 'ALL',
        search: '',
        page: 1,
        limit: 25,
      });
    }
  };

  return (
    <div
      className="dashboard-reports-page"
      style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '64px' }}
    >
      {/* Header In Ấn Trang Trọng (Chỉ xuất hiện khi In / Lưu PDF) */}
      <div
        className="print-only"
        style={{
          borderBottom: '2px solid #0F172A',
          paddingBottom: '16px',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '20px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 800,
                color: '#0F172A',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {currentOrg?.name || 'SME RETAIL ENTERPRISE'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px', fontWeight: 600 }}>
              TRUNG TÂM VẬN HÀNH HẠ TẦNG KUBERNETES & TỰ TRỊ eBPF
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
              Phạm vi:{' '}
              <strong style={{ fontFamily: 'var(--font-mono)' }}>
                {activeScopeLabel}
              </strong>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>
              MÃ SỐ BÁO CÁO: <span style={{ fontFamily: 'var(--font-mono)' }}>{documentId}</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
              Phân loại: <strong>NỘI BỘ (INTERNAL AUDIT REPORT)</strong>
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
              Thời điểm xuất bản: {new Date().toLocaleDateString('vi-VN')}{' '}
              {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0F172A',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            BÁO CÁO CAM KẾT SLA, PHÂN TÍCH SỰ CỐ & TRUY VẾT ACTION TỰ PHỤC HỒI
          </h2>
          <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '4px', fontStyle: 'italic' }}>
            (Kỳ đánh giá: {timeRangeLabel} — Đối soát trực tiếp trên dữ liệu Sự cố, AI MAPE-K & Con người phê duyệt)
          </div>
        </div>
      </div>

      {/* Header Trên Màn Hình Web */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <BarChart3 size={22} color="var(--dash-primary)" />
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Báo Cáo SLA & Vận Hành Doanh Nghiệp
            </h1>
            {currentOrg?.name && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  fontSize: '0.75rem',
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
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: reportScope === 'CLUSTER' ? '#EFF6FF' : '#F1F5F9',
                  border: reportScope === 'CLUSTER' ? '1px solid #BFDBFE' : '1px solid #CBD5E1',
                  color: reportScope === 'CLUSTER' ? '#1D4ED8' : '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                <Server size={12} />
                <span>
                  {reportScope === 'CLUSTER' ? `Cụm K8s: ${headerClusterName}` : 'Phạm vi: Toàn công ty'}
                </span>
              </span>
            )}
            {effectiveService !== 'ALL' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#047857',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                <Layers size={12} />
                <span>{`Dịch vụ: ${effectiveService}`}</span>
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Đánh giá cam kết SLA, cơ cấu sự cố, người/AI thực thi Action và nguyên nhân thành công hay thất bại
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              triggerRefresh();
              loadReport();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoadingReport ? 'animate-spin' : ''} />
            <span>{isLoadingReport ? 'Đang cập nhật...' : 'Làm mới số liệu'}</span>
          </button>

          <div className="dash-export-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isViewer && (
              <span
                title="Tài khoản quyền Người xem (Viewer) bị giới hạn chức năng xuất dữ liệu theo chính sách RBAC"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 8px',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: 'var(--dash-radius-md)',
                  fontSize: '0.6875rem',
                  color: '#64748B',
                  fontWeight: 600,
                }}
              >
                <Lock size={12} />
                <span>Chỉ Đọc (Viewer)</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleOpenExcelModal}
              disabled={!canExport}
              aria-label="Xuất Excel chọn biểu đồ"
              title="Chọn các loại biểu đồ muốn xuất ra file Excel (.xlsx)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 13px',
                backgroundColor: canExport ? '#059669' : '#94A3B8',
                border: 'none',
                borderRadius: 'var(--dash-radius-md)',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: canExport ? 'pointer' : 'not-allowed',
                opacity: canExport ? 1 : 0.55,
              }}
            >
              <FileSpreadsheet size={15} />
              <span>Xuất Excel</span>
            </button>

            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => canExport && setIsExportMenuOpen((prev) => !prev)}
                disabled={!canExport}
                aria-haspopup="true"
                aria-expanded={isExportMenuOpen}
                aria-label="Tùy chọn xuất báo cáo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  backgroundColor: canExport ? 'var(--dash-primary)' : '#94A3B8',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-md)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: canExport ? 'pointer' : 'not-allowed',
                  opacity: canExport ? 1 : 0.55,
                }}
              >
                <Download size={15} />
                <span>Xuất Báo Cáo</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: isExportMenuOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>

              <div
                role="menu"
                aria-label="Danh sách định dạng xuất báo cáo"
                style={{
                  display: isExportMenuOpen ? 'flex' : 'none',
                  flexDirection: 'column',
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  width: '240px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
                  padding: '6px',
                  zIndex: 50,
                  gap: '2px',
                }}
              >
                <div
                  style={{
                    padding: '6px 8px 4px 8px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: 'var(--dash-text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Chọn Định Dạng File
                </div>

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
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: '#D1FAE5',
                    }}
                  >
                    <FileSpreadsheet size={16} color="#047857" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.8125rem' }}>
                      Xuất Excel (.xlsx)
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Chọn thẻ biểu đồ & bảng tải về
                    </span>
                  </div>
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
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: '#DCFCE7',
                    }}
                  >
                    <FileSpreadsheet size={16} color="#059669" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#0F172A', fontWeight: 600, fontSize: '0.8125rem' }}>
                      Xuất CSV
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Bảng truy vết Action & Lỗi (.csv)
                    </span>
                  </div>
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
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: '#E0F2FE',
                    }}
                  >
                    <FileJson size={16} color="#0284C7" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#0F172A', fontWeight: 600, fontSize: '0.8125rem' }}>
                      Xuất JSON
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Toàn bộ cấu trúc báo cáo (.json)
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handlePrintPdf();
                    setIsExportMenuOpen(false);
                  }}
                  aria-label="In hoặc Lưu PDF"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    width: '100%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: '#F1F5F9',
                    }}
                  >
                    <Printer size={16} color="#475569" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#0F172A', fontWeight: 600, fontSize: '0.8125rem' }}>
                      In / Lưu PDF
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      In hoặc lưu tài liệu PDF A4
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {exportNotice && (
        <div
          className="no-print"
          style={{
            padding: '12px 16px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--dash-radius-md)',
            color: '#065F46',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>
            {exportNotice === 'PDF'
              ? `Đang mở hộp thoại In / Lưu PDF cho Báo Cáo SLA kỳ ${timeRange}. Vui lòng chọn "Save as PDF".`
              : exportNotice === 'EXCEL'
                ? `File Excel (.xlsx) gồm các thẻ biểu đồ và bảng dữ liệu đã chọn kỳ ${timeRange} đã được tải xuống thành công!`
                : `Báo cáo kiểm toán SLA kỳ ${timeRange} đã được tạo và tải xuống thành công dưới định dạng ${exportNotice}!`}
          </span>
        </div>
      )}

      {/* Thanh Bộ Lọc Đồng Bộ: Cụm K8s (Header), Dịch Vụ K8s thực tế & Kỳ Báo Cáo */}
      <div
        className="dash-card no-print"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {hasHeaderCluster && headerClusterName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>
                Cụm K8s:
              </span>
              <div
                role="group"
                aria-label="Phạm vi cụm Kubernetes"
                style={{
                  display: 'inline-flex',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '7px',
                  padding: '2px',
                  height: '32px',
                  alignItems: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <button
                  type="button"
                  onClick={() => setReportScope('CLUSTER')}
                  aria-pressed={reportScope === 'CLUSTER'}
                  title={`Lọc báo cáo theo cụm đang chọn trên Header: ${headerClusterName}`}
                  style={{
                    height: '26px',
                    padding: '0 10px',
                    borderRadius: '5px',
                    border: 'none',
                    backgroundColor: reportScope === 'CLUSTER' ? '#FFFFFF' : 'transparent',
                    color: reportScope === 'CLUSTER' ? '#059669' : '#64748B',
                    boxShadow: reportScope === 'CLUSTER' ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Server size={12} />
                  <span>{headerClusterName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportScope('ALL')}
                  aria-pressed={reportScope === 'ALL'}
                  title="Xem báo cáo SLA & Action của toàn bộ các cụm thuộc công ty"
                  style={{
                    height: '26px',
                    padding: '0 10px',
                    borderRadius: '5px',
                    border: 'none',
                    backgroundColor: reportScope === 'ALL' ? '#FFFFFF' : 'transparent',
                    color: reportScope === 'ALL' ? '#0F172A' : '#64748B',
                    boxShadow: reportScope === 'ALL' ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Toàn công ty
                </button>
              </div>
            </div>
          )}

          {/* Bộ lọc Dịch vụ K8s thực tế */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>
              Dịch Vụ:
            </span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Layers
                size={13}
                color="#64748B"
                style={{ position: 'absolute', left: '9px', pointerEvents: 'none' }}
              />
              <select
                aria-label="Lọc theo dịch vụ K8s"
                value={effectiveService}
                onChange={(e) => setSelectedService(e.target.value)}
                style={{
                  height: '32px',
                  padding: '0 10px 0 28px',
                  fontSize: '0.75rem',
                  border: effectiveService !== 'ALL' ? '1px solid #059669' : '1px solid #CBD5E1',
                  borderRadius: '6px',
                  backgroundColor: effectiveService !== 'ALL' ? '#ECFDF5' : '#FFFFFF',
                  color: effectiveService !== 'ALL' ? '#047857' : '#1E293B',
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
                height: '32px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                color: '#475569',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} />
              <span>Đặt lại lọc</span>
            </button>
          )}
        </div>

        {/* Time Range Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>
            Kỳ Báo Cáo:
          </span>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              padding: '2px',
            }}
          >
            {[
              { id: '7D', label: '7 Ngày' },
              { id: '1M', label: '30 Ngày' },
              { id: '3M', label: '3 Tháng' },
              { id: '6M', label: '6 Tháng' },
              { id: '1Y', label: '1 Năm' },
            ].map((range) => (
              <button
                key={range.id}
                type="button"
                onClick={() => setTimeRange(range.id)}
                style={{
                  padding: '5px 11px',
                  border: 'none',
                  backgroundColor: timeRange === range.id ? 'var(--dash-primary)' : 'transparent',
                  color: timeRange === range.id ? '#FFFFFF' : 'var(--dash-text-secondary)',
                  borderRadius: 'var(--dash-radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {reportError && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--dash-radius-md)',
            color: '#DC2626',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertTriangle size={18} color="#DC2626" />
          <span>{reportError}</span>
        </div>
      )}

      {/* 1. 4 THẺ CHỈ SỐ VẬN HÀNH & ACTION THỰC TẾ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
        <div
          className="dash-card"
          style={{
            padding: '18px 20px',
            borderTop: '3px solid #0284C7',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
            ĐỘ SẴN SÀNG THỰC TẾ (UPTIME)
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#0284C7',
              margin: '6px 0 2px 0',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {actualUptimeStr}
          </div>
          {isSlaCompliant ? (
            <div style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <TrendingUp size={13} />
              <span>Đạt cam kết SLA ({targetSlaStr})</span>
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <AlertTriangle size={13} />
              <span>Dưới mục tiêu SLA ({targetSlaStr})</span>
            </div>
          )}
          <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '4px' }}>
            Vận hành {reportData?.summary?.totalOperatingHours ?? 720} giờ ({timeRangeLabel})
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '18px 20px',
            borderTop: '3px solid #059669',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
            TỐC ĐỘ PHỤC HỒI & THỰC THI (MTTR)
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#059669',
              margin: '6px 0 2px 0',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {reportData?.summary?.mttrAvgSeconds ?? 0} giây
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            Thực thi K8s TB: {actionSummary.avgExecutionSeconds}s (Trung vị {actionSummary.medianExecutionSeconds}s)
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '4px' }}>
            Xác minh sau phục hồi: {actionSummary.verifiedSuccessRate}% ({actionSummary.verifiedCount.toLocaleString('vi-VN')} probe)
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '18px 20px',
            borderTop: '3px solid #2563EB',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
            TỔNG ACTION & KẾT QUẢ THỰC TẾ
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#2563EB',
              margin: '6px 0 2px 0',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {actionSummary.totalActions.toLocaleString('vi-VN')} action
          </div>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#059669' }}>{actionSummary.succeededActions.toLocaleString('vi-VN')} OK</span>
            <span style={{ color: '#DC2626' }}>{actionSummary.failedActions.toLocaleString('vi-VN')} Lỗi</span>
            <span style={{ color: '#D97706' }}>{actionSummary.cancelledActions.toLocaleString('vi-VN')} Hủy</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '4px' }}>
            Sự cố đã xử lý: {(reportData?.summary?.totalIncidentsResolved ?? 0).toLocaleString('vi-VN')} / {actionSummary.totalIncidents.toLocaleString('vi-VN')} phát hiện
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '18px 20px',
            borderTop: '3px solid #8B5CF6',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
            TỶ LỆ ĐẠT ACTION & PHÂN BỔ AI / NGƯỜI
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#8B5CF6',
              margin: '6px 0 2px 0',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {actionSummary.successRate}% đạt
          </div>
          <div style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600 }}>
            AI Auto: {actionSummary.autoSucceeded.toLocaleString('vi-VN')}/{actionSummary.autoActionsTotal.toLocaleString('vi-VN')} · Người/HITL: {actionSummary.manualSucceeded.toLocaleString('vi-VN')}/{actionSummary.manualActionsTotal.toLocaleString('vi-VN')}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '4px' }}>
            Tỷ trọng tự trị trên action thành công: {reportData?.summary?.autonomousHealingRate || '0.0%'}
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ 1: XU HƯỚNG SLA UPTIME, MTTR & KẾT QUẢ ACTION THEO THỜI GIAN */}
      <SLACostSavingsChart
        title="Cam Kết & Xu Hướng SLA Uptime"
        subtitle="Theo dõi song song SLA Uptime, tốc độ hồi sinh MTTR và diễn biến Thành công / Thất bại / Bị hủy của Action theo thời gian"
        trendsData={reportData?.monthlyTrends}
        actionTrends={actionAnalytics?.trends}
        summary={reportData?.summary}
      />

      {/* BIỂU ĐỒ 2 & BIỂU ĐỒ 3: CƠ CẤU LOẠI SỰ CỐ (ĐỘNG) + MỨC ĐỘ NGHIÊM TRỌNG (P1-P4) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(430px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
        {/* Biểu đồ 2: Donut Loại Sự Cố Hạ Tầng (Thiết kế gọn gàng, cân đối) */}
        <div
          className="dash-card"
          style={{
            padding: '16px 18px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              borderBottom: '1px solid #F1F5F9',
              paddingBottom: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <PieChart size={17} color="#2563EB" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Cơ Cấu Các Loại Sự Cố Hạ Tầng
                </h3>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '3px 0 0 0' }}>
                Tổng hợp sự cố eBPF & K8s trong kỳ — nhấp vào loại để lọc log Action
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#2563EB',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  padding: '2px 9px',
                  borderRadius: '999px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {incidentBreakdownList.total.toLocaleString('vi-VN')} sự cố
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: actionSummary.failedActions > 0 ? '#B45309' : '#059669',
                  backgroundColor: actionSummary.failedActions > 0 ? '#FFFBEB' : '#ECFDF5',
                  border: `1px solid ${actionSummary.failedActions > 0 ? '#FDE68A' : '#A7F3D0'}`,
                  padding: '2px 9px',
                  borderRadius: '999px',
                }}
              >
                {actionSummary.successRate}% thành công
              </span>
            </div>
          </div>

          <div
            className="report-donut-grid"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '144px', height: '144px' }}>
                <svg viewBox="0 0 200 200" width="144" height="144" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="100" cy="100" r="68" stroke="#F1F5F9" strokeWidth="22" fill="transparent" />
                  {incidentBreakdownList.items.map((item) => (
                    <circle
                      key={item.key}
                      cx="100"
                      cy="100"
                      r="68"
                      stroke={item.color}
                      strokeWidth="22"
                      strokeDasharray={item.strokeDasharray}
                      strokeDashoffset={item.strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    >
                      <title>{`${item.label}: ${item.count.toLocaleString('vi-VN')} sự cố (${item.percent}%)`}</title>
                    </circle>
                  ))}
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                    {incidentBreakdownList.total.toLocaleString('vi-VN')}
                  </span>
                  <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 700, marginTop: '2px' }}>TỔNG SỰ CỐ</span>
                  <span style={{ fontSize: '0.58rem', color: '#2563EB', fontWeight: 700, marginTop: '1px' }}>
                    {actionSummary.incidentsWithAction.toLocaleString('vi-VN')} có Action
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
                gap: '7px',
              }}
            >
              {incidentBreakdownList.items.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', color: '#64748B', fontSize: '0.78rem', textAlign: 'center' }}>
                  Chưa có sự cố nào được ghi nhận trong phạm vi đang chọn.
                </div>
              ) : (
                incidentBreakdownList.items.map((item) => {
                  const isActiveFilter =
                    item.key !== 'OTHER' && actionFilters.incidentType === item.key;

                  return (
                    <div
                      key={item.key}
                      onClick={() => {
                        setActionFilters((prev) => ({
                          ...prev,
                          incidentType: item.key === 'OTHER' || isActiveFilter ? 'ALL' : item.key,
                          page: 1,
                        }));
                        scrollToTraceability();
                      }}
                      title={`${item.actionText} — Nhấp để lọc bảng truy vết Action`}
                      style={{
                        padding: '6px 9px',
                        backgroundColor: isActiveFilter ? item.bgLight : '#FFFFFF',
                        border: isActiveFilter ? `1.5px solid ${item.color}` : '1px solid #E2E8F0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '4px',
                        transition: 'border-color 0.14s ease, background-color 0.14s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0F172A', lineHeight: 1.25 }}>
                            {item.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                            {item.count.toLocaleString('vi-VN')}
                          </span>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              color: item.color,
                              backgroundColor: item.bgLight,
                              padding: '1px 5px',
                              borderRadius: '999px',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {item.percent}%
                          </span>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: '3px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(2, item.percent))}%`,
                            height: '100%',
                            backgroundColor: item.color,
                            borderRadius: '999px',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: '8px',
              borderTop: '1px dashed #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '0.7rem',
              color: '#64748B',
            }}
          >
            <span>Rê chuột xem hướng tự phục hồi · Nhấp vào dòng để lọc bảng Action</span>
            {incidentBreakdownList.items.length > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#334155' }}>
                Cao nhất: {incidentBreakdownList.items[0].percent}%
              </span>
            )}
          </div>
        </div>

        {/* Biểu đồ 3: Phân Bổ Sự Cố Theo Mức Độ Nghiêm Trọng P1-P4 */}
        <IncidentSeverityBreakdown breakdown={reportData?.incidentBreakdown} />
      </div>

      {/* BIỂU ĐỒ 4: HIỆU SUẤT ACTION THEO ĐỐI TƯỢNG THỰC THI (AI MAPE-K / NGƯỜI VẬN HÀNH / HITL) */}
      <ActionActorBreakdownChart
        byActor={actionAnalytics?.byActor || []}
        selectedActor={actionFilters.actor}
        onSelectActor={(actorKey) => {
          setActionFilters((prev) => ({ ...prev, actor: actorKey, page: 1 }));
          if (actorKey !== 'ALL') scrollToTraceability();
        }}
      />

      {/* BIỂU ĐỒ 5 & 6: MA TRẬN LỖI x ACTION + NGUYÊN NHÂN THẤT BẠI / BỊ HỦY */}
      <ErrorActionMatrixChart
        matrix={actionAnalytics?.errorActionMatrix || []}
        selectedFilter={{
          incidentType: actionFilters.incidentType,
          actionCode: actionFilters.actionCode,
        }}
        onSelectCell={({ incidentType, actionCode }) => {
          setActionFilters((prev) => ({ ...prev, incidentType, actionCode, page: 1 }));
          scrollToTraceability();
        }}
      />

      <ActionFailureReasonsChart
        failureReasons={actionAnalytics?.failureReasons || []}
        onSelectStatusReason={(st) => {
          setActionFilters((prev) => ({ ...prev, status: st, page: 1 }));
          scrollToTraceability();
        }}
      />

      {/* BẢNG 1: BẢNG TRUY VẾT SỰ CỐ -> AI/NGƯỜI ACTION -> THỜI GIAN -> KẾT QUẢ & LÝ DO */}
      <div ref={traceabilityRef} className="dash-card dash-table-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#2563EB" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                Bảng Truy Vết Lỗi, Action & Nhật Ký Biến Động & Tự Khắc Phục Gần Đây
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '3px 0 0 0' }}>
              Đối soát chi tiết lỗi gì → AI hoặc Ai thao tác / duyệt → lúc nào → kết quả Thành công / Thất bại / Hủy & nguyên nhân
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Tổng khớp: <strong>{actionPagination.total.toLocaleString('vi-VN')}</strong> bản ghi
          </span>
        </div>

        {/* Bộ lọc bảng Truy Vết Action */}
        <div
          className="no-print"
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--dash-border)',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', width: '230px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--dash-text-muted)',
                }}
              />
              <input
                type="text"
                value={actionFilters.search}
                onChange={(e) =>
                  setActionFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))
                }
                placeholder="Tìm lỗi, dịch vụ, người, nguyên nhân..."
                aria-label="Tìm kiếm trong nhật ký action"
                style={{
                  width: '100%',
                  padding: '6px 26px 6px 30px',
                  borderRadius: 'var(--dash-radius-md)',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.78rem',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                }}
              />
              {actionFilters.search && (
                <button
                  type="button"
                  onClick={() => setActionFilters((prev) => ({ ...prev, search: '', page: 1 }))}
                  aria-label="Xóa tìm kiếm action"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--dash-text-muted)',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              value={actionFilters.actor}
              onChange={(e) =>
                setActionFilters((prev) => ({ ...prev, actor: e.target.value, page: 1 }))
              }
              aria-label="Lọc theo đối tượng thực hiện"
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-md)',
                border: '1px solid var(--dash-border)',
                fontSize: '0.78rem',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Tất cả AI / Người</option>
              <option value="AI">Chỉ AI Tự Trị (AUTO)</option>
              <option value="HUMAN">Chỉ Con Người thao tác/duyệt</option>
              <option value="HITL_QUEUE">Hàng chờ HITL (Chưa gán)</option>
              {filterOptions.actors.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.name} ({a.count})
                </option>
              ))}
            </select>

            <select
              value={actionFilters.status}
              onChange={(e) =>
                setActionFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))
              }
              aria-label="Lọc theo kết quả action"
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-md)',
                border: '1px solid var(--dash-border)',
                fontSize: '0.78rem',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="SUCCEEDED">Thành công (SUCCEEDED)</option>
              <option value="FAILED">Thất bại (FAILED)</option>
              <option value="CANCELLED">Bị hủy / HITL (CANCELLED)</option>
              <option value="PENDING">Đang chờ (PENDING)</option>
            </select>

            <select
              value={actionFilters.incidentType}
              onChange={(e) =>
                setActionFilters((prev) => ({ ...prev, incidentType: e.target.value, page: 1 }))
              }
              aria-label="Lọc theo loại sự cố"
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-md)',
                border: '1px solid var(--dash-border)',
                fontSize: '0.78rem',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Mọi loại lỗi</option>
              {filterOptions.incidentTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={actionFilters.actionCode}
              onChange={(e) =>
                setActionFilters((prev) => ({ ...prev, actionCode: e.target.value, page: 1 }))
              }
              aria-label="Lọc theo mã hành động"
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-md)',
                border: '1px solid var(--dash-border)',
                fontSize: '0.78rem',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Mọi hành động</option>
              {filterOptions.actionCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {hasActiveActionFilter && (
              <button
                type="button"
                onClick={() =>
                  setActionFilters({
                    actor: 'ALL',
                    status: 'ALL',
                    incidentType: 'ALL',
                    actionCode: 'ALL',
                    search: '',
                    page: 1,
                    limit: 25,
                  })
                }
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#DC2626',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <X size={12} />
                <span>Xóa lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* Bảng dữ liệu chi tiết */}
        <div className="dash-table-container" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Mã & Thời Điểm</th>
                <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Sự Cố Phát Hiện & Dịch Vụ</th>
                <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Hành Động & Chế Độ</th>
                <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>AI / Người Action & Duyệt</th>
                <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Kết Quả & Nguyên Nhân Chi Tiết</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingActions ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B' }}>
                    Đang tải lịch sử truy vết hành động...
                  </td>
                </tr>
              ) : actionRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    Không có bản ghi Action nào phù hợp với điều kiện lọc hiện tại.
                  </td>
                </tr>
              ) : (
                actionRows.map((row) => {
                  const isOk = row.executionStatus === 'SUCCEEDED';
                  const isFail = row.executionStatus === 'FAILED';
                  const isCancel = row.executionStatus === 'CANCELLED';

                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--dash-border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#0F172A' }}>
                          #{row.shortId}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>
                          {formatDateTimeVn(row.startedAt || row.createdAt)}
                        </div>
                        {row.durationSeconds !== null && (
                          <div style={{ fontSize: '0.68rem', color: '#059669', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            Thời lượng: {row.durationSeconds}s
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            onClick={() => onNavigate && onNavigate('/dashboard/incidents')}
                            title="Đi tới trang Quản lý Sự cố"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: '#1D4ED8',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            {row.targetName}
                            <ArrowUpRight size={11} className="no-print" />
                          </span>
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              backgroundColor: '#F1F5F9',
                              color: '#334155',
                            }}
                          >
                            {row.incidentType}
                          </span>
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              backgroundColor:
                                row.severity === 'CRITICAL'
                                  ? '#FEF2F2'
                                  : row.severity === 'HIGH'
                                    ? '#FFF7ED'
                                    : '#F8FAFC',
                              color:
                                row.severity === 'CRITICAL'
                                  ? '#DC2626'
                                  : row.severity === 'HIGH'
                                    ? '#C2410C'
                                    : '#475569',
                            }}
                          >
                            {row.severity}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', lineHeight: 1.35 }}>
                          {row.incidentTitle}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A' }}>
                          {row.actionCode}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              backgroundColor: row.executionMode === 'AUTO' ? '#EFF6FF' : '#F3E8FF',
                              color: row.executionMode === 'AUTO' ? '#1D4ED8' : '#7C3AED',
                            }}
                          >
                            {row.executionMode}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Risk: {row.riskLevel}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', minWidth: '175px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0F172A' }}>
                          {row.actorType === 'AI' ? (
                            <Cpu size={14} color="#2563EB" />
                          ) : row.actorType === 'HUMAN' ? (
                            <UserCheck size={14} color="#059669" />
                          ) : (
                            <Clock size={14} color="#D97706" />
                          )}
                          <span>{row.actorName}</span>
                        </div>
                        {row.approverName && (
                          <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '3px' }}>
                            Duyệt HITL: <strong>{row.approverName}</strong>
                          </div>
                        )}
                        {row.agentName && (
                          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>
                            Agent: {row.agentName}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', maxWidth: '320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              backgroundColor: isOk ? '#ECFDF5' : isFail ? '#FEF2F2' : isCancel ? '#FFFBEB' : '#F1F5F9',
                              color: isOk ? '#059669' : isFail ? '#DC2626' : isCancel ? '#B45309' : '#475569',
                              border: `1px solid ${isOk ? '#A7F3D0' : isFail ? '#FECACA' : isCancel ? '#FDE68A' : '#CBD5E1'}`,
                            }}
                          >
                            {isOk ? (
                              <CheckCircle2 size={11} />
                            ) : isFail ? (
                              <XCircle size={11} />
                            ) : isCancel ? (
                              <Ban size={11} />
                            ) : (
                              <Clock size={11} />
                            )}
                            <span>{row.executionStatus}</span>
                          </span>

                          {row.verificationResult !== null && (
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: row.verificationResult ? '#F0FDF4' : '#FEF2F2',
                                color: row.verificationResult ? '#15803D' : '#B91C1C',
                              }}
                            >
                              {row.verificationResult ? 'Xác minh ổn định ✓' : 'Xác minh thất bại'}
                            </span>
                          )}
                        </div>

                        {row.reasonCategory && (
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isFail ? '#B91C1C' : '#92400E', marginTop: '4px' }}>
                            {row.reasonCategory}
                          </div>
                        )}
                        {row.failureReason && (
                          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px', wordBreak: 'break-word' }}>
                            {row.failureReason}
                          </div>
                        )}
                        {!row.failureReason && row.resultSummary && (
                          <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '3px', wordBreak: 'break-word' }}>
                            {row.resultSummary}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang Bảng Truy Vết Action */}
        <div
          className="no-print"
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--dash-border)',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            Trang {actionPagination.page} / {actionPagination.totalPages} (Hiển thị {actionRows.length} /{' '}
            {actionPagination.total.toLocaleString('vi-VN')} action)
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              disabled={actionPagination.page <= 1 || isLoadingActions}
              onClick={() =>
                setActionFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: actionPagination.page <= 1 ? 'not-allowed' : 'pointer',
                opacity: actionPagination.page <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} />
              <span>Trước</span>
            </button>
            <button
              type="button"
              disabled={actionPagination.page >= actionPagination.totalPages || isLoadingActions}
              onClick={() =>
                setActionFilters((prev) => ({
                  ...prev,
                  page: Math.min(actionPagination.totalPages, prev.page + 1),
                }))
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor:
                  actionPagination.page >= actionPagination.totalPages ? 'not-allowed' : 'pointer',
                opacity: actionPagination.page >= actionPagination.totalPages ? 0.5 : 1,
              }}
            >
              <span>Sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* KHỐI SO SÁNH ĐỐI CHỨNG HIỆU QUẢ (BEFORE vs AFTER AI) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <div
          className="dash-card"
          style={{
            padding: '20px 24px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94A3B8' }} />
              <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#475569', margin: 0, textTransform: 'uppercase' }}>
                Quy Trình SRE Cũ (Thủ Công)
              </h4>
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#94A3B8', fontWeight: 600 }}>Tham chiếu trước AI</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ color: '#64748B' }}>Tốc độ phục hồi (MTTR):</span>
              <strong style={{ color: '#334155', fontFamily: 'var(--font-mono)' }}>25 – 45 phút</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ color: '#64748B' }}>Phụ thuộc trực ca thủ công:</span>
              <strong style={{ color: '#334155' }}>Xử lý tuần tự từng sự cố</strong>
            </div>
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '20px 24px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#059669" />
              <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0, textTransform: 'uppercase' }}>
                Hệ Thống Tự Trị CapTone (eBPF + AI + HITL)
              </h4>
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 700, backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '10px' }}>
              Số liệu thực tế
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ color: '#64748B' }}>Thời gian thực thi K8s trung bình:</span>
              <strong style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>
                {actionSummary.avgExecutionSeconds}s (MTTR {reportData?.summary?.mttrAvgSeconds ?? 0}s)
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ color: '#64748B' }}>Kết quả thực tế kỳ này:</span>
              <strong style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>
                {actionSummary.succeededActions.toLocaleString('vi-VN')} OK / {actionSummary.failedActions} Lỗi ({actualUptimeStr} Uptime)
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* BẢNG 2: BẢNG PHÂN TÍCH SLA THEO TỪNG DỊCH VỤ MICROSERVICE */}
      <div className="dash-card dash-table-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Bảng Phân Tích SLA Theo Từng Dịch Vụ Microservice
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Số liệu đối chiếu trực tiếp theo từng dịch vụ của {currentOrg?.name || 'tổ chức'}
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Chu kỳ: {timeRangeLabel}
          </span>
        </div>

        {/* Bộ lọc Service SLA */}
        <div
          className="no-print"
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--dash-border)',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--dash-text-muted)',
                }}
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
                  borderRadius: 'var(--dash-radius-md)',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
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
                    color: 'var(--dash-text-muted)',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="var(--dash-text-muted)" />
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                aria-label="Lọc theo phân cấp Tier"
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--dash-radius-md)',
                  border: '1px solid var(--dash-border)',
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

          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Hiển thị {filteredServices.length} / {activeServices.length} dịch vụ
          </span>
        </div>

        <div className="dash-table-container" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Dịch Vụ & Phân Hạng</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Cam Kết SLA</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Uptime Thực Tế</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Thực Thi TB</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Action (OK / Lỗi / Hủy)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Trạng Thái Tuân Thủ</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
                    {activeServices.length === 0
                      ? `${currentOrg?.name || 'Tổ chức'} chưa ghi nhận dịch vụ hoặc hành động phục hồi nào.`
                      : 'Không tìm thấy dịch vụ vi mô nào phù hợp với điều kiện lọc.'}
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => {
                  const hasErr = (svc.actionsFailed || 0) > 0;
                  return (
                    <tr key={svc.name} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                      <td style={{ padding: '13px 16px' }}>
                        <div
                          onClick={() => onNavigate && onNavigate('/dashboard/workloads')}
                          title={`Xem chi tiết ${svc.name}`}
                          style={{
                            fontWeight: 700,
                            color: 'var(--dash-text-primary)',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>{svc.name}</span>
                          <ArrowUpRight size={12} color="var(--dash-text-muted)" className="no-print" />
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>{svc.tier}</div>
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)' }}>{svc.targetSla}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#0284C7', fontWeight: 800 }}>
                            {svc.actualUptime}
                          </span>
                          <div style={{ width: '48px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, parseFloat(svc.actualUptime) || 99.9)}%`,
                                height: '100%',
                                backgroundColor: '#0284C7',
                                borderRadius: '3px',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 700 }}>
                        {svc.mttrAvg}
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#059669', fontWeight: 700 }}>{svc.incidentsResolved}</span>
                        {svc.actionsTotal !== undefined && (
                          <span style={{ color: '#64748B', fontSize: '0.74rem' }}>
                            {' '}
                            / {svc.actionsFailed || 0} lỗi / {svc.actionsCancelled || 0} hủy
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            backgroundColor: hasErr ? '#FFFBEB' : '#ECFDF5',
                            color: hasErr ? '#B45309' : '#059669',
                            border: `1px solid ${hasErr ? '#FDE68A' : '#A7F3D0'}`,
                            borderRadius: 'var(--dash-radius-full)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={11} />
                          <span>{svc.status}</span>
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

      {/* XÁC NHẬN NGHIỆM THU & PHÊ DUYỆT BÁO CÁO (CHO IN PDF) */}
      <div
        className="dash-card print-signature-block"
        style={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            borderBottom: '1px solid #E2E8F0',
            paddingBottom: '12px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#059669" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, textTransform: 'uppercase' }}>
              Xác Nhận Nghiệm Thu & Phê Duyệt Báo Cáo Vận Hành SLA
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            Mã hồ sơ: {documentId} | Trích xuất từ Sổ cái Kiểm toán Bất biến
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: '120px' }}>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>
                ĐẠI DIỆN HỆ THỐNG TỰ TRỊ
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                (Tác tử eBPF & Engine Tự Phục Hồi)
              </div>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '999px',
                color: '#059669',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={13} />
              <span>XÁC THỰC TỰ ĐỘNG</span>
            </span>
            <div style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>SHA-256 Immutable Ledger</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: '120px' }}>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>
                TRƯỞNG NHÓM DEVOPS / SRE
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                (Ký và ghi rõ họ tên)
              </div>
            </div>
            <div style={{ height: '34px', width: '120px', borderBottom: '1px dashed #CBD5E1' }} />
            <div style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>Xác nhận Action & MTTR</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: '120px' }}>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>
                ĐẠI DIỆN BAN GIÁM ĐỐC
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                (Ký, đóng dấu và ghi rõ họ tên)
              </div>
            </div>
            <div style={{ height: '34px', width: '120px', borderBottom: '1px dashed #CBD5E1' }} />
            <div style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>
              {currentOrg?.name || 'SME Retail Enterprise'}
            </div>
          </div>
        </div>
      </div>

      <div
        className="print-only"
        style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid #CBD5E1',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.6875rem',
          color: '#64748B',
        }}
      >
        <div>Báo cáo được khởi tạo tự động từ dữ liệu vận hành thực tế Kubernetes & Sổ cái kiểm toán.</div>
        <div style={{ fontFamily: 'var(--font-mono)' }}>Hồ sơ: {documentId}</div>
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
          totalMatchedActions: actionPagination.total || actionRows.length,
          servicesCount: (effectiveService !== 'ALL' || Boolean(searchService.trim()) || selectedTier !== 'ALL' ? filteredServices : activeServices).length,
        }}
      />
    </div>
  );
};

export default ReportsPage;
