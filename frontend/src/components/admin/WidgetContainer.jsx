import React from 'react';
import { AlertCircle, WifiOff, Inbox, RefreshCw, DatabaseZap } from 'lucide-react';

/**
 * Reusable WidgetContainer Component
 * Handles unified widget states: loading, empty, error, no-data, disconnected, and ready.
 */
export const WidgetContainer = ({
  title,
  subtitle,
  icon: Icon,
  action,
  status = 'ready', // 'ready' | 'loading' | 'empty' | 'error' | 'no-data' | 'disconnected'
  errorMessage,
  emptyMessage = 'Không có dữ liệu trong khoảng thời gian đã chọn.',
  disconnectedMessage = 'Mất kết nối với cụm máy chủ hoặc tác tử eBPF viễn trắc.',
  noDataMessage = 'Chưa có dữ liệu viễn trắc được ghi nhận cho mục tiêu này.',
  onRetry,
  children,
  style = {},
  className = '',
}) => {
  return (
    <section
      className={`dash-card ${className}`}
      aria-label={title}
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        minHeight: '180px',
        ...style,
      }}
    >
      {/* Widget Header */}
      {(title || subtitle || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {Icon && (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(5, 150, 105, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--dash-primary)',
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
            )}
            <div>
              {title && (
                <h3
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    color: 'var(--dash-text-primary)',
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--dash-text-muted)',
                    margin: '2px 0 0 0',
                    lineHeight: 1.4,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}

      {/* Widget Content Body by Status */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 1. LOADING STATE */}
        {status === 'loading' && (
          <div
            role="status"
            aria-label="Đang nạp dữ liệu"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '24px 0',
              gap: '12px',
            }}
          >
            <RefreshCw
              size={24}
              color="var(--dash-primary)"
              style={{
                animation: 'spin 1s linear infinite',
              }}
            />
            <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)', fontWeight: 500 }}>
              Đang tải dữ liệu viễn trắc...
            </div>
          </div>
        )}

        {/* 2. ERROR STATE */}
        {status === 'error' && (
          <div
            role="alert"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              backgroundColor: '#FEF2F2',
              borderRadius: '12px',
              border: '1px solid #FECACA',
              textAlign: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={24} color="#DC2626" />
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991B1B' }}>
              Không Thể Nạp Dữ Liệu
            </div>
            <div style={{ fontSize: '0.75rem', color: '#B91C1C', maxWidth: '420px', lineHeight: 1.5 }}>
              {errorMessage || 'Đã xảy ra lỗi khi truy vấn viễn trắc từ dịch vụ quản trị.'}
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  marginTop: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                }}
              >
                <RefreshCw size={13} />
                <span>Thử Lại Ngay</span>
              </button>
            )}
          </div>
        )}

        {/* 3. DISCONNECTED STATE */}
        {status === 'disconnected' && (
          <div
            role="status"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              backgroundColor: '#FFFBEB',
              borderRadius: '12px',
              border: '1px solid #FDE68A',
              textAlign: 'center',
              gap: '10px',
            }}
          >
            <WifiOff size={24} color="#D97706" />
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#92400E' }}>
              Mất Kết Nối Với Cụm Máy Chủ
            </div>
            <div style={{ fontSize: '0.75rem', color: '#B45309', maxWidth: '420px', lineHeight: 1.5 }}>
              {disconnectedMessage}
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  marginTop: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} />
                <span>Kiểm Tra Lại Kết Nối</span>
              </button>
            )}
          </div>
        )}

        {/* 4. NO-DATA STATE */}
        {status === 'no-data' && (
          <div
            role="status"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: '12px',
              border: '1px dashed var(--dash-border)',
              textAlign: 'center',
              gap: '10px',
            }}
          >
            <DatabaseZap size={24} color="#94A3B8" />
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>
              Chưa Có Dữ Liệu Viễn Trắc
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', maxWidth: '420px', lineHeight: 1.5 }}>
              {noDataMessage}
            </div>
          </div>
        )}

        {/* 5. EMPTY STATE */}
        {status === 'empty' && (
          <div
            role="status"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: '12px',
              border: '1px dashed var(--dash-border)',
              textAlign: 'center',
              gap: '8px',
            }}
          >
            <Inbox size={24} color="#94A3B8" />
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
              {emptyMessage}
            </div>
          </div>
        )}

        {/* 6. READY STATE */}
        {status === 'ready' && children}
      </div>
    </section>
  );
};

export default WidgetContainer;
