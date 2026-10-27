import React from 'react';
import { Cpu, GitCommit, Activity, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';

export const IncidentRCA = ({ rca, isLoading = false }) => {
  if (isLoading) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '30px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          textAlign: 'center',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Đang tải phân tích nguyên nhân gốc rễ (RCA)...
      </div>
    );
  }

  if (!rca) return null;

  return (
    <div
      className="dash-card"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
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
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} style={{ color: '#059669' }} />
            Chẩn Đoán Nguyên Nhân Gốc Rễ (Root Cause Analysis - RCA)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Xây dựng từ đồ thị nhân quả Causal Graph và tín hiệu đo lường kernel eBPF thời gian thực.
          </p>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: '#ECFDF5',
            color: '#065F46',
            border: '1px solid #A7F3D0',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          <Sparkles size={13} />
          <span>Độ tin cậy: {rca.confidence}</span>
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Root Cause Conclusion */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            KẾT LUẬN NGUYÊN NHÂN CỐT LÕI (ROOT CAUSE)
          </div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#065F46', marginTop: '6px', lineHeight: 1.5 }}>
            {rca.rootCause}
          </div>
        </div>

        {/* Causal Chain Sequence */}
        {rca.causalChain && rca.causalChain.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GitCommit size={15} style={{ color: '#059669' }} />
              Chuỗi Quan Hệ Nhân Quả (Causal Chain Graph)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rca.causalChain.map((item, idx) => (
                <div
                  key={item.step || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    backgroundColor: '#FAFAFA',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.6875rem',
                      flexShrink: 0,
                    }}
                  >
                    {item.step}
                  </div>

                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#F1F5F9',
                      color: '#0F172A',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.component}
                  </span>

                  <ArrowRight size={14} style={{ color: 'var(--dash-text-muted)', flexShrink: 0 }} />

                  <span style={{ color: 'var(--dash-text-secondary)', flex: 1 }}>{item.event}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Telemetry Signals Table */}
        {rca.signals && rca.signals.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={15} style={{ color: '#059669' }} />
              Tín Hiệu Dị Thường Thu Thập Từ Nhân Kernel (Telemetry Signals)
            </h4>

            <div style={{ overflowX: 'auto', border: '1px solid var(--dash-border)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-secondary)' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Chỉ Số Telemetry</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Ngưỡng Cho Phép (Threshold)</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Giá Trị Ghi Nhận (Observed)</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Mức Độ</th>
                  </tr>
                </thead>
                <tbody>
                  {rca.signals.map((sig, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--dash-border)', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                        {sig.metric}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--dash-text-secondary)' }}>{sig.threshold}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#DC2626' }}>{sig.observed}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: sig.severity === 'CRITICAL' ? '#FEF2F2' : '#FFFBEB',
                            color: sig.severity === 'CRITICAL' ? '#DC2626' : '#D97706',
                            fontWeight: 700,
                            fontSize: '0.6875rem',
                          }}
                        >
                          {sig.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Blast Radius Assessment */}
        {rca.blastRadius && (
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#FFFBEB',
              borderRadius: '10px',
              border: '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} style={{ color: '#D97706', flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#92400E' }}>
                  Phạm Vi Tác Động (Blast Radius):
                </span>{' '}
                <span style={{ fontSize: '0.8125rem', color: '#78350F' }}>
                  {rca.blastRadius.userImpact}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600 }}>
                Dịch vụ: <strong>{rca.blastRadius.impactedServices}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600 }}>
                Pods ảnh hưởng: <strong>{rca.blastRadius.affectedPods}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentRCA;
