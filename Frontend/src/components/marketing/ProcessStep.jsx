import React from 'react';
import { ArrowRight } from 'lucide-react';

export const ProcessStep = ({
  stepNumber,
  title,
  description,
  isLast = false,
  status = 'default', // 'default' | 'active' | 'success'
}) => {
  const isSuccess = status === 'success';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flex: 1,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '16px',
          backgroundColor: isSuccess ? 'var(--color-canvas)' : 'var(--color-surface)',
          border: `1px solid ${isSuccess ? 'var(--color-primary)' : 'var(--border-default)'}`,
          borderRadius: '0px',
          width: '100%',
          boxShadow: 'none',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '0px',
              backgroundColor: isSuccess ? 'var(--color-primary)' : 'var(--color-canvas)',
              color: isSuccess ? '#FFFFFF' : 'var(--color-primary)',
              border: '1px solid var(--border-default)',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stepNumber}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
            {title}
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {description}
        </p>
      </div>

      {!isLast && (
        <div
          className="desktop-arrow"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8px',
            color: 'var(--emerald-600)',
          }}
        >
          <ArrowRight size={18} />
        </div>
      )}
    </div>
  );
};

export default ProcessStep;
