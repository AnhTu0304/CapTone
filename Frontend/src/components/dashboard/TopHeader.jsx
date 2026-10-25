import React, { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../../pages/Dashboard/context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { getStoredProfile } from '../../mocks/profileMockData';
import {
  Building2,
  Loader2,
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
    orgList,
    switchOrganization,
    isLoadingOrgs,
    isSwitchingOrg,
    currentEnv,
    setCurrentEnv,
    envList,
    isLoadingEnvs,
    fetchOrgEnvironmentsAndClusters,
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
  const [focusedOrgIndex, setFocusedOrgIndex] = useState(-1);

  const handleOrgKeyDown = (e) => {
    if (!isOrgDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOrgDropdownOpen(true);
        setFocusedOrgIndex(0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOrgDropdownOpen(false);
      setFocusedOrgIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedOrgIndex((prev) => (orgList.length > 0 ? (prev + 1) % orgList.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedOrgIndex((prev) => (orgList.length > 0 ? (prev - 1 + orgList.length) % orgList.length : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedOrgIndex >= 0 && focusedOrgIndex < orgList.length) {
        if (switchOrganization) switchOrganization(orgList[focusedOrgIndex].id);
        setIsOrgDropdownOpen(false);
        setFocusedOrgIndex(-1);
      }
    }
  };
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
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isOrgDropdownOpen}
            aria-label="Chọn tổ chức"
            disabled={isSwitchingOrg}
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            onKeyDown={handleOrgKeyDown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: 'var(--dash-bg-canvas)',
              border: isOrgDropdownOpen ? '1px solid var(--dash-primary)' : '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isSwitchingOrg ? 'wait' : 'pointer',
              opacity: isSwitchingOrg ? 0.75 : 1,
              outline: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {isSwitchingOrg ? (
              <Loader2 size={15} color="var(--dash-primary)" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Building2 size={15} color="var(--dash-primary)" />
            )}
            <span>
              {isSwitchingOrg
                ? 'Đang chuyển...'
                : currentOrg?.name || (isLoadingOrgs ? 'Đang tải...' : 'Chưa chọn tổ chức')}
            </span>
            {currentOrg?.role_in_org && (
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor:
                    currentOrg.role_in_org === 'SME_OWNER'
                      ? '#FEF3C7'
                      : currentOrg.role_in_org === 'DEVOPS'
                      ? '#E0E7FF'
                      : '#F1F5F9',
                  color:
                    currentOrg.role_in_org === 'SME_OWNER'
                      ? '#92400E'
                      : currentOrg.role_in_org === 'DEVOPS'
                      ? '#3730A3'
                      : '#475569',
                  textTransform: 'uppercase',
                }}
              >
                {currentOrg.role_in_org}
              </span>
            )}
            <ChevronDown size={14} color="var(--dash-text-muted)" />
          </button>

          {isOrgDropdownOpen && (
            <div
              role="listbox"
              aria-label="Danh sách tổ chức của bạn"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                width: '260px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-dropdown)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--dash-text-muted)',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--dash-border)',
                  marginBottom: '4px',
                }}
              >
                <span>Tổ Chức Của Bạn</span>
                {isLoadingOrgs && (
                  <Loader2 size={12} color="var(--dash-text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
                )}
              </div>

              {isLoadingOrgs && orgList.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)', textAlign: 'center' }}>
                  Đang tải danh sách...
                </div>
              )}

              {!isLoadingOrgs && orgList.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)', textAlign: 'center' }}>
                  Chưa có tổ chức nào.
                </div>
              )}

              {orgList.map((org, idx) => {
                const isSelected = currentOrg?.id === org.id;
                const isFocused = focusedOrgIndex === idx;
                const roleBadge = org.role_in_org || org.role || 'SME_OWNER';

                return (
                  <button
                    key={org.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (switchOrganization) switchOrganization(org.id);
                      setIsOrgDropdownOpen(false);
                      setFocusedOrgIndex(-1);
                    }}
                    onMouseEnter={() => setFocusedOrgIndex(idx)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--dash-radius-sm)',
                      border: isFocused ? '1px solid var(--dash-primary)' : '1px solid transparent',
                      backgroundColor: isSelected
                        ? 'var(--dash-primary-light)'
                        : isFocused
                        ? '#F8FAFC'
                        : 'transparent',
                      color: isSelected ? 'var(--dash-primary)' : 'var(--dash-text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      outline: 'none',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {org.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          color:
                            roleBadge === 'SME_OWNER'
                              ? '#B45309'
                              : roleBadge === 'DEVOPS'
                              ? '#4338CA'
                              : '#64748B',
                        }}
                      >
                        {roleBadge}
                      </span>
                    </div>
                    {isSelected && <Check size={14} color="var(--dash-primary)" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <span style={{ color: 'var(--dash-border)', fontSize: '1.2rem' }}>/</span>

        {/* Environment & K8s Cluster Selector Dropdown */}
        <div ref={envRef} style={{ position: 'relative' }}>
          <button
            onClick={() => {
              const nextState = !isEnvDropdownOpen;
              setIsEnvDropdownOpen(nextState);
              if (nextState && currentOrg?.id && fetchOrgEnvironmentsAndClusters) {
                fetchOrgEnvironmentsAndClusters(currentOrg.id);
              }
            }}
            title="Chọn Môi Trường & Cụm Kubernetes"
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              {currentEnv?.cluster ? `${currentEnv.envName || 'Production'} / ${currentEnv.cluster}` : (currentEnv?.displayName || currentEnv?.name || 'Chọn Cụm K8s')}
            </span>
            {currentEnv?.agentStatus === 'ONLINE' ? (
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  display: 'inline-block',
                }}
                title="Agent eBPF Online"
              />
            ) : currentEnv?.agentStatus === 'OFFLINE' ? (
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                  display: 'inline-block',
                }}
                title="Agent Offline"
              />
            ) : null}
            <ChevronDown size={14} color="var(--dash-text-muted)" />
          </button>

          {isEnvDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                width: '280px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-dropdown)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--dash-text-muted)',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--dash-border)',
                  marginBottom: '4px',
                }}
              >
                <span>Môi Trường & Cụm K8s</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--dash-primary)' }}>{envList.length} Cụm</span>
                  <button
                    type="button"
                    title="Tải lại danh sách cụm K8s"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentOrg?.id && fetchOrgEnvironmentsAndClusters) {
                        fetchOrgEnvironmentsAndClusters(currentOrg.id);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      color: 'var(--dash-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <RefreshCw size={11} className={isLoadingEnvs ? 'dash-spin' : ''} />
                  </button>
                </div>
              </div>

              {isLoadingEnvs && envList.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)', textAlign: 'center' }}>
                  Đang tải danh sách cụm...
                </div>
              )}

              {!isLoadingEnvs && envList.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 8px 0' }}>Chưa có cụm K8s nào trong tổ chức.</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentOrg?.id && fetchOrgEnvironmentsAndClusters) {
                        fetchOrgEnvironmentsAndClusters(currentOrg.id);
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      border: '1px solid #BFDBFE',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Tải lại danh sách cụm
                  </button>
                </div>
              )}

              {envList.map((env) => {
                const isSelected = currentEnv?.id === env.id;
                const isOnline = env.agentStatus === 'ONLINE';

                return (
                  <button
                    key={env.id}
                    onClick={() => {
                      setCurrentEnv(env);
                      setIsAgentConnected(env.agentStatus === 'ONLINE');
                      localStorage.setItem('selfheal_active_cluster_id', env.id);
                      localStorage.setItem('selfheal_active_cluster_name', env.cluster || env.name);
                      localStorage.setItem('selfheal_active_env_name', env.envName || 'Production');
                      setIsEnvDropdownOpen(false);
                      triggerRefresh();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--dash-radius-sm)',
                      border: 'none',
                      backgroundColor: isSelected ? 'var(--dash-primary-light)' : 'transparent',
                      color: isSelected ? 'var(--dash-primary)' : 'var(--dash-text-primary)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {env.cluster || env.name}
                        </span>
                        {isOnline ? (
                          <span style={{ fontSize: '0.5625rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#D1FAE5', color: '#065F46', fontWeight: 700 }}>
                            ONLINE
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.5625rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: 600 }}>
                            {env.agentStatus || 'OFFLINE'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{env.envName || env.name}</span>
                        {env.nodes > 0 && <span>&bull; {env.nodes} Node</span>}
                        {env.pods > 0 && <span>&bull; {env.pods} Pods</span>}
                      </div>
                    </div>
                    {isSelected && <Check size={14} color="var(--dash-primary)" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}

              <div style={{ borderTop: '1px solid var(--dash-border)', marginTop: '4px', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsEnvDropdownOpen(false);
                    if (onNavigate) {
                      onNavigate('/dashboard/clusters');
                    } else {
                      window.location.hash = '#/dashboard/clusters';
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 'var(--dash-radius-sm)',
                    border: 'none',
                    background: 'none',
                    color: 'var(--dash-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>+ Quản Lý & Thêm Cụm Kubernetes</span>
                </button>
              </div>
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
