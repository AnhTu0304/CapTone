import React from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  PieChart,
} from 'lucide-react';

export const SelfHealingAnalytics = ({ analytics, isLoading = false }) => {
  if (isLoading) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Đang tải dữ liệu phân tích số liệu tự phục hồi...
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 5 KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        {/* 1. Total Actions */}
        <div
          className="dash-card"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={14} style={{ color: '#059669' }} /> TỔNG SỐ HÀNH ĐỘNG
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {analytics.totalActions}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
            Toàn bộ các cụm K8s
          </div>
        </div>

        {/* 2. Success Rate */}
        <div
          className="dash-card"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #BBF7D0',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={14} /> TỶ LỆ THÀNH CÔNG
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#059669', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {analytics.successRate}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#065F46', fontWeight: 600, marginTop: '2px' }}>
            Mục tiêu cam kết &gt; 95%
          </div>
        </div>

        {/* 3. Failed Actions */}
        <div
          className="dash-card"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #FECACA',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <XCircle size={14} /> HÀNH ĐỘNG THẤT BẠI
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#DC2626', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {analytics.failedActions}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#DC2626', fontWeight: 600, marginTop: '2px' }}>
            Đã hoàn nguyên (Rollback)
          </div>
        </div>

        {/* 4. Average Recovery Time */}
        <div
          className="dash-card"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={14} style={{ color: '#059669' }} /> THỜI GIAN PHỤC HỒI TRUNG BÌNH
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#059669', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {analytics.averageRecoveryTime}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, marginTop: '2px' }}>
            MTTR đo từ lúc kích hoạt
          </div>
        </div>

        {/* 5. Retry Count */}
        <div
          className="dash-card"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <RotateCcw size={14} style={{ color: '#D97706' }} /> SỐ LẦN THỬ LẠI
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#D97706', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {analytics.retryCount}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, marginTop: '2px' }}>
            Tuân thủ giới hạn Max Retries
          </div>
        </div>
      </div>

      {/* 6. Action Type Distribution Card */}
      <div
        className="dash-card"
        style={{
          padding: '24px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={18} style={{ color: '#059669' }} />
              Phân Bổ Hành Động Tự Phục Hồi Theo Loại (Action Type Distribution)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Tỷ lệ cơ cấu các biện pháp can thiệp tự động được kích hoạt trên hệ thống
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {analytics.actionTypeDistribution.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{item.type}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                  {item.count} lượt ({item.percentage}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '9999px',
                  backgroundColor: '#F1F5F9',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${item.percentage}%`,
                    height: '100%',
                    borderRadius: '9999px',
                    background:
                      idx === 0
                        ? 'linear-gradient(90deg, #059669, #10B981)'
                        : idx === 1
                        ? 'linear-gradient(90deg, #2563EB, #3B82F6)'
                        : idx === 2
                        ? 'linear-gradient(90deg, #7C3AED, #8B5CF6)'
                        : 'linear-gradient(90deg, #D97706, #F59E0B)',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SelfHealingAnalytics;
