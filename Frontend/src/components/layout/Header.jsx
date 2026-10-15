import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, LayoutDashboard, LogOut, Shield } from 'lucide-react';
import Logo from '../common/Logo';
import MobileNavigation from './MobileNavigation';
import useScrollHeader from '../../hooks/useScrollHeader';
import { useAuth } from '../../context/AuthContext';

export const Header = ({ currentPath = '/', onNavigate }) => {
  const isScrolled = useScrollHeader(25);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  const { user, isAuthenticated, logout, getInitials, getPrimaryRole } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { label: 'HƯỚNG DẪN', path: '/guide', hasDropdown: false },
    { label: 'TÍNH NĂNG', path: '/features', hasDropdown: true },
    { label: 'GIỚI THIỆU', path: '/about', hasDropdown: false },
    { label: 'TÀI LIỆU', path: '/docs', hasDropdown: true },
  ];

  const handleLinkClick = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleLogout = () => {
    setUserDropdownOpen(false);
    logout();
    if (onNavigate) {
      onNavigate('/login');
    } else {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <>
      <div
        className={`header-outer-container ${isScrolled ? 'header-scrolled-wrapper' : 'header-top-wrapper'}`}
        style={{
          position: 'sticky',
          top: isScrolled ? '12px' : '0px',
          zIndex: 1000,
          width: '100%',
          backgroundColor: isScrolled ? 'transparent' : 'var(--color-canvas)',
          borderBottom: isScrolled ? 'none' : '1px dashed rgba(61, 59, 79, 0.16)',
          padding: isScrolled ? '0 var(--space-6)' : '0',
          transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
        }}
      >
        <header
          className="header-inner-box"
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: isScrolled ? 'var(--content-max-width)' : '100%', // Full-width at top, 1400px when scrolled!
            margin: '0 auto',
            height: isScrolled ? '56px' : '66px',
            backgroundColor: isScrolled ? 'rgba(238, 238, 238, 0.90)' : 'transparent',
            backdropFilter: isScrolled ? 'blur(12px) saturate(140%)' : 'none',
            WebkitBackdropFilter: isScrolled ? 'blur(12px) saturate(140%)' : 'none',
            border: isScrolled 
              ? '1px dashed rgba(61, 59, 79, 0.18)' 
              : 'none',
            borderRadius: '0px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isScrolled ? '0 20px 0 24px' : '0 clamp(24px, 4vw, 48px)',
            transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Technical Corner Crosshairs (+) visible when header contracts on scroll */}
          {isScrolled && (
            <>
              <span className="header-crosshair ch-tl" aria-hidden="true">+</span>
              <span className="header-crosshair ch-tr" aria-hidden="true">+</span>
              <span className="header-crosshair ch-bl" aria-hidden="true">+</span>
              <span className="header-crosshair ch-br" aria-hidden="true">+</span>

              {/* Top-left Datum Tab Anchor from Greptile Blueprint */}
              <span className="header-datum-tab" aria-hidden="true" title="Datum Tab Anchor">
                <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
                  <polygon points="0,2.5 9,0 13,0 13,11 9,11 0,8.5" fill="#8B8999" opacity="0.85" />
                </svg>
              </span>
            </>
          )}

          {/* Left: Brand Logo & Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isScrolled ? '32px' : '44px', transition: 'gap 0.3s ease' }}>
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, '/')}
              style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
              aria-label="SelfHeal Homepage"
            >
              <Logo size={isScrolled ? 24 : 26} />
            </a>

            {/* Desktop Navigation Links */}
            <nav
              className="desktop-nav"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {navLinks.map((link) => {
                const isActive = currentPath === link.path;
                return (
                  <a
                    key={link.path}
                    href={link.path}
                    onClick={(e) => handleLinkClick(e, link.path)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: isActive ? 'var(--color-primary)' : '#555368',
                      textDecoration: 'none',
                      borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                      padding: '6px 0',
                      transition: 'color 0.15s ease, border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = 'var(--color-ink)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = '#555368';
                    }}
                  >
                    <span>{link.label}</span>
                    {link.hasDropdown && (
                      <ChevronDown
                        size={12}
                        strokeWidth={2.5}
                        style={{ opacity: 0.75, transition: 'transform 0.15s ease' }}
                      />
                    )}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions (User Profile or Sign in / Sign up) */}
          <div className="desktop-actions" style={{ display: 'flex', alignItems: 'center' }}>
            {isAuthenticated && user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Button to Dashboard */}
                <a
                  href="/dashboard"
                  onClick={(e) => handleLinkClick(e, '/dashboard')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    borderRadius: '0px',
                    border: '1px solid var(--color-primary)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2D2B3B';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  }}
                  title="Vào Bảng điều khiển"
                >
                  <LayoutDashboard size={14} color="var(--color-accent)" />
                  <span>Bảng điều khiển</span>
                </a>

                {/* User Capsule & Dropdown */}
                <div ref={userDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      padding: '4px 10px 4px 6px',
                      backgroundColor: userDropdownOpen ? '#E5E7EB' : 'rgba(61, 59, 79, 0.06)',
                      border: '1px dashed rgba(61, 59, 79, 0.3)',
                      borderRadius: '0px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title={user.email}
                  >
                    {/* Initials Avatar */}
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '0px',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        border: '1px solid rgba(40, 233, 159, 0.4)',
                      }}
                    >
                      {getInitials(user.full_name || user.email)}
                    </div>

                    {/* Name & Role Pill */}
                    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          color: 'var(--color-ink)',
                          fontFamily: 'var(--font-display)',
                          lineHeight: 1.2,
                          maxWidth: '120px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.full_name || user.email?.split('@')[0]}
                      </span>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.04em',
                          color: getPrimaryRole(user) === 'SUPER ADMIN' ? '#7C3AED' : getPrimaryRole(user) === 'ADMIN' ? '#0D9488' : '#6B7280',
                        }}
                      >
                        {getPrimaryRole(user)}
                      </span>
                    </div>

                    <ChevronDown
                      size={14}
                      color="#555368"
                      style={{
                        transform: userDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {userDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: '240px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(61, 59, 79, 0.18)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        zIndex: 1100,
                        padding: '8px 0',
                      }}
                    >
                      {/* Identity Header */}
                      <div style={{ padding: '8px 16px 12px', borderBottom: '1px dashed rgba(61, 59, 79, 0.15)' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                          {user.full_name || 'Người dùng'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#6B7280',
                            fontFamily: 'var(--font-mono)',
                            marginTop: '2px',
                            wordBreak: 'break-all',
                          }}
                        >
                          {user.email}
                        </div>
                        <div style={{ marginTop: '8px', display: 'inline-flex' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              backgroundColor: 'rgba(40, 233, 159, 0.15)',
                              border: '1px solid rgba(40, 233, 159, 0.4)',
                              color: '#065F46',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            <Shield size={11} />
                            {getPrimaryRole(user)}
                          </span>
                        </div>
                      </div>

                      {/* Links */}
                      <div style={{ padding: '6px 0' }}>
                        <a
                          href="/dashboard"
                          onClick={(e) => {
                            setUserDropdownOpen(false);
                            handleLinkClick(e, '/dashboard');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 16px',
                            color: 'var(--color-ink)',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            transition: 'background-color 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#F3F4F6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <LayoutDashboard size={15} color="var(--color-primary)" />
                          <span>Vào Bảng điều khiển</span>
                        </a>
                      </div>

                      <div style={{ borderTop: '1px dashed rgba(61, 59, 79, 0.15)', margin: '4px 0' }} />

                      {/* Logout Action */}
                      <button
                        type="button"
                        onClick={handleLogout}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 16px',
                          color: '#DC2626',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#FEF2F2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <LogOut size={15} color="#DC2626" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="chevron-btn-group">
                {/* Button 1: Đăng nhập (Navy #3D3B4F Chevron) */}
                <a
                  href="/login"
                  onClick={(e) => handleLinkClick(e, '/login')}
                  className="chevron-btn chevron-login"
                  title="Đăng nhập tài khoản"
                >
                  <span>Đăng nhập</span>
                </a>

                {/* Button 2: Đăng ký (Mint #28E99F Chevron) */}
                <a
                  href="/register"
                  onClick={(e) => handleLinkClick(e, '/register')}
                  className="chevron-btn chevron-signup"
                  title="Đăng ký tài khoản"
                >
                  <span>Đăng ký</span>
                </a>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="mobile-menu-toggle">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu di động"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                color: 'var(--color-ink)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Menu size={22} />
            </button>
          </div>
        </header>
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNavigation
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentPath={currentPath}
        onNavigate={(path) => {
          setMobileMenuOpen(false);
          if (onNavigate) {
            onNavigate(path);
          } else {
            window.history.pushState({}, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }}
      />

      {/* STYLES FOR SCROLLED HEADER & CHEVRON BUTTONS */}
      <style>{`
        /* Technical Corner Crosshairs (+) */
        .header-crosshair {
          position: absolute;
          color: var(--color-accent); /* Greptile Mint #28E99F */
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          line-height: 1;
          pointer-events: none;
          user-select: none;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          opacity: 0.95;
        }
        .ch-tl { top: 0; left: 0; transform: translate(-50%, -50%); }
        .ch-tr { top: 0; right: 0; transform: translate(50%, -50%); }
        .ch-bl { bottom: 0; left: 0; transform: translate(-50%, 50%); }
        .ch-br { bottom: 0; right: 0; transform: translate(50%, 50%); }

        /* Blueprint Top-Left Datum Tab Anchor */
        .header-datum-tab {
          position: absolute;
          top: -5px;
          left: -13px;
          pointer-events: none;
          user-select: none;
          z-index: 15;
          display: flex;
          align-items: center;
        }

        /* Signature Chevron Button Pair */
        .chevron-btn-group {
          display: inline-flex;
          align-items: center;
        }

        .chevron-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justifyContent: center;
          height: 34px;
          font-family: var(--font-display);
          font-size: 0.8125rem;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
          transition: background-color 0.15s ease, transform 0.15s ease;
        }

        /* 1. Đăng nhập - Navy Ribbon Chevron */
        .chevron-login {
          padding: 0 18px 0 22px;
          background-color: var(--color-primary); /* #3D3B4F */
          color: #FFFFFF;
          clip-path: polygon(10px 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0% 50%);
          z-index: 1;
        }

        .chevron-login:hover {
          background-color: #4C4A61;
          transform: translateX(-2px);
        }

        /* 2. Đăng ký - Mint Ribbon Chevron */
        .chevron-signup {
          padding: 0 20px 0 22px;
          margin-left: 2px;
          background-color: var(--color-accent); /* #28E99F */
          color: #000000;
          clip-path: polygon(10px 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0% 50%);
          z-index: 2;
        }

        .chevron-signup:hover {
          background-color: #1FE092;
          transform: translateX(2px);
        }

        @media (max-width: 768px) {
          .desktop-nav, .desktop-actions {
            display: none !important;
          }
          .mobile-menu-toggle {
            display: block !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-menu-toggle {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default Header;
