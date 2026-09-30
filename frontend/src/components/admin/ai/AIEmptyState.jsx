import React from 'react';
import PropTypes from 'prop-types';
import { Database, RotateCcw } from 'lucide-react';

export const AIEmptyState = ({
  title = 'Không Có Dữ Liệu Khả Dụng',
  description = 'Hiện chưa có bản ghi nào từ hệ thống backend hoặc bộ lọc hiện tại không tìm thấy kết quả phù hợp.',
  actionText,
  actionLabel,
  onAction,
}) => {
  const buttonLabel = actionLabel || actionText || 'Xóa bộ lọc & Tải lại';

  return (
    <div
      className="dash-card"
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px dashed var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          color: 'var(--dash-text-muted)',
        }}
      >
        <Database size={26} />
      </div>

      <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: '0 0 6px 0' }}>
        {title}
      </h3>

      <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', maxWidth: '440px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
        {description}
      </p>

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            color: 'var(--dash-primary)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--dash-primary)';
            e.currentTarget.style.backgroundColor = 'var(--dash-primary-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--dash-border)';
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          }}
        >
          <RotateCcw size={13} />
          <span>{buttonLabel}</span>
        </button>
      )}
    </div>
  );
};

AIEmptyState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  actionText: PropTypes.string,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
};

export default AIEmptyState;
