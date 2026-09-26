import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const ErrorAlert = ({
  title = 'An error occurred',
  message,
  onRetry,
  className = '',
  style = {},
}) => {
  if (!message) return null;

  return (
    <div
      className={`onboarding-error-alert ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        backgroundColor: '#FFF1F2',
        border: '1px solid #FECDD3',
        borderLeft: '4px solid #E11D48',
        borderRadius: '0px',
        marginBottom: '20px',
        ...style,
      }}
    >
      <AlertCircle size={18} color="#E11D48" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#9F1239',
            marginBottom: '2px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            color: '#BE123C',
            lineHeight: 1.45,
          }}
        >
          {message}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #FDA4AF',
            color: '#E11D48',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

export default ErrorAlert;
