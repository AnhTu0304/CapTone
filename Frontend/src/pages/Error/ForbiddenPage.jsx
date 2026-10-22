import React from 'react';
import PropTypes from 'prop-types';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export const ForbiddenPage = ({
  onNavigate,
  title = '403 — Không Có Quyền Truy Cập',
  message = 'Tài khoản của bạn không có quyền truy cập trang hoặc tài nguyên này theo chính sách phân quyền (RBAC) hoặc ngữ cảnh tổ chức hiện tại. Vui lòng liên hệ Quản trị viên để được cấp quyền.',
  redirectPath = '/dashboard',
}) => {
  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      window.history.back();
    } else if (onNavigate) {
      onNavigate(redirectPath);
    }
  };

  const handleGoDashboard = () => {
    if (onNavigate) {
      onNavigate(redirectPath);
    }
  };

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        role="alert"
        aria-live="assertive"
        className="dash-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '48px 32px',
          borderRadius: '16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #FECACA',
          boxShadow: 'var(--dash-shadow-xs, 0 1px 3px rgba(0,0,0,0.05))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '20px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#DC2626',
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#991B1B',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--dash-text-secondary, #6B7280)',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            onClick={handleGoBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '9px',
              backgroundColor: '#F3F4F6',
              color: '#374151',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid #D1D5DB',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E5E7EB')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
          >
            <ArrowLeft size={16} />
            <span>Quay Lại Trang Trước</span>
          </button>

          <button
            type="button"
            onClick={handleGoDashboard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '9px',
              backgroundColor: '#059669',
              color: '#FFFFFF',
              fontSize: '0.875rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-xs, 0 1px 2px rgba(0,0,0,0.05))',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#047857')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
          >
            <Home size={16} />
            <span>Về Bàn Điều Khiển</span>
          </button>
        </div>
      </div>
    </div>
  );
};

ForbiddenPage.propTypes = {
  onNavigate: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string,
  redirectPath: PropTypes.string,
};

export default ForbiddenPage;
