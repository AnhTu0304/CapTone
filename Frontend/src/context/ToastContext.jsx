import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, type, title, message, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message, title = 'Thành Công') => {
    showToast({ type: 'success', title, message });
  }, [showToast]);

  const error = useCallback((message, title = 'Lỗi Thao Tác') => {
    showToast({ type: 'error', title, message });
  }, [showToast]);

  const warning = useCallback((message, title = 'Cảnh Báo') => {
    showToast({ type: 'warning', title, message });
  }, [showToast]);

  const info = useCallback((message, title = 'Thông Báo') => {
    showToast({ type: 'info', title, message });
  }, [showToast]);

  const getToastColors = (type) => {
    switch (type) {
      case 'success':
        return {
          bg: '#FFFFFF',
          border: '#A7F3D0',
          accent: '#059669',
          iconBg: '#ECFDF5',
          Icon: CheckCircle2,
        };
      case 'error':
        return {
          bg: '#FFFFFF',
          border: '#FECDD3',
          accent: '#E11D48',
          iconBg: '#FFF1F2',
          Icon: AlertCircle,
        };
      case 'warning':
        return {
          bg: '#FFFFFF',
          border: '#FDE68A',
          accent: '#D97706',
          iconBg: '#FFFBEB',
          Icon: AlertTriangle,
        };
      case 'info':
      default:
        return {
          bg: '#FFFFFF',
          border: '#BFDBFE',
          accent: '#2563EB',
          iconBg: '#EFF6FF',
          Icon: Info,
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, removeToast }}>
      {children}

      {/* Floating Toast Container */}
      <div
        className="selfheal-toast-container"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          width: 'calc(100vw - 32px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const { border, accent, iconBg, Icon } = getToastColors(toast.type);

          return (
            <div
              key={toast.id}
              role="alert"
              style={{
                pointerEvents: 'auto',
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--dash-radius-md, 8px)',
                border: `1px solid ${border}`,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                position: 'relative',
                overflow: 'hidden',
                animation: 'slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Left Accent Bar */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: '4px',
                  backgroundColor: accent,
                }}
              />

              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: accent,
                  marginTop: '1px',
                }}
              >
                <Icon size={18} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {toast.title && (
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: 'var(--dash-text-primary, #0F172A)',
                      lineHeight: 1.3,
                      marginBottom: '2px',
                    }}
                  >
                    {toast.title}
                  </div>
                )}
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--dash-text-secondary, #475569)',
                    lineHeight: 1.4,
                  }}
                >
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Đóng thông báo"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--dash-text-muted, #94A3B8)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback safe dummy functions if rendered outside provider
    return {
      showToast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      removeToast: () => {},
    };
  }
  return context;
};

export default ToastContext;
