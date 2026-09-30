import React from 'react';
import {
  Cpu,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  GitCommit,
  ArrowRight,
  Zap,
} from 'lucide-react';

export const AIOverviewSection = ({ kpis, onNavigate }) => {
  if (!kpis) return null;

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
            {kpis.activeModels}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
            ONNX Runtime & PyTorch
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
            <Sparkles size={14} style={{ color: '#2563EB' }} /> KHỐI LƯỢNG DỰ BÁO (24H)
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#1D4ED8', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {kpis.predictionVolume.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, marginTop: '2px' }}>
            Lượt suy diễn viễn trắc eBPF
          </div>
        </div>

        {/* 3. Average Confidence */}
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
            <ShieldCheck size={14} /> ĐỘ TIN CẬY TRUNG BÌNH
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#059669', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {kpis.averageConfidence}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#065F46', fontWeight: 600, marginTop: '2px' }}>
            Vượt ngưỡng chuẩn &gt; 90%
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
            <AlertTriangle size={14} /> DỰ BÁO RỦI RO CAO
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#DC2626', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {kpis.highRiskPredictions}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#DC2626', fontWeight: 600, marginTop: '2px' }}>
            Đã chuyển tiếp Cổng HITL
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
            {kpis.rcaAnalysisVolume}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, marginTop: '2px' }}>
            Đồ thị nhân quả tự động
          </div>
        </div>
      </div>

      {/* Feature Spotlight Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Models Spotlight */}
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
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
                Mô Hình Học Máy & Suy Luận (Models)
              </h4>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Quản lý các mô hình phát hiện dị thường eBPF, đồ thị nhân quả Causal Graph và dự báo sập Pods trước khi xảy ra sự cố.
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
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: '#F0FDF4',
              color: '#065F46',
              border: '1px solid #BBF7D0',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>Xem Danh Sách Mô Hình</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Performance Spotlight */}
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
              <Zap size={18} style={{ color: '#D97706' }} />
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
                Hiệu Năng & Độ Chính Xác Kiểm Định (Performance)
              </h4>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Đối soát minh bạch các chỉ số Accuracy, F1-Score, MAE/RMSE và tỷ lệ báo động sai (FPR) trên tập dữ liệu benchmark độc lập.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('/admin/ai/performance')}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: '#FFFBEB',
              color: '#92400E',
              border: '1px solid #FDE68A',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>Xem Ma Trận Hiệu Năng</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIOverviewSection;
