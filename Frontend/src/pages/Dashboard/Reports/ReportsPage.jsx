import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { exportToCsv, exportToJson } from '../../../utils/exportUtils';
import SLACostSavingsChart from '../../../components/dashboard/SLACostSavingsChart';
import IncidentSeverityBreakdown from '../../../components/dashboard/IncidentSeverityBreakdown';
import { fetchOrganizationSLAReport } from '../../../services/reportService';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  GitCommit,
  AlertTriangle,
  FileSpreadsheet,
  FileJson,
  Printer,
  Search,
  Filter,
  X,
  Lock,
  ExternalLink,
  ArrowUpRight,
  Download,
  ChevronDown
} from 'lucide-react';

export const ReportsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh, currentUserRole, onNavigate } = useDashboard();
  const { success: toastSuccess, error: toastError } = useToast();
  const isViewer = currentUserRole === 'VIEWER';
  const canExport = !isViewer;
  const [timeRange, setTimeRange] = useState('6M');
  const [exportNotice, setExportNotice] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [searchService, setSearchService] = useState('');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadReport = useCallback(async () => {
    setIsLoadingReport(true);
    setReportError(null);
    try {
      const activeClusterId = currentEnv?.clusterId || (currentEnv?.cluster ? currentEnv?.id : null);
      const activeEnvId = currentEnv?.environment_id || (!currentEnv?.cluster ? currentEnv?.id : null);

      const data = await fetchOrganizationSLAReport({
        organizationId: currentOrg?.id,
        environmentId: activeEnvId,
        clusterId: activeClusterId,
        timeRange,
      });
      if (data) {
        setReportData(data);
      }
    } catch (err) {
      console.warn('[ReportsPage] Lỗi khi tải dữ liệu báo cáo:', err);
      if (err?.status === 403 || err?.message?.includes('403') || err?.message?.includes('Từ chối')) {
        setReportError('Từ chối truy cập (403 Forbidden): Bạn không thuộc tổ chức này hoặc chưa được cấp quyền truy cập theo chính sách RBAC.');
      } else {
        setReportError(err?.message || 'Không thể kết nối máy chủ để tải dữ liệu báo cáo.');
      }
      setReportData({
        summary: {
          actualUptime: '0.00%',
          targetSla: '99.90%',
          mttrAvgSeconds: 0,
          totalIncidentsResolved: 0,
          autonomousHealingRate: '0.0%',
          totalOperatingHours: 0,
        },
        services: [],
        recentChanges: [],
        monthlyTrends: [],
      });
    } finally {
      setIsLoadingReport(false);
    }
  }, [currentOrg?.id, currentEnv?.id, currentEnv?.clusterId, currentEnv?.environment_id, timeRange]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const activeServices = reportData?.services || [];
  const recentChanges = reportData?.recentChanges || [];

  const filteredServices = useMemo(() => {
    return activeServices.filter((svc) => {
      const matchTier = selectedTier === 'ALL' || (svc.tier && svc.tier.includes(selectedTier));
      const matchSearch =
        !searchService ||
        (svc.name && svc.name.toLowerCase().includes(searchService.toLowerCase().trim()));
      return matchTier && matchSearch;
    });
  }, [activeServices, selectedTier, searchService]);

  const handleExportCsv = () => {
    if (!canExport) {
      if (toastError) toastError('Quyền hạn bị giới hạn (RBAC): Chỉ Quản trị viên (Admin) hoặc Kỹ sư (DevOps) mới có quyền xuất báo cáo kỹ thuật.', 'Từ Chối Xuất File');
      return;
    }
    const headers = ['Dịch Vụ Vi Mô', 'Phân Cấp (Tier)', 'SLA Cam Kết', 'Uptime Thực Tế', 'MTTR Trung Bình', 'Sự Cố Tự Xử Lý', 'Trạng Thái Đạt'];
    const rows = filteredServices.map((s) => [
      s.name,
      s.tier,
      s.targetSla,
      s.actualUptime,
      s.mttrAvg,
      s.incidentsResolved,
      s.status,
    ]);
    exportToCsv(`bao-cao-sla-${timeRange.toLowerCase()}-2026.csv`, headers, rows);
    setExportNotice('CSV');
    toastSuccess('Báo cáo SLA & Vận hành đã được tải xuống máy thành công (định dạng CSV)!', 'Xuất Báo Cáo CSV');
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleExportJson = () => {
    if (!canExport) {
      if (toastError) toastError('Quyền hạn bị giới hạn (RBAC): Chỉ Quản trị viên (Admin) hoặc Kỹ sư (DevOps) mới có quyền xuất báo cáo kỹ thuật.', 'Từ Chối Xuất File');
      return;
    }
    const exportPayload = {
      title: 'Báo Cáo SLA & Vận Hành Doanh Nghiệp',
      organization: currentOrg?.name || 'Tổ chức mặc định',
      organizationId: currentOrg?.id,
      environment: currentEnv?.name || 'Môi trường mặc định',
      timeRange,
      exportTimestamp: new Date().toISOString(),
      summary: reportData?.summary || {},
      services: activeServices,
      recentChanges,
      monthlyTrends: reportData?.monthlyTrends || [],
    };
    exportToJson(`bao-cao-sla-van-hanh-${timeRange.toLowerCase()}-2026.json`, exportPayload);
    setExportNotice('JSON');
    toastSuccess('Báo cáo SLA & Vận hành đã được tải xuống máy thành công (định dạng JSON)!', 'Xuất Báo Cáo JSON');
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handlePrintPdf = () => {
    if (!canExport) {
      if (toastError) toastError('Quyền hạn bị giới hạn (RBAC): Chỉ Quản trị viên (Admin) hoặc Kỹ sư (DevOps) mới có quyền xuất báo cáo kỹ thuật.', 'Từ Chối Xuất File');
      return;
    }
    setExportNotice('PDF');
    toastSuccess('Đang mở hộp thoại In / Lưu PDF của trình duyệt...', 'In / Lưu PDF');
    setTimeout(() => {
      window.print();
    }, 250);
    setTimeout(() => setExportNotice(null), 4000);
  };

  return (
    <div className="dashboard-reports-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '64px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Báo Cáo SLA & Vận Hành Doanh Nghiệp
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg?.name || 'Chưa chọn Tổ chức'} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.name || 'Môi trường mặc định'}</span> &bull; Đánh giá cam kết thời gian hoạt động hệ thống (SLA) và năng lực tự phục hồi
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Time Range Selector */}
          <div style={{ display: 'flex', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', padding: '2px' }}>
            {['1M', '3M', '6M', '1Y'].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  backgroundColor: timeRange === range ? 'var(--dash-primary)' : 'transparent',
                  color: timeRange === range ? '#FFFFFF' : 'var(--dash-text-secondary)',
                  borderRadius: 'var(--dash-radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {range === '1M' ? '30 Ngày' : range === '3M' ? 'Quý 3' : range === '6M' ? '6 Tháng' : 'Năm 2026'}
              </button>
            ))}
          </div>

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
                title="Tài khoản quyền Người xem (Viewer) bị giới hạn chức năng xuất dữ liệu theo ma trận phân quyền RBAC"
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

            {/* Danh Sách Chọn Định Dạng Xuất Báo Cáo */}
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => canExport && setIsExportMenuOpen((prev) => !prev)}
                disabled={!canExport}
                aria-haspopup="true"
                aria-expanded={isExportMenuOpen}
                aria-label="Tùy chọn xuất báo cáo"
                title={canExport ? 'Chọn định dạng file xuất báo cáo (CSV, JSON, PDF)' : 'Chỉ Quản trị viên (Admin) hoặc Kỹ sư (DevOps) mới có quyền xuất file'}
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
                  boxShadow: canExport ? 'var(--dash-shadow-xs)' : 'none',
                  transition: 'all 0.15s ease',
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

              {/* Danh sách định dạng file để chọn */}
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
                  width: '230px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
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
                    letterSpacing: '0.05em',
                  }}
                >
                  Chọn Định Dạng File
                </div>

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
                    color: 'var(--dash-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
                    <span style={{ color: '#0F172A', fontWeight: 600 }}>Xuất CSV</span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>Bảng tính Excel (.csv)</span>
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
                    color: 'var(--dash-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0F9FF')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
                    <span style={{ color: '#0F172A', fontWeight: 600 }}>Xuất JSON</span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>Cấu trúc đối tượng (.json)</span>
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
                    color: 'var(--dash-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
                    <span style={{ color: '#0F172A', fontWeight: 600 }}>In / Lưu PDF</span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>In hoặc tài liệu PDF A4</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {exportNotice && (
        <div
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
              ? `Đang mở hộp thoại In / Lưu PDF cho Báo Cáo SLA kỳ ${timeRange}. Vui lòng chọn "Save as PDF" (Lưu dưới dạng PDF) trong cửa sổ in.`
              : `Báo cáo kiểm toán SLA kỳ ${timeRange} đã được tạo và tải xuống thành công dưới định dạng ${exportNotice}!`}
          </span>
        </div>
      )}

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

      {/* 4 Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>UPTIME TRUNG BÌNH THỰC TẾ</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284C7', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            {reportData?.summary?.actualUptime || '100.00%'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={12} />
            <span>Vượt mục tiêu chuẩn SLA {reportData?.summary?.targetSla || '99.90%'}</span>
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>THỜI GIAN KHẮC PHỤC (MTTR)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            {reportData?.summary?.mttrAvgSeconds ?? 0} giây
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
            Tự động hóa hoàn toàn không cần kỹ sư can thiệp
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>SỰ CỐ ĐÃ TỰ PHỤC HỒI</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-primary)', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            {reportData?.summary?.totalIncidentsResolved ?? 0} sự cố
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
            Ngăn chặn gián đoạn dịch vụ mà không cần can thiệp thủ công
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TỶ LỆ TỰ TRỊ KHÔNG GIÁN ĐOẠN</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7C3AED', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            {reportData?.summary?.autonomousHealingRate || '100.0%'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
            Vận hành liên tục {reportData?.summary?.totalOperatingHours ?? 0} giờ
          </div>
        </div>
      </div>

      {/* Incident Severity & Root Cause Distribution */}
      <IncidentSeverityBreakdown breakdown={reportData?.incidentBreakdown} />

      {/* Main Interactive React Chart */}
      <SLACostSavingsChart
        height={280}
        title={
          timeRange === '1M'
            ? 'Cam Kết & Xu Hướng SLA Uptime (30 Ngày Gần Nhất - Theo Tuần)'
            : timeRange === '3M'
            ? 'Cam Kết & Xu Hướng SLA Uptime (Quý 3 / 90 Ngày Gần Nhất)'
            : timeRange === '1Y'
            ? 'Cam Kết & Xu Hướng SLA Uptime (Năm 2026 - Theo 4 Quý)'
            : 'Cam Kết & Xu Hướng SLA Uptime (6 Tháng Gần Nhất)'
        }
        subtitle={
          timeRange === '1M'
            ? 'Đối chiếu thời gian hoạt động thực tế 4 tuần gần nhất với cam kết chuẩn SLA 99.9%'
            : timeRange === '3M'
            ? 'Đối chiếu thời gian hoạt động thực tế 3 tháng trong quý với cam kết chuẩn SLA 99.9%'
            : timeRange === '1Y'
            ? 'Đối chiếu thời gian hoạt động thực tế theo 4 quý năm 2026 với cam kết chuẩn SLA 99.9%'
            : 'Đối chiếu thời gian hoạt động thực tế 6 tháng với cam kết chuẩn SLA 99.9% và số lượng sự cố tự phục hồi'
        }
        trendsData={reportData?.monthlyTrends}
        summary={reportData?.summary}
      />

      {/* Service-by-Service SLA Breakdown Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Bảng Phân Tích SLA Theo Từng Dịch Vụ Microservice
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Số liệu tổng hợp đối chiếu trực tiếp từ cụm Kubernetes của {currentOrg?.name || 'tổ chức'}
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Chu kỳ: {timeRange === '1M' ? '30 Ngày' : timeRange === '3M' ? 'Quý 3' : timeRange === '6M' ? '6 Tháng' : 'Năm 2026'}
          </span>
        </div>

        {/* Bộ Lọc Dịch Vụ Vi Mô & Phân Cấp (Tier Filter & Search) */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--dash-border)', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dash-text-muted)' }} />
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
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--dash-text-muted)' }}
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
                  color: 'var(--dash-text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                  fontWeight: 500,
                }}
              >
                <option value="ALL">Tất Cả Phân Cấp</option>
                <option value="Tier 1">Tier 1 (Tối quan trọng)</option>
                <option value="Tier 2">Tier 2 (Nghiệp vụ cốt lõi)</option>
                <option value="Tier 3">Tier 3 (Dịch vụ phụ trợ)</option>
              </select>
            </div>

            {(searchService || selectedTier !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchService('');
                  setSelectedTier('ALL');
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#DC2626',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 600,
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

          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Hiển thị {filteredServices.length} / {activeServices.length} dịch vụ
          </span>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Dịch Vụ & Phân Hạng</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Cam Kết SLA</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Uptime Thực Tế</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>MTTR Trung Bình</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Sự Cố Đã Tự Vá</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Trạng Thái Tuân Thủ</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
                    {activeServices.length === 0
                      ? `${currentOrg?.name || 'Tổ chức'} chưa liên kết cụm Kubernetes hoặc chưa có dịch vụ vi mô nào được ghi nhận.`
                      : 'Không tìm thấy dịch vụ vi mô nào phù hợp với điều kiện tìm kiếm và bộ lọc.'}
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => (
                  <tr key={svc.name} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div
                        onClick={() => onNavigate && onNavigate('/dashboard/workloads')}
                        title={`Xem chi tiết tải và Pods của ${svc.name} tại Bàn Giám Sát Tải`}
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
                        <ArrowUpRight size={12} color="var(--dash-text-muted)" />
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>{svc.tier}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)' }}>{svc.targetSla}</td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: '#0284C7', fontWeight: 700 }}>
                      {svc.actualUptime}
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 700 }}>
                      {svc.mttrAvg}
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)' }}>{svc.incidentsResolved} sự cố</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          backgroundColor: '#ECFDF5',
                          color: '#059669',
                          border: '1px solid #A7F3D0',
                          borderRadius: 'var(--dash-radius-full)',
                        }}
                      >
                        ● {svc.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Changes & Self-Healing Remediations Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCommit size={18} color="var(--dash-primary)" />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Nhật Ký Biến Động & Tự Khắc Phục Gần Đây
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
                Lịch sử các lần Rollback, Auto-restart và Scale Pod tự động để bảo đảm chỉ số SLA
              </p>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {recentChanges.length} sự kiện gần nhất
          </span>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>MÃ BIẾN ĐỘNG</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>LOẠI THAY ĐỔI</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>DỊCH VỤ ẢNH HƯỞNG</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>MÔ TẢ HÀNH ĐỘNG</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>THỜI ĐIỂM</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>KẾT QUẢ</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {recentChanges.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
                    Chưa có biến động hoặc sự cố tự khắc phục nào được ghi nhận trong khoảng thời gian này.
                  </td>
                </tr>
              ) : (
                recentChanges.map((chg) => {
                  const isRollback = String(chg.type || '').toUpperCase().includes('ROLLBACK');
                  const isSucceeded = chg.result === 'SUCCEEDED';
                  return (
                    <tr key={chg.id} style={{ borderBottom: '1px solid var(--dash-border)', backgroundColor: '#FFFFFF' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          type="button"
                          onClick={() => onNavigate && onNavigate('/dashboard/incidents')}
                          title="Nhấp để xem chi tiết sự cố tại Bàn Giám Sát Sự Cố"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(2, 132, 199, 0.08)',
                            color: '#0284C7',
                            border: '1px solid rgba(2, 132, 199, 0.25)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{chg.id}</span>
                          <ExternalLink size={11} />
                        </button>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            backgroundColor: isRollback ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: isRollback ? '#EF4444' : '#2563EB',
                            border: `1px solid ${isRollback ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {chg.type}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                        {chg.service}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--dash-text-secondary)', lineHeight: 1.4 }}>
                        {chg.description}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--dash-text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {new Date(chg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(chg.timestamp).toLocaleDateString('vi-VN')}
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 'var(--dash-radius-full)',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            backgroundColor: isSucceeded ? '#ECFDF5' : '#FEF2F2',
                            color: isSucceeded ? '#059669' : '#DC2626',
                            border: `1px solid ${isSucceeded ? '#A7F3D0' : '#FECACA'}`,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          ● {chg.result}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => onNavigate && onNavigate('/dashboard/incidents')}
                          title="Xem phân tích nguyên nhân gốc rễ (RCA) của sự cố này"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            backgroundColor: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            borderRadius: '6px',
                            color: '#15803D',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>Xem RCA</span>
                          <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
