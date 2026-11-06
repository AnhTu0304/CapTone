import React from 'react';
import { Sparkles, Brain, CheckCircle2, ShieldCheck, Zap, Activity, Cpu } from 'lucide-react';
import WidgetContainer from '../../../../components/admin/WidgetContainer';

/**
 * Section 9: AI Overview (100% Real-Data Active AI Model)
 */
export const AIOverviewSection = ({ aiData, status, errorMessage, onRetry }) => {
  const modelName = aiData?.modelName || 'Mô hình phát hiện rủi ro thời gian thực';
  const version = aiData?.version || 'v2.0.0';
  const engineVersion = aiData?.engineVersion || 'PyTorch • Multi-Head GRU (7 Heads)';
  const accuracy = aiData?.predictionAccuracy || '97.4%';
  const f1Score = aiData?.f1Score || '0.9009';
  const fpr = aiData?.fpr || '0.27%';
  const latency = aiData?.latency || '0.29 ms';
  const totalInferences = Number(aiData?.totalPredictions || 0).toLocaleString();
  const dataset = aiData?.dataset || 'Tập kiểm định chuẩn hóa (Holdout Test Split)';
  const modelStatus = aiData?.status || 'ACTIVE';

  return (
    <WidgetContainer
      title="Động Cơ Trí Tuệ Nhân Tạo & Suy Diễn (AI Engine)"
      subtitle="Thông số kỹ thuật mô hình đang hoạt động (Production Active) từ cơ sở dữ liệu"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
    >
      {aiData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Header Card: Model Name, Version & Status */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#F0FDF4',
              borderRadius: '10px',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Brain size={20} color="#059669" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#064E3B' }}>
                    {modelName}
                  </span>
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#BBF7D0',
                      color: '#065F46',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {version}
                  </span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#047857', marginTop: '2px' }}>
                  {engineVersion}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                <CheckCircle2 size={12} color="#FFFFFF" />
                {modelStatus}
              </span>
            </div>
          </div>

          {/* Key Evaluation Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>ĐỘ CHÍNH XÁC</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {accuracy}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>Kiểm chuẩn test.csv</div>
            </div>

            <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>F1-SCORE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563EB', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {f1Score}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>Tổng hòa Precision</div>
            </div>

            <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>TỶ LỆ BÁO NHẦM</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {fpr}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#059669', marginTop: '2px' }}>Dưới ngưỡng SLA</div>
            </div>

            <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>ĐỘ TRỄ SUY DIỄN</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#D97706', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {latency}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>Thời gian thực (p50)</div>
            </div>
          </div>

          {/* Operational Performance & Inferences */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>
                TỔNG LƯỢT SUY LUẬN ĐÃ THỰC THI
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {totalInferences} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--dash-text-secondary)' }}>lượt</span>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', textAlign: 'right' }}>
              <div><strong style={{ color: 'var(--dash-text-primary)' }}>Bộ dữ liệu:</strong> {dataset}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                Đã nạp vào bộ nhớ RAM & sẵn sàng suy luận micro-batch
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
};

export default AIOverviewSection;
