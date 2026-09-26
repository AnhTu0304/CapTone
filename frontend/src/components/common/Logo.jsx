import React from 'react';

export const Logo = ({ size = 28, showText = true, className = '' }) => {
  return (
    <div 
      className={`logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
        textDecoration: 'none'
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SelfHeal Logo Mark"
      >
        {/* Kubernetes-inspired hexagonal shield boundary */}
        <path
          d="M16 2L28 8.9282V23.0718L16 30L4 23.0718V8.9282L16 2Z"
          fill="#ECFDF5"
          stroke="#059669"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Internal healing cross / node core */}
        <path
          d="M16 9V23"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M9 16H23"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Active AI health beacon */}
        <circle cx="16" cy="16" r="3" fill="#10B981" />
      </svg>
      {showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: `${size * 0.72}px`,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}
        >
          Self<span style={{ color: 'var(--emerald-600)' }}>Heal</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
