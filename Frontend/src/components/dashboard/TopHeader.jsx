import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../pages/Dashboard/context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import UserProfileDropdown from '../common/UserProfileDropdown';
import {
  Building2,
  Users,
  Radio,
  Layers,
  Box,
  ScrollText,
  BarChart3,
  ShieldAlert,
  Settings,
  Loader2,
  Server,
  RefreshCw,
  Bell,
  ChevronDown,
  Check,
  Menu,
} from 'lucide-react';

export const TopHeader = ({ isFloatingCanvas = false, currentPath = '/dashboard' }) => {
  const { t } = useTranslation('dashboard');
  const {
    currentOrg,
    currentUserRole,
    orgList,
    switchOrganization,
    isLoadingOrgs,
    isSwitchingOrg,
    currentEnv,
    setCurrentEnv,
    envList,
    isLoadingEnvs,
    fetchOrgEnvironmentsAndClusters,
    setIsAgentConnected,
    triggerRefresh,
    notifications,
    unreadNotifsCount,
    markAllNotificationsRead,
    toggleNotificationRead,
    isMobileNavOpen,
    setIsMobileNavOpen,
    onNavigate,
  } = useDashboard();

  const auth = useAuth();
  const authUser = auth?.user || null;
  const isSuperAdmin = auth?.isSuperAdmin ? auth.isSuperAdmin(authUser) : false;
  const isSystemAdmin = auth?.isAdmin ? auth.isAdmin(authUser) : false;
  const isOwnerUser = auth?.isOwner ? auth.isOwner(authUser) : false;
  const effectiveRole = (
    currentUserRole ||
    currentOrg?.role_in_org ||
    currentOrg?.role ||
    (isSuperAdmin || isSystemAdmin || isOwnerUser
      ? 'SME_OWNER'
      : auth?.isDevOps && auth.isDevOps(authUser)
        ? 'DEVOPS'
        : 'VIEWER')
  ).toUpperCase();
  const canViewOrgNav = effectiveRole !== 'DEVOPS' && effectiveRole !== 'VIEWER';
  const canViewClusters = effectiveRole !== 'VIEWER';
  const canViewPolicies = effectiveRole !== 'VIEWER';
  const cleanCurrentPath = (currentPath || '').toLowerCase().split('?')[0].split('#')[0];
  const isAgentsActive = cleanCurrentPath === '/dashboard/agents' || cleanCurrentPath.startsWith('/dashboard/agents/');
  const isClustersActive = cleanCurrentPath === '/dashboard/clusters' || cleanCurrentPath.startsWith('/dashboard/clusters/');
  const isInfraActive = cleanCurrentPath === '/dashboard/infrastructure' || cleanCurrentPath.startsWith('/dashboard/infrastructure/');
  const isWorkloadsActive = cleanCurrentPath === '/dashboard/workloads' || cleanCurrentPath.startsWith('/dashboard/workloads/');
  const isOrgInfoActive = cleanCurrentPath === '/dashboard/organization';
  const isOrgMembersActive = cleanCurrentPath === '/dashboard/organization/members';
  const isAuditLogsActive = cleanCurrentPath === '/dashboard/audit-logs';
  const isReportsActive = cleanCurrentPath === '/dashboard/reports';
  const isPoliciesActive = cleanCurrentPath === '/dashboard/self-healing/policies' || cleanCurrentPath.startsWith('/dashboard/self-healing/policies/');
  const isSettingsActive = cleanCurrentPath === '/dashboard/settings';
  const isNotificationsActive = cleanCurrentPath === '/dashboard/notifications';

  const headerGroupDividerStyle = {
    width: '1px',
    height: '20px',
    backgroundColor: 'rgba(203, 213, 225, 0.85)',
    margin: '0 2px',
    flexShrink: 0,
  };

  const getHeaderDropdownBtnStyle = (isActive, isOpen) => ({
    height: '34px',
    padding: '0 8px',
    borderRadius: '10px',
    border: isActive || isOpen ? '1px solid #10B981' : '1px solid rgba(203, 213, 225, 0.9)',
    backgroundColor: isActive ? '#ECFDF5' : isOpen ? '#FFFFFF' : 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: isOpen
      ? '0 4px 12px rgba(16, 185, 129, 0.14)'
      : '0 2px 8px rgba(15, 23, 42, 0.05)',
    color: isActive ? '#059669' : 'var(--dash-text-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    fontSize: '0.78rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.15s ease',
  });

  const getHeaderIconBtnStyle = (isActive) => ({
    width: '34px',
    height: '34px',
    borderRadius: 'var(--dash-radius-md)',
    border: isActive ? '1px solid #10B981' : '1px solid rgba(203, 213, 225, 0.9)',
    backgroundColor: isActive ? '#ECFDF5' : 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
    color: isActive ? '#059669' : 'var(--dash-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.15s ease',
  });

  const headerNavDropdowns = [
    {
      key: 'infra',
      label: t('header.nav.infraLabel'),
      headerTitle: t('header.nav.infraTitle'),
      icon: Server,
      isActive: isAgentsActive || isClustersActive || isInfraActive || isWorkloadsActive,
      items: [
        {
          label: t('header.nav.agentsLabel'),
          desc: t('header.nav.agentsDesc'),
          path: '/dashboard/agents',
          icon: Radio,
          active: isAgentsActive,
        },
        ...(canViewClusters
          ? [
              {
                label: t('header.nav.clustersLabel'),
                desc: t('header.nav.clustersDesc'),
                path: '/dashboard/clusters',
                icon: Server,
                active: isClustersActive,
              },
            ]
          : []),
        {
          label: t('header.nav.infraHostsLabel'),
          desc: t('header.nav.infraHostsDesc'),
          path: '/dashboard/infrastructure',
          icon: Layers,
          active: isInfraActive,
        },
        {
          label: t('header.nav.workloadsLabel'),
          desc: t('header.nav.workloadsDesc'),
          path: '/dashboard/workloads',
          icon: Box,
          active: isWorkloadsActive,
        },
      ],
    },
    ...(canViewOrgNav
      ? [
          {
            key: 'org',
            label: t('header.nav.orgLabel'),
            headerTitle: t('header.nav.orgTitle'),
            icon: Building2,
            isActive: isOrgInfoActive || isOrgMembersActive,
            items: [
              {
                label: t('header.nav.orgInfoLabel'),
                desc: t('header.nav.orgInfoDesc'),
                path: '/dashboard/organization',
                icon: Building2,
                active: isOrgInfoActive,
              },
              {
                label: t('header.nav.orgMembersLabel'),
                desc: t('header.nav.orgMembersDesc'),
                path: '/dashboard/organization/members',
                icon: Users,
                active: isOrgMembersActive,
              },
            ],
          },
        ]
      : []),
    {
      key: 'system',
      label: t('header.nav.systemLabel'),
      headerTitle: t('header.nav.systemTitle'),
      icon: Settings,
      isActive: isAuditLogsActive || isReportsActive || isPoliciesActive || isSettingsActive,
      items: [
        ...(canViewPolicies
          ? [
              {
                label: t('header.nav.policiesLabel'),
                desc: t('header.nav.policiesDesc'),
                path: '/dashboard/self-healing/policies',
                icon: ShieldAlert,
                active: isPoliciesActive,
              },
            ]
          : []),
        {
          label: t('header.nav.auditLogsLabel'),
          desc: t('header.nav.auditLogsDesc'),
          path: '/dashboard/audit-logs',
          icon: ScrollText,
          active: isAuditLogsActive,
        },
        {
          label: t('header.nav.reportsLabel'),
          desc: t('header.nav.reportsDesc'),
          path: '/dashboard/reports',
          icon: BarChart3,
          active: isReportsActive,
        },
        ...(canViewOrgNav
          ? [
              {
                label: t('header.nav.settingsLabel'),
                desc: t('header.nav.settingsDesc'),
                path: '/dashboard/settings',
                icon: Settings,
                active: isSettingsActive,
              },
            ]
          : []),
      ],
    },
  ];

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
  const [openNavMenu, setOpenNavMenu] = useState(null); // 'infra' | 'org' | 'system' | null

  const orgRef = useRef(null);
  const envRef = useRef(null);
  const notifRef = useRef(null);
  const navMenusRef = useRef(null);

  // Close dropdowns on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (orgRef.current && !orgRef.current.contains(e.target)) setIsOrgDropdownOpen(false);
      if (envRef.current && !envRef.current.contains(e.target)) setIsEnvDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifPopoverOpen(false);
      if (navMenusRef.current && !navMenusRef.current.contains(e.target)) setOpenNavMenu(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenNavMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header
      className="dashboard-top-header"
      style={{
        height: '60px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px 0 16px',
        position: 'relative',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Mobile-only menu button + Org/Cluster Selectors */}
      <div className="dashboard-top-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          className="dashboard-mobile-toggle"
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          aria-label={t('header.mobileToggleAria')}
          style={{
            display: 'none',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            border: '1px solid rgba(203, 213, 225, 0.9)',
            color: 'var(--dash-text-primary)',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <Menu size={18} />
        </button>

        {/* Organization Selector Dropdown */}
        <div ref={orgRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="topheader-org-btn"
            aria-haspopup="listbox"
            aria-expanded={isOrgDropdownOpen}
            aria-label={t('header.selectOrgAria')}
            disabled={isSwitchingOrg}
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            onKeyDown={handleOrgKeyDown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: isFloatingCanvas ? 'rgba(255, 255, 255, 0.94)' : 'var(--dash-bg-canvas)',
              backdropFilter: isFloatingCanvas ? 'blur(10px)' : 'none',
              border: isOrgDropdownOpen ? '1px solid var(--dash-primary)' : '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '10px',
              boxShadow: isFloatingCanvas ? '0 2px 8px rgba(15, 23, 42, 0.05)' : 'none',
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
            <span
              className="topheader-org-name topheader-org-desktop"
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '165px',
              }}
            >
              {isSwitchingOrg
                ? t('header.switchingOrg')
                : currentOrg?.name || (isLoadingOrgs ? t('header.loading') : t('header.noOrg'))}
            </span>
            <span
              className="topheader-org-name topheader-org-mobile"
              style={{
                whiteSpace: 'nowrap',
                display: 'none',
              }}
            >
              {isSwitchingOrg ? '...' : (currentOrg?.name?.split(' ')[0] || t('header.orgShort'))}
            </span>
            {currentOrg?.role_in_org && (
              <span
                className="topheader-org-badge"
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
              aria-label={t('header.orgListAria')}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                width: '260px',
                maxWidth: 'calc(100vw - 24px)',
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
                <span>{t('header.yourOrgs')}</span>
                {isLoadingOrgs && (
                  <Loader2 size={12} color="var(--dash-text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
                )}
              </div>

              {isLoadingOrgs && orgList.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)', textAlign: 'center' }}>
                  {t('header.loadingList')}
                </div>
              )}

              {!isLoadingOrgs && orgList.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)', textAlign: 'center' }}>
                  {t('header.emptyOrgs')}
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
        <span className="dashboard-header-divider" style={{ color: 'var(--dash-border)', fontSize: '1.2rem' }}>/</span>

        {/* Environment & K8s Cluster Selector Dropdown */}
        <div ref={envRef} style={{ position: 'relative' }}>
          <button
            className="topheader-cluster-btn"
            onClick={() => {
              const nextState = !isEnvDropdownOpen;
              setIsEnvDropdownOpen(nextState);
              if (nextState && currentOrg?.id && fetchOrgEnvironmentsAndClusters) {
                fetchOrgEnvironmentsAndClusters(currentOrg.id);
              }
            }}
            title={t('header.selectEnvClusterTitle')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: isFloatingCanvas ? 'rgba(255, 255, 255, 0.94)' : 'var(--dash-bg-canvas)',
              backdropFilter: isFloatingCanvas ? 'blur(10px)' : 'none',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '10px',
              boxShadow: isFloatingCanvas ? '0 2px 8px rgba(15, 23, 42, 0.05)' : 'none',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Server size={15} color="var(--dash-text-secondary)" style={{ flexShrink: 0 }} />
            <span
              className="topheader-cluster-name topheader-cluster-desktop"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              title={
                currentEnv?.cluster
                  ? `${currentEnv.envName || 'Production'} / ${currentEnv.cluster}`
                  : currentEnv?.displayName || currentEnv?.name || ''
              }
            >
              {isLoadingEnvs
                ? t('header.loadingClusters')
                : currentEnv?.cluster
                ? `${currentEnv.envName || 'Production'} / ${currentEnv.cluster}`
                : currentEnv?.displayName || currentEnv?.name || (envList.length === 0 ? t('header.noK8sCluster') : t('header.chooseK8sCluster'))}
            </span>
            <span
              className="topheader-cluster-name topheader-cluster-mobile"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                display: 'none',
              }}
              title={
                currentEnv?.cluster
                  ? `${currentEnv.envName || 'Production'} / ${currentEnv.cluster}`
                  : currentEnv?.displayName || currentEnv?.name || ''
              }
            >
              {isLoadingEnvs
                ? t('header.loading')
                : currentEnv?.cluster || currentEnv?.name || (envList.length === 0 ? 'K8s' : t('header.chooseShort'))}
            </span>
            {currentEnv?.agentStatus === 'ONLINE' ? (
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
                title={t('header.agentEbpfOnline')}
              />
            ) : currentEnv?.agentStatus === 'OFFLINE' ? (
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
                title={t('header.agentOffline')}
              />
            ) : null}
            <ChevronDown size={14} color="var(--dash-text-muted)" style={{ flexShrink: 0 }} />
          </button>

          {isEnvDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                width: '280px',
                maxWidth: 'calc(100vw - 24px)',
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
                <span>{t('header.envAndClusters')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--dash-primary)' }}>{t('header.clusterCount', { count: envList.length })}</span>
                  <button
                    type="button"
                    title={t('header.reloadClustersTitle')}
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
                  {t('header.loadingClusterList')}
                </div>
              )}

              {!isLoadingEnvs && envList.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 8px 0' }}>{t('header.emptyOrgClusters')}</p>
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
                    {t('header.reloadClusterList')}
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
                            {t('header.statusOnline')}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.5625rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: 600 }}>
                            {env.agentStatus || t('header.statusOffline')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{env.envName || env.name}</span>
                        {env.nodes > 0 && <span>&bull; {t('header.nodeCount', { count: env.nodes })}</span>}
                        {env.pods > 0 && <span>&bull; {t('header.podCount', { count: env.pods })}</span>}
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
                  <span>{t('header.manageAddClusters')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: 3 thẻ Dropdown (Hạ tầng | Tổ chức | Hệ thống) + Chế độ Điện thoại + Thông báo + Profile */}
      <div className="dashboard-top-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, boxSizing: 'border-box' }}>
        <div ref={navMenusRef} className="dashboard-header-nav-groups" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {headerNavDropdowns.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = openNavMenu === group.key;
            return (
              <div key={group.key} style={{ position: 'relative' }}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpenNavMenu(isOpen ? null : group.key);
                    setIsOrgDropdownOpen(false);
                    setIsEnvDropdownOpen(false);
                    setIsNotifPopoverOpen(false);
                  }}
                  style={getHeaderDropdownBtnStyle(group.isActive, isOpen)}
                >
                  <GroupIcon size={15} color={group.isActive || isOpen ? '#059669' : 'var(--dash-text-secondary)'} />
                  <span>{group.label}</span>
                  <ChevronDown
                    size={13}
                    color={group.isActive || isOpen ? '#059669' : 'var(--dash-text-muted)'}
                    style={{
                      transition: 'transform 0.16s ease',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>

                {isOpen && (
                  <div
                    role="menu"
                    aria-label={group.headerTitle}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '6px',
                      width: '272px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '12px',
                      boxShadow: 'var(--dash-shadow-dropdown)',
                      padding: '6px',
                      zIndex: 60,
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'var(--dash-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid var(--dash-border)',
                        marginBottom: '4px',
                      }}
                    >
                      {group.headerTitle}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.path}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenNavMenu(null);
                              if (onNavigate) onNavigate(item.path);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              border: 'none',
                              borderRadius: '8px',
                              backgroundColor: item.active ? '#ECFDF5' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background-color 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!item.active) e.currentTarget.style.backgroundColor = '#F8FAFC';
                            }}
                            onMouseLeave={(e) => {
                              if (!item.active) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '8px',
                                backgroundColor: item.active ? '#D1FAE5' : '#F1F5F9',
                                color: item.active ? '#059669' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <ItemIcon size={15} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  color: item.active ? '#047857' : 'var(--dash-text-primary)',
                                  lineHeight: 1.25,
                                }}
                              >
                                {item.label}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.6875rem',
                                  color: 'var(--dash-text-muted)',
                                  marginTop: '2px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {item.desc}
                              </div>
                            </div>
                            {item.active && <Check size={14} color="#059669" style={{ flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="dashboard-header-divider" style={headerGroupDividerStyle} />


        {/* Notifications Popover (kiêm lối vào trang Thông báo) */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsNotifPopoverOpen(!isNotifPopoverOpen)}
            title={t('header.notificationsLabel')}
            aria-label={t('header.notificationsLabel')}
            style={{
              ...getHeaderIconBtnStyle(isNotificationsActive),
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
                maxWidth: 'calc(100vw - 24px)',
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
                  {t('header.systemNotifications')}
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
                    {t('header.markAllRead')}
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setIsNotifPopoverOpen(false);
                      if (!n.read && toggleNotificationRead) toggleNotificationRead(n.id, true);
                      const dest = n.link || n.actionPath;
                      if (onNavigate && dest) onNavigate(dest);
                    }}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--dash-border)',
                      backgroundColor: n.unread
                        ? n.severity === 'CRITICAL'
                          ? '#FFF1F2'
                          : 'var(--dash-mint-50)'
                        : 'transparent',
                      borderLeft: n.unread && n.severity === 'CRITICAL' ? '3px solid #DC2626' : '3px solid transparent',
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
                  {t('header.viewAllNotifications')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu đồng bộ chuẩn /admin */}
        <UserProfileDropdown onNavigate={onNavigate} />
      </div>
    </header>
  );
};

export default TopHeader;
