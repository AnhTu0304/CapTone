import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import Logo from '../common/Logo';

export const MobileNavigation = ({
  isOpen,
  onClose,
  currentPath = '/',
  onNavigate,
}) => {
  if (!isOpen) return null;

  const navLinks = [
    { label: 'Hướng dẫn', path: '/guide' },
    { label: 'Tính năng', path: '/features' },
    { label: 'Giới thiệu', path: '/about' },
    { label: 'Tài liệu', path: '/docs' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Mobile Drawer Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onClose();
            onNavigate('/');
          }}
        >
          <Logo size={26} />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: 'var(--text-primary)',
          }}
        >
          <X size={24} />
        </button>
      </div>

      {/* Nav links */}
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, fontFamily: 'var(--font-body)' }}>
        {navLinks.map((link) => {
          const isActive = currentPath === link.path;
          return (
            <a
              key={link.path}
              href={link.path}
              onClick={(e) => {
                e.preventDefault();
                onClose();
                onNavigate(link.path);
              }}
              style={{
                fontSize: '1.125rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-primary)' : 'var(--color-ink)',
                padding: '10px 0',
                borderBottom: '1px solid var(--border-default)',
              }}
            >
              {link.label}
            </a>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div
        style={{
          padding: '20px',
          borderTop: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <a
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            onClose();
            onNavigate('/login');
          }}
          style={{
            textAlign: 'center',
            padding: '11px 16px',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '0.9375rem',
            borderRadius: '0px',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          Đăng nhập
        </a>
        <a
          href="/get-started"
          onClick={(e) => {
            e.preventDefault();
            onClose();
            onNavigate('/get-started');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-ink)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '0.9375rem',
            borderRadius: '0px',
            border: '1px solid var(--color-accent)',
          }}
        >
          <span>Đăng ký</span>
          <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
};

export default MobileNavigation;
