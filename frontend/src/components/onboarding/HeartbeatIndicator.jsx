import React from 'react';

export const HeartbeatIndicator = ({
  status = 'active', // 'active' | 'warning' | 'offline'
  lastSeen = '3s ago',
  latencyMs = 14,
  className = '',
}) => {
  const isHealthy = status === 'active';
  const color = isHealthy ? 'var(--color-accent)' : status === 'warning' ? '#F59E0B' : '#E11D48';

  return (
    <div
      className={`onboarding-heartbeat-indicator ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 10px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6875rem',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          boxShadow: isHealthy ? '0 0 8px rgba(40, 233, 159, 0.8)' : 'none',
        }}
      />
      <span style={{ fontWeight: 700, color: 'var(--color-ink)' }}>
        {isHealthy ? 'LIVE HEARTBEAT' : status.toUpperCase()}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>•</span>
      <span style={{ color: 'var(--text-muted)' }}>{lastSeen}</span>
      {isHealthy && latencyMs && (
        <>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>{latencyMs}ms</span>
        </>
      )}
    </div>
  );
};

export default HeartbeatIndicator;
