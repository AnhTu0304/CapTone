import React from 'react';
import { ShieldAlert, ShieldCheck, AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

/**
 * IncidentSeverityBreakdown Component
 * Hiển thị biểu đồ phân bổ mức độ nghiêm trọng (CRITICAL, HIGH, MEDIUM, LOW)
 * và thống kê các dạng thức sự cố kỹ thuật thường gặp từ dữ liệu viễn trắc K8s.
 */
export const IncidentSeverityBreakdown = ({ breakdown = null, className = '' }) => {
  const severity = breakdown?.bySeverity || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byType = breakdown?.byType || {};

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
    { key: 'CRITICAL', label: 'Nghiêm Trọng (P1)', count: critical, color: '#EF4444', icon: AlertOctagon },
    { key: 'HIGH', label: 'Mức Độ Cao (P2)', count: high, color: '#F97316', icon: AlertTriangle },
    { key: 'MEDIUM', label: 'Trung Bình (P3)', count: medium, color: '#F59E0B', icon: Info },
    { key: 'LOW', label: 'Thấp / Cảnh Báo (P4)', count: low, color: '#3B82F6', icon: ShieldCheck },
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

  const typeEntries = Object.entries(byType);

  return (
    <div
      className={`dash-card ${className}`}
      style={{
        padding: '20px',
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--dash-radius-md)',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="var(--dash-primary)" />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              Phân Bổ Sự Cố Theo Mức Độ Nghiêm Trọng & Dạng Thức
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Cơ cấu các sự cố phát hiện và tự động xử lý bởi hệ thống tự trị
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#059669', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: 'var(--dash-radius-full)', fontWeight: 600 }}>
          <CheckCircle2 size={13} />
          <span>{total} sự cố ghi nhận trong chu kỳ</span>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
        {/* Left Column: Donut Chart + Severity Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* SVG Donut */}
          <div style={{ position: 'relative', width: '136px', height: '136px', flexShrink: 0, margin: '0 auto' }}>
            <svg width="136" height="136" viewBox="0 0 136 136" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background Circle */}
              <circle
                cx="68"
                cy="68"
                r={radius}
                fill="transparent"
                stroke={total === 0 ? '#10B981' : '#F1F5F9'}
                strokeWidth={strokeWidth}
              />

              {/* Segments */}
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
                      />
                    )
                )}
            </svg>

            {/* Center Text */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: total === 0 ? '#059669' : 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)' }}>
                {total}
              </span>
              <span style={{ fontSize: '0.625rem', color: 'var(--dash-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {total === 0 ? 'ỔN ĐỊNH' : 'SỰ CỐ'}
              </span>
            </div>
          </div>

          {/* Severity Badges & Pct */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '180px' }}>
            {categories.map((cat) => {
              const pct = total > 0 ? Math.round((cat.count / total) * 100) : 0;
              return (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color, display: 'inline-block' }} />
                    <span style={{ color: 'var(--dash-text-secondary)', fontWeight: 600 }}>{cat.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{cat.count} vụ</span>
                    <span style={{ color: 'var(--dash-text-muted)', fontSize: '0.6875rem' }}>({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Top Incident Types Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '1px solid var(--dash-border)', paddingLeft: '20px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
            Dạng Thức Sự Cố Kỹ Thuật (Incident Types)
          </div>

          {typeEntries.length === 0 ? (
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: 'var(--dash-radius-sm)', color: 'var(--dash-text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
              Không có sự cố nào được ghi nhận trong chu kỳ này.
            </div>
          ) : (
            typeEntries.map(([tName, tCount]) => {
              const pct = total > 0 ? Math.min(100, Math.round((tCount / total) * 100)) : 0;
              return (
                <div key={tName} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                      {tName}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem' }}>
                      {tCount} sự cố ({pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor:
                          tName.includes('OOM') ? '#EF4444' : tName.includes('Crash') ? '#F97316' : '#2563EB',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
            <CheckCircle2 size={12} color="#059669" />
            <span>Toàn bộ sự cố được tự động kích hoạt chu trình phân tích MAPE-K.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentSeverityBreakdown;
