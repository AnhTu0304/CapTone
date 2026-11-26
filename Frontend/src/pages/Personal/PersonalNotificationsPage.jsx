import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Filter,
  Settings,
  ShieldAlert,
  ShieldCheck,
  X,
  ExternalLink,
  Building2,
  Server,
  Layers,
  Radio,
  Cpu,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';

const cleanTitle = (title) => {
  if (!title) return '';
  return title.replace(/\[INC-[A-Za-z0-9_-]+\]\s*/gi, '').trim();
};

const getServiceName = (item) => {
  if (item.serviceName) return item.serviceName;
  const match = (item.title || '').match(/trên\s+([a-zA-Z0-9_.-]+)/i) || (item.message || '').match(/on\s+([a-zA-Z0-9_.-]+)/i);
  return match ? match[1] : null;
};

const getTypeConfig = (type) => {
  switch (type) {
    case 'INFRASTRUCTURE':
      return {
        bg: '#FEF2F2',
        color: '#DC2626',
        icon: <Server size={18} />,
        label: 'Sự Cố K8s',
      };
    case 'SECURITY':
      return {
        bg: '#FFF7ED',
        color: '#EA580C',
        icon: <ShieldAlert size={18} />,
        label: 'Bảo Mật',
      };
    case 'BROADCAST':
      return {
        bg: '#F5F3FF',
        color: '#7C3AED',
        icon: <Radio size={18} />,
        label: 'Phát Thanh Admin',
      };
    case 'INVITATION':
      return {
        bg: '#EFF6FF',
        color: '#2563EB',
        icon: <Building2 size={18} />,
        label: 'Lời Mời Company',
      };
    case 'ROLE':
      return {
        bg: '#F0F9FF',
        color: '#0284C7',
        icon: <ShieldCheck size={18} />,
        label: 'Thay Đổi Vai Trò',
      };
    case 'SYSTEM':
    default:
      return {
        bg: '#ECFDF5',
        color: '#059669',
        icon: <Cpu size={18} />,
        label: 'Hệ Thống Nền Tảng',
      };
  }
};

const formatDisplayTime = (timeStr, fallbackTime) => {
  if (fallbackTime && !fallbackTime.includes('T')) return fallbackTime;
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return timeStr;
  }
};

export const PersonalNotificationsPage = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState(() => personalPortalService.getNotifications());
  const [companies, setCompanies] = useState(() => personalPortalService.getMyCompanies());
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'INVITATION' | 'SECURITY' | 'ROLE' | 'SYSTEM'
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settings, setSettings] = useState(() => personalPortalService.getNotificationSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    let isMounted = true;
    personalPortalService.fetchNotifications().then((res) => {
      if (isMounted && res && res.items) {
        setNotifications(res.items);
      }
    });
    personalPortalService.fetchMyCompanies().then((res) => {
      if (isMounted && res && Array.isArray(res)) {
        setCompanies(res);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const getOrgName = (item) => {
    if (item.organizationName) return item.organizationName;
    if (item.organization_name) return item.organization_name;
    if (item.organizationId) {
      const found = companies.find((c) => c.id === item.organizationId);
      if (found) return found.name;
    }
    return companies[0]?.name || 'SME Retail Enterprise';
  };

  const getClusterName = (item) => {
    if (item.clusterName) return item.clusterName;
    if (item.environmentName) return `${item.environmentName} (minikube)`;
    return 'minikube';
  };

  const handleMarkAsRead = async (id) => {
    const updated = await personalPortalService.markAsRead(id);
    setNotifications([...updated]);
  };

  const handleMarkAllAsRead = async () => {
    const updated = await personalPortalService.markAllAsRead();
    setNotifications([...updated]);
  };

  const handleDelete = async (id) => {
    const updated = await personalPortalService.deleteNotification(id);
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
            Trung Tâm Thông Báo Cá Nhân
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
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
            maxWidth: '100%',
          }}
        >
          <option value="ALL">Tất cả loại thông báo</option>
          <option value="INFRASTRUCTURE">Sự cố Hạ tầng K8s (Khẩn cấp)</option>
          <option value="BROADCAST">Phát thanh Quản trị viên</option>
          <option value="SYSTEM">Hệ thống AI / Nền tảng</option>
          <option value="SECURITY">Cảnh báo bảo mật</option>
          <option value="INVITATION">Lời mời Company</option>
          <option value="ROLE">Thay đổi vai trò</option>
        </select>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map((item) => {
          const typeConf = getTypeConfig(item.type);
          return (
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
                  flexWrap: 'wrap',
                  gap: '16px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 'min(100%, 240px)' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '9px',
                    backgroundColor: typeConf.bg,
                    color: typeConf.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                  title={typeConf.label}
                >
                  {typeConf.icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: typeConf.bg,
                        color: typeConf.color,
                        border: `1px solid ${typeConf.color}33`,
                      }}
                    >
                      {typeConf.label}
                    </span>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      {cleanTitle(item.title)}
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
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                      {formatDisplayTime(item.createdAt, item.time)}
                    </span>
                  </div>

                <p style={{ fontSize: '0.8125rem', color: '#475569', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                  {item.message}
                </p>

                {/* Metadata context: Công ty, Cụm K8s, Dịch vụ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.71875rem',
                      fontWeight: 600,
                      color: '#334155',
                    }}
                  >
                    <Building2 size={13} color="#475569" />
                    <span>Công ty: <strong style={{ color: '#0F172A' }}>{getOrgName(item)}</strong></span>
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      fontSize: '0.71875rem',
                      fontWeight: 600,
                      color: '#1D4ED8',
                    }}
                  >
                    <Server size={13} color="#2563EB" />
                    <span>Cụm K8s: <strong style={{ color: '#1E40AF' }}>{getClusterName(item)}</strong></span>
                  </span>

                  {getServiceName(item) && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        fontSize: '0.71875rem',
                        fontWeight: 600,
                        color: '#15803D',
                      }}
                    >
                      <Layers size={13} color="#16A34A" />
                      <span>Dịch vụ: <strong style={{ color: '#14532D' }}>{getServiceName(item)}</strong></span>
                    </span>
                  )}

                  {item.actionPath && (
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate(item.actionPath)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        fontSize: '0.71875rem',
                        fontWeight: 700,
                        color: '#DC2626',
                        cursor: 'pointer',
                      }}
                    >
                      <span>Xem Sự Cố</span>
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>

                {/* Action button if invitation */}
                {item.type === 'INVITATION' && (
                  <button
                    type="button"
                    onClick={() => onNavigate && onNavigate('/portal/companies')}
                    style={{
                      marginTop: '8px',
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

            {/* Quick Actions on Notification: Only mark as read, trash can deleted per request */}
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
            </div>
          </div>
        );
      })}

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
