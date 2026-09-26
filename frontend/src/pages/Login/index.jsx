import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export const LoginPage = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleGoogleSignIn = () => {
    // Simulated Google OAuth redirect
    setSubmitted(true);
  };

  return (
    <div
      className="login-card"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '36px 32px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Top Center: Isometric Mint Cube Logo matching reference image */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <svg width="52" height="52" viewBox="0 0 120 120" fill="none" aria-label="SelfHeal Cube Logo">
          <defs>
            <linearGradient id="cubeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#28E99F" />
              <stop offset="100%" stopColor="#1fd48f" />
            </linearGradient>
            <linearGradient id="cubeGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c788" />
              <stop offset="100%" stopColor="#28E99F" />
            </linearGradient>
            <linearGradient id="cubeGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1bb87c" />
              <stop offset="100%" stopColor="#148e5f" />
            </linearGradient>
          </defs>
          <g transform="translate(60, 60)">
            {/* Top-Left Quadrant */}
            <path d="M 0 -48 L -42 -8 L -22 12 L 0 -8 Z" fill="url(#cubeGrad1)" stroke="#148e5f" strokeWidth="1" />
            {/* Top-Right Quadrant */}
            <path d="M 0 -48 L 42 -8 L 22 12 L 0 -8 Z" fill="url(#cubeGrad2)" stroke="#148e5f" strokeWidth="1" />
            {/* Bottom-Left Quadrant */}
            <path d="M -42 -8 L 0 34 L 0 12 L -22 -10 Z" fill="url(#cubeGrad2)" stroke="#148e5f" strokeWidth="1" />
            {/* Bottom-Right Quadrant */}
            <path d="M 42 -8 L 0 34 L 0 12 L 22 -10 Z" fill="url(#cubeGrad3)" stroke="#148e5f" strokeWidth="1" />
            {/* Inner Core Accent */}
            <circle cx="0" cy="-8" r="4" fill="#FFFFFF" opacity="0.9" />
          </g>
        </svg>
      </div>

      {/* Title & Switch to Signup */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#111827',
            letterSpacing: '-0.03em',
            marginBottom: '8px',
            lineHeight: 1.2,
          }}
        >
          Log into your account
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'var(--font-body)' }}>
          Don't have an account?{' '}
          <a
            href="/register"
            onClick={(e) => {
              e.preventDefault();
              if (onNavigate) {
                onNavigate('/register');
              } else {
                window.history.pushState({}, '', '/register');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            style={{
              color: '#2563EB',
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Sign up
          </a>
        </p>
      </div>

      {submitted ? (
        <div
          style={{
            padding: '24px 20px',
            borderRadius: '0px',
            backgroundColor: 'rgba(40, 233, 159, 0.12)',
            border: '1px solid var(--color-accent)',
            color: 'var(--color-primary)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '6px', fontSize: '1rem', color: '#065F46' }}>
            Authentication Successful!
          </strong>
          <p style={{ margin: '0 0 16px 0', color: '#047857' }}>
            Your account is verified. Continue to complete your infrastructure workspace onboarding.
          </p>
          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate('/onboarding/organization');
              } else {
                window.history.pushState({}, '', '/onboarding/organization');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              border: '1px solid var(--border-strong)',
              borderRadius: '0px',
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Proceed to Workspace Onboarding</span>
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Field 1: Enter work email */}
          <div>
            <label
              htmlFor="login-email"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '6px',
                fontFamily: 'var(--font-body)',
              }}
            >
              Enter work email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="me@example.com"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '4px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                fontSize: '0.9375rem',
                color: '#111827',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-primary)';
                e.target.style.boxShadow = '0 0 0 1px var(--color-primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#D1D5DB';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Field 2: Enter password */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                htmlFor="login-password"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Enter password
              </label>
              <a
                href="/forgot-password"
                onClick={(e) => {
                  e.preventDefault();
                  if (onNavigate) {
                    onNavigate('/forgot-password');
                  } else {
                    window.history.pushState({}, '', '/forgot-password');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
                }}
                style={{
                  fontSize: '0.875rem',
                  color: '#4B5563',
                  fontFamily: 'var(--font-body)',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.target.style.color = '#111827')}
                onMouseLeave={(e) => (e.target.style.color = '#4B5563')}
              >
                Forgot password?
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '4px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                fontSize: '0.9375rem',
                color: '#111827',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-primary)';
                e.target.style.boxShadow = '0 0 0 1px var(--color-primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#D1D5DB';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Primary Action Button: Vibrant Mint "Login →" */}
          <button
            type="submit"
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: 'var(--color-accent)', // Mint #28E99F
              color: '#000000',
              fontWeight: 700,
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-display)',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.15s ease, transform 0.15s ease',
              marginTop: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1FE092';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>Login</span>
            <ArrowRight size={17} strokeWidth={2.2} />
          </button>

          {/* Subtle Horizontal Divider: "Or sign in with" */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '8px 0',
              position: 'relative',
              textAlign: 'center',
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
            <span
              style={{
                padding: '0 12px',
                fontSize: '0.8125rem',
                color: '#6B7280',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
              }}
            >
              Or sign in with
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
          </div>

          {/* Gmail / Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              fontWeight: 600,
              fontSize: '0.875rem',
              fontFamily: 'var(--font-body)',
              borderRadius: '4px',
              border: '1px solid #D1D5DB',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F9FAFB';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#D1D5DB';
            }}
          >
            {/* Official 4-color Google G Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Đăng nhập với Google / Gmail</span>
          </button>
        </form>
      )}
    </div>
  );
};

export default LoginPage;
