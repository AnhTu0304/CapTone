import React from 'react';
import './AuthShared.css';

export const AUTH_HEADING_STYLE = {
  fontFamily: 'var(--font-anybody)',
  fontSize: '1.85rem',
  fontWeight: 600,
  color: '#2A2A2A',
  letterSpacing: '-0.025em',
  marginBottom: '10px',
  lineHeight: 1.18,
};

export const AUTH_LABEL_STYLE = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#4B5563',
  marginBottom: '8px',
  fontFamily: 'var(--font-body)',
};

export const AUTH_INPUT_STYLE = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  backgroundColor: '#FFFFFF',
  fontSize: '0.9375rem',
  color: '#111827',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  boxSizing: 'border-box',
};

export const AUTH_PRIMARY_BTN_STYLE = {
  width: '100%',
  height: '44px',
  backgroundColor: '#22E59B',
  color: '#111827',
  fontSize: '0.9375rem',
  fontFamily: 'var(--font-dm-sans)',
  borderRadius: '6px',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'background-color 0.15s ease, transform 0.1s ease',
};

export const GoogleAuthButton = ({ label, onClick, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    style={{
      width: '100%',
      height: '44px',
      backgroundColor: '#F3F4F6',
      color: '#1F2937',
      fontSize: '0.875rem',
      fontFamily: 'var(--font-dm-sans)',
      borderRadius: '6px',
      border: '1px solid #E5E7EB',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.7 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      transition: 'background-color 0.15s ease',
    }}
    onMouseEnter={(e) => {
      if (!disabled) e.currentTarget.style.backgroundColor = '#E5E7EB';
    }}
    onMouseLeave={(e) => {
      if (!disabled) e.currentTarget.style.backgroundColor = '#F3F4F6';
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
    <span>{label}</span>
  </button>
);

export const AuthLegalFooter = ({ onNavigate }) => {
  const handleLink = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <p
      style={{
        marginTop: '36px',
        textAlign: 'center',
        fontSize: '0.8125rem',
        color: '#6B7280',
        fontFamily: 'var(--font-body)',
        lineHeight: 1.6,
      }}
    >
      Bằng việc tiếp tục, bạn đồng ý với{' '}
      <a
        href="/terms"
        className="auth-link-legal"
        onClick={(e) => handleLink(e, '/terms')}
      >
        Điều khoản dịch vụ
      </a>{' '}
      và{' '}
      <a
        href="/privacy"
        className="auth-link-legal"
        onClick={(e) => handleLink(e, '/privacy')}
      >
        Chính sách bảo mật
      </a>
      .
    </p>
  );
};
