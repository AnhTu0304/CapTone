import React, { useState } from 'react';

export const FloatingCard = ({
  icon: Icon,
  iconBg = 'var(--emerald-50)',
  iconColor = 'var(--emerald-600)',
  category,
  title,
  metric,
  badge,
  badgeType = 'default', // 'default' | 'success' | 'warning' | 'info'
  style = {},
  animationName = 'cardEmergeOrbitDissolve',
  animationDelay = '0s',
  animationDuration = '10s',
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getBadgeStyle = () => {
    switch (badgeType) {
      case 'success':
        return {
          bg: '#ECFDF5',
          color: '#059669',
          border: '#A7F3D0',
        };
      case 'warning':
        return {
          bg: '#FFFBEB',
          color: '#B45309',
          border: '#FDE68A',
        };
      case 'info':
        return {
          bg: '#EFF6FF',
          color: '#2563EB',
          border: '#BFDBFE',
        };
      default:
        return {
          bg: '#F1F5F9',
          color: '#475569',
          border: '#E2E8F0',
        };
    }
  };

  const badgeTheme = getBadgeStyle();

  return (
    <div
      className={`hero-floating-card ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 18px',
        backgroundColor: 'var(--color-surface)',
        border: isHovered ? '1px solid var(--color-primary)' : '1px solid var(--border-default)',
        borderRadius: '0px',
        boxShadow: 'none',
        zIndex: isHovered ? 50 : 20,
        pointerEvents: 'auto',
        cursor: 'default',
        transformStyle: 'preserve-3d',
        animation: `${animationName} ${animationDuration} ease-in-out infinite`,
        animationDelay: animationDelay,
        animationPlayState: isHovered ? 'paused' : 'running',
        opacity: isHovered ? 1 : undefined,
        transform: isHovered ? 'scale(1.04) translateZ(30px)' : undefined,
        transition: 'border-color 0.15s ease',
        ...style,
      }}
    >
      {Icon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '0px',
            backgroundColor: iconBg,
            color: iconColor,
            flexShrink: 0,
            border: '1px solid var(--border-default)',
          }}
        >
          <Icon size={20} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {category}
          </span>
          {badge && (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '2px 8px',
                borderRadius: '0px',
                backgroundColor: badgeTheme.bg,
                color: badgeTheme.color,
                border: `1px solid ${badgeTheme.border}`,
                lineHeight: 1.2,
              }}
            >
              {badge}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.015em' }}>
            {title}
          </span>
          {metric && (
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              {metric}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FloatingCard;
