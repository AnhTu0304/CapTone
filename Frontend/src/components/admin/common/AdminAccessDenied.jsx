import React from 'react';
import PropTypes from 'prop-types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

/**
 * AdminAccessDenied Component
 * Màn hình Fallback 403 (Forbidden) cho các yêu cầu truy cập trái quyền RBAC.
 */
export const AdminAccessDenied = ({
  onNavigate,
  title = '403 — Không Có Quyền Truy Cập',
  message = 'Tài khoản của bạn không có quyền truy cập trang hoặc chức năng này theo chính sách phân quyền vai trò (RBAC). Vui lòng liên hệ Quản trị viên nếu cần cấp quyền.',
  redirectPath = '/admin',
  buttonText = 'Về Bàn Điều Khiển',
}) => {
  return (
    <div
      role="alert"
      className="dash-card"
      style={{
        padding: '56px 24px',
        borderRadius: '16px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #FECACA',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '18px',
        maxWidth: '560px',
        margin: '40px auto',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#DC2626',
        }}
      >
        <ShieldAlert size={28} />
      </div>

      <div>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#991B1B',
            margin: '0 0 8px 0',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--dash-text-secondary)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
      </div>

      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate(redirectPath)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '9px',
            backgroundColor: '#059669',
            color: '#FFFFFF',
            fontSize: '0.8125rem',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--dash-shadow-xs)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#047857')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
        >
          <ArrowLeft size={16} />
          <span>{buttonText}</span>
        </button>
      )}
    </div>
  );
};

AdminAccessDenied.propTypes = {
  onNavigate: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string,
  redirectPath: PropTypes.string,
  buttonText: PropTypes.string,
};

export default AdminAccessDenied;
