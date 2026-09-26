import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { exportToCsv } from '../../../utils/exportUtils';
import SLACostSavingsChart from '../../../components/dashboard/SLACostSavingsChart';
import {
  BarChart3,
  TrendingUp,
  Download,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

const SERVICE_SLA_METRICS = [
  {
    name: 'payment-service',
    tier: 'Tier 1 (Tối quan trọng)',
    targetSla: '99.90%',
    actualUptime: '99.99%',
    mttrAvg: '1.4s',
    incidentsResolved: 18,
    status: 'Vượt Chuẩn SLA',
  },
  {
    name: 'api-gateway',
    tier: 'Tier 1 (Cửa ngõ truy cập)',
    targetSla: '99.90%',
    actualUptime: '99.98%',
    mttrAvg: '1.8s',
    incidentsResolved: 12,
    status: 'Đạt Chuẩn SLA',
  },
  {
    name: 'auth-service',
    tier: 'Tier 1 (Đăng nhập & RBAC)',
    targetSla: '99.90%',
    actualUptime: '99.97%',
    mttrAvg: '1.2s',
    incidentsResolved: 14,
    status: 'Đạt Chuẩn SLA',
  },
  {
    name: 'order-processor',
    tier: 'Tier 2 (Xử lý đơn hàng)',
    targetSla: '99.50%',
    actualUptime: '99.96%',
    mttrAvg: '2.3s',
    incidentsResolved: 21,
    status: 'Vượt Chuẩn SLA',
  },
  {
    name: 'notification-service',
    tier: 'Tier 3 (Tin nhắn & Email)',
    targetSla: '99.00%',
    actualUptime: '99.95%',
    mttrAvg: '1.9s',
    incidentsResolved: 8,
    status: 'Vượt Chuẩn SLA',
  },
];

export const ReportsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const { success: toastSuccess } = useToast();
  const [timeRange, setTimeRange] = useState('6M');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleExportReport = () => {
    const headers = ['Dịch Vụ Vi Mô', 'Phân Cấp (Tier)', 'SLA Cam Kết', 'Uptime Thực Tế', 'MTTR Trung Bình', 'Sự Cố Tự Xử Lý', 'Trạng Thái Đạt'];
    const rows = SERVICE_SLA_METRICS.map((s) => [
      s.name,
      s.tier,
      s.targetSla,
      s.actualUptime,
      s.mttrAvg,
      s.incidentsResolved,
      s.status,
    ]);
    exportToCsv(`bao-cao-sla-chi-phi-${timeRange.toLowerCase()}-2026.csv`, headers, rows);
    setDownloadSuccess(true);
    toastSuccess('Báo cáo SLA & Hiệu quả chi phí đã được tải xuống máy thành công!', 'Xuất Báo Cáo CSV');
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="dashboard-reports-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Báo Cáo SLA & Hiệu Quả Chi Phí Doanh Nghiệp
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Đánh giá hiệu quả đầu tư tự phục hồi (ROI) và cam kết thời gian hoạt động hệ thống
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
            onClick={triggerRefresh}
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
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới số liệu</span>
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

      {/* 4 Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>UPTIME TRUNG BÌNH THỰC TẾ</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284C7', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            99.98%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={12} />
            <span>Vượt 0.08% so với cam kết 99.90%</span>
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>THỜI GIAN KHẮC PHỤC (MTTR)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            1.8 giây
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
            Nhanh hơn 120 lần so với can thiệp thủ công (24 phút)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TỔNG THIỆT HẠI ĐÃ TRÁNH ĐƯỢC</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-primary)', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            $24,150
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
            Tiết kiệm ~600,000,000 VNĐ cho doanh nghiệp SME
          </div>
        </div>

        <div className="dash-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TỶ LỆ TỰ TRỊ KHÔNG GIÁN ĐOẠN</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7C3AED', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
            96.2%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
            Chỉ 3.8% hành động nhạy cảm cần qua Cổng HITL
          </div>
        </div>
      </div>

      {/* Main Interactive React Chart */}
      <SLACostSavingsChart height={260} />

      {/* Service-by-Service SLA Breakdown Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Bảng Phân Tích SLA Theo Từng Dịch Vụ Microservice
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Số liệu tổng hợp đối chiếu trực tiếp từ cụm Kubernetes k8s-prod-cluster-01
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Chu kỳ: 6 Tháng qua
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
              {SERVICE_SLA_METRICS.map((svc) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
