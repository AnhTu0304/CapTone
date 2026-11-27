import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  LayoutDashboard,
  Shield,
  ShieldCheck,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStoredProfile } from '../../mocks/profileMockData';

/**
 * Phân giải System Role chuẩn hóa từ cơ sở dữ liệu (system_roles / user_system_roles)
 * Tuân thủ phân cấp ưu tiên: SUPER_ADMIN > SYSTEM_ADMIN > ADMIN > USER
 * Nếu tài khoản không có System Role (ví dụ chỉ có Company Role như SME_OWNER, DEVOPS), trả về null.
 * Tuyệt đối không fallback sang Company Role hoặc giá trị mặc định nào khác.
 */
export const resolveUserSystemRole = (u) => {
  if (!u) return null;

  // 1. Kiểm tra danh sách system_roles dạng mảng từ API / Database
  const rawRoles = Array.isArray(u.system_roles)
    ? u.system_roles.map((r) =>
        typeof r === 'object' && r !== null ? r.role_name || r.name || r.code || r.role_id : r
      )
    : [];
  const normalized = rawRoles.map((r) => String(r).toUpperCase().trim());

  // Phân cấp ưu tiên System Role: SUPER_ADMIN > SYSTEM_ADMIN > ADMIN > USER
  if (normalized.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (normalized.includes('SYSTEM_ADMIN')) return 'SYSTEM_ADMIN';
  if (normalized.includes('ADMIN')) return 'ADMIN';
  if (normalized.includes('USER')) return 'USER';

  // 2. Kiểm tra trường đơn lẻ systemRole / system_role trả về trực tiếp từ API backend
  const directRole = (u.systemRole || u.system_role || u.role || '').toString().toUpperCase().trim();
  if (directRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (directRole === 'SYSTEM_ADMIN') return 'SYSTEM_ADMIN';
  if (directRole === 'ADMIN') return 'ADMIN';
  if (directRole === 'USER') return 'USER';

  // Không có System Role trong Database
  return null;
};

export const UserProfileDropdown = ({
  onNavigate,
  variant = 'default',
  logoutLabel,
  ariaLabel,
}) => {
  const { t } = useTranslation('portal');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const auth = useAuth();
  const user = auth?.user || null;

  // Lắng nghe cập nhật profile cục bộ
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

  useEffect(() => {
    try {
      setProfileData(getStoredProfile());
    } catch {}
  }, [user?.id, user?.email, user?.full_name, user?.fullName, user?.avatar_url]);

    // Đảm bảo chỉ dùng profileData nếu cùng tài khoản email
  const isProfileDataOwnedByCurrentUser = Boolean(
    user?.email && profileData?.email && user.email.toLowerCase().trim() === profileData.email.toLowerCase().trim()
  );

  const rawDisplayName =
    user?.full_name ||
    user?.name ||
    (isProfileDataOwnedByCurrentUser ? profileData?.fullName : null) ||
    (user?.email ? user.email.split('@')[0] : t('profileDropdown.defaultAdminName'));

  // Chuẩn hóa họ tên, xóa hậu tố (Super Admin) hoặc (Admin) nếu có
  const displayName = useMemo(() => {
    if (!rawDisplayName) return '';
    return rawDisplayName.replace(/\s*\((?:Super\s*Admin|Admin|User|SME\s*Owner|DevOps)\)/gi, '').trim();
  }, [rawDisplayName]);

  const displayEmail =
    user?.email ||
    (isProfileDataOwnedByCurrentUser ? profileData?.email : null) ||
    'admin@selfheal.systems';

  // Tuyệt đối không fallback sang avatar của tài khoản khác
  const displayAvatar =
    user?.avatar_url ||
    user?.avatar ||
    (isProfileDataOwnedByCurrentUser ? profileData?.avatar : null);

  const monogram = useMemo(() => {
    if (auth?.getInitials && displayName) {
      return auth.getInitials(displayName);
    }
    if (displayName) {
      const parts = displayName.trim().split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return displayName.slice(0, 2).toUpperCase();
    }
    return 'AD';
  }, [auth, displayName]);

  // Xác định System Role từ database theo đúng phân cấp
  const activeSystemRole = useMemo(() => {
    return resolveUserSystemRole(user);
  }, [user]);

  const isSuperAdmin = useMemo(() => {
    return activeSystemRole === 'SUPER_ADMIN';
  }, [activeSystemRole]);

  const isAdmin = useMemo(() => {
    return ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(activeSystemRole);
  }, [activeSystemRole]);

  const canAccessAdmin = isSuperAdmin || isAdmin;

  // Nhãn hiển thị System Role cho Menu cá nhân (Header trigger & Card Badge)
  const roleDisplay = useMemo(() => {
    if (!activeSystemRole) {
      return t('profileDropdown.noSystemRole');
    }
    return activeSystemRole;
  }, [activeSystemRole, t]);

  const roleSubtitle = roleDisplay;

  // Không hiển thị nhãn USER theo yêu cầu, chỉ hiển thị khi là Admin / Super Admin (hoặc chưa gán role)
  const shouldShowRoleSubtitle = useMemo(() => {
    return ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(activeSystemRole);
  }, [activeSystemRole]);

  // Xử lý đóng khi click bên ngoài và khi nhấn Escape
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
    } else if (item.path) {
      window.history.pushState({}, '', item.path);
      window.dispatchEvent(new PopStateEvent('popstate'));
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

  // Danh sách các mục điều hướng theo phân quyền thực tế
  const menuItems = useMemo(() => {
    const list = [
      {
        id: 'switch_to_portal',
        label: t('profileDropdown.switchToPortal'),
        icon: User,
        path: '/portal',
      },
      {
        id: 'switch_to_dashboard',
        label: t('profileDropdown.switchToDashboard'),
        icon: LayoutDashboard,
        path: '/dashboard',
      },
    ];

    if (canAccessAdmin) {
      list.push({
        id: 'switch_to_admin',
        label: t('profileDropdown.switchToAdmin'),
        icon: Shield,
        path: '/admin',
      });
    }

    list.push({
      id: 'profile',
      label: variant === 'admin' ? t('profileDropdown.adminProfile') : t('profileDropdown.viewProfile'),
      icon: User,
      path: '/portal/profile',
    });

    list.push({
      id: 'security',
      label: t('profileDropdown.securityAndPassword'),
      icon: ShieldCheck,
      path: '/portal/security',
    });

    if (canAccessAdmin) {
      list.push({
        id: 'audit',
        label: t('profileDropdown.auditLogs'),
        icon: FileText,
        path: '/admin/audit-logs',
      });
      if (isSuperAdmin) {
        list.push({
          id: 'settings',
          label: t('profileDropdown.systemSettings'),
          icon: Settings,
          path: '/admin/settings',
        });
      } else {
        list.push({
          id: 'settings',
          label: t('profileDropdown.accountSettings'),
          icon: Settings,
          path: '/admin/account-settings',
        });
      }
    } else {
      list.push({
        id: 'settings',
        label: t('profileDropdown.accountSettings'),
        icon: Settings,
        path: '/portal/preferences',
      });
    }

    return list;
  }, [canAccessAdmin, isSuperAdmin, variant, t]);

  const defaultLogoutText =
    logoutLabel || (variant === 'admin' ? t('profileDropdown.logoutAdmin') : t('profileDropdown.logoutAccount'));

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={ariaLabel || (variant === 'admin' ? t('profileDropdown.ariaAdminMenu') : t('profileDropdown.ariaUserMenu'))}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '4px 8px 4px 4px',
          backgroundColor: isOpen ? 'var(--dash-bg-subtle, #F8FAFC)' : '#FFFFFF',
          border: '1px solid var(--dash-border, #E2E8F0)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: 'var(--dash-shadow-xs, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#CBD5E1';
          e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle, #F8FAFC)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'var(--dash-border, #E2E8F0)';
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          }
        }}
      >
        {/* Avatar Monogram hoặc Ảnh đại diện */}
        {displayAvatar ? (
          <img
            src={displayAvatar}
            alt={displayName}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              objectFit: 'cover',
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
              flexShrink: 0,
            }}
          />
        ) : (
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
              flexShrink: 0,
            }}
          >
            {monogram}
          </div>
        )}

        {/* Họ tên & Nhãn vai trò (Ẩn trên mobile thông qua class .admin-profile-meta) */}
        <div className="admin-profile-meta" style={{ textAlign: 'left' }}>
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--dash-text-primary, #0F172A)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '105px',
            }}
          >
            {displayName}
          </div>
          {shouldShowRoleSubtitle && (
            <div
              style={{
                fontSize: '0.6875rem',
                color: activeSystemRole ? '#059669' : '#64748B',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '1px',
              }}
            >
              <Shield size={10} color={activeSystemRole ? '#059669' : '#64748B'} />
              <span>{roleSubtitle}</span>
            </div>
          )}
        </div>

        <ChevronDown
          className="topheader-avatar-chevron"
          size={14}
          color="#94A3B8"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Menu Dropdown Popover */}
      {isOpen && (
        <div
          role="menu"
          aria-label={ariaLabel || t('profileDropdown.ariaAccountOptions')}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '280px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border, #E2E8F0)',
            boxShadow:
              'var(--dash-shadow-dropdown, 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04))',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeInSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* User Card Header */}
          <div
            style={{
              padding: '14px 16px',
              background: 'linear-gradient(180deg, #F0FDF4 0%, #E6FBF0 100%)',
              borderBottom: '1px solid #A7F3D0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#065F46', lineHeight: 1.2 }}>
                  {displayName}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#047857',
                    fontFamily: 'var(--font-mono, monospace)',
                    marginTop: '2px',
                    wordBreak: 'break-all',
                  }}
                >
                  {displayEmail}
                </div>
              </div>
            </div>

            {/* Hiển thị huy hiệu vai trò quản trị viên nếu là Admin / Super Admin (USER ẩn hoàn toàn) */}
            {['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(activeSystemRole) && (
              <div style={{ marginTop: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#D1FAE5',
                    color: '#065F46',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    border: '1px solid #A7F3D0',
                    letterSpacing: '0.02em',
                  }}
                >
                  <Shield size={10} color="#059669" />
                  {activeSystemRole}
                </span>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div style={{ padding: '6px' }}>
            {menuItems.map((item) => {
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
                    color: 'var(--dash-text-primary, #0F172A)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle, #F8FAFC)';
                    e.currentTarget.style.color = 'var(--dash-primary, #059669)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--dash-text-primary, #0F172A)';
                  }}
                >
                  <ItemIcon size={16} color="#64748B" style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
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
              <span>{defaultLogoutText}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;
