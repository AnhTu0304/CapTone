import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Filter,
  Settings,
  ShieldAlert,
  Trash2,
  X,
  ExternalLink,
  Building2,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';

export const PersonalNotificationsPage = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState(() => personalPortalService.getNotifications());
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'INVITATION' | 'SECURITY' | 'ROLE' | 'SYSTEM'
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settings, setSettings] = useState(() => personalPortalService.getNotificationSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);

  const handleMarkAsRead = (id) => {
    const updated = personalPortalService.markAsRead(id);
    setNotifications([...updated]);
  };

  const handleMarkAllAsRead = () => {
    const updated = personalPortalService.markAllAsRead();
    setNotifications([...updated]);
  };

  const handleDelete = (id) => {
    const updated = personalPortalService.deleteNotification(id);
    setNotifications([...updated]);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    personalPortalService.saveNotificationSettings(settings);
    setSettingsSaved(true);
    setTimeout(() => {
      setSettingsSaved(false);
      setIsSettingsModalOpen(false);
    }, 1200);
  };

  // Filtered
  const filtered = notifications.filter((n) => {
    const matchesStatus =
      statusFilter === 'ALL' || (statusFilter === 'UNREAD' && !n.read) || (statusFilter === 'READ' && n.read);
    const matchesType = typeFilter === 'ALL' || n.type === typeFilter;
    return matchesStatus && matchesType;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Notifications — Trung Tâm Thông Báo Cá Nhân
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Xem thông báo lời mời Company, cảnh báo đăng nhập và cập nhật hệ thống. Bạn có {unreadCount} tin chưa đọc.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#F0FDF4',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                fontSize: '0.78125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCheck size={16} />
              <span>Đánh Dấu Tất Cả Đã Đọc</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              fontSize: '0.78125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Settings size={15} />
            <span>Cài Đặt Nhận Tin</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          padding: '12px 16px',
          border: '1px solid #E2E8F0',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={15} />
          <span>Bộ lọc:</span>
        </span>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'ALL', label: `Tất cả (${notifications.length})` },
            { id: 'UNREAD', label: `Chưa đọc (${unreadCount})` },
            { id: 'READ', label: `Đã đọc (${notifications.length - unreadCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: statusFilter === tab.id ? '#059669' : '#F1F5F9',
                color: statusFilter === tab.id ? '#FFFFFF' : '#475569',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            fontSize: '0.75rem',
            backgroundColor: '#FFFFFF',
            outline: 'none',
          }}
        >
          <option value="ALL">Tất cả loại thông báo</option>
          <option value="INVITATION">Lời mời Company</option>
          <option value="SECURITY">Cảnh báo bảo mật</option>
          <option value="ROLE">Thay đổi vai trò</option>
          <option value="SYSTEM">Hệ thống AI / Nền tảng</option>
        </select>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              backgroundColor: item.read ? '#FFFFFF' : '#F0FDF4',
              borderRadius: '10px',
              border: item.read ? '1px solid #E2E8F0' : '1px solid #A7F3D0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '9px',
                  backgroundColor:
                    item.type === 'INVITATION'
                      ? '#EFF6FF'
                      : item.type === 'SECURITY'
                      ? '#FEF2F2'
                      : item.type === 'ROLE'
                      ? '#F5F3FF'
                      : '#F0FDF4',
                  color:
                    item.type === 'INVITATION'
                      ? '#2563EB'
                      : item.type === 'SECURITY'
                      ? '#DC2626'
                      : item.type === 'ROLE'
                      ? '#7C3AED'
                      : '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                {item.type === 'INVITATION' ? (
                  <Building2 size={18} />
                ) : item.type === 'SECURITY' ? (
                  <ShieldAlert size={18} />
                ) : (
                  <Bell size={18} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {item.title}
                  </h4>
                  {!item.read && (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                      }}
                    >
                      MỚI
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{item.createdAt}</span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#475569', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                  {item.message}
                </p>

                {/* Action button if invitation */}
                {item.type === 'INVITATION' && (
                  <button
                    type="button"
                    onClick={() => onNavigate && onNavigate('/portal/companies')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>Xem Lời Mời Tại Company</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions on Notification */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!item.read && (
                <button
                  type="button"
                  onClick={() => handleMarkAsRead(item.id)}
                  title="Đánh dấu đã đọc"
                  style={{
                    padding: '6px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#059669',
                    cursor: 'pointer',
                  }}
                >
                  <CheckCheck size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                title="Xóa thông báo"
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px dashed #CBD5E1',
              color: '#64748B',
            }}
          >
            <Bell size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1E293B' }}>Không có thông báo nào</div>
            <p style={{ fontSize: '0.8125rem', margin: '4px 0 0 0' }}>
              Bạn đã xem hết toàn bộ thông báo hoặc không có tin phù hợp với bộ lọc hiện tại.
            </p>
          </div>
        )}
      </div>

      {/* NOTIFICATION SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color="#059669" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Cài Đặt Nhận Thông Báo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {settingsSaved && (
              <div
                style={{
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: '14px',
                }}
              >
                Đã lưu cài đặt thông báo thành công!
              </div>
            )}

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { key: 'webNotify', label: 'Thông báo trên giao diện Website (In-App)' },
                  { key: 'emailNotify', label: 'Gửi thông báo qua Email đăng ký' },
                  { key: 'companyInvitations', label: 'Thông báo lời mời tham gia Company mới' },
                  { key: 'securityAlerts', label: 'Cảnh báo đăng nhập lạ và thay đổi bảo mật' },
                  { key: 'criticalAlerts', label: 'Cảnh báo sự cố hạ tầng K8s khẩn cấp' },
                  { key: 'weeklyDigest', label: 'Bản tin tổng kết hoạt động hàng tuần' },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.8125rem',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(settings[item.key])}
                      onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#F1F5F9',
                    color: '#64748B',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Lưu Cài Đặt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalNotificationsPage;
