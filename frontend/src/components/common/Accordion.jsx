import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export const Accordion = ({ items = [], allowMultiple = false, className = '' }) => {
  const [openIndexes, setOpenIndexes] = useState([0]);

  const toggle = (idx) => {
    if (allowMultiple) {
      setOpenIndexes((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    } else {
      setOpenIndexes((prev) => (prev.includes(idx) ? [] : [idx]));
    }
  };

  return (
    <div className={`accordion ${className}`} style={{ borderTop: '1px solid var(--border-default)' }}>
      {items.map((item, index) => {
        const isOpen = openIndexes.includes(index);
        return (
          <div key={index} style={{ borderBottom: '1px solid var(--border-default)' }}>
            <button
              type="button"
              onClick={() => toggle(index)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              <span>{item.title}</span>
              <ChevronDown
                size={18}
                color="var(--text-muted)"
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>
            {isOpen && (
              <div
                style={{
                  paddingBottom: '16px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                }}
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-overlay)',
        backdropFilter: 'blur(3px)',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  );
};

export const Tooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            padding: '4px 8px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            fontSize: '0.6875rem',
            borderRadius: 'var(--radius-xs)',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};
