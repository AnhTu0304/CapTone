import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Cpu,
  Database,
  HardDrive,
  Box,
  AlertTriangle,
  Radio,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Terminal,
  HelpCircle,
} from 'lucide-react';
import InteractiveResourceChart from '../../../components/dashboard/InteractiveResourceChart';

export const OverviewPage = () => {
  const {
    currentOrg,
    currentEnv,
    isAgentConnected,
    isAutoRefresh,
    lastUpdated,
    isRefreshing,
    triggerRefresh,
    pendingApprovalsCount,
    onNavigate,
  } = useDashboard();


  // If no agent connected, render Honest Empty State
  if (!isAgentConnected) {
    return (
      <div className="dashboard-overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Tổng Quan Vận Hành Hạ Tầng
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
              {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span>
            </p>
          </div>
          <button
            onClick={triggerRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Kiểm tra kết nối</span>
          </button>
        </div>

        {/* Honest Empty State Card */}
        <div
          className="dash-card"
          style={{
            padding: '64px 32px',
            textAlign: 'center',
            maxWidth: '680px',
            margin: '40px auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--dash-radius-xl)',
              backgroundColor: 'var(--dash-mint-100)',
              color: 'var(--dash-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <Radio size={32} />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '8px' }}>
            Chưa có Tác tử Kubernetes Kết nối
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', lineHeight: 1.6, maxWidth: '520px', marginBottom: '24px' }}>
            SelfHeal tuân thủ nghiêm ngặt nguyên tắc viễn trắc trung thực: không hiển thị số liệu giả lập khi chưa kết nối. Để bắt đầu giám sát chủ động và kích hoạt AI dự báo, hãy triển khai tác tử siêu nhẹ eBPF vào cụm Kubernetes của bạn.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/agents')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: 'var(--dash-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--dash-radius-md)',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: 'var(--dash-shadow-sm)',
              }}
            >
              <Terminal size={16} />
              <span>Cài đặt Tác tử Ngay</span>
            </button>

            <button
              onClick={() => onNavigate && onNavigate('/guide')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-secondary)',
                borderRadius: 'var(--dash-radius-md)',
                border: '1px solid var(--dash-border)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <span>Xem Hướng dẫn Cài đặt</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Tổng Quan Vận Hành Hạ Tầng
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{currentOrg.name}</span>
            <span>&bull;</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span>
            <span>&bull;</span>
            <span style={{ color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Cập nhật gần nhất: {lastUpdated}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--dash-radius-full)',
              backgroundColor: isAutoRefresh ? 'var(--dash-mint-100)' : 'var(--dash-bg-subtle)',
              color: isAutoRefresh ? 'var(--dash-mint-600)' : 'var(--dash-text-muted)',
              border: isAutoRefresh ? '1px solid var(--dash-mint-200)' : '1px solid var(--dash-border)',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isAutoRefresh ? 'var(--dash-success)' : 'var(--dash-text-muted)' }} />
            <span>Tự làm mới: {isAutoRefresh ? '30s đang bật' : 'Tạm dừng'}</span>
          </span>

          <button
            onClick={triggerRefresh}
            disabled={isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. System Health Card */}
      <div
        className="dash-card"
        style={{
          padding: '20px 24px',
          backgroundColor: '#FFFFFF',
          borderLeft: '4px solid var(--dash-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--dash-radius-lg)',
              backgroundColor: 'var(--dash-success-bg)',
              color: 'var(--dash-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                Trạng Thái Hệ Thống: Khỏe Mạnh & Ổn Định
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: 'var(--dash-success-bg)',
                  color: 'var(--dash-success-text)',
                  border: '1px solid var(--dash-success-border)',
                }}
              >
                HOẠT ĐỘNG TỐT
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Toàn bộ 8 máy chủ (nodes) và 84 pods báo cáo dữ liệu định kỳ ổn định. Đầu dò nhân eBPF hoạt động với độ trễ &lt; 1.2ms. Không có sự cố nghiêm trọng nào.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Kết Nối Tác Tử
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-success)' }}>
              Đã kết nối (Nhịp tim 4s)
            </div>
          </div>
          <div style={{ height: '28px', width: '1px', backgroundColor: 'var(--dash-border)' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Sự Cố Đang Diễn Ra
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
              0 Sự cố nghiêm trọng
            </div>
          </div>
        </div>
      </div>

      {/* 3. Overview Metric Cards (8 Cards in Responsive Grid) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: CPU Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sử dụng CPU</span>
            <Cpu size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              42%
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)', display: 'flex', alignItems: 'center' }}>
              <ArrowDownRight size={14} /> 3.2%
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Đã cấp phát: 6.72 / 16 vCPUs
          </div>
        </div>

        {/* Card 2: Memory Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sử dụng RAM</span>
            <Database size={16} color="var(--dash-info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              68%
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-warning)', display: 'flex', alignItems: 'center' }}>
              <ArrowUpRight size={14} /> 1.8%
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            RSS: 43.5 GB / 64 GB
          </div>
        </div>

        {/* Card 3: Disk Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Dung lượng Ổ đĩa</span>
            <HardDrive size={16} color="var(--dash-text-secondary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              24%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Ổn định</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Ổ đĩa PV: 240 GB / 1.0 TB
          </div>
        </div>

        {/* Card 4: Running Pods */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Pods Đang Chạy</span>
            <Box size={16} color="var(--dash-mint-600)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              84 / 84
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>100% Bình thường</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Trên 6 Namespaces
          </div>
        </div>

        {/* Card 5: Active Incidents */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sự cố Đang Diễn Ra</span>
            <AlertTriangle size={16} color="var(--dash-success)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              0
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>An toàn</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Sự cố gần nhất: 3 ngày trước
          </div>
        </div>

        {/* Card 6: Agent Status */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Trạng thái Tác tử</span>
            <Radio size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              Trực tuyến
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-success)', fontWeight: 600 }}>&lt; 1.2ms</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Nhân eBPF v1.4.2 đang chạy
          </div>
        </div>

        {/* Card 7: Self-Healing Actions */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tự Phục Hồi (24h)</span>
            <Zap size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              12
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>100% Thành công</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Thời gian phục hồi TB: 1.8s
          </div>
        </div>

        {/* Card 8: Pending Approvals (HITL Gate) */}
        <div
          className="dash-card"
          onClick={() => onNavigate && onNavigate('/dashboard/self-healing/approvals')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            backgroundColor: pendingApprovalsCount > 0 ? 'var(--dash-warning-bg)' : '#FFFFFF',
            border: pendingApprovalsCount > 0 ? '1px solid var(--dash-warning-border)' : '1px solid var(--dash-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: pendingApprovalsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-secondary)' }}>
              Phê duyệt Chờ Xử lý (HITL)
            </span>
            <CheckCircle2 size={16} color={pendingApprovalsCount > 0 ? 'var(--dash-warning)' : 'var(--dash-text-muted)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: pendingApprovalsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {pendingApprovalsCount}
            </span>
            {pendingApprovalsCount > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-warning-text)' }}>
                Cần xử lý &rarr;
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.6875rem', color: pendingApprovalsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-muted)', marginTop: '6px' }}>
            Tháo tải máy chủ worker-03
          </div>
        </div>
      </div>

      {/* 4. Interactive Infrastructure Metrics Resource Chart */}
      <InteractiveResourceChart totalCpuCores={32} totalMemoryGb={64} />


      {/* 5, 6, 7. Summaries Grid: AI Predictions, Incidents, Self-Healing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* 5. AI Prediction Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-mint-100)',
                  color: 'var(--dash-mint-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={16} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                AI Dự Báo Rủi Ro Chủ Động
              </h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/ai/predictions')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Xem tất cả &rarr;
            </button>
          </div>

          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--dash-bg-subtle)',
              borderRadius: 'var(--dash-radius-sm)',
              fontSize: '0.6875rem',
              color: 'var(--dash-text-secondary)',
              lineHeight: 1.4,
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
            }}
          >
            <HelpCircle size={14} color="var(--dash-text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Lưu ý kỹ thuật:</strong> Dự báo AI phản ánh rủi ro xác suất dựa trên chuỗi thời gian, không phải sự cố đã xảy ra.
            </span>
          </div>

          {/* Prediction Item */}
          <div
            style={{
              padding: '12px',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              backgroundColor: '#FFFFFF',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Rủi ro Bão hòa Bộ nhớ (RAM Exhaustion)
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: 'var(--dash-warning-bg)',
                  color: 'var(--dash-warning-text)',
                  border: '1px solid var(--dash-warning-border)',
                }}
              >
                Độ tin cậy 87%
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5 }}>
              Dịch vụ: <code style={{ color: 'var(--dash-text-primary)', fontWeight: 600 }}>payment-gateway</code> trong namespace <code style={{ color: 'var(--dash-text-muted)' }}>production</code>.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
              <span>Dự kiến xảy ra: ~18 phút tới</span>
              <span style={{ color: 'var(--dash-primary)', fontWeight: 600, cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('/dashboard/ai/predictions')}>
                Xem khuyến nghị &rarr;
              </span>
            </div>
          </div>
        </div>

        {/* 6. Incident Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-success-bg)',
                  color: 'var(--dash-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={16} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Sự Cố Đang Diễn Ra (0)
              </h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/incidents')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Xem lịch sử &rarr;
            </button>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'var(--dash-bg-canvas)',
              borderRadius: 'var(--dash-radius-md)',
              border: '1px dashed var(--dash-border)',
            }}
          >
            <ShieldCheck size={32} color="var(--dash-success)" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
              Toàn Bộ Hệ Thống Hoạt Động Tốt
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Không ghi nhận sự cố nghiêm trọng nào trong môi trường hiện tại suốt 72 giờ qua.
            </p>
          </div>
        </div>

        {/* 7. Self-Healing Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-mint-100)',
                  color: 'var(--dash-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={16} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Hiệu Quả Tự Phục Hồi
              </h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/self-healing/history')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Nhật ký đầy đủ &rarr;
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Tỷ Lệ Thành Công</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--dash-success)', marginTop: '2px' }}>100%</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>12/12 Hành động</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Thời Gian Phục Hồi TB</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>1.8s</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>Không gián đoạn</div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
            Hành Động Tự Động Gần Đây:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-xs)' }}>
              <span style={{ color: 'var(--dash-text-secondary)' }}>Khởi động lại cuốn chiếu: auth-service-v2</span>
              <span style={{ color: 'var(--dash-success)', fontWeight: 600 }}>Xử lý trong 1.4s</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-xs)' }}>
              <span style={{ color: 'var(--dash-text-secondary)' }}>Mở rộng bản sao replica: order-processor</span>
              <span style={{ color: 'var(--dash-success)', fontWeight: 600 }}>Xử lý trong 2.1s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
