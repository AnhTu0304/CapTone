import React from 'react';
import {
  Cpu,
  GitCommit,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Scale,
} from 'lucide-react';

export const AIOverviewSection = ({ kpis, models = [], onNavigate }) => {
  if (!kpis) return null;

  const activeModel = kpis.activeModel || models.find((m) => m.status === 'ACTIVE') || models[0] || null;
  const riskBreakdown = kpis.riskBreakdown || {};

  const totalRiskCount = Object.values(riskBreakdown).reduce((a, b) => a + Number(b), 0) || 1;

  const riskColors = {
    NORMAL: '#059669',
    OOM: '#DC2626',
    HTTP_5XX_SPIKE: '#7C3AED',
    HIGH_LATENCY: '#2563EB',
    CPU_OVERLOAD: '#D97706',
  };

  const riskLabels = {
    NORMAL: 'Bình Thường (Healthy)',
    OOM: 'Tràn RAM (OOM-Killed)',
    HTTP_5XX_SPIKE: 'Bùng Nổ Lỗi (HTTP 5xx)',
    HIGH_LATENCY: 'Độ Trễ Cao (High Latency)',
    CPU_OVERLOAD: 'Quá Tải CPU (CPU Spike)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. 5 KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        {/* 1. Active Models */}
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
            <Cpu size={14} style={{ color: '#059669' }} /> MÔ HÌNH HOẠT ĐỘNG
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {kpis.activeModels} <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>/ {models.length || 4}</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
            Multi-Head GRU PyTorch
          </div>
        </div>

        {/* 2. Prediction Volume */}
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
            <Sparkles size={14} style={{ color: '#2563EB' }} /> TỔNG LƯỢT SUY LUẬN
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#1D4ED8', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {(kpis.predictionVolume || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#2563EB', fontWeight: 600, marginTop: '2px' }}>
            Telemetry K8s thời gian thực
          </div>
        </div>

        {/* 3. Average Accuracy */}
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
            <ShieldCheck size={14} /> ĐỘ CHÍNH XÁC KIỂM ĐỊNH
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#059669', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {kpis.averageConfidence}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#065F46', fontWeight: 600, marginTop: '2px' }}>
            F1-Score: {activeModel?.rawMetrics?.overall?.f1_score ?? 'N/A'}
          </div>
        </div>

        {/* 4. High-risk Predictions */}
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
            <AlertTriangle size={14} /> DỰ BÁO CẢNH BÁO RỦI RO
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#DC2626', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {(kpis.highRiskPredictions || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#DC2626', fontWeight: 600, marginTop: '2px' }}>
            OOM, Latency, 5xx & CPU
          </div>
        </div>

        {/* 5. RCA Analysis Volume */}
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
            <GitCommit size={14} style={{ color: '#7C3AED' }} /> PHÂN TÍCH NGUYÊN NHÂN (RCA)
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#7C3AED', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {(kpis.rcaAnalysisVolume || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#7C3AED', fontWeight: 600, marginTop: '2px' }}>
            Đồ thị truy vết sự cố K8s
          </div>
        </div>
      </div>

      {/* 2. Active Model Live Status Banner */}
      {activeModel && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '2px solid #059669',
            borderRadius: '16px',
            padding: '22px 26px',
            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#ECFDF5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #A7F3D0',
                }}
              >
                <Cpu size={24} color="#059669" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', textTransform: 'uppercase' }}>
                    Production Active
                  </span>
                  <div style={{ fontSize: '1.1875rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                    {activeModel.name}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '3px' }}>
                  Phiên bản: <strong>{activeModel.version}</strong> • Engine: {activeModel.framework} • Cập nhật: {activeModel.updatedAt || 'Hôm nay'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/admin/ai/comparison')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Scale size={14} color="#059669" />
                <span>So Sánh Phiên Bản</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/admin/ai/models')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                }}
              >
                <span>Hồ Sơ Chi Tiết Model</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px dashed var(--dash-border)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>Độ chính xác (Holdout)</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                {activeModel.rawMetrics?.overall?.accuracy != null ? `${activeModel.rawMetrics.overall.accuracy}%` : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>Điểm F1-Score</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1D4ED8', marginTop: '2px' }}>
                {activeModel.rawMetrics?.overall?.f1_score ?? '--'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>Tỷ lệ báo nhầm (FPR)</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                {activeModel.rawMetrics?.overall?.false_positive_rate != null ? `${activeModel.rawMetrics.overall.false_positive_rate}%` : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>Độ trễ suy luận</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0369A1', marginTop: '2px' }}>
                {activeModel.rawMetrics?.overall?.latency_ms != null ? `${activeModel.rawMetrics.overall.latency_ms} ms` : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>Lượt suy luận thực tế</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                {(activeModel.predictionCount || 0).toLocaleString()} lượt
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Live Telemetry Risk Distribution Breakdown */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: 'var(--dash-shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
              Phân Bổ Kết Quả Dự Báo Viễn Trắc Thực Tế (Live Telemetry Distribution)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
              Thống kê trực tiếp từ {(kpis.predictionVolume || 0).toLocaleString()} bản ghi suy luận trong bảng ai_predictions
            </div>
          </div>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid var(--dash-border)' }}>
            Dữ liệu trực tiếp (Live DB)
          </span>
        </div>

        {/* Multi-segmented Progress Bar */}
        <div style={{ height: '14px', borderRadius: '7px', backgroundColor: '#F1F5F9', overflow: 'hidden', display: 'flex' }}>
          {Object.entries(riskBreakdown).map(([riskKey, count]) => {
            const pct = (Number(count) / totalRiskCount) * 100;
            return (
              <div
                key={riskKey}
                title={`${riskLabels[riskKey] || riskKey}: ${Number(count).toLocaleString()} (${pct.toFixed(1)}%)`}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: riskColors[riskKey] || '#64748B',
                  transition: 'width 0.3s ease',
                }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', paddingTop: '4px' }}>
          {Object.entries(riskBreakdown).map(([riskKey, count]) => {
            const pct = ((Number(count) / totalRiskCount) * 100).toFixed(1);
            return (
              <div
                key={riskKey}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--dash-border)',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: riskColors[riskKey] || '#64748B',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {riskLabels[riskKey] || riskKey}
                  </div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '1px' }}>
                    {Number(count).toLocaleString()} <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>({pct}%)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. 4 Feature Spotlight Navigation Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Module 1: Models */}
        <div
          className="dash-card"
          style={{
            padding: '20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Cpu size={18} style={{ color: '#059669' }} />
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
                Kho Mô Hình Học Máy (Models)
              </h4>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Quản lý danh sách checkpoint `.pth`, tải lên mô hình mới, kích hoạt mô hình Active và xem hồ sơ kỹ thuật chi tiết.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('/admin/ai/models')}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>Quản Lý Mô Hình</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Module 2: Comparison */}
        <div
          className="dash-card"
          style={{
            padding: '20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Scale size={18} style={{ color: '#059669' }} />
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
                Đánh Giá & So Sánh Trước / Sau
              </h4>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Đối chiếu trực tiếp 6 chỉ số tổng thể, bảng điểm 6 loại rủi ro K8s giữa hai phiên bản mô hình và Rollback an toàn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('/admin/ai/comparison')}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>So Sánh Phiên Bản</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIOverviewSection;
