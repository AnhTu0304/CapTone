import React from 'react';
import { ArrowLeft } from 'lucide-react';

export const SecondaryButton = ({
  children,
  onClick,
  disabled = false,
  icon: Icon = ArrowLeft,
  type = 'button',
  style = {},
  className = '',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`onboarding-secondary-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px 20px',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-primary)',
        fontFamily: 'var(--font-display)',
        fontSize: '0.875rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        ...style,
      }}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
};

export default SecondaryButton;
