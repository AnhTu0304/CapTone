import React, { useState, useEffect } from 'react';
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminHeader from '../components/admin/AdminHeader';
import { X, Shield, Terminal } from 'lucide-react';

export const AdminLayout = ({
  children,
  currentPath = '/admin',
  onNavigate,
  breadcrumbItems,
}) => {
  // Collapsed state: false for desktop, true for tablet by default
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 && window.innerWidth >= 768;
    }
    return false;
  });

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Auto-adapt on screen resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        // Mobile screen: close drawer if open, desktop sidebar stays hidden via CSS
        setIsMobileDrawerOpen(false);
      } else if (width < 1024) {
        // Tablet screen: default to collapsed
        setIsCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut [Ctrl+B / Cmd+B] to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle handlers
  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  const handleToggleMobileDrawer = () => {
    setIsMobileDrawerOpen((prev) => !prev);
  };

  const handleMobileNavigate = (path) => {
    setIsMobileDrawerOpen(false);
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <div
      className="admin-root-layout"
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
      {/* 1. Desktop & Tablet Sidebar */}
      <div className="admin-desktop-sidebar" style={{ display: 'flex', height: '100%' }}>
        <AdminSidebar
          currentPath={currentPath}
          onNavigate={onNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {/* 2. Mobile Drawer Backdrop Overlay */}
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
            animation: 'fadeIn 0.2s ease-out',
          }}
        />
      )}

      {/* 3. Mobile Slide-Over Drawer */}
      {isMobileDrawerOpen && (
        <div
          role="dialog"
          aria-label="Menu điều hướng di động"
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
            animation: 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Mobile Drawer Top Close Header */}
          <div
            style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--dash-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--dash-primary)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                SelfHeal Admin
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-label="Đóng thanh điều hướng"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--dash-text-muted)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Inner Nav */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <AdminSidebar
              currentPath={currentPath}
              onNavigate={handleMobileNavigate}
              isCollapsed={false}
              onToggleCollapse={null}
            />
          </div>
        </div>
      )}

      {/* 4. Main Application Viewport */}
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
        {/* Header */}
        <AdminHeader
          currentPath={currentPath}
          onNavigate={onNavigate}
          breadcrumbItems={breadcrumbItems}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onToggleMobileDrawer={handleToggleMobileDrawer}
        />

        {/* Scrollable Content Body */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px 32px',
            backgroundColor: 'var(--dash-bg-canvas)',
          }}
        >
          {children || (
            /* Shell Placeholder (Ready for dashboard content in next steps) */
            <div
              className="admin-shell-placeholder"
              style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              {/* Welcome Banner Card */}
              <div
                className="dash-card"
                style={{
                  padding: '28px',
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)',
                  border: '1px solid #A7F3D0',
                  boxShadow: '0 4px 12px rgba(6, 95, 70, 0.05)',
                  borderRadius: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ maxWidth: '680px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        color: '#065F46',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: '12px',
                      }}
                    >
                      <Terminal size={12} color="#059669" />
                      <span>APPLICATION SHELL SẴN SÀNG</span>
                    </div>

                    <h1
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: 'var(--dash-text-primary)',
                        letterSpacing: '-0.02em',
                        margin: '0 0 8px 0',
                      }}
                    >
                      Khung Ứng Dụng Quản Trị Hệ Thống (Admin Shell)
                    </h1>

                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--dash-text-secondary)',
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      Bộ khung sườn Admin đã được khởi tạo hoàn chỉnh với đầy đủ các thành phần{' '}
                      <strong>AdminLayout</strong>, <strong>AdminSidebar</strong> (hỗ trợ nhóm phân cấp, route kích hoạt, thu gọn mượt mà, tooltip nổi),{' '}
                      <strong>AdminHeader</strong>, <strong>AdminBreadcrumb</strong>, <strong>AdminNotificationButton</strong> và{' '}
                      <strong>AdminProfileMenu</strong>. Sẵn sàng tiếp nhận các widget và nội dung dashboard trong giai đoạn tiếp theo.
                    </p>
                  </div>

                  <div
                    style={{
                      padding: '12px 18px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '12px',
                      boxShadow: 'var(--dash-shadow-xs)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ color: 'var(--dash-text-muted)', marginBottom: '4px' }}>TRẠNG THÁI KHUNG:</div>
                    <div style={{ color: '#059669', fontWeight: 700 }}>● GIAO DIỆN HOẠT ĐỘNG</div>
                    <div style={{ color: 'var(--dash-text-secondary)', marginTop: '4px' }}>PHÍM TẮT: Ctrl+B</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
