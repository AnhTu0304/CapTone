import React from 'react';
import { Check } from 'lucide-react';

export const FeatureCard = ({
  icon: Icon,
  title,
  description,
  items = [],
  technicalTag,
  media,
  children,
  className = '',
}) => {
  return (
    <div
      className={`feature-card ${className}`}
      style={{
        padding: '28px 24px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'var(--color-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '0px',
            backgroundColor: 'var(--color-canvas)',
            color: 'var(--color-primary)',
            border: '1px solid var(--border-default)',
          }}
        >
          {Icon && <Icon size={20} />}
        </div>
        {technicalTag && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              color: 'var(--color-primary)',
              backgroundColor: 'var(--color-canvas)',
              padding: '3px 8px',
              borderRadius: '0px',
              border: '1px solid var(--border-default)',
              fontWeight: 700,
            }}
          >
            {technicalTag}
          </span>
        )}
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px', minHeight: '48px' }}>
        {description}
      </p>

      {media && <div className="feature-card-media" style={{ marginBottom: '18px' }}>{media}</div>}
      {children}

      {items.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 'auto 0 0 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
              <Check size={14} color="var(--color-primary)" style={{ marginTop: '3px', flexShrink: 0 }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const CTASection = ({
  title = "Ready to connect your Kubernetes environment?",
  description = "Deploy the lightweight SelfHeal agent in minutes. Proactive failure prediction and safe automated recovery for SMEs.",
  primaryButtonText = "Get Started",
  secondaryButtonText = "Read the Guide",
  onPrimaryClick,
  onSecondaryClick,
  className = '',
}) => {
  return (
    <div
      className={`cta-section-wrapper ${className}`}
      style={{
        margin: '48px 0',
        padding: '56px 24px',
        backgroundColor: 'var(--emerald-50)',
        border: '1px solid var(--emerald-200)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <h2
          style={{
            fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
            lineHeight: 1.25,
            marginBottom: '14px',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '28px',
          }}
        >
          {description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <a
            href="/get-started"
            onClick={(e) => {
              if (onPrimaryClick) {
                e.preventDefault();
                onPrimaryClick();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '11px 22px',
              backgroundColor: 'var(--emerald-600)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.9375rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--emerald-600)',
              boxShadow: 'var(--shadow-sm)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--emerald-700)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--emerald-600)')}
          >
            {primaryButtonText}
          </a>
          <a
            href="/guide"
            onClick={(e) => {
              if (onSecondaryClick) {
                e.preventDefault();
                onSecondaryClick();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '11px 22px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontWeight: 500,
              fontSize: '0.9375rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xs)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
          >
            {secondaryButtonText}
          </a>
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;
