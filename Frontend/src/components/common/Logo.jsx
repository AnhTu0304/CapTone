import React from 'react';
import logoSvg from '../../assets/Logo.svg';
import logoPng from '../../assets/Logo-transparent.png';

export const Logo = ({
  size = 38,
  showText = false,
  variant = 'svg',
  textColor,
  className = '',
  style = {},
  ariaLabel = 'SelfHeal Logo Mark',
}) => {
  const imgSrc = variant === 'png' ? logoPng : logoSvg;

  return (
    <div 
      className={`logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        textDecoration: 'none',
        ...style,
      }}
    >
      <img
        src={imgSrc}
        width={size}
        height={size}
        alt={ariaLabel}
        aria-label={ariaLabel}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
        }}
      />
      {showText && (
        <span
          style={{
            marginLeft: '10px',
            fontWeight: 700,
            fontSize: `${Math.max(12, size * 0.72)}px`,
            letterSpacing: '-0.03em',
            color: textColor || 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          Self<span style={{ color: 'var(--emerald-600, #059669)' }}>Heal</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
