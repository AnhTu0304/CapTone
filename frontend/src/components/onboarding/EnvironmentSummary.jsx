import React from 'react';
import { Layers } from 'lucide-react';

export const EnvironmentSummary = ({ environment, onEdit, className = '', style = {} }) => {
  if (!environment?.name) return null;

  return (
    <div
      className={`onboarding-env-summary ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        marginBottom: '24px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            backgroundColor: 'rgba(40, 233, 159, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--color-accent)',
          }}
        >
          <Layers size={18} color="var(--color-primary)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
              }}
            >
              {environment.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                color: environment.type === 'staging' ? '#075985' : '#7C3AED',
                backgroundColor: environment.type === 'staging' ? '#E0F2FE' : '#F3E8FF',
                padding: '1px 6px',
                fontWeight: 700,
              }}
            >
              {environment.type === 'staging' ? 'THỬ NGHIỆM' : 'PHÁT TRIỂN'}
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            {environment.description || 'Cụm hạ tầng phân vùng độc lập'}
          </div>
        </div>
      </div>

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--color-primary)',
            fontWeight: 700,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Thay đổi
        </button>
      )}
    </div>
  );
};

export default EnvironmentSummary;
