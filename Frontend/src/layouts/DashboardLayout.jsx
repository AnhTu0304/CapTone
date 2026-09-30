import React from 'react';
import { DashboardProvider, useDashboard } from '../pages/Dashboard/context/DashboardContext';
import Sidebar from '../components/dashboard/Sidebar';
import TopHeader from '../components/dashboard/TopHeader';
import { ChevronRight, Home, X } from 'lucide-react';

const DashboardLayoutContent = ({ children, currentPath, breadcrumbs = [] }) => {
  const { isMobileNavOpen, setIsMobileNavOpen, onNavigate } = useDashboard();

  return (
    <div
      className="dashboard-root-layout"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--dash-bg-canvas)',
        fontFamily: 'var(--font-body)',
        color: 'var(--dash-text-primary)',
      }}
    >
      {/* Desktop Sidebar */}
      <div className="dashboard-desktop-sidebar" style={{ display: 'flex', height: '100%' }}>
        <Sidebar currentPath={currentPath} />
      </div>

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
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            width: '280px',
            backgroundColor: '#FFFFFF',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--dash-shadow-dropdown)',
          }}
        >
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid var(--dash-border)' }}>
            <button
              onClick={() => setIsMobileNavOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-muted)' }}
            >
              <X size={20} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Sidebar currentPath={currentPath} />
          </div>
        </div>
      )}

      {/* Main Area: TopHeader + Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <TopHeader />

        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
            backgroundColor: 'var(--dash-bg-canvas)',
          }}
        >
          {/* Optional Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <nav
              aria-label="Breadcrumbs"
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
                <span>Dashboard</span>
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
          <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
            {children}
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-desktop-sidebar {
            display: none !important;
          }
          .dashboard-mobile-toggle {
            display: block !important;
          }
        }
      `}</style>
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
