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
            <Logo size={32} />
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
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ width: '100%', maxWidth: '440px' }}>
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 840px) {
          .auth-left-pane {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AuthLayout;
