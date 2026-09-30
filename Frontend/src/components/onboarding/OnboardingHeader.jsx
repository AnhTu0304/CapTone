import React, { useState } from 'react';
import { HelpCircle, BookOpen, ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import Logo from '../common/Logo';

export const OnboardingHeader = ({ onNavigate }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLink = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
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
          <span className="hidden sm:inline">Help & Guide</span>
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
          <span className="hidden sm:inline">Documentation</span>
        </a>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-default)' }} />

        {/* User Profile Menu */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              OP
            </div>
            <div style={{ textAlign: 'left', display: 'none' }} className="sm:block">
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1.1 }}>
                Operator
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                devops@acme.corp
              </div>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {userMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                width: '200px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--border-default)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                zIndex: 200,
                padding: '6px 0',
              }}
            >
              <div style={{ padding: '8px 14px', borderBottom: '1px dashed var(--border-default)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Signed in as
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                  devops@acme.corp
                </div>
              </div>
              <a
                href="/login"
                onClick={(e) => {
                  setUserMenuOpen(false);
                  handleLink(e, '/login');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  color: '#BE123C',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={14} />
                <span>Log out</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default OnboardingHeader;
