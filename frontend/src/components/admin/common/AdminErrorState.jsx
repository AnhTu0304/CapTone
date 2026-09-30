import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * AdminErrorState Component
 * Thành phần thông báo lỗi nhất quán cho toàn bộ các trang Admin.
 * Tuân thủ hệ màu enterprise: white-first, viền #FECACA, nền #FEF2F2, nút thử lại soft emerald #059669.
 */
export const AdminErrorState = ({
  title = 'Không thể tải dữ liệu máy chủ',
  message = 'Đã có lỗi xảy ra trong quá trình truy vấn dữ liệu từ hệ thống backend. Vui lòng kiểm tra kết nối mạng và thử lại.',
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div
      role="alert"
      className="dash-card"
      style={{
        padding: '32px 24px',
        borderRadius: '16px',
        backgroundColor: '#FEF2F2',
        border: '1px solid #FECACA',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        margin: '16px 0',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: '#FEE2E2',
          border: '1px solid #FCA5A5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#DC2626',
        }}
      >
        <AlertTriangle size={24} />
      </div>

      <div style={{ maxWidth: '540px' }}>
        <h3
          style={{
            fontSize: '1.0625rem',
            fontWeight: 700,
            color: '#991B1B',
            margin: '0 0 6px 0',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '0.8125rem',
            color: '#B91C1C',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {message}
        </p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            backgroundColor: '#059669',
            color: '#FFFFFF',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: 'none',
            cursor: isRetrying ? 'not-allowed' : 'pointer',
            opacity: isRetrying ? 0.7 : 1,
            boxShadow: 'var(--dash-shadow-xs)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => !isRetrying && (e.currentTarget.style.backgroundColor = '#047857')}
          onMouseLeave={(e) => !isRetrying && (e.currentTarget.style.backgroundColor = '#059669')}
        >
          <RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />
          <span>{isRetrying ? 'Đang thử lại...' : 'Thử lại ngay'}</span>
        </button>
      )}
    </div>
  );
};

AdminErrorState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onRetry: PropTypes.func,
  isRetrying: PropTypes.bool,
};

export default AdminErrorState;
