import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  User,
  LayoutDashboard,
  Shield,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import AuthContext from '../../context/AuthContext';

export const AdminProfileMenu = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const auth = useContext(AuthContext);
  const user = auth?.user || null;

  const displayName = user?.full_name || 'Quản Trị Viên';
  const displayEmail = user?.email || 'admin@selfheal.systems';
  const monogram = user?.full_name
    ? auth?.getInitials
      ? auth.getInitials(user.full_name)
      : user.full_name.slice(0, 2).toUpperCase()
    : 'AD';

  const primaryRole = auth?.getPrimaryRole
    ? auth.getPrimaryRole(user)
    : (user?.system_roles?.includes('SUPER_ADMIN') ? 'SUPER ADMIN' : 'Super Admin');

  const isSuperAdmin = user?.system_roles?.includes('SUPER_ADMIN') || primaryRole.includes('SUPER');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (item) => {
    setIsOpen(false);
    if (item.action) {
      item.action();
    } else if (onNavigate && item.path) {
      onNavigate(item.path);
    }
  };

  const handleLogout = () => {
    setIsOpen(false);
    if (auth?.logout) {
      auth.logout();
    }
    if (onNavigate) {
      onNavigate('/login');
    } else {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Menu hồ sơ quản trị viên"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '4px 8px 4px 4px',
          backgroundColor: isOpen ? 'var(--dash-bg-subtle)' : '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#CBD5E1';
          e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'var(--dash-border)';
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          }
        }}
      >
        {/* Avatar Monogram */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
            color: '#FFFFFF',
            fontSize: '0.8125rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
            letterSpacing: '0.02em',
          }}
        >
          {monogram}
        </div>

        {/* Name & Role (Hidden on mobile) */}
        <div className="admin-profile-meta" style={{ textAlign: 'left' }}>
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--dash-text-primary)',
              lineHeight: 1.2,
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: '0.6875rem',
              color: '#059669',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '1px',
            }}
          >
            <Shield size={10} color="#059669" />
            <span>{primaryRole}</span>
          </div>
        </div>

        <ChevronDown
          size={14}
          color="#94A3B8"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Profile Dropdown Popover */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Tùy chọn quản trị viên"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '280px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-dropdown)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeInSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* User Card */}
          <div
            style={{
              padding: '14px 16px',
              background: 'linear-gradient(180deg, #F0FDF4 0%, #E6FBF0 100%)',
              borderBottom: '1px solid #A7F3D0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#065F46' }}>
                  {displayName}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#047857',
                    fontFamily: 'var(--font-mono)',
                    marginTop: '2px',
                    wordBreak: 'break-all',
                  }}
                >
                  {displayEmail}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(5, 150, 105, 0.15)',
                color: '#065F46',
                fontSize: '0.6875rem',
                fontWeight: 700,
              }}
            >
              <Shield size={11} color="#059669" />
              <span>{isSuperAdmin ? 'Toàn Quyền Cụm & Chính Sách' : 'Quản Trị Hệ Thống'}</span>
            </div>
          </div>

          {/* Menu Items */}
          <div style={{ padding: '6px' }}>
            {[
              {
                id: 'switch_to_portal',
                label: 'Không Gian Cá Nhân (Personal Portal)',
                icon: User,
                path: '/portal',
              },
              {
                id: 'switch_to_dashboard',
                label: 'Bảng Điều Khiển Doanh Nghiệp (Owner / User)',
                icon: LayoutDashboard,
                path: '/dashboard',
              },
              {
                id: 'audit',
                label: 'Nhật Ký Kiểm Toán SHA-256',
                icon: FileText,
                path: '/admin/audit-logs',
              },
              {
                id: 'settings',
                label: 'Thiết Lập Hệ Thống',
                icon: Settings,
                path: '/admin/settings',
              },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleAction(item)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--dash-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
                    e.currentTarget.style.color = 'var(--dash-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--dash-text-primary)';
                  }}
                >
                  <ItemIcon size={16} color="#64748B" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Divider & Logout */}
          <div style={{ borderTop: '1px solid #F1F5F9', padding: '6px' }}>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#DC2626',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FEF2F2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={16} color="#DC2626" />
              <span>Đăng Xuất Khỏi Admin</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfileMenu;
