import React from 'react';

export const Badge = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'success' | 'warning' | 'danger'
  size = 'md',
  className = '',
  icon: Icon,
  ...props
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--emerald-50)',
          color: 'var(--emerald-800)',
          border: '1px solid var(--emerald-200)',
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-default)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-subtle)',
        };
      case 'success':
        return {
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success-text)',
          border: '1px solid var(--success-border)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--warning-bg)',
          color: 'var(--warning-text)',
          border: '1px solid var(--warning-border)',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--error-bg)',
          color: 'var(--error-text)',
          border: '1px solid var(--error-border)',
        };
      default:
        return {};
    }
  };

  const isSmall = size === 'sm';

  return (
    <span
      className={`badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: isSmall ? '2px 8px' : '4px 10px',
        fontSize: isSmall ? '0.6875rem' : '0.75rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        borderRadius: '0px',
        lineHeight: 1.2,
        letterSpacing: '0.02em',
        border: '1px solid var(--border-default)',
        ...getBadgeStyle(),
      }}
      {...props}
    >
      {Icon && <Icon size={isSmall ? 11 : 13} />}
      {children}
    </span>
  );
};

export const StatusBadge = ({ status, className = '' }) => {
  // status: 'healthy' | 'warning' | 'critical' | 'remediated' | 'pending'
  const config = {
    healthy: {
      label: 'Healthy',
      variant: 'success',
      dotColor: 'var(--color-accent)',
    },
    warning: {
      label: 'Warning',
      variant: 'warning',
      dotColor: 'var(--warning-icon)',
    },
    critical: {
      label: 'Critical Anomaly',
      variant: 'danger',
      dotColor: 'var(--error-icon)',
    },
    remediated: {
      label: 'Auto-Remediated',
      variant: 'primary',
      dotColor: 'var(--color-accent)',
    },
    pending: {
      label: 'Approval Required',
      variant: 'warning',
      dotColor: 'var(--warning-icon)',
    },
  }[status] || { label: status, variant: 'secondary', dotColor: 'var(--text-muted)' };

  return (
    <Badge variant={config.variant} className={className}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '0px',
          backgroundColor: config.dotColor,
          display: 'inline-block',
        }}
      />
      {config.label}
    </Badge>
  );
};

export const IconButton = ({
  icon: Icon,
  label,
  onClick,
  size = 'md',
  variant = 'ghost',
  className = '',
  disabled = false,
  ...props
}) => {
  const sizePx = size === 'sm' ? 32 : size === 'lg' ? 42 : 36;
  const iconPx = size === 'sm' ? 14 : size === 'lg' ? 20 : 18;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`icon-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        borderRadius: '0px',
        border: variant === 'secondary' ? '1px solid var(--border-default)' : '1px solid transparent',
        backgroundColor: variant === 'secondary' ? 'var(--bg-secondary)' : 'transparent',
        color: 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = variant === 'secondary' ? 'var(--bg-secondary)' : 'transparent';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
      {...props}
    >
      {Icon && <Icon size={iconPx} />}
    </button>
  );
};
