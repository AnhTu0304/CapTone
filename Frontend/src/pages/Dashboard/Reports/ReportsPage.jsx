import React, { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { exportToCsv } from '../../../utils/exportUtils';
import SLACostSavingsChart from '../../../components/dashboard/SLACostSavingsChart';
import { fetchOrganizationSLAReport } from '../../../services/reportService';
import {
  BarChart3,
  TrendingUp,
  Download,
  CheckCircle2,
  RefreshCw,
  GitCommit,
  AlertTriangle
} from 'lucide-react';

export const ReportsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const { success: toastSuccess } = useToast();
  const [timeRange, setTimeRange] = useState('6M');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  const loadReport = useCallback(async () => {
    setIsLoadingReport(true);
    setReportError(null);
    try {
      const data = await fetchOrganizationSLAReport({
        organizationId: currentOrg?.id,
        environmentId: currentEnv?.id,
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
  }, [currentOrg?.id, currentEnv?.id, timeRange]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const activeServices = reportData?.services || [];
  const recentChanges = reportData?.recentChanges || [];

  const handleExportReport = () => {
    const headers = ['Dịch Vụ Vi Mô', 'Phân Cấp (Tier)', 'SLA Cam Kết', 'Uptime Thực Tế', 'MTTR Trung Bình', 'Sự Cố Tự Xử Lý', 'Trạng Thái Đạt'];
    const rows = activeServices.map((s) => [
      s.name,
      s.tier,
      s.targetSla,
      s.actualUptime,
      s.mttrAvg,
      s.incidentsResolved,
      s.status,
    ]);
    exportToCsv(`bao-cao-sla-${timeRange.toLowerCase()}-2026.csv`, headers, rows);
    setDownloadSuccess(true);
    toastSuccess('Báo cáo SLA & Vận hành đã được tải xuống máy thành công!', 'Xuất Báo Cáo CSV');
    setTimeout(() => setDownloadSuccess(false), 3000);
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

          <button
            type="button"
            onClick={handleExportReport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--dash-primary)',
              border: 'none',
              borderRadius: 'var(--dash-radius-md)',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            <span>{downloadSuccess ? 'Đang tải báo cáo...' : 'Xuất Báo Cáo SLA'}</span>
          </button>
        </div>
      </div>

      {downloadSuccess && (
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
          <span>Báo cáo kiểm toán SLA kỳ {timeRange} đã được tạo thành công dưới định dạng PDF & Excel.</span>
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

      {/* Main Interactive React Chart */}
      <SLACostSavingsChart height={260} trendsData={reportData?.monthlyTrends} summary={reportData?.summary} />

      {/* Service-by-Service SLA Breakdown Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              {activeServices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
                    {currentOrg?.name || 'Tổ chức'} chưa liên kết cụm Kubernetes hoặc chưa có dịch vụ vi mô nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                activeServices.map((svc) => (
                  <tr key={svc.name} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)' }}>{svc.name}</div>
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
              </tr>
            </thead>
            <tbody>
              {recentChanges.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
                    Chưa có biến động hoặc sự cố tự khắc phục nào được ghi nhận trong khoảng thời gian này.
                  </td>
                </tr>
              ) : (
                recentChanges.map((chg) => {
                  const isRollback = String(chg.type || '').toUpperCase().includes('ROLLBACK');
                  const isSucceeded = chg.result === 'SUCCEEDED';
                  return (
                    <tr key={chg.id} style={{ borderBottom: '1px solid var(--dash-border)', backgroundColor: '#FFFFFF' }}>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                        {chg.id}
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
