import React from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardProvider, useDashboard } from '../pages/Dashboard/context/DashboardContext';
import Sidebar from '../components/dashboard/Sidebar';
import TopHeader from '../components/dashboard/TopHeader';
import { ChevronRight, Home, X } from 'lucide-react';

const DashboardLayoutContent = ({ children, currentPath, breadcrumbs = [] }) => {
  const { t } = useTranslation('dashboard');
  const { isMobileNavOpen, setIsMobileNavOpen, onNavigate, isMobileMode } = useDashboard();
  const cleanPath = (currentPath || '/dashboard').toLowerCase().split('?')[0].split('#')[0];
  const isOverview =
    cleanPath === '/dashboard' ||
    cleanPath === '/dashboard/' ||
    cleanPath === '' ||
    cleanPath === '/dashboard/monitoring/metrics';

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 860 && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileNavOpen, setIsMobileNavOpen]);

  return (
    <div
      style={
        isMobileMode
          ? {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100vw',
              height: '100vh',
              backgroundColor: '#0F172A',
              overflow: 'hidden',
            }
          : { width: '100%', height: '100%' }
      }
    >
      <div
        className={`dashboard-root-layout ${isMobileMode ? 'device-mode-mobile' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: isMobileMode ? '412px' : '100vw',
          maxWidth: isMobileMode ? '412px' : '100vw',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          fontFamily: 'var(--font-body)',
          color: 'var(--dash-text-primary)',
          position: 'relative',
          borderRadius: isMobileMode ? '24px' : '0',
          boxShadow: isMobileMode ? '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.15)' : 'none',
        }}
      >
      {/* Mobile Drawer Backdrop */}
      {isMobileNavOpen && (
        <div
          onClick={() => setIsMobileNavOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
        />
      )}

      {/* Mobile Drawer */}
      {isMobileNavOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('layout.mobileNavAria')}
          style={{
            position: 'fixed',
            top: '12px',
            bottom: '12px',
            left: '12px',
            width: '280px',
            maxWidth: '85vw',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '18px',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--dash-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {t('layout.mobileNavTitle')}
            </span>
            <button
              type="button"
              aria-label={t('layout.closeNavAria')}
              onClick={() => setIsMobileNavOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-muted)', display: 'flex', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Sidebar currentPath={currentPath} isFloating={false} isMobileDrawer={true} />
          </div>
        </div>
      )}

      {/* Top Header spanning the full width across the very top (tràn qua bên trái toàn màn hình) */}
      <TopHeader isFloatingCanvas={true} currentPath={currentPath} />

      {/* Body below Header: Sidebar on left + Main Content on right */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Desktop Floating Sidebar Panel (bắt đầu dưới TopHeader) */}
        <div
          className="dashboard-desktop-sidebar"
          style={{
            display: 'flex',
            height: '100%',
            padding: '8px 0 14px 14px',
            flexShrink: 0,
            position: 'relative',
            zIndex: 45,
            boxSizing: 'border-box',
          }}
        >
          <Sidebar currentPath={currentPath} isFloating={true} />
        </div>

        {/* Main Content Area */}
        <main
          className={isOverview ? 'dashboard-overview-main' : ''}
          style={{
            flex: 1,
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            overflow: isOverview ? 'hidden' : 'auto',
            overflowY: isOverview ? 'hidden' : 'auto',
            overflowX: 'hidden',
            padding: isOverview ? 0 : '12px 28px 24px 20px',
            backgroundColor: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Optional Breadcrumbs */}
          {!isOverview && breadcrumbs.length > 0 && (
            <nav
              aria-label={t('layout.breadcrumbsAria')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                fontSize: '0.75rem',
                color: 'var(--dash-text-muted)',
              }}
            >
              <button
                onClick={() => onNavigate && onNavigate('/dashboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--dash-text-muted)',
                  cursor: 'pointer',
                }}
              >
                <Home size={13} />
                <span>{t('layout.breadcrumbHome')}</span>
              </button>

              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight size={12} color="var(--dash-text-muted)" />
                  {crumb.path ? (
                    <button
                      onClick={() => onNavigate && onNavigate(crumb.path)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: idx === breadcrumbs.length - 1 ? 'var(--dash-text-primary)' : 'var(--dash-text-muted)',
                        fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span
                      style={{
                        color: 'var(--dash-text-primary)',
                        fontWeight: 600,
                      }}
                    >
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Children Slot */}
          <div
            style={{
              maxWidth: isOverview ? '100%' : '1440px',
              margin: isOverview ? '0' : '0 auto',
              width: '100%',
              height: isOverview ? '100%' : 'auto',
              flex: isOverview ? 1 : 'none',
              minHeight: 0,
              display: isOverview ? 'flex' : 'block',
              flexDirection: isOverview ? 'column' : 'initial',
            }}
          >
            {children}
          </div>
        </main>
      </div>

      <style>{`
        .dashboard-overview-main {
          padding: 0 !important;
        }

        /* 1. Breakpoint Tablet/Mobile <= 860px HOẶC Chế độ mô phỏng Điện thoại (.device-mode-mobile) */
        @media (max-width: 860px) {
          .dashboard-top-header {
            padding: 0 8px !important;
            height: 52px !important;
          }
          .dashboard-top-header-left {
            gap: 6px !important;
          }
          .dashboard-top-header-right {
            gap: 4px !important;
          }
          .dashboard-desktop-sidebar {
            display: none !important;
          }
          .dashboard-mobile-toggle {
            display: inline-flex !important;
            width: 32px !important;
            height: 32px !important;
          }
          .dashboard-header-nav-groups,
          .dashboard-header-divider {
            display: none !important;
          }
          .topheader-org-btn {
            padding: 4px 6px !important;
            gap: 4px !important;
          }
          .topheader-org-badge {
            display: none !important;
          }
          .topheader-org-desktop {
            display: none !important;
          }
          .topheader-org-mobile {
            display: inline !important;
            font-size: 0.75rem !important;
          }
          .topheader-cluster-btn {
            padding: 4px 6px !important;
            gap: 4px !important;
          }
          .topheader-cluster-desktop {
            display: none !important;
          }
          .topheader-cluster-mobile {
            display: inline !important;
            font-size: 0.75rem !important;
          }
          .topheader-avatar-chevron {
            display: none !important;
          }
          .admin-profile-meta {
            display: none !important;
          }
          .dashboard-kpi-grid {
            display: flex !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            scroll-snap-type: x mandatory;
            gap: 8px !important;
            padding-bottom: 4px !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none !important;
          }
          .dashboard-kpi-grid::-webkit-scrollbar {
            display: none !important;
          }
          .dashboard-kpi-grid > button {
            min-width: 135px !important;
            max-width: 145px !important;
            flex-shrink: 0 !important;
            scroll-snap-align: start;
            padding: 6px 8px 5px !important;
          }
          .node-metrics-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }
          .canvas-bottom-toolbar {
            left: 8px !important;
            right: 8px !important;
            bottom: 8px !important;
            max-width: calc(100vw - 16px) !important;
            overflow-x: auto !important;
            justify-content: flex-start !important;
            padding: 4px 8px !important;
            scrollbar-width: none !important;
          }
          .canvas-bottom-toolbar::-webkit-scrollbar {
            display: none !important;
          }
          .overview-controls-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 6px !important;
          }
          .overview-controls-left,
          .overview-controls-right {
            width: 100% !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
          }
          .dashboard-overview-main {
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
          .dashboard-overview-container,
          .dashboard-metrics-page {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
          }
          .overview-floating-header,
          .node-metrics-floating-header {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            padding: 6px 10px 8px !important;
            pointer-events: auto !important;
          }
          .overview-canvas-wrapper {
            position: relative !important;
            inset: auto !important;
            height: auto !important;
            flex: none !important;
            overflow: visible !important;
            display: block !important;
          }
          .node-metrics-controls-left,
          .node-metrics-controls-right {
            width: 100% !important;
            flex-wrap: wrap !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
          }
        }

        /* 2. Áp dụng toàn bộ quy tắc Mobile khi người dùng bật Chế độ Điện thoại (.device-mode-mobile) */
        .device-mode-mobile .dashboard-top-header {
          padding: 0 8px !important;
          height: 52px !important;
        }
        .device-mode-mobile .dashboard-top-header-left {
          gap: 6px !important;
        }
        .device-mode-mobile .dashboard-top-header-right {
          gap: 4px !important;
        }
        .device-mode-mobile .dashboard-desktop-sidebar {
          display: none !important;
        }
        .device-mode-mobile .dashboard-mobile-toggle {
          display: inline-flex !important;
          width: 32px !important;
          height: 32px !important;
        }
        .device-mode-mobile .dashboard-header-nav-groups,
        .device-mode-mobile .dashboard-header-divider {
          display: none !important;
        }
        .device-mode-mobile .topheader-org-btn {
          padding: 4px 6px !important;
          gap: 4px !important;
        }
        .device-mode-mobile .topheader-org-badge {
          display: none !important;
        }
        .device-mode-mobile .topheader-org-desktop {
          display: none !important;
        }
        .device-mode-mobile .topheader-org-mobile {
          display: inline !important;
          font-size: 0.75rem !important;
        }
        .device-mode-mobile .topheader-cluster-btn {
          padding: 4px 6px !important;
          gap: 4px !important;
        }
        .device-mode-mobile .topheader-cluster-desktop {
          display: none !important;
        }
        .device-mode-mobile .topheader-cluster-mobile {
          display: inline !important;
          font-size: 0.75rem !important;
        }
        .device-mode-mobile .topheader-avatar-chevron {
          display: none !important;
        }
        .device-mode-mobile .admin-profile-meta {
          display: none !important;
        }
        .device-mode-mobile .dashboard-kpi-grid {
          display: flex !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scroll-snap-type: x mandatory;
          gap: 8px !important;
          padding-bottom: 4px !important;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none !important;
        }
        .device-mode-mobile .dashboard-kpi-grid::-webkit-scrollbar {
          display: none !important;
        }
        .device-mode-mobile .dashboard-kpi-grid > button {
          min-width: 135px !important;
          max-width: 145px !important;
          flex-shrink: 0 !important;
          scroll-snap-align: start;
          padding: 6px 8px 5px !important;
        }
        .device-mode-mobile .node-metrics-kpi-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }
        .device-mode-mobile .canvas-bottom-toolbar {
          left: 8px !important;
          right: 8px !important;
          bottom: 8px !important;
          max-width: 396px !important;
          overflow-x: auto !important;
          justify-content: flex-start !important;
          padding: 4px 8px !important;
          scrollbar-width: none !important;
        }
        .device-mode-mobile .canvas-bottom-toolbar::-webkit-scrollbar {
          display: none !important;
        }
        .device-mode-mobile .overview-controls-row {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 6px !important;
        }
        .device-mode-mobile .overview-controls-left,
        .device-mode-mobile .overview-controls-right {
          width: 100% !important;
          justify-content: space-between !important;
          box-sizing: border-box !important;
        }
        .device-mode-mobile .dashboard-overview-main {
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        .device-mode-mobile .dashboard-overview-container,
        .device-mode-mobile .dashboard-metrics-page {
          height: auto !important;
          min-height: 100% !important;
          overflow: visible !important;
        }
        .device-mode-mobile .overview-floating-header,
        .device-mode-mobile .node-metrics-floating-header {
          position: relative !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          padding: 6px 10px 8px !important;
          pointer-events: auto !important;
        }
        .device-mode-mobile .overview-canvas-wrapper {
          position: relative !important;
          inset: auto !important;
          height: auto !important;
          flex: none !important;
          overflow: visible !important;
          display: block !important;
        }
        .device-mode-mobile .node-metrics-controls-left,
        .device-mode-mobile .node-metrics-controls-right {
          width: 100% !important;
          flex-wrap: wrap !important;
          justify-content: space-between !important;
          box-sizing: border-box !important;
        }
      `}</style>
    </div>
    </div>
  );
};

export const DashboardLayout = ({ children, currentPath = '/dashboard', onNavigate, breadcrumbs = [] }) => {
  return (
    <DashboardProvider onNavigate={onNavigate}>
      <DashboardLayoutContent currentPath={currentPath} breadcrumbs={breadcrumbs}>
        {children}
      </DashboardLayoutContent>
    </DashboardProvider>
  );
};

export default DashboardLayout;
