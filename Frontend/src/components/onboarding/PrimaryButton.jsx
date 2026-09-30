import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export const PrimaryButton = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  icon: Icon = ArrowRight,
  style = {},
  className = '',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`onboarding-primary-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px 24px',
        backgroundColor: disabled ? '#E2E8F0' : 'var(--color-primary)',
        color: disabled ? '#94A3B8' : '#FFFFFF',
        fontFamily: 'var(--font-display)',
        fontSize: '0.875rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        border: '1px solid var(--border-strong)',
        borderRadius: '0px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: 'none',
        ...style,
      }}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Processing...</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {Icon && <Icon size={16} />}
        </>
      )}
    </button>
  );
};

export default PrimaryButton;
