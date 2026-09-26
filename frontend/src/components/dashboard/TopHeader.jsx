import React, { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../../pages/Dashboard/context/DashboardContext';
import {
  Building2,
  Server,
  RefreshCw,
  Bell,
  User,
  ChevronDown,
  Check,
  Radio,
  Clock,
  Shield,
  ExternalLink,
  Menu,
} from 'lucide-react';

export const TopHeader = () => {
  const {
    currentOrg,
    setCurrentOrg,
    orgList,
    currentEnv,
    setCurrentEnv,
    envList,
    currentUserRole,
    setCurrentUserRole,
    isAgentConnected,
    setIsAgentConnected,
    isAutoRefresh,
    setIsAutoRefresh,
    lastUpdated,
    isRefreshing,
    triggerRefresh,
    notifications,
    unreadNotifsCount,
    markAllNotificationsRead,
    isMobileNavOpen,
    setIsMobileNavOpen,
    onNavigate,
  } = useDashboard();

  // Dropdown states
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isEnvDropdownOpen, setIsEnvDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const orgRef = useRef(null);
  const envRef = useRef(null);
  const roleRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (orgRef.current && !orgRef.current.contains(e.target)) setIsOrgDropdownOpen(false);
      if (envRef.current && !envRef.current.contains(e.target)) setIsEnvDropdownOpen(false);
      if (roleRef.current && !roleRef.current.contains(e.target)) setIsRoleDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifPopoverOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roles = [
    { key: 'SME_OWNER', label: 'Chủ DN (SME Owner)', desc: 'Toàn quyền quản trị & phê duyệt rủi ro cao' },
    { key: 'DEVOPS', label: 'Kỹ sư DevOps', desc: 'Quản trị khối lượng công việc, chính sách & giám sát' },
    { key: 'VIEWER', label: 'Người xem (Viewer)', desc: 'Chỉ xem dữ liệu, giám sát an toàn' },
  ];

  return (
    <header
      className="dashboard-top-header"
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--dash-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 25,
      }}
    >
      {/* Left: Mobile Toggle & Selectors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Mobile menu trigger */}
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="dashboard-mobile-toggle"
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'var(--dash-text-primary)',
            cursor: 'pointer',
            padding: '6px',
          }}
        >
          <Menu size={20} />
        </button>

        {/* Organization Selector Dropdown */}
        <div ref={orgRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: 'var(--dash-bg-canvas)',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Building2 size={15} color="var(--dash-primary)" />
            <span>{currentOrg.name}</span>
            <ChevronDown size={14} color="var(--dash-text-muted)" />
          </button>

          {isOrgDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                width: '220px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-dropdown)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                Chọn Tổ Chức
              </div>
              {orgList.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setCurrentOrg(org);
                    setIsOrgDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--dash-radius-sm)',
                    border: 'none',
                    backgroundColor: currentOrg.id === org.id ? 'var(--dash-primary-light)' : 'transparent',
                    color: currentOrg.id === org.id ? 'var(--dash-primary)' : 'var(--dash-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{org.name}</span>
                  {currentOrg.id === org.id && <Check size={14} color="var(--dash-primary)" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <span style={{ color: 'var(--dash-border)', fontSize: '1.2rem' }}>/</span>

        {/* Environment Selector Dropdown */}
        <div ref={envRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsEnvDropdownOpen(!isEnvDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: 'var(--dash-bg-canvas)',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Server size={15} color="var(--dash-text-secondary)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{currentEnv.name}</span>
            <ChevronDown size={14} color="var(--dash-text-muted)" />
          </button>

          {isEnvDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                width: '240px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-dropdown)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                Chọn Môi Trường
              </div>
              {envList.map((env) => (
                <button
                  key={env.id}
                  onClick={() => {
                    setCurrentEnv(env);
                    setIsEnvDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--dash-radius-sm)',
                    border: 'none',
                    backgroundColor: currentEnv.id === env.id ? 'var(--dash-primary-light)' : 'transparent',
                    color: currentEnv.id === env.id ? 'var(--dash-primary)' : 'var(--dash-text-primary)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{env.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{env.cluster}</div>
                  </div>
                  {currentEnv.id === env.id && <Check size={14} color="var(--dash-primary)" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions, Refresh, Role Switcher, Notifications, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Agent Connection Simulator Toggle (Demo tool for Empty State) */}
        <button
          onClick={() => setIsAgentConnected(!isAgentConnected)}
          title={isAgentConnected ? "Tác tử đang kết nối. Bấm để thử trạng thái trống" : "Chưa có tác tử kết nối. Bấm để khôi phục dữ liệu mẫu"}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: 'var(--dash-radius-full)',
            backgroundColor: isAgentConnected ? 'var(--dash-success-bg)' : 'var(--dash-warning-bg)',
            border: isAgentConnected ? '1px solid var(--dash-success-border)' : '1px solid var(--dash-warning-border)',
            color: isAgentConnected ? 'var(--dash-success-text)' : 'var(--dash-warning-text)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isAgentConnected ? 'var(--dash-success)' : 'var(--dash-warning)',
            }}
          />
          <span>{isAgentConnected ? 'Tác tử: Trực tuyến' : 'Tác tử: Ngoại tuyến'}</span>
        </button>

        {/* Role Switcher Badge (Interactive RBAC Demo) */}
        <div ref={roleRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              backgroundColor: 'var(--dash-bg-canvas)',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-full)',
              color: 'var(--dash-text-secondary)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Shield size={12} color="var(--dash-primary)" />
            <span>Vai trò: {roles.find((r) => r.key === currentUserRole)?.label}</span>
            <ChevronDown size={12} color="var(--dash-text-muted)" />
          </button>

          {isRoleDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                width: '260px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-dropdown)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                Chuyển Đổi Vai Trò (RBAC)
              </div>
              {roles.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setCurrentUserRole(r.key);
                    setIsRoleDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--dash-radius-sm)',
                    border: 'none',
                    backgroundColor: currentUserRole === r.key ? 'var(--dash-primary-light)' : 'transparent',
                    color: currentUserRole === r.key ? 'var(--dash-primary)' : 'var(--dash-text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'block',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.75rem' }}>{r.label}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>{r.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual Refresh & Auto-refresh status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={triggerRefresh}
            title="Làm mới số liệu bảng điều khiển"
            disabled={isRefreshing}
            style={{
              background: 'none',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--dash-text-secondary)',
              cursor: 'pointer',
              backgroundColor: 'var(--dash-bg-canvas)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            title="Bật/Tắt tự động làm mới sau 30 giây"
            style={{
              padding: '4px 8px',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              backgroundColor: isAutoRefresh ? 'var(--dash-mint-50)' : 'var(--dash-bg-canvas)',
              color: isAutoRefresh ? 'var(--dash-primary)' : 'var(--dash-text-muted)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={11} />
            <span>{isAutoRefresh ? '30s' : 'Tắt'}</span>
          </button>
        </div>

        {/* Notifications Popover */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsNotifPopoverOpen(!isNotifPopoverOpen)}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--dash-radius-md)',
              border: '1px solid var(--dash-border)',
              backgroundColor: 'var(--dash-bg-canvas)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--dash-text-secondary)',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Bell size={16} />
            {unreadNotifsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  width: '16px',
                  height: '16px',
                  backgroundColor: 'var(--dash-critical)',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #FFFFFF',
                }}
              >
                {unreadNotifsCount}
              </span>
            )}
          </button>

          {isNotifPopoverOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '320px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-dropdown)',
                zIndex: 60,
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--dash-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                  Thông Báo Hệ Thống
                </span>
                {unreadNotifsCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--dash-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setIsNotifPopoverOpen(false);
                      if (onNavigate && n.link) onNavigate(n.link);
                    }}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--dash-border)',
                      backgroundColor: n.unread ? 'var(--dash-mint-50)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{n.time}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', lineHeight: 1.4, margin: 0 }}>
                      {n.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid var(--dash-border)' }}>
                <button
                  onClick={() => {
                    setIsNotifPopoverOpen(false);
                    if (onNavigate) onNavigate('/dashboard/notifications');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--dash-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Xem tất cả trong Trung tâm thông báo &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px',
              borderRadius: 'var(--dash-radius-md)',
              border: '1px solid var(--dash-border)',
              backgroundColor: 'var(--dash-bg-canvas)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'var(--dash-primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              JD
            </div>
            <div style={{ textAlign: 'left', display: 'none', md: 'block' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-primary)', lineHeight: 1.2 }}>
                John Doe
              </div>
            </div>
            <ChevronDown size={12} color="var(--dash-text-muted)" />
          </button>

          {isProfileMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '200px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-dropdown)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--dash-border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>John Doe</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>owner@acme.corp</div>
              </div>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  if (onNavigate) onNavigate('/dashboard/settings');
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--dash-text-secondary)',
                  fontSize: '0.8125rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 'var(--dash-radius-sm)',
                }}
              >
                Cài đặt tài khoản
              </button>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  if (onNavigate) onNavigate('/');
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--dash-critical)',
                  fontSize: '0.8125rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 'var(--dash-radius-sm)',
                }}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
