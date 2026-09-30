import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingState = ({ message = 'Loading infrastructure details...', className = '', style = {} }) => {
  return (
    <div
      className={`onboarding-loading-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        backgroundColor: 'var(--color-surface)',
        border: '1px dashed var(--border-default)',
        borderRadius: '0px',
        gap: '12px',
        ...style,
      }}
    >
      <Loader2 size={24} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.02em',
        }}
      >
        {message}
      </span>
    </div>
  );
};

export default LoadingState;
