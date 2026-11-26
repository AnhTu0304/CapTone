import React from 'react';
import Logo from '../components/common/Logo';
import OnboardingSequence3D from '../pages/Login/components/OnboardingSequence3D';

export const AuthLayout = ({ children, onNavigate }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Left side: Interactive 3D 7-Step Onboarding Sequence & Dashboard Bloom */}
      <div
        className="auth-left-pane"
        style={{
          flex: '1.2',
          backgroundColor: 'var(--color-canvas)',
          borderRight: '1px dashed rgba(61, 59, 79, 0.18)',
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top: Brand Logo */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (onNavigate) onNavigate('/');
            }}
            style={{ display: 'inline-flex', alignItems: 'center' }}
            aria-label="SelfHeal Homepage"
          >
            <Logo size={46} showText={false} />
          </a>
        </div>

        {/* Center: 3D 7-Step Hexagonal Flow & Dashboard Bloom */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 0', position: 'relative' }}>
          <OnboardingSequence3D />
        </div>

        {/* Bottom: Minimal Technical Monospace Footer */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px dashed rgba(61, 59, 79, 0.12)',
            paddingTop: '12px',
          }}
        >
          <span>&copy; {new Date().getFullYear()} SELFHEAL SYSTEMS</span>
          <span>ONBOARDING WORKFLOW v1.2</span>
        </div>
      </div>

      {/* Right side: Focused Auth Form */}
      <div
        className="auth-right-pane"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          backgroundColor: '#FFFFFF',
          minWidth: 0,
        }}
      >
        <div
          className="auth-mobile-topbar"
          style={{
            width: '100%',
            maxWidth: '380px',
            marginBottom: '12px',
          }}
        >
          <a
            href="/"
            className="auth-link-muted"
            onClick={(e) => {
              e.preventDefault();
              if (onNavigate) {
                onNavigate('/');
              } else {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '36px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
            }}
          >
            &larr; SelfHeal
          </a>
        </div>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {children}
        </div>
      </div>

      <style>{`
        .auth-mobile-topbar {
          display: none;
        }
        @media (max-width: 840px) {
          .auth-left-pane {
            display: none !important;
          }
          .auth-mobile-topbar {
            display: flex;
            align-items: center;
          }
        }
        @media (max-width: 640px) {
          .auth-right-pane {
            padding: 20px 16px 28px !important;
            justify-content: flex-start !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AuthLayout;
