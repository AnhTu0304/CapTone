import React from 'react';
import { X, ArrowRight, LayoutDashboard, LogOut } from 'lucide-react';
import Logo from '../common/Logo';
import { useAuth } from '../../context/AuthContext';

export const MobileNavigation = ({
  isOpen,
  onClose,
  currentPath = '/',
  onNavigate,
}) => {
  const { user, isAuthenticated, logout, getInitials, getPrimaryRole } = useAuth();

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
        {isAuthenticated && user ? (
          <>
            {/* User Info Capsule */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'rgba(61, 59, 79, 0.05)',
                border: '1px dashed rgba(61, 59, 79, 0.2)',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {getInitials(user.full_name || user.email)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--color-ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.full_name || 'Người dùng'}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {user.email}
                </div>
              </div>
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'rgba(40, 233, 159, 0.2)',
                  color: '#065F46',
                }}
              >
                {getPrimaryRole(user)}
              </span>
            </div>

            {/* Dashboard Button */}
            <a
              href="/dashboard"
              onClick={(e) => {
                e.preventDefault();
                onClose();
                onNavigate('/dashboard');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '0.9375rem',
                textDecoration: 'none',
              }}
            >
              <LayoutDashboard size={16} color="var(--color-accent)" />
              <span>Vào Bảng điều khiển</span>
            </a>

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
                onNavigate('/login');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px 16px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <LogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          </>
        ) : (
          <>
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
              href="/register"
              onClick={(e) => {
                e.preventDefault();
                onClose();
                onNavigate('/register');
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
          </>
        )}
      </div>
    </div>
  );
};

export default MobileNavigation;
