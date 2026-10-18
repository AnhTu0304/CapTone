import React from 'react';
import {
  CheckCircle2,
  Clock,
  Circle,
  Eye,
  Search,
  Zap,
  ShieldCheck,
  Check,
  ThumbsUp,
  Cpu,
} from 'lucide-react';

const STAGE_ORDER = [
  'Detection',
  'Investigation',
  'RCA',
  'Recommendation',
  'Approval',
  'Healing',
  'Verification',
  'Resolution',
];

const STAGE_ICONS = {
  Detection: Eye,
  Investigation: Search,
  RCA: Cpu,
  Recommendation: Zap,
  Approval: ThumbsUp,
  Healing: Zap,
  Verification: ShieldCheck,
  Resolution: Check,
};

export const IncidentTimeline = ({ timeline = [], isLoading = false }) => {
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
        Đang tải dòng thời gian chu trình tự lành 8 giai đoạn...
      </div>
    );
  }

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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
          Chu Trình Vòng Đời Tự Phục Hồi 8 Giai Đoạn (8-Stage Autonomous Lifecycle)
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
          Detection &rarr; Investigation &rarr; RCA &rarr; Recommendation &rarr; Approval &rarr; Healing &rarr; Verification &rarr; Resolution
        </p>
      </div>

      {/* Horizontal Steps Bar */}
      <div
        className="dash-table-container"
        style={{
          padding: '20px',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid var(--dash-border)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: '760px', justifyContent: 'space-between', position: 'relative' }}>
          {STAGE_ORDER.map((stageName, index) => {
            const step = timeline.find((s) => s.stage === stageName) || {
              stage: stageName,
              title: stageName,
              status: 'PENDING',
              timestamp: '--:--',
            };

            const isCompleted = step.status === 'COMPLETED';
            const isInProgress = step.status === 'IN_PROGRESS';
            const Icon = STAGE_ICONS[stageName] || Circle;

            return (
              <React.Fragment key={stageName}>
                {/* Step Item */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isCompleted ? '#059669' : isInProgress ? '#2563EB' : '#E2E8F0',
                      color: isCompleted || isInProgress ? '#FFFFFF' : '#94A3B8',
                      boxShadow: isInProgress ? '0 0 0 4px rgba(37, 99, 235, 0.2)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isCompleted ? <CheckCircle2 size={18} /> : isInProgress ? <Clock size={18} /> : <Icon size={16} />}
                  </div>

                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: isCompleted || isInProgress ? 700 : 500,
                      color: isCompleted ? '#065F46' : isInProgress ? '#1D4ED8' : 'var(--dash-text-muted)',
                      marginTop: '6px',
                      textAlign: 'center',
                    }}
                  >
                    {index + 1}. {stageName}
                  </span>

                  <span style={{ fontSize: '0.625rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {step.timestamp}
                  </span>
                </div>

                {/* Connector Line between steps */}
                {index < STAGE_ORDER.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: '3px',
                      backgroundColor: isCompleted ? '#10B981' : '#E2E8F0',
                      margin: '0 4px',
                      marginTop: '-18px',
                      transition: 'background-color 0.2s ease',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Detailed Narrative Feed */}
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {timeline.map((step, idx) => {
            const isCompleted = step.status === 'COMPLETED';
            const isInProgress = step.status === 'IN_PROGRESS';

            return (
              <div
                key={step.stage || idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: isInProgress ? '#EFF6FF' : isCompleted ? '#F0FDF4' : '#FAFAFA',
                  border: `1px solid ${isInProgress ? '#BFDBFE' : isCompleted ? '#BBF7D0' : '#E2E8F0'}`,
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCompleted ? '#ECFDF5' : isInProgress ? '#DBEAFE' : '#F1F5F9',
                    color: isCompleted ? '#059669' : isInProgress ? '#2563EB' : '#94A3B8',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {isCompleted ? <CheckCircle2 size={16} /> : isInProgress ? <Clock size={16} /> : <Circle size={14} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                      {step.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>
                        {step.actor}
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--dash-text-secondary)',
                          backgroundColor: '#FFFFFF',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--dash-border)',
                        }}
                      >
                        {step.timestamp}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5 }}>
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default IncidentTimeline;
