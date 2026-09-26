import React from 'react';

export const Sidebar = ({
  title,
  items = [],
  activeItem,
  onItemSelect,
  className = '',
}) => {
  return (
    <aside
      className={`sidebar-nav ${className}`}
      style={{
        width: '240px',
        flexShrink: 0,
        fontSize: '0.875rem',
      }}
    >
      {title && (
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: '12px',
          }}
        >
          {title}
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onItemSelect && onItemSelect(item.id)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--emerald-50)' : 'transparent',
                  color: isActive ? 'var(--emerald-700)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default Sidebar;
