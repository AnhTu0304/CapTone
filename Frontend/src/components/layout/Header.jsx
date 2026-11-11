import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, LayoutDashboard, LogOut, Shield, Globe } from 'lucide-react';
import Logo from '../common/Logo';
import MobileNavigation from './MobileNavigation';
import useScrollHeader from '../../hooks/useScrollHeader';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

export const Header = ({ currentPath = '/', onNavigate }) => {
  const isScrolled = useScrollHeader(25);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('VI');

  const userDropdownRef = useRef(null);
  const langDropdownRef = useRef(null);

  const { user, isAuthenticated, logout, getInitials, getPrimaryRole } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
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

  const selectLanguage = (lang) => {
    setCurrentLang(lang);
    setLangDropdownOpen(false);
  };

  return (
    <>
      <div
        className={`header-outer-container ${isScrolled ? 'header-scrolled-wrapper' : 'header-top-wrapper'}`}
        data-testid="header-container"
      >
        <header
          className="header-inner-box"
          aria-label="Thanh điều hướng chính của SelfHeal"
        >
          {/* Technical Corner Crosshairs (+) visible when header contracts on scroll */}
          {isScrolled && (
            <>
              <span className="header-crosshair ch-tl" aria-hidden="true">+</span>
              <span className="header-crosshair ch-tr" aria-hidden="true">+</span>
              <span className="header-crosshair ch-bl" aria-hidden="true">+</span>
              <span className="header-crosshair ch-br" aria-hidden="true">+</span>

              {/* Blueprint Top-Left Datum Tab Anchor */}
              <span className="header-datum-tab" aria-hidden="true" title="Datum Tab Anchor">
                <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
                  <polygon points="0,2.5 9,0 13,0 13,11 9,11 0,8.5" fill="#8B8999" opacity="0.85" />
                </svg>
              </span>
            </>
          )}

          {/* ================= 1. LEFT ZONE: BRAND LOGO ================= */}
          <div className="header-left">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, '/')}
              className="header-logo-link"
              aria-label="SelfHeal Homepage"
            >
              <Logo size={isScrolled ? 24 : 26} />
            </a>
          </div>

          {/* ================= 2. CENTER ZONE: SYMMETRICAL NAVIGATION DIV ================= */}
          <div className="header-center-wrapper">
            <nav
              className="header-center-nav"
              aria-label="Điều hướng chính"
            >
              {navLinks.map((link) => {
                const isActive = currentPath === link.path;
                return (
                  <a
                    key={link.label}
                    href={link.path}
                    onClick={(e) => handleLinkClick(e, link.path)}
                    className={`header-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span>{link.label}</span>
                    {link.hasDropdown && (
                      <ChevronDown
                        size={0}
                        strokeWidth={2.5}
                        className="header-nav-chevron"
                        aria-hidden="true"
                      />
                    )}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* ================= 3. RIGHT ZONE: LANGUAGE & ACTIONS ================= */}
          <div className="header-right">
            {/* Language Switcher */}
            <div className="header-lang-wrapper" ref={langDropdownRef}>
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="header-lang-btn"
                aria-label="Chuyển đổi ngôn ngữ"
                aria-expanded={langDropdownOpen}
              >
                <Globe size={14} color="#3D3B4F" aria-hidden="true" />
                <span>{currentLang}</span>
                <ChevronDown size={11} strokeWidth={2.5} style={{ opacity: 0.7 }} aria-hidden="true" />
              </button>

              {langDropdownOpen && (
                <div className="header-lang-dropdown" role="menu">
                  <button
                    type="button"
                    onClick={() => selectLanguage('VI')}
                    className={`header-lang-option ${currentLang === 'VI' ? 'active' : ''}`}
                    role="menuitem"
                  >
                    <span>Tiếng Việt</span>
                    {currentLang === 'VI' && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectLanguage('EN')}
                    className={`header-lang-option ${currentLang === 'EN' ? 'active' : ''}`}
                    role="menuitem"
                  >
                    <span>English</span>
                    {currentLang === 'EN' && <span>✓</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Authenticated State vs Guest State */}
            {isAuthenticated && user ? (
              <div className="header-auth-capsule">
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
                          }}
                        >
                          <LayoutDashboard size={15} color="var(--color-primary)" />
                          <span>Vào Bảng điều khiển</span>
                        </a>
                      </div>

                      <div style={{ borderTop: '1px dashed rgba(61, 59, 79, 0.15)', margin: '4px 0' }} />

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
              /* Dual-Hexagon Connected Button Group matching Greptile */
              <div className="header-dual-hex-group">
                {/* Button 1: Đăng nhập (Navy #3D3B4F) */}
                <a
                  href="/login"
                  onClick={(e) => handleLinkClick(e, '/login')}
                  className="header-hex-btn-login"
                  title="Đăng nhập tài khoản"
                >
                  <span>Đăng nhập</span>
                </a>

                {/* Button 2: Đăng ký (Vibrant Mint #28E99F) */}
                <a
                  href="/register"
                  onClick={(e) => handleLinkClick(e, '/register')}
                  className="header-hex-btn-signup"
                  title="Đăng ký tài khoản"
                >
                  <span>Đăng ký</span>
                </a>
              </div>
            )}

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
    </>
  );
};

export default Header;
