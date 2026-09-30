import React from 'react';

export const StepHeader = ({
  stepNumber,
  totalSteps = 5,
  category,
  title,
  description,
  className = '',
}) => {
  return (
    <div className={`onboarding-step-header ${className}`} style={{ marginBottom: '28px' }}>
      {stepNumber && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px',
            backgroundColor: 'rgba(40, 233, 159, 0.15)',
            padding: '2px 8px',
            border: '1px solid var(--color-accent)',
          }}
        >
          <span>STEP 0{stepNumber}/0{totalSteps}</span>
          {category && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>{'//'}</span>
              <span>{category}</span>
            </>
          )}
        </div>
      )}

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          color: 'var(--color-ink)',
          marginBottom: '10px',
        }}
      >
        {title}
      </h1>

      {description && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            maxWidth: '560px',
            margin: 0,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
};

export default StepHeader;
