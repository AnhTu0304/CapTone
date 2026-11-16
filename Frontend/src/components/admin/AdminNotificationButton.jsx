import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Radio,
  Loader2,
  Activity,
  Megaphone,
} from 'lucide-react';
import { getAlertsOverview } from '../../services/adminIncidentsService';
import { fetchAdminBroadcasts } from '../../services/adminBroadcastService';

export const AdminNotificationButton = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'broadcasts'
  const [alerts, setAlerts] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);

  // Đọc danh sách ID thông báo đã đọc từ localStorage
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('selfheal_admin_read_notif_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Tải dữ liệu thời gian thực từ Backend (100% không dùng dữ liệu cứng)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [overviewData, broadcastData] = await Promise.all([
        getAlertsOverview().catch(() => null),
        fetchAdminBroadcasts().catch(() => null),
      ]);

      if (overviewData?.platformAlerts && Array.isArray(overviewData.platformAlerts)) {
        setAlerts(overviewData.platformAlerts.slice(0, 8));
      } else {
        setAlerts([]);
      }

      if (broadcastData?.broadcasts && Array.isArray(broadcastData.broadcasts)) {
        setBroadcasts(broadcastData.broadcasts.slice(0, 8));
      } else {
        setBroadcasts([]);
      }
    } catch (err) {
      console.warn('[AdminNotificationButton] Lỗi nạp thông báo:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
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

  const markIdAsRead = (id) => {
    if (!id) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('selfheal_admin_read_notif_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleMarkAllAsRead = () => {
    const allIds = [
      ...alerts.map((a) => a.id),
      ...broadcasts.map((b) => b.id || b.broadcast_code),
    ];
    setReadIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      try {
        localStorage.setItem('selfheal_admin_read_notif_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const isAlertUnread = (alt) => {
    if (readIds.has(alt.id)) return false;
    return alt.status !== 'RESOLVED' || alt.severity === 'CRITICAL' || alt.severity === 'WARNING';
  };

  const isBroadcastUnread = (b) => {
    const key = b.id || b.broadcast_code;
    return !readIds.has(key);
  };

  const unreadAlertsCount = alerts.filter(isAlertUnread).length;
  const unreadBroadcastsCount = broadcasts.filter(isBroadcastUnread).length;
  const totalUnreadCount = unreadAlertsCount + unreadBroadcastsCount;

  const handleAlertItemClick = (alt) => {
    markIdAsRead(alt.id);
    if (onNavigate) {
      onNavigate('/admin/alerts');
      setIsOpen(false);
    }
  };

  const handleBroadcastItemClick = (b) => {
    markIdAsRead(b.id || b.broadcast_code);
    if (onNavigate) {
      onNavigate('/admin/notifications');
      setIsOpen(false);
    }
  };

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          icon: AlertTriangle,
          color: '#DC2626',
          bg: '#FEF2F2',
        };
      case 'WARNING':
      case 'HIGH':
        return {
          icon: Cpu,
          color: '#D97706',
          bg: '#FFFBEB',
        };
      case 'INFO':
      default:
        return {
          icon: ShieldCheck,
          color: '#059669',
          bg: '#ECFDF5',
        };
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
        {totalUnreadCount > 0 && (
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
            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
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
            width: '380px',
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
              {totalUnreadCount > 0 && (
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
                  {totalUnreadCount} mới
                </span>
              )}
            </div>

            {totalUnreadCount > 0 && (
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

          {/* Segmented Tabs: Cảnh Báo Kỹ Thuật & Bản Tin Phát Sóng */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--dash-border)',
              backgroundColor: '#F8FAFC',
              padding: '4px 6px',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: activeTab === 'alerts' ? 700 : 500,
                color: activeTab === 'alerts' ? '#065F46' : 'var(--dash-text-muted)',
                backgroundColor: activeTab === 'alerts' ? '#FFFFFF' : 'transparent',
                border: activeTab === 'alerts' ? '1px solid #CBD5E1' : '1px solid transparent',
                boxShadow: activeTab === 'alerts' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <Activity size={13} color={activeTab === 'alerts' ? '#059669' : '#64748B'} />
              <span>Cảnh Báo Kỹ Thuật</span>
              {unreadAlertsCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    fontSize: '0.625rem',
                    padding: '0 5px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                  }}
                >
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('broadcasts')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: activeTab === 'broadcasts' ? 700 : 500,
                color: activeTab === 'broadcasts' ? '#065F46' : 'var(--dash-text-muted)',
                backgroundColor: activeTab === 'broadcasts' ? '#FFFFFF' : 'transparent',
                border: activeTab === 'broadcasts' ? '1px solid #CBD5E1' : '1px solid transparent',
                boxShadow: activeTab === 'broadcasts' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <Megaphone size={13} color={activeTab === 'broadcasts' ? '#059669' : '#64748B'} />
              <span>Bản Tin Phát Sóng</span>
              {unreadBroadcastsCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    fontSize: '0.625rem',
                    padding: '0 5px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                  }}
                >
                  {unreadBroadcastsCount}
                </span>
              )}
            </button>
          </div>

          {/* List Content */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {isLoading ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--dash-text-muted)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Đang đồng bộ dữ liệu thực tế...</span>
              </div>
            ) : activeTab === 'alerts' ? (
              // TAB 1: CẢNH BÁO KỸ THUẬT & HẠ TẦNG
              alerts.length === 0 ? (
                <div
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--dash-text-muted)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <ShieldCheck size={28} color="#059669" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div>Hệ thống hoạt động ổn định</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>Không có cảnh báo kỹ thuật nào</div>
                </div>
              ) : (
                alerts.map((alt) => {
                  const unread = isAlertUnread(alt);
                  const iconConfig = getAlertIcon(alt.severity);
                  const IconComp = iconConfig.icon;

                  return (
                    <div
                      key={alt.id}
                      onClick={() => handleAlertItemClick(alt)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: unread ? 'rgba(240, 253, 244, 0.5)' : '#FFFFFF',
                        display: 'flex',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = unread
                          ? 'rgba(240, 253, 244, 0.5)'
                          : '#FFFFFF')
                      }
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: iconConfig.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComp size={16} color={iconConfig.color} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: unread ? 700 : 600,
                            color: 'var(--dash-text-primary)',
                            marginBottom: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {alt.title}
                          </span>
                          {unread && (
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#10B981',
                                flexShrink: 0,
                                marginLeft: '6px',
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
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {alt.detail || alt.scope || alt.service}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--dash-text-muted)',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{alt.timestamp || 'Thời gian thực'}</span>
                          {alt.service && (
                            <span style={{ color: '#059669', backgroundColor: '#ECFDF5', padding: '0 4px', borderRadius: '4px' }}>
                              {alt.service}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              // TAB 2: BẢN TIN PHÁT SÓNG TOÀN MẠNG
              broadcasts.length === 0 ? (
                <div
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--dash-text-muted)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <Radio size={28} color="#64748B" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div>Chưa có bản tin phát sóng nào</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>Các thông báo toàn mạng sẽ hiển thị tại đây</div>
                </div>
              ) : (
                broadcasts.map((b) => {
                  const unread = isBroadcastUnread(b);
                  return (
                    <div
                      key={b.id || b.broadcast_code}
                      onClick={() => handleBroadcastItemClick(b)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: unread ? 'rgba(240, 253, 244, 0.5)' : '#FFFFFF',
                        display: 'flex',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = unread
                          ? 'rgba(240, 253, 244, 0.5)'
                          : '#FFFFFF')
                      }
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: '#F0FDF4',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: '1px solid #BBF7D0',
                        }}
                      >
                        <Radio size={16} color="#059669" />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: unread ? 700 : 600,
                            color: 'var(--dash-text-primary)',
                            marginBottom: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.title}
                          </span>
                          {unread && (
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#10B981',
                                flexShrink: 0,
                                marginLeft: '6px',
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
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {b.content}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--dash-text-muted)',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span style={{ color: '#047857', fontWeight: 600 }}>{b.broadcast_code}</span>
                          <span>•</span>
                          <span>{b.audience || 'Tất cả người dùng'}</span>
                          <span>•</span>
                          <span>{b.formatted_date || 'Gần đây'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>

          {/* Footer - Điều hướng chính xác theo Tab */}
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--dash-bg-canvas)',
              borderTop: '1px solid var(--dash-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeTab === 'alerts' ? (
              <button
                type="button"
                onClick={() => {
                  if (onNavigate) onNavigate('/admin/alerts');
                  setIsOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--dash-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Xem Tất Cả Sự Cố & Cảnh Báo Hạ Tầng</span>
                <span>&rarr;</span>
              </button>
            ) : (
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Mở Trung Tâm Phát Thông Báo Toàn Mạng</span>
                <span>&rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationButton;
