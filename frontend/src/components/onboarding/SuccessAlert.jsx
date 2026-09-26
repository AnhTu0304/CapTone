import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const SuccessAlert = ({
  title = 'Success',
  message,
  className = '',
  style = {},
}) => {
  if (!message) return null;

  return (
    <div
      className={`onboarding-success-alert ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        backgroundColor: 'rgba(40, 233, 159, 0.10)',
        border: '1px solid rgba(40, 233, 159, 0.4)',
        borderLeft: '4px solid var(--color-accent)',
        borderRadius: '0px',
        marginBottom: '20px',
        ...style,
      }}
    >
      <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#065F46',
            marginBottom: '2px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            color: '#047857',
            lineHeight: 1.45,
          }}
        >
          {message}
        </div>
      </div>
    </div>
  );
};

export default SuccessAlert;
