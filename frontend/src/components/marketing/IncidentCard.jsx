import React from 'react';
import { StatusBadge } from '../common/Badge';

export const IncidentCard = ({
  stage,
  title,
  timestamp,
  metricLabel,
  metricValue,
  metricTrend = 'up', // 'up' | 'down' | 'stable'
  status = 'healthy',
  actionNote,
  workload = 'deployment/payment-service',
  className = '',
}) => {
  return (
    <div
      className={`incident-card ${className}`}
      style={{
        padding: '16px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        boxShadow: 'none',
        fontSize: '0.8125rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
          {stage}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
          {timestamp}
        </span>
      </div>

      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
        {title}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          backgroundColor: 'var(--color-canvas)',
          borderRadius: '0px',
          border: '1px solid var(--border-default)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>{workload}</span>
        <span style={{ fontWeight: 700, color: status === 'critical' ? 'var(--error-icon)' : status === 'warning' ? 'var(--warning-icon)' : 'var(--text-primary)' }}>
          {metricLabel}: {metricValue}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <StatusBadge status={status} />
        {actionNote && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--emerald-700)', fontWeight: 500 }}>
            {actionNote}
          </span>
        )}
      </div>
    </div>
  );
};

export default IncidentCard;
