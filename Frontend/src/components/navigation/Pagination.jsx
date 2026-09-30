import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export const Pagination = ({ prev, next, onNavigate, className = '' }) => {
  return (
    <div
      className={`docs-pagination ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '48px',
        paddingTop: '24px',
        borderTop: '1px solid var(--border-default)',
        gap: '16px',
        flexWrap: 'wrap',
      }}
    >
      {prev ? (
        <button
          type="button"
          onClick={() => onNavigate && onNavigate(prev.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: '0px',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-4px)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0px)';
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <ArrowLeft size={16} color="var(--color-accent)" />
          <div>
            <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Bài trước</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{prev.title}</div>
          </div>
        </button>
      ) : <div />}

      {next ? (
        <button
          type="button"
          onClick={() => onNavigate && onNavigate(next.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: '0px',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'right',
            marginLeft: 'auto',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(4px)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0px)';
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <div>
            <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Bài tiếp theo</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{next.title}</div>
          </div>
          <ArrowRight size={16} color="var(--color-accent)" />
        </button>
      ) : <div />}
    </div>
  );
};

export default Pagination;
