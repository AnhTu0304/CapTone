import React from 'react';
import PropTypes from 'prop-types';
import { Compass, ArrowLeft } from 'lucide-react';

/**
 * AdminNotFound Component
 * Màn hình Fallback 404 cho các tuyến đường quản trị không tồn tại (/admin/*).
 */
export const AdminNotFound = ({ onNavigate }) => {
  return (
    <div
      className="dash-card"
      style={{
        padding: '60px 24px',
        borderRadius: '16px',
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        maxWidth: '560px',
        margin: '40px auto',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          backgroundColor: '#F1F5F9',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748B',
        }}
      >
        <Compass size={28} />
      </div>

      <div>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--dash-text-primary)',
            margin: '0 0 8px 0',
          }}
        >
          Không tìm thấy trang quản trị
        </h2>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--dash-text-secondary)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Đường dẫn quản trị bạn yêu cầu không tồn tại hoặc đã được chuyển sang phân hệ khác.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onNavigate && onNavigate('/admin/overview')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          borderRadius: '8px',
          backgroundColor: '#059669',
          color: '#FFFFFF',
          fontSize: '0.8125rem',
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
          boxShadow: 'var(--dash-shadow-xs)',
          transition: 'background-color 0.15s ease',
          marginTop: '8px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#047857')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
      >
        <ArrowLeft size={16} />
        <span>Về Bàn Điều Khiển Tổng Quan</span>
      </button>
    </div>
  );
};

AdminNotFound.propTypes = {
  onNavigate: PropTypes.func,
};

export default AdminNotFound;
