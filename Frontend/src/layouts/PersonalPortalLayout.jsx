import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Shield } from 'lucide-react';
import PersonalSidebar from '../components/personal/PersonalSidebar';
import PersonalHeader from '../components/personal/PersonalHeader';

export const PersonalPortalLayout = ({ currentPath, onNavigate, children }) => {
  const { t } = useTranslation('portal');
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 && window.innerWidth >= 768;
    }
    return false;
  });
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setIsMobileDrawerOpen(false);
      } else {
        setIsMobileDrawerOpen(false);
        if (width < 1024) {
          setIsCollapsed(true);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen]);

  const handleMobileNavigate = (path) => {
    setIsMobileDrawerOpen(false);
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <div
      className="portal-root-layout"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--dash-bg-canvas, #F8FAFC)',
      }}
    >
      {/* Desktop Sidebar */}
      <div className="portal-desktop-sidebar" style={{ display: 'flex', height: '100%', position: 'relative', zIndex: 45 }}>
        <PersonalSidebar
          currentPath={currentPath}
          onNavigate={onNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div
          role="presentation"
          onClick={() => setIsMobileDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      {isMobileDrawerOpen && (
        <div
          role="dialog"
          aria-label={t('layout.mobileMenuLabel')}
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            width: '280px',
            maxWidth: '85vw',
            backgroundColor: '#FFFFFF',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--dash-border, #E2E8F0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="#059669" />
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A' }}>
                SelfHeal Portal
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-label={t('layout.closeNavMenu')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748B',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <PersonalSidebar
              currentPath={currentPath}
              onNavigate={handleMobileNavigate}
              isCollapsed={false}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Top Header */}
        <PersonalHeader
          currentPath={currentPath}
          onNavigate={onNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
        />

        {/* Scrollable Page Body */}
        <main
          className="portal-main-viewport"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '1440px',
              margin: '0 auto',
              width: '100%',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PersonalPortalLayout;
