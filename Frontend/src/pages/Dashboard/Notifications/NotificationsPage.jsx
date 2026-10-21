import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Bell,
  CheckCircle2,
  RefreshCw,
  Check,
  ArrowRight,
  Server,
  Zap,
  ShieldAlert,
  Cpu,
  Inbox
} from 'lucide-react';
import { NOTIFICATION_TYPES, NOTIFICATION_SEVERITIES } from '../../../mocks/notificationMockData';

const EMPTY_NOTIFICATIONS = [];

export const NotificationsPage = () => {
  const dashboard = useDashboard();
  const currentOrg = dashboard?.currentOrg || { name: 'Acme Corporation' };
  const currentEnv = dashboard?.currentEnv || { name: 'production-us-east-1' };
  const isRefreshing = dashboard?.isRefreshing || false;
  const triggerRefresh = dashboard?.triggerRefresh || (() => {});
  const onNavigate = dashboard?.onNavigate;
  const notifications = dashboard?.notifications || EMPTY_NOTIFICATIONS;
  const toggleNotificationRead = dashboard?.toggleNotificationRead || (() => {});
  const markAllNotificationsRead = dashboard?.markAllNotificationsRead || (() => {});
  const unreadCount = dashboard?.unreadNotifsCount ?? notifications.filter((n) => n.unread || !n.read).length;

  // Filter States
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'INFRASTRUCTURE' | 'SELF_HEALING' | 'SECURITY' | 'SYSTEM'
  const [pageSize, setPageSize] = useState(6);

  // Filter logic
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const isRead = n.read ?? !n.unread;
      // Status filter
      if (statusFilter === 'UNREAD' && isRead) return false;
      if (statusFilter === 'READ' && !isRead) return false;

      // Type filter
      if (typeFilter !== 'ALL') {
        const itemType = n.type || n.category;
        if (itemType !== typeFilter) return false;
      }

      return true;
    });
  }, [notifications, statusFilter, typeFilter]);

  const visibleNotifications = useMemo(() => {
    return filteredNotifications.slice(0, pageSize);
  }, [filteredNotifications, pageSize]);

  const hasMore = pageSize < filteredNotifications.length;

  const handleLoadMore = () => {
    setPageSize((prev) => prev + 6);
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case NOTIFICATION_SEVERITIES.CRITICAL:
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Khẩn Cấp' };
      case NOTIFICATION_SEVERITIES.HIGH:
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'Cảnh Báo Cao' };
      case NOTIFICATION_SEVERITIES.MEDIUM:
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'Trung Bình' };
      case NOTIFICATION_SEVERITIES.LOW:
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'Thấp' };
      case NOTIFICATION_SEVERITIES.INFO:
      default:
        return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: 'Thông Tin' };
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.INFRASTRUCTURE:
        return <Server size={18} color="#2563EB" />;
      case NOTIFICATION_TYPES.SELF_HEALING:
        return <Zap size={18} color="#059669" />;
      case NOTIFICATION_TYPES.SECURITY:
        return <ShieldAlert size={18} color="#DC2626" />;
      case NOTIFICATION_TYPES.SYSTEM:
      default:
        return <Cpu size={18} color="#64748B" />;
    }
  };

  return (
    <div className="dashboard-notifications-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Trung Tâm Thông Báo & Điều Phối Cảnh Báo
            </h1>
            {unreadCount > 0 && (
              <span
                data-testid="header-unread-badge"
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: '#FFF1F2',
                  color: '#E11D48',
                  border: '1px solid #FDA4AF',
                }}
              >
                {unreadCount} chưa đọc
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Quản trị kênh truyền thông báo, cảnh báo khẩn cấp và các yêu cầu can thiệp HITL
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={triggerRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--dash-text-secondary)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới thông báo</span>
          </button>

          <button
            type="button"
            data-testid="btn-mark-all-read"
            onClick={markAllNotificationsRead}
            disabled={unreadCount === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: unreadCount > 0 ? '#FFFFFF' : '#F8FAFC',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: unreadCount > 0 ? 'var(--dash-primary)' : 'var(--dash-text-muted)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: unreadCount > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
            }}
          >
            <Check size={14} />
            <span>Đánh Dấu Tất Cả Đã Đọc</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Row */}
      <div
        className="dash-card"
        style={{
          padding: '16px 20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Status Tabs: All, Unread, Read */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
            Trạng thái:
          </span>
          {[
            { key: 'ALL', label: 'Tất Cả' },
            { key: 'UNREAD', label: `Chưa Đọc (${unreadCount})` },
            { key: 'READ', label: 'Đã Đọc' },
          ].map((tab) => (
            <button
              key={tab.key}
              data-testid={`filter-status-${tab.key}`}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--dash-radius-full)',
                border: '1px solid var(--dash-border)',
                backgroundColor: statusFilter === tab.key ? 'var(--dash-primary)' : '#FFFFFF',
                color: statusFilter === tab.key ? '#FFFFFF' : 'var(--dash-text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type Category Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
            Phân loại:
          </span>
          {[
            { key: 'ALL', label: 'Tất Cả Loại' },
            { key: NOTIFICATION_TYPES.INFRASTRUCTURE, label: 'Hạ Tầng' },
            { key: NOTIFICATION_TYPES.SELF_HEALING, label: 'Tự Phục Hồi' },
            { key: NOTIFICATION_TYPES.SECURITY, label: 'Bảo Mật' },
            { key: NOTIFICATION_TYPES.SYSTEM, label: 'Hệ Thống' },
          ].map((typeChip) => (
            <button
              key={typeChip.key}
              data-testid={`filter-type-${typeChip.key}`}
              type="button"
              onClick={() => setTypeFilter(typeChip.key)}
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--dash-radius-sm)',
                border: typeFilter === typeChip.key ? '1px solid var(--dash-primary)' : '1px solid var(--dash-border)',
                backgroundColor: typeFilter === typeChip.key ? 'var(--dash-mint-50)' : '#FFFFFF',
                color: typeFilter === typeChip.key ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {typeChip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div
        className="dash-card"
        style={{
          padding: '0',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visibleNotifications.length === 0 ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--dash-text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Inbox size={40} strokeWidth={1.5} color="var(--dash-text-muted)" />
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--dash-text-secondary)' }}>
                Không tìm thấy thông báo nào trong phân mục này
              </div>
              <p style={{ fontSize: '0.8125rem', margin: 0, maxWidth: '360px' }}>
                {statusFilter === 'UNREAD'
                  ? 'Tuyệt vời! Bạn đã xem hết tất cả thông báo quan trọng.'
                  : 'Hãy thử đổi bộ lọc trạng thái hoặc loại thông báo để xem các cảnh báo khác.'}
              </p>
            </div>
          ) : (
            visibleNotifications.map((n) => {
              const isRead = n.read ?? !n.unread;
              const severityMeta = getSeverityBadge(n.severity);
              const typeIcon = getTypeIcon(n.type || n.category);

              return (
                <div
                  key={n.id}
                  style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--dash-border)',
                    backgroundColor: isRead ? '#FFFFFF' : 'rgba(5, 150, 105, 0.03)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Left: Icon, Details, Tags */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--dash-radius-md)',
                        backgroundColor: isRead ? '#F8FAFC' : '#ECFDF5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid var(--dash-border)',
                      }}
                    >
                      {typeIcon}
                    </div>

                    <div style={{ flex: 1 }}>
                      {/* Top Meta: Type, Severity, Time, Unread Indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                            border: '1px solid #CBD5E1',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {n.type || n.category || 'SYSTEM'}
                        </span>

                        {n.severity && (
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: severityMeta.bg,
                              color: severityMeta.text,
                              border: `1px solid ${severityMeta.border}`,
                            }}
                          >
                            {severityMeta.label}
                          </span>
                        )}

                        <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                          {n.timestamp || n.time}
                        </span>

                        {!isRead && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--dash-primary)',
                              display: 'inline-block',
                            }}
                            title="Thông báo mới chưa đọc"
                          />
                        )}
                      </div>

                      {/* Title */}
                      <h4
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: isRead ? 600 : 700,
                          color: 'var(--dash-text-primary)',
                          margin: '0 0 4px 0',
                        }}
                      >
                        {n.title}
                      </h4>

                      {/* Message Body */}
                      <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                        {n.message || n.desc}
                      </p>

                      {/* Metadata Chips if available */}
                      {n.metadata && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {n.metadata.cluster && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)', backgroundColor: 'var(--dash-bg-canvas)', padding: '2px 6px', borderRadius: '4px' }}>
                              Cụm: {n.metadata.cluster}
                            </span>
                          )}
                          {n.metadata.resource && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)', backgroundColor: 'var(--dash-bg-canvas)', padding: '2px 6px', borderRadius: '4px' }}>
                              Tài nguyên: {n.metadata.resource}
                            </span>
                          )}
                          {n.metadata.mttr && (
                            <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, backgroundColor: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                              MTTR: {n.metadata.mttr}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Deep-link and Read toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {(n.actionPath || n.link) && (
                      <button
                        type="button"
                        onClick={() => onNavigate && onNavigate(n.actionPath || n.link)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--dash-border)',
                          borderRadius: 'var(--dash-radius-md)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--dash-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{n.actionText || 'Chi Tiết'}</span>
                        <ArrowRight size={12} />
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid={`btn-toggle-read-${n.id}`}
                      onClick={() => toggleNotificationRead(n.id)}
                      title={isRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                      aria-label={isRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                      style={{
                        padding: '6px',
                        background: 'none',
                        border: 'none',
                        color: isRead ? 'var(--dash-text-muted)' : 'var(--dash-primary)',
                        cursor: 'pointer',
                        borderRadius: 'var(--dash-radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Load More Pagination */}
        {hasMore && (
          <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--dash-border)', backgroundColor: 'var(--dash-bg-canvas)' }}>
            <button
              type="button"
              onClick={handleLoadMore}
              style={{
                padding: '8px 20px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                color: 'var(--dash-text-primary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Xem thêm thông báo cũ hơn ({filteredNotifications.length - pageSize} thông báo còn lại)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
