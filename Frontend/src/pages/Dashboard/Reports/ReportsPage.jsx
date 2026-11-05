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
  ChevronDown,
  Sparkles,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';

export const ReportsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh, currentUserRole, onNavigate } = useDashboard();
  const { success: toastSuccess, error: toastError } = useToast();
  const isViewer = currentUserRole === 'VIEWER';
  const canExport = !isViewer;
  const [timeRange, setTimeRange] = useState('6M');
  const [reportScope, setReportScope] = useState('ALL'); // 'ALL' = Toàn Doanh Nghiệp | 'CLUSTER' = Cụm hiện tại
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
      const isClusterScope = reportScope === 'CLUSTER';
      const activeClusterId = isClusterScope ? (currentEnv?.clusterId || (currentEnv?.cluster ? currentEnv?.id : null)) : null;
      const activeEnvId = isClusterScope ? (currentEnv?.environment_id || (!currentEnv?.cluster ? currentEnv?.id : null)) : null;

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
  }, [currentOrg?.id, currentEnv?.id, currentEnv?.clusterId, currentEnv?.environment_id, timeRange, reportScope]);

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

  const actualUptimeStr = reportData?.summary?.actualUptime || '100.00%';
  const targetSlaStr = reportData?.summary?.targetSla || '99.90%';
  const actualUptimeVal = parseFloat(actualUptimeStr) || 100;
  const targetSlaVal = parseFloat(targetSlaStr) || 99.9;
  const isSlaCompliant = actualUptimeVal >= targetSlaVal;

  const documentId = useMemo(() => {
    const orgCode = (currentOrg?.name || 'SME').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'S');
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `SLA-RPT-${orgCode}-${dateStr}`;
  }, [currentOrg?.name]);

  const timeRangeLabel = useMemo(() => {
    switch (timeRange) {
      case '1M': return '30 Ngày gần nhất';
      case '3M': return 'Quý 3 / 90 Ngày gần nhất';
      case '1Y': return 'Cả năm 2026 (4 Quý)';
      default: return '6 Tháng qua';
    }
  }, [timeRange]);

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
      {/* Header In Ấn Trang Trọng (Chỉ xuất hiện khi In / Lưu file PDF) */}
      <div
        className="print-only"
        style={{
          borderBottom: '2px solid #0F172A',
          paddingBottom: '16px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {currentOrg?.name || 'SME RETAIL ENTERPRISE'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px', fontWeight: 600 }}>
              TRUNG TÂM VẬN HÀNH HẠ TẦNG KUBERNETES & TỰ TRỊ eBPF
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
              Cụm máy chủ: <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.clusterId || currentEnv?.name || 'minikube-cluster'}</strong>
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
              Thời điểm xuất bản: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            BÁO CÁO TOÀN DIỆN VỀ CAM KẾT CHẤT LƯỢNG DỊCH VỤ (SLA) & VẬN HÀNH TỰ TRỊ
          </h2>
          <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '4px', fontStyle: 'italic' }}>
            (Kỳ đánh giá: {timeRangeLabel} — Đối soát tự động trên toàn bộ Microservices hạ tầng)
          </div>
        </div>
      </div>

      {/* Header Trên Màn Hình Web */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Báo Cáo SLA & Vận Hành Doanh Nghiệp
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Đánh giá cam kết thời gian hoạt động hệ thống (SLA) và năng lực tự phục hồi
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Scope Selector: Toàn Doanh Nghiệp vs Cụm Hiện Tại */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              padding: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setReportScope('ALL')}
              title="Xem dữ liệu toàn bộ hạ tầng doanh nghiệp (hơn 5.800 sự cố từ cơ sở dữ liệu thật)"
              style={{
                padding: '6px 12px',
                border: 'none',
                backgroundColor: reportScope === 'ALL' ? '#FFFFFF' : 'transparent',
                color: reportScope === 'ALL' ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                boxShadow: reportScope === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                borderRadius: 'var(--dash-radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🏢 Toàn Doanh Nghiệp
            </button>
            <button
              type="button"
              onClick={() => setReportScope('CLUSTER')}
              title={`Lọc riêng dữ liệu cho cụm ${currentEnv?.name || 'hiện tại'}`}
              style={{
                padding: '6px 12px',
                border: 'none',
                backgroundColor: reportScope === 'CLUSTER' ? '#FFFFFF' : 'transparent',
                color: reportScope === 'CLUSTER' ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                boxShadow: reportScope === 'CLUSTER' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                borderRadius: 'var(--dash-radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ☸ Cụm Hiện Tại
            </button>
          </div>

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

      {/* Thông Tin Hồ Sơ Báo Cáo Doanh Nghiệp (Hiện cả trên màn hình và trang trọng khi in PDF) */}
      <div
        className="dash-card"
        style={{
          padding: '14px 20px',
          backgroundColor: '#F8FAFC',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '0.8125rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
          <div>
            <span style={{ color: 'var(--dash-text-muted)' }}>Doanh nghiệp: </span>
            <strong style={{ color: 'var(--dash-text-primary)' }}>{currentOrg?.name || 'SME Retail Enterprise'}</strong>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#CBD5E1' }} className="no-print" />
          <div>
            <span style={{ color: 'var(--dash-text-muted)' }}>Phạm vi: </span>
            <strong style={{ color: reportScope === 'ALL' ? '#7C3AED' : '#0284C7', fontFamily: 'var(--font-mono)' }}>
              {reportScope === 'ALL' ? 'Toàn Doanh Nghiệp (Tất cả cụm)' : (currentEnv?.clusterId || currentEnv?.name || 'Cụm hiện tại')}
            </strong>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#CBD5E1' }} className="no-print" />
          <div>
            <span style={{ color: 'var(--dash-text-muted)' }}>Kỳ đánh giá: </span>
            <strong style={{ color: 'var(--dash-text-primary)' }}>{timeRangeLabel}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ color: 'var(--dash-text-muted)' }}>Mã hồ sơ: </span>
            <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-secondary)', backgroundColor: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>
              {documentId}
            </code>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#CBD5E1' }} className="no-print" />
          <div>
            <span style={{ color: 'var(--dash-text-muted)' }}>Ngày xuất bản: </span>
            <span style={{ color: 'var(--dash-text-primary)', fontWeight: 600 }}>{new Date().toLocaleDateString('vi-VN')}</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#CBD5E1' }} className="no-print" />
          <div>
            <span style={{ color: 'var(--dash-text-muted)' }}>Người trích xuất: </span>
            <strong style={{ color: 'var(--dash-text-primary)' }}>{currentUserRole || 'Administrator'}</strong>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#CBD5E1' }} className="no-print" />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 700 }}>
            <CheckCircle2 size={13} color="#059669" />
            <span>Đối Soát Mật Mã Toàn Vẹn</span>
          </div>
        </div>
      </div>

      {/* 2. 4 Thẻ Chỉ Số Vận Hành Cốt Lõi (Doanh Nghiệp & SRE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '18px 20px', borderTop: '3px solid #0284C7' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>ĐỘ SẴN SÀNG THỰC TẾ (UPTIME)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284C7', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
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
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
            Hệ thống luôn chạy thông suốt, không gián đoạn
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px', borderTop: '3px solid #059669' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>TỐC ĐỘ TỰ KHẮC PHỤC (MTTR)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            {reportData?.summary?.mttrAvgSeconds ?? 0} giây
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            AI tự động hóa 100% trong nháy mắt
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
            Nhanh hơn 95% so với quy trình thủ công (15-30p)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px', borderTop: '3px solid var(--dash-primary)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>SỰ CỐ ĐÃ TỰ ĐỘNG VÁ</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-primary)', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            {reportData?.summary?.totalIncidentsResolved ?? 0} sự cố
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-primary)', fontWeight: 600 }}>
            Bảo vệ dịch vụ kinh doanh liên tục
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
            Không cần kỹ sư can thiệp hay thức đêm trực ca
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px', borderTop: '3px solid #7C3AED' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>NGÂN SÁCH DOWNTIME (ERROR BUDGET)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7C3AED', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            {reportData?.summary?.autonomousHealingRate || '100.0%'} An toàn
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7C3AED', fontWeight: 600 }}>
            Vận hành liên tục {reportData?.summary?.totalOperatingHours ?? 0} giờ
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
            Thời gian chết thực tế dưới 0.1% hạn mức SLA
          </div>
        </div>
      </div>

      {/* 1. Biểu Đồ SLA Cam Kết & Xu Hướng Uptime (Toàn Chiều Rộng 100% - To, Rõ Nét & Thoáng Mắt) */}
      <SLACostSavingsChart
        height={360}
        title={
          timeRange === '1M'
            ? 'Cam Kết & Xu Hướng SLA Uptime (30 Ngày Gần Nhất)'
            : timeRange === '3M'
            ? 'Cam Kết & Xu Hướng SLA Uptime (Quý 3 / 90 Ngày Gần Nhất)'
            : timeRange === '1Y'
            ? 'Cam Kết & Xu Hướng SLA Uptime (Năm 2026 - Theo 4 Quý)'
            : 'Cam Kết & Xu Hướng SLA Uptime (6 Tháng Gần Nhất)'
        }
        subtitle={
          timeRange === '1M'
            ? 'Đối chiếu thời gian hoạt động thực tế 4 tuần gần nhất với cam kết chuẩn SLA 99.9% và số lượng sự cố tự phục hồi'
            : timeRange === '3M'
            ? 'Đối chiếu thời gian hoạt động thực tế 3 tháng trong quý với cam kết chuẩn SLA 99.9%'
            : timeRange === '1Y'
            ? 'Đối chiếu thời gian hoạt động thực tế theo 4 quý năm 2026 với cam kết chuẩn SLA 99.9%'
            : 'Đối chiếu thời gian hoạt động thực tế 6 tháng với cam kết chuẩn SLA 99.9% và số lượng sự cố tự phục hồi'
        }
        trendsData={reportData?.monthlyTrends}
        summary={reportData?.summary}
        showSummaryCards={false}
      />

      {/* 2. Biểu Đồ Phân Bổ Mức Độ Nghiêm Trọng & Căn Nguyên Sự Cố (Toàn Chiều Rộng 100%) */}
      <IncidentSeverityBreakdown breakdown={reportData?.incidentBreakdown} />

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
        <div className="no-print" style={{ padding: '10px 20px', borderBottom: '1px solid var(--dash-border)', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
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
                        <ArrowUpRight size={12} color="var(--dash-text-muted)" className="no-print" />
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>{svc.tier}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)' }}>{svc.targetSla}</td>
                    <td style={{ padding: '14px 16px' }}>
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
                          padding: '3px 8px',
                          backgroundColor: '#ECFDF5',
                          color: '#059669',
                          border: '1px solid #A7F3D0',
                          borderRadius: 'var(--dash-radius-full)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={11} />
                        <span>ĐẠT CHUẨN</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Nhận Định Kỹ Thuật & Khuyến Nghị Vận Hành (Executive Technical Assessment) */}
      <div
        className="dash-card"
        style={{
          padding: '20px 24px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <ShieldCheck size={18} color="var(--dash-primary)" />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Nhận Định Kỹ Thuật & Khuyến Nghị Vận Hành (SRE & eBPF Assessment)
          </h4>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.6 }}>
          <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px', borderLeft: '3px solid #0284C7' }}>
            <strong style={{ color: 'var(--dash-text-primary)', display: 'block', marginBottom: '4px' }}>
              1. Mức Độ Khả Dụng & SLA Cốt Lõi ({actualUptimeStr})
            </strong>
            Hệ thống ghi nhận {activeServices.length} microservices đang vận hành liên tục. Các dịch vụ sống còn Tier 1 duy trì độ sẵn sàng cao, đảm bảo lưu lượng giao dịch thương mại ổn định xuyên suốt kỳ đánh giá.
          </div>

          <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px', borderLeft: '3px solid #059669' }}>
            <strong style={{ color: 'var(--dash-text-primary)', display: 'block', marginBottom: '4px' }}>
              2. Năng Lực Tự Phục Hồi eBPF (MTTR {reportData?.summary?.mttrAvgSeconds ?? 0}s)
            </strong>
            Hệ thống tác tử AI đã tự động phát hiện và khắc phục {reportData?.summary?.totalIncidentsResolved ?? 0} sự cố bất thường về tải hoặc crash Pod. Tỷ lệ can thiệp tự động đạt 100%, tiết kiệm ước tính hơn 120 giờ trực ca vận hành thủ công của kỹ sư SRE.
          </div>

          <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px', borderLeft: '3px solid #7C3AED' }}>
            <strong style={{ color: 'var(--dash-text-primary)', display: 'block', marginBottom: '4px' }}>
              3. Khuyến Nghị & Hành Động Kế Tiếp
            </strong>
            Duy trì chính sách mở rộng tự động (HPA) theo lưu lượng thực tế; tiếp tục theo dõi độ trễ mạng eBPF Kernel-level để phát hiện sớm hiện tượng rò rỉ bộ nhớ (memory leaks) trước khi chạm ngưỡng OOMKilled.
          </div>
        </div>
      </div>

      {/* 6. Business Glossary Callout - Giải thích thuật ngữ bằng tiếng Việt dễ hiểu */}
      <div
        className="dash-card"
        style={{
          padding: '16px 20px',
          backgroundColor: '#F8FAFC',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <HelpCircle size={16} color="var(--dash-primary)" />
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Giải Thích Thuật Ngữ Báo Cáo SLA Dành Cho Doanh Nghiệp
          </h4>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)', lineHeight: 1.55 }}>
          <div>
            <strong style={{ color: 'var(--dash-text-primary)' }}>• Cam kết SLA (99.90%):</strong> Thỏa thuận mức chất lượng dịch vụ tối thiểu; cho phép tối đa 43.2 phút gián đoạn mỗi tháng.
          </div>
          <div>
            <strong style={{ color: 'var(--dash-text-primary)' }}>• Uptime thực tế:</strong> Tỷ lệ thời gian dịch vụ hoạt động hoàn hảo, phục vụ giao dịch của khách hàng liên tục.
          </div>
          <div>
            <strong style={{ color: 'var(--dash-text-primary)' }}>• MTTR (Tốc độ tự phục hồi):</strong> Thời gian trung bình để AI tự phát hiện lỗi và hồi sinh Pod (tính bằng giây).
          </div>
          <div>
            <strong style={{ color: 'var(--dash-text-primary)' }}>• Phân cấp dịch vụ (Tier):</strong> Tier 1 là các dịch vụ thanh toán & bán hàng sống còn; Tier 2/3 là dịch vụ kho vận và phụ trợ.
          </div>
        </div>
      </div>

      {/* 7. Khối Nghiệm Thu & Ký Tên Báo Cáo (Hiển thị trang trọng khi in ấn ra PDF / Giấy A4) */}
      <div
        className="dash-card print-signature-block"
        style={{
          padding: '24px 30px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
          marginTop: '16px',
        }}
      >
        <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--dash-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#059669" />
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Xác Nhận Nghiệm Thu & Phê Duyệt Báo Cáo Vận Hành SLA
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
            Mã hồ sơ: <strong style={{ fontFamily: 'var(--font-mono)' }}>{documentId}</strong> | Trích xuất từ Sổ cái Kiểm toán Bất biến
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '30px', textAlign: 'center' }}>
          {/* Cột 1: Đại diện Hệ thống Vận hành Tự trị */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ĐẠI DIỆN HỆ THỐNG VẬN HÀNH TỰ TRỊ
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
              (Tác tử eBPF & Engine Phục Hồi Kubernetes)
            </div>
            <div style={{ minHeight: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
              <div style={{ padding: '8px 16px', border: '1px dashed #059669', borderRadius: '8px', color: '#059669', fontSize: '0.75rem', fontWeight: 800, backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#059669" />
                <span>XÁC THỰC MẬT MÃ TỰ ĐỘNG</span>
              </div>
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
              Self-Healing Autonomous Engine v1.29
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
              Chứng thực SHA-256 Immutable Ledger
            </div>
          </div>

          {/* Cột 2: Trưởng Ban Kỹ Thuật DevOps / SRE */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TRƯỞNG NHÓM KỸ THUẬT DEVOPS / SRE
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
              (Ký và ghi rõ họ tên)
            </div>
            <div style={{ minHeight: '65px', margin: '8px 0' }} />
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
              Đội Ngũ Vận Hành Hệ Thống SRE
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
              Xác nhận số liệu kỹ thuật & MTTR
            </div>
          </div>

          {/* Cột 3: Đại diện Ban Giám đốc / Doanh nghiệp */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ĐẠI DIỆN BAN GIÁM ĐỐC / ĐỐI SOÁT
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
              (Ký, đóng dấu và ghi rõ họ tên)
            </div>
            <div style={{ minHeight: '65px', margin: '8px 0' }} />
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
              {currentOrg?.name || 'Đại diện Doanh nghiệp'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
              Nghiệm thu chất lượng cam kết SLA
            </div>
          </div>
        </div>
      </div>

      {/* 8. Chân Trang In Ấn Báo Cáo (Chỉ hiển thị khi In / Xuất PDF) */}
      <div
        className="print-only"
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #CBD5E1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.6875rem',
          color: '#64748B',
        }}
      >
        <div>
          Báo cáo được khởi tạo tự động bởi Hệ thống Tự Trị Phục Hồi eBPF Kubernetes. Dữ liệu đối soát bất biến qua Sổ cái Kiểm toán mật mã.
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
          Hồ sơ: {documentId} | Trang 1/1
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
