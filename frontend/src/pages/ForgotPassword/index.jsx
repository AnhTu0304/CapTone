import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Mail, Loader2, RefreshCw, ExternalLink } from 'lucide-react';

export const ForgotPasswordPage = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');

  const handleLink = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your work email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
      setResendCooldown(30);
    }, 700);
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setTimeout(() => {
      setResending(false);
      setResendCooldown(30);
    }, 600);
  };

  return (
    <div
      className="forgot-password-card"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '36px 32px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Top Center: Isometric Mint Cube Logo matching Login Page */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <svg width="52" height="52" viewBox="0 0 120 120" fill="none" aria-label="SelfHeal Cube Logo">
          <defs>
            <linearGradient id="fpCubeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#28E99F" />
              <stop offset="100%" stopColor="#1fd48f" />
            </linearGradient>
            <linearGradient id="fpCubeGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c788" />
              <stop offset="100%" stopColor="#28E99F" />
            </linearGradient>
            <linearGradient id="fpCubeGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1bb87c" />
              <stop offset="100%" stopColor="#148e5f" />
            </linearGradient>
          </defs>
          <g transform="translate(60, 60)">
            <path d="M 0 -48 L -42 -8 L -22 12 L 0 -8 Z" fill="url(#fpCubeGrad1)" stroke="#148e5f" strokeWidth="1" />
            <path d="M 0 -48 L 42 -8 L 22 12 L 0 -8 Z" fill="url(#fpCubeGrad2)" stroke="#148e5f" strokeWidth="1" />
            <path d="M -42 -8 L 0 34 L 0 12 L -22 -10 Z" fill="url(#fpCubeGrad2)" stroke="#148e5f" strokeWidth="1" />
            <path d="M 42 -8 L 0 34 L 0 12 L 22 -10 Z" fill="url(#fpCubeGrad3)" stroke="#148e5f" strokeWidth="1" />
            <circle cx="0" cy="-8" r="4" fill="#FFFFFF" opacity="0.9" />
          </g>
        </svg>
      </div>

      {sent ? (
        /* ================= SUCCESS STATE: Check your inbox ================= */
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: 'rgba(40, 233, 159, 0.15)',
              color: '#059669',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <Mail size={24} color="#059669" />
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.625rem',
              fontWeight: 800,
              color: '#111827',
              letterSpacing: '-0.03em',
              marginBottom: '8px',
            }}
          >
            Check your inbox
          </h2>

          <p
            style={{
              fontSize: '0.875rem',
              color: '#4B5563',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
              marginBottom: '16px',
            }}
          >
            We have sent a password reset link to:
          </p>

          <div
            style={{
              display: 'inline-block',
              padding: '6px 14px',
              backgroundColor: 'rgba(61, 59, 79, 0.06)',
              border: '1px solid var(--border-default)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--color-ink)',
              marginBottom: '16px',
              borderRadius: '4px',
            }}
          >
            {email}
          </div>

          <p
            style={{
              fontSize: '0.8125rem',
              color: '#6B7280',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
              marginBottom: '24px',
            }}
          >
            The reset link is valid for 60 minutes. If you don't see it in a few minutes, be sure to check your spam folder.
          </p>

          {/* Quick Simulation Link for demo / test environment */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#F8FAFC',
              border: '1px dashed #CBD5E1',
              borderRadius: '4px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#64748B', marginBottom: '6px' }}>
              DEMO SIMULATION LINK
            </div>
            <button
              type="button"
              onClick={(e) => handleLink(e, '/reset-password')}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563EB',
                fontFamily: 'var(--font-display)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'underline',
              }}
            >
              <span>Open Reset Password Link</span>
              <ExternalLink size={13} />
            </button>
          </div>

          {/* Resend button */}
          <div style={{ marginBottom: '20px' }}>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              style={{
                background: 'none',
                border: 'none',
                color: resendCooldown > 0 ? '#9CA3AF' : '#4B5563',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
              <span>
                {resending
                  ? 'Resending email...'
                  : resendCooldown > 0
                    ? `Resend email in ${resendCooldown}s`
                    : "Didn't receive the email? Resend"}
              </span>
            </button>
          </div>

          {/* Back to Sign In */}
          <a
            href="/login"
            onClick={(e) => handleLink(e, '/login')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#2563EB',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'underline',
              fontFamily: 'var(--font-body)',
            }}
          >
            <ArrowLeft size={15} />
            <span>Back to Sign In</span>
          </a>
        </div>
      ) : (
        /* ================= INITIAL STATE: Enter email form ================= */
        <div>
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
              Forgot your password?
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'var(--font-body)', margin: 0, lineHeight: 1.45 }}>
              Enter the email address associated with your account and we'll send you a password reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label
                htmlFor="forgot-email"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Work email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="me@example.com"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '4px',
                  border: error ? '1px solid #EF4444' : '1px solid #D1D5DB',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.9375rem',
                  color: '#111827',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                onBlur={(e) => (e.target.style.borderColor = error ? '#EF4444' : '#D1D5DB')}
              />
              {error && (
                <span style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                  {error}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '44px',
                backgroundColor: loading ? '#A7F3D0' : 'var(--color-accent)',
                color: '#000000',
                fontWeight: 700,
                fontSize: '0.9375rem',
                fontFamily: 'var(--font-display)',
                borderRadius: '4px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Sending reset link...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight size={17} strokeWidth={2.2} />
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <a
                href="/login"
                onClick={(e) => handleLink(e, '/login')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#4B5563',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-body)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#111827')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#4B5563')}
              >
                <ArrowLeft size={15} />
                <span>Back to Sign In</span>
              </a>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ForgotPasswordPage;
