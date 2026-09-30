import React from 'react';
import { Building2 } from 'lucide-react';

export const OrganizationSummary = ({ organization, onEdit, className = '', style = {} }) => {
  if (!organization?.name) return null;

  return (
    <div
      className={`onboarding-org-summary ${className}`}
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
            backgroundColor: 'rgba(61, 59, 79, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-default)',
          }}
        >
          <Building2 size={18} color="var(--color-primary)" />
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
              {organization.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                color: '#059669',
                backgroundColor: 'rgba(40, 233, 159, 0.15)',
                padding: '1px 6px',
                border: '1px solid var(--color-accent)',
                fontWeight: 700,
              }}
            >
              TỔ CHỨC ĐÃ CHỌN
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            slug: {organization.slug}
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

export default OrganizationSummary;
