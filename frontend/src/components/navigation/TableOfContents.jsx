import React from 'react';

export const TableOfContents = ({
  items = [],
  activeId = '',
  onItemClick,
  title = "Mục lục bài viết",
  className = '',
}) => {
  return (
    <nav
      className={`toc-container ${className}`}
      aria-label="Mục lục bài viết"
      style={{
        position: 'sticky',
        top: '80px',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        fontSize: '0.8125rem',
        paddingLeft: '16px',
        borderLeft: '1px solid var(--border-default)',
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '12px',
          }}
        >
          {title}
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li
              key={item.id}
              style={{
                paddingLeft: item.level === 3 ? '12px' : '0',
              }}
            >
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  if (onItemClick) {
                    e.preventDefault();
                    onItemClick(item.id);
                  }
                }}
                style={{
                  display: 'block',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-link)',
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'var(--font-body)',
                  transition: 'color 0.15s ease',
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--color-link)';
                }}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default TableOfContents;
