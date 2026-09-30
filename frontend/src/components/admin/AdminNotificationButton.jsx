import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Cần Phê Duyệt HITL Khẩn Cấp',
    desc: 'Tháo tải & Cô lập máy chủ worker-03 do CPU chạm ngưỡng 88%',
    time: '2 phút trước',
    unread: true,
    type: 'critical',
    icon: AlertTriangle,
    iconColor: '#DC2626',
    bgColor: '#FEF2F2',
  },
  {
    id: 'notif-2',
    title: 'Đã Vá Lỗi Tự Lành Thành Công',
    desc: 'Tự động mở rộng Memory Limit 4096MiB cho payment-service',
    time: '14 phút trước',
    unread: true,
    type: 'success',
    icon: ShieldCheck,
    iconColor: '#059669',
    bgColor: '#ECFDF5',
  },
  {
    id: 'notif-3',
    title: 'Cảnh Báo Tải eBPF Agent',
    desc: 'Nhịp tim tác tử eBPF trên cụm staging trễ 4.2ms',
    time: '45 phút trước',
    unread: true,
    type: 'warning',
    icon: Cpu,
    iconColor: '#D97706',
    bgColor: '#FFFBEB',
  },
];

export const AdminNotificationButton = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const containerRef = useRef(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleNotificationClick = (item) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
    );
    if (onNavigate) {
      onNavigate('/admin/notifications');
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Thông báo hệ thống quản trị"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: 'relative',
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          border: '1px solid var(--dash-border)',
          backgroundColor: isOpen ? 'var(--dash-bg-subtle)' : '#FFFFFF',
          color: 'var(--dash-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#CBD5E1';
          e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'var(--dash-border)';
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          }
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '9999px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontSize: '0.625rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #FFFFFF',
              boxShadow: '0 1px 3px rgba(239, 68, 68, 0.4)',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Danh sách thông báo"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '340px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-dropdown)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeInSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(180deg, #F0FDF4 0%, #E6FBF0 100%)',
              borderBottom: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#065F46' }}>
                Thông Báo Quản Trị
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                  }}
                >
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#065F46',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: '6px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <CheckCheck size={13} />
                <span>Đã đọc tất cả</span>
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--dash-text-muted)',
                  fontSize: '0.8125rem',
                }}
              >
                Không có thông báo mới nào
              </div>
            ) : (
              notifications.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: item.unread ? 'rgba(240, 253, 244, 0.5)' : '#FFFFFF',
                      display: 'flex',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = item.unread
                        ? 'rgba(240, 253, 244, 0.5)'
                        : '#FFFFFF')
                    }
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: item.bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={16} color={item.iconColor} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: item.unread ? 700 : 600,
                          color: 'var(--dash-text-primary)',
                          marginBottom: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ truncate: true }}>{item.title}</span>
                        {item.unread && (
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#10B981',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--dash-text-secondary)',
                          lineHeight: 1.4,
                          marginBottom: '4px',
                        }}
                      >
                        {item.desc}
                      </div>
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--dash-text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {item.time}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--dash-bg-canvas)',
              borderTop: '1px solid var(--dash-border)',
              textAlign: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (onNavigate) onNavigate('/admin/notifications');
                setIsOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Mở Trung Tâm Cảnh Báo Toàn Cục &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationButton;
