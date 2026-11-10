import React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

/**
 * IncidentSeverityBreakdown Component
 * Hiển thị biểu đồ phân bổ mức độ nghiêm trọng (CRITICAL, HIGH, MEDIUM, LOW)
 * với bố cục nhỏ gọn, đồng bộ chiều cao với biểu đồ Cơ cấu các loại sự cố hạ tầng.
 */
export const IncidentSeverityBreakdown = ({ breakdown = null, className = '' }) => {
  const severity = breakdown?.bySeverity || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  const critical = severity.CRITICAL || 0;
  const high = severity.HIGH || 0;
  const medium = severity.MEDIUM || 0;
  const low = severity.LOW || 0;
  const total = critical + high + medium + low;

  // Donut SVG Math
  const radius = 54;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~339.29

  const categories = [
    { key: 'CRITICAL', label: 'Nghiêm Trọng (P1)', count: critical, color: '#EF4444' },
    { key: 'HIGH', label: 'Mức Độ Cao (P2)', count: high, color: '#F97316' },
    { key: 'MEDIUM', label: 'Trung Bình (P3)', count: medium, color: '#F59E0B' },
    { key: 'LOW', label: 'Thấp / Cảnh Báo (P4)', count: low, color: '#3B82F6' },
  ];

  // Calculate cumulative offsets for SVG circles
  let cumulativePercent = 0;
  const segments = categories.map((cat) => {
    const percent = total > 0 ? cat.count / total : 0;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativePercent * circumference;
    cumulativePercent += percent;
    return { ...cat, percent: Math.round(percent * 100), strokeDasharray, strokeDashoffset };
  });

  const severityMetaStyles = {
    CRITICAL: { bg: '#FEF2F2', text: '#DC2626' },
    HIGH: { bg: '#FFF7ED', text: '#C2410C' },
    MEDIUM: { bg: '#FFFBEB', text: '#B45309' },
    LOW: { bg: '#EFF6FF', text: '#1D4ED8' },
  };

  return (
    <div
      className={`dash-card ${className}`}
      style={{
        padding: '16px 18px',
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid #F1F5F9',
          paddingBottom: '10px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <ShieldAlert size={17} color="var(--dash-primary)" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Phân Bổ Sự Cố Theo Mức Độ Nghiêm Trọng (P1–P4)
            </h3>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Phân cấp mức độ ảnh hưởng SLA và độ ưu tiên kích hoạt MAPE-K
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.7rem',
            color: '#059669',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            padding: '2px 9px',
            borderRadius: '999px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <CheckCircle2 size={12} />
          <span>{total.toLocaleString('vi-VN')} sự cố</span>
        </div>
      </div>

      {/* Main Content: Donut on TOP + 2x2 P1–P4 grid below */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          flex: 1,
        }}
      >
        {/* SVG Donut */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '144px', height: '144px' }}>
            <svg width="144" height="144" viewBox="0 0 136 136" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="68"
                cy="68"
                r={radius}
                fill="transparent"
                stroke={total === 0 ? '#10B981' : '#F1F5F9'}
                strokeWidth={strokeWidth}
              />

              {total > 0 &&
                segments.map(
                  (seg) =>
                    seg.count > 0 && (
                      <circle
                        key={seg.key}
                        cx="68"
                        cy="68"
                        r={radius}
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={seg.strokeDasharray}
                        strokeDashoffset={seg.strokeDashoffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                      >
                        <title>{`${seg.label}: ${seg.count.toLocaleString('vi-VN')} vụ (${seg.percent}%)`}</title>
                      </circle>
                    )
                )}
            </svg>

            {/* Center Text */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: total === 0 ? '#059669' : '#0F172A',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.1,
                }}
              >
                {total.toLocaleString('vi-VN')}
              </span>
              <span
                style={{
                  fontSize: '0.6rem',
                  color: '#64748B',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: '2px',
                }}
              >
                {total === 0 ? 'ỔN ĐỊNH' : 'SỰ CỐ'}
              </span>
            </div>
          </div>
        </div>

        {/* 2x2 Compact Severity Grid */}
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
            gap: '7px',
          }}
        >
          {categories.map((cat) => {
            const pct = total > 0 ? Math.round((cat.count / total) * 100) : 0;
            const badgeStyle = severityMetaStyles[cat.key] || { bg: '#F1F5F9', text: cat.color };
            return (
              <div
                key={cat.key}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }} />
                    <span style={{ color: '#0F172A', fontWeight: 600, fontSize: '0.74rem' }}>{cat.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.75rem' }}>
                      {cat.count.toLocaleString('vi-VN')} vụ
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: badgeStyle.text,
                        backgroundColor: badgeStyle.bg,
                        padding: '1px 6px',
                        borderRadius: '999px',
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '3px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${total > 0 && cat.count > 0 ? Math.max(3, pct) : 0}%`,
                      height: '100%',
                      backgroundColor: cat.color,
                      borderRadius: '999px',
                      transition: 'width 0.35s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact Footer Summary */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '8px',
          borderTop: '1px dashed #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.7rem',
          color: '#64748B',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <CheckCircle2 size={12} color="#059669" />
          <span>Tự động kích hoạt chu trình MAPE-K theo mức độ rủi ro</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#334155' }}>
          P1+P2: {(critical + high).toLocaleString('vi-VN')} · P3+P4: {(medium + low).toLocaleString('vi-VN')}
        </div>
      </div>
    </div>
  );
};

export default IncidentSeverityBreakdown;
