import React from 'react';

export const FormField = ({
  label,
  required = false,
  description,
  error,
  children,
  htmlFor,
  className = '',
}) => {
  return (
    <div className={`onboarding-form-field ${className}`} style={{ marginBottom: '22px' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label
            htmlFor={htmlFor}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--color-ink)',
              letterSpacing: '-0.01em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {label}
            {required && <span style={{ color: '#E11D48', fontWeight: 800 }}>*</span>}
          </label>
        </div>
      )}

      {description && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            lineHeight: 1.45,
          }}
        >
          {description}
        </p>
      )}

      {children}

      {error && (
        <div
          style={{
            marginTop: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: '#E11D48',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
          }}
        >
          <span>✕</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FormField;
