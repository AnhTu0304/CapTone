import React, { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../../pages/Dashboard/context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { getStoredProfile } from '../../mocks/profileMockData';
import {
  Building2,
  Server,
  RefreshCw,
  Bell,
  ChevronDown,
  Check,
  Clock,
  ShieldCheck,
  Menu,
  LogOut,
  User,
  Sparkles,
} from 'lucide-react';

export const TopHeader = () => {
  const { user, logout, getInitials, getPrimaryRole, isAdmin } = useAuth();
  const {
    currentOrg,
    setCurrentOrg,
    orgList,
    currentEnv,
    setCurrentEnv,
    envList,
    isAgentConnected,
    setIsAgentConnected,
    isAutoRefresh,
    setIsAutoRefresh,
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
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const orgRef = useRef(null);
  const envRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (orgRef.current && !orgRef.current.contains(e.target)) setIsOrgDropdownOpen(false);
      if (envRef.current && !envRef.current.contains(e.target)) setIsEnvDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifPopoverOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [profileData, setProfileData] = useState(() => {
    try {
      return getStoredProfile();
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleProfileUpdate = (e) => {
      if (e.detail) {
        setProfileData(e.detail);
      }
    };
    window.addEventListener('selfheal_profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('selfheal_profile_updated', handleProfileUpdate);
  }, []);

  const displayName = user?.full_name || profileData?.fullName || user?.email?.split('@')[0] || 'Tài khoản';
  const displayEmail = user?.email || profileData?.email || 'user@example.com';
  const displayAvatar = profileData?.avatar || null;

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
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={displayName}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1.5px solid var(--dash-mint-200)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--dash-primary)',
                  color: '#28E99F',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {getInitials(displayName)}
              </div>
            )}
            <div style={{ textAlign: 'left', display: 'none', md: 'block' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-primary)', lineHeight: 1.2 }}>
                {displayName}
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
                width: '220px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-dropdown)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--dash-border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', wordBreak: 'break-all' }}>
                  {displayEmail}
                </div>
                <div style={{ marginTop: '6px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(40, 233, 159, 0.15)',
                      color: '#065F46',
                      border: '1px solid rgba(40, 233, 159, 0.3)',
                    }}
                  >
                    {getPrimaryRole(user)}
                  </span>
                </div>
              </div>
              {(isAdmin(user) || user?.system_roles?.some((r) => ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(r))) && (
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    if (onNavigate) onNavigate('/admin');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'none',
                    color: '#059669',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: 'var(--dash-radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ShieldCheck size={13} color="#059669" />
                  <span>Bảng Quản Trị Hệ Thống (Admin)</span>
                </button>
              )}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  if (onNavigate) onNavigate('/portal');
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  background: 'none',
                  color: '#059669',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 'var(--dash-radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={13} color="#059669" />
                <span>Không Gian Cá Nhân (Portal)</span>
              </button>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  if (onNavigate) onNavigate('/portal/profile');
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <User size={13} color="var(--dash-primary)" />
                <span>Hồ sơ cá nhân</span>
              </button>
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
                  logout();
                  if (onNavigate) {
                    onNavigate('/login');
                  } else {
                    window.history.pushState({}, '', '/login');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={13} color="var(--dash-critical)" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
