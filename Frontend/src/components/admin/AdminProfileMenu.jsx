import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  User,
  Shield,
  ShieldCheck,
  KeyRound,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  X,
  CheckCircle2,
  Lock,
  Eye,
} from 'lucide-react';
import AuthContext from '../../context/AuthContext';

const formatVnDate = (isoStr) => {
  if (!isoStr) return 'Hôm nay';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime())
      ? 'Hôm nay'
      : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return 'Hôm nay';
  }
};

const formatVnDateTime = (isoStr) => {
  if (!isoStr) return 'Vừa mới đăng nhập';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime())
      ? 'Vừa mới đăng nhập'
      : `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  } catch {
    return 'Vừa mới đăng nhập';
  }
};

const extractRoleName = (r) => {
  if (!r) return '';
  if (typeof r === 'string') return r;
  return r.role_name || r.name || r.role_id || String(r);
};

export const AdminProfileMenu = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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
        setIsDetailOpen(false);
      }
    };

    if (isOpen || isDetailOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isDetailOpen]);

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

              {/* Button Xem Chi Tiết */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsDetailOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(5, 150, 105, 0.2)',
                }}
                title="Xem chi tiết tài khoản quản trị"
              >
                <Eye size={12} />
                <span>Xem chi tiết</span>
              </button>
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
                id: 'profile',
                label: 'Hồ Sơ Quản Trị Viên',
                icon: User,
                action: () => {
                  setIsOpen(false);
                  setIsDetailOpen(true);
                },
              },
              {
                id: 'security',
                label: 'Bảo Mật & Khóa Xác Thực 2FA',
                icon: KeyRound,
                path: '/admin/settings',
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

      {/* Admin Profile Details Modal */}
      {isDetailOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-profile-detail-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: 'var(--dash-shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'scaleIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="#059669" />
                <h2
                  id="admin-profile-detail-title"
                  style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}
                >
                  Thông Tin Quản Trị Viên & An Toàn
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng chi tiết hồ sơ"
                onClick={() => setIsDetailOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--dash-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
                title="Đóng chi tiết"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
              {/* User Overview Box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid var(--dash-border)',
                }}
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={displayName}
                    style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      border: '2px solid #A7F3D0',
                    }}
                  >
                    {monogram}
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                    {displayName}
                  </h3>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    {displayEmail}
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid #A7F3D0',
                      }}
                    >
                      <CheckCircle2 size={11} />
                      Hoạt động (ACTIVE)
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: isSuperAdmin ? '#FEE2E2' : '#EEF2FF',
                        color: isSuperAdmin ? '#DC2626' : '#4F46E5',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid currentColor',
                      }}
                    >
                      {primaryRole}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Banner: Cam kết an toàn thông tin quản trị */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <ShieldCheck size={18} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.75rem', color: '#166534', lineHeight: 1.5 }}>
                  <strong>Bảo mật thông tin Quản trị viên:</strong> Tài khoản này được bảo vệ ở cấp độ cao nhất theo tiêu chuẩn IAM & Zero Trust. Không bao giờ hiển thị mật khẩu, mã hash hoặc khóa riêng tư trên giao diện.
                </div>
              </div>

              {/* Detailed Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>ID Định Danh (Admin UUID)</div>
                  <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)', wordBreak: 'break-all' }}>
                    {user?.id || 'sys-admin-root-01'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Quyền Hạn Hệ Thống (System Roles)</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {(user?.system_roles || ['ADMIN']).map((role, idx) => {
                      const roleName = extractRoleName(role);
                      const isSuper = roleName === 'SUPER_ADMIN';
                      return (
                        <span
                          key={role?.role_id || roleName || idx}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: isSuper ? '#FEE2E2' : '#EEF2FF',
                            color: isSuper ? '#DC2626' : '#4F46E5',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: '1px solid currentColor',
                          }}
                        >
                          {roleName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Cơ Chế Xác Thực & Bảo Mật</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: '#059669', fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> Xác thực token: JSON Web Token (HMAC-SHA256)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: '#059669', fontWeight: 600 }}>
                      <Lock size={14} /> Khóa bảo vệ phiên: Phiên đăng nhập được mã hóa an toàn
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Đăng Nhập Gần Nhất</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                    {formatVnDateTime(user?.last_login_at)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Ngày Khởi Tạo Tài Khoản</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                    {formatVnDate(user?.created_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfileMenu;
