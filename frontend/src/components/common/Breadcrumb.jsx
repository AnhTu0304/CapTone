import React from 'react';
import { ChevronRight } from 'lucide-react';

export const Breadcrumb = ({ items = [], className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={`breadcrumb-nav ${className}`} style={{ marginBottom: '16px' }}>
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {index > 0 && <ChevronRight size={14} color="var(--text-subtle)" />}
              {isLast ? (
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.label}</span>
              ) : (
                <a
                  href={item.href || '#'}
                  style={{
                    color: 'var(--text-muted)',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
