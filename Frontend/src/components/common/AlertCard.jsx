import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const AlertCard = ({
  type = 'info', // 'info' | 'tip' | 'warning' | 'error'
  title,
  children,
  className = '',
}) => {
  const cardConfig = {
    info: {
      icon: Info,
      bg: 'var(--info-bg)',
      border: 'var(--info-border)',
      color: 'var(--info-text)',
      iconColor: 'var(--info-icon)',
      label: 'Note',
    },
    tip: {
      icon: CheckCircle,
      bg: 'var(--success-bg)',
      border: 'var(--success-border)',
      color: 'var(--success-text)',
      iconColor: 'var(--success-icon)',
      label: 'Tip',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'var(--warning-bg)',
      border: 'var(--warning-border)',
      color: 'var(--warning-text)',
      iconColor: 'var(--warning-icon)',
      label: 'Warning',
    },
    error: {
      icon: AlertCircle,
      bg: 'var(--error-bg)',
      border: 'var(--error-border)',
      color: 'var(--error-text)',
      iconColor: 'var(--error-icon)',
      label: 'Important',
    },
  };

  const activeConfig = cardConfig[type] || cardConfig.info;
  const IconComponent = activeConfig.icon;

  return (
    <div
      className={`alert-card ${className}`}
      style={{
        display: 'flex',
        gap: '12px',
        padding: '14px 16px',
        margin: '16px 0',
        borderRadius: '0px',
        backgroundColor: activeConfig.bg,
        border: `1px solid ${activeConfig.border}`,
        fontSize: '0.875rem',
        lineHeight: 1.5,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>
        <IconComponent size={18} color={activeConfig.iconColor} />
      </div>
      <div style={{ flex: 1, color: activeConfig.color }}>
        <div style={{ fontWeight: 600, marginBottom: '4px', fontFamily: 'var(--font-display)' }}>
          {title || activeConfig.label}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export const InfoCard = ({
  icon: Icon,
  title,
  subtitle,
  children,
  action,
  className = '',
}) => {
  return (
    <div
      className={`info-card ${className}`}
      style={{
        padding: '20px',
        borderRadius: '0px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        boxShadow: 'none',
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {Icon && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '0px',
                backgroundColor: 'rgba(40, 233, 159, 0.15)',
                color: 'var(--color-accent)',
                border: '1px solid var(--border-default)',
              }}
            >
              <Icon size={18} />
            </div>
          )}
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{title}</h4>
            {subtitle && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</span>}
          </div>
        </div>
        {action}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
};

export default AlertCard;
