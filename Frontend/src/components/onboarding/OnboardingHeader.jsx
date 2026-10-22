import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, BookOpen, ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import Logo from '../common/Logo';
import { useAuth } from '../../context/AuthContext';

export const OnboardingHeader = ({ onNavigate }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const { user, logout, getInitials, getPrimaryRole } = useAuth();

  const displayName = user?.full_name || 'Người Dùng';
  const displayEmail = user?.email || 'user@selfheal.systems';
  const monogram = user?.full_name
    ? (getInitials ? getInitials(user.full_name) : user.full_name.slice(0, 2).toUpperCase())
    : (user?.email ? user.email.slice(0, 2).toUpperCase() : 'US');
  const roleName = getPrimaryRole ? getPrimaryRole(user) : 'SME OWNER';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleLink = (e, path) => {
    if (e && e.preventDefault) e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleLogout = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setUserMenuOpen(false);
    if (logout) {
      logout();
    }
    handleLink(e, '/login');
  };

  return (
    <header
      className="onboarding-global-header"
      style={{
        width: '100%',
        height: '60px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px dashed rgba(61, 59, 79, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        userSelect: 'none',
      }}
    >
      {/* Left: SelfHeal Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <a
          href="/"
          onClick={(e) => handleLink(e, '/')}
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          aria-label="SelfHeal Homepage"
        >
          <Logo size={24} />
        </a>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            backgroundColor: 'rgba(61, 59, 79, 0.06)',
            border: '1px solid var(--border-default)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <ShieldCheck size={12} color="var(--color-accent)" />
          <span>ONBOARDING WORKSPACE</span>
        </div>
      </div>

      {/* Right: Help, Docs & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <a
          href="/guide"
          onClick={(e) => handleLink(e, '/guide')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <HelpCircle size={14} />
          <span className="hidden sm:inline">Trợ giúp & Hướng dẫn</span>
        </a>

        <a
          href="/docs"
          onClick={(e) => handleLink(e, '/docs')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <BookOpen size={14} />
          <span className="hidden sm:inline">Tài liệu</span>
        </a>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-default)' }} />

        {/* User Profile Menu */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label="Tài khoản người dùng"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(61, 59, 79, 0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {/* Monogram Avatar */}
            <div
              style={{
                width: '30px',
                height: '30px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
              }}
            >
              {monogram}
            </div>

            {/* Display Name & Email preview on desktop */}
            <div style={{ textAlign: 'left', display: 'none' }} className="sm:block">
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: 'var(--color-ink)',
                  lineHeight: 1.2,
                  maxWidth: '140px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  maxWidth: '140px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayEmail}
              </div>
            </div>

            <ChevronDown
              size={14}
              color="var(--text-muted)"
              style={{
                transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {/* User Popover Dropdown */}
          {userMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '240px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--border-default)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                zIndex: 200,
                padding: '6px 0',
                animation: 'fadeIn 0.15s ease',
              }}
            >
              {/* Signed In Header */}
              <div style={{ padding: '10px 14px', borderBottom: '1px dashed var(--border-default)' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.625rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '4px',
                  }}
                >
                  ĐÃ ĐĂNG NHẬP VỚI
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'var(--color-ink)',
                    lineHeight: 1.2,
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: '#059669',
                    marginTop: '2px',
                    wordBreak: 'break-all',
                  }}
                >
                  {displayEmail}
                </div>

                <div
                  style={{
                    marginTop: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    backgroundColor: 'rgba(5, 150, 105, 0.12)',
                    color: '#065F46',
                    fontSize: '0.625rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                  }}
                >
                  <span>{roleName}</span>
                </div>
              </div>

              {/* Logout button */}
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#DC2626',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={14} color="#DC2626" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default OnboardingHeader;
