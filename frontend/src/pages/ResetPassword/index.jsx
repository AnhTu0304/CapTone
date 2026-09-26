import React, { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export const ResetPasswordPage = ({ onNavigate }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const [errors, setErrors] = useState({});

  // Requirements checklist
  const criteria = {
    length: password.length >= 8,
    hasNumber: /[0-9]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  const calculateStrength = () => {
    let score = 0;
    if (criteria.length) score += 1;
    if (criteria.hasNumber) score += 1;
    if (criteria.hasUpper) score += 1;
    if (criteria.hasSpecial) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#EF4444' };
    if (score === 2 || score === 3) return { score: 2, label: 'Medium', color: '#F59E0B' };
    return { score: 3, label: 'Strong', color: '#10B981' };
  };

  const strength = calculateStrength();
  const allCriteriaMet = criteria.length && criteria.hasNumber && criteria.hasUpper && criteria.hasSpecial;

  const validate = () => {
    const errs = {};
    if (!password) {
      errs.password = 'New password is required';
    } else if (!allCriteriaMet) {
      errs.password = 'Password does not meet all security requirements';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirmation password is required';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 750);
  };

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
    <div
      className="reset-password-card"
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
            <linearGradient id="rpCubeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#28E99F" />
              <stop offset="100%" stopColor="#1fd48f" />
            </linearGradient>
            <linearGradient id="rpCubeGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c788" />
              <stop offset="100%" stopColor="#28E99F" />
            </linearGradient>
            <linearGradient id="rpCubeGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1bb87c" />
              <stop offset="100%" stopColor="#148e5f" />
            </linearGradient>
          </defs>
          <g transform="translate(60, 60)">
            <path d="M 0 -48 L -42 -8 L -22 12 L 0 -8 Z" fill="url(#rpCubeGrad1)" stroke="#148e5f" strokeWidth="1" />
            <path d="M 0 -48 L 42 -8 L 22 12 L 0 -8 Z" fill="url(#rpCubeGrad2)" stroke="#148e5f" strokeWidth="1" />
            <path d="M -42 -8 L 0 34 L 0 12 L -22 -10 Z" fill="url(#rpCubeGrad2)" stroke="#148e5f" strokeWidth="1" />
            <path d="M 42 -8 L 0 34 L 0 12 L 22 -10 Z" fill="url(#rpCubeGrad3)" stroke="#148e5f" strokeWidth="1" />
            <circle cx="0" cy="-8" r="4" fill="#FFFFFF" opacity="0.9" />
          </g>
        </svg>
      </div>

      {isTokenExpired ? (
        /* ================= EXPIRED / INVALID TOKEN STATE ================= */
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#FFF1F2',
              color: '#E11D48',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={24} color="#E11D48" />
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#111827',
              letterSpacing: '-0.03em',
              marginBottom: '8px',
            }}
          >
            Reset Link Expired or Invalid
          </h2>

          <p
            style={{
              fontSize: '0.875rem',
              color: '#4B5563',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
              marginBottom: '24px',
            }}
          >
            This password recovery link has either already been used or has expired. Please request a new link to proceed.
          </p>

          <button
            type="button"
            onClick={(e) => handleLink(e, '/forgot-password')}
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-display)',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <span>Request New Reset Link</span>
            <ArrowRight size={17} />
          </button>

          <button
            type="button"
            onClick={() => setIsTokenExpired(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Switch back to active token view (Demo)
          </button>
        </div>
      ) : submitted ? (
        /* ================= SUCCESS STATE: Password Reset Successfully ================= */
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
            <CheckCircle2 size={26} color="#059669" />
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
            Password Reset Successfully
          </h2>

          <p
            style={{
              fontSize: '0.875rem',
              color: '#4B5563',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
              marginBottom: '24px',
            }}
          >
            Your password has been securely updated. You can now log into your account with your new credentials.
          </p>

          <button
            type="button"
            onClick={(e) => handleLink(e, '/login')}
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: 'var(--color-accent)',
              color: '#000000',
              fontWeight: 700,
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-display)',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>Return to Sign In</span>
            <ArrowRight size={17} strokeWidth={2.2} />
          </button>
        </div>
      ) : (
        /* ================= INITIAL FORM: Enter new password ================= */
        <div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
              Reset your password
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'var(--font-body)', margin: 0 }}>
              Create a new strong password for your SelfHeal account.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* New Password */}
            <div>
              <label
                htmlFor="new-password"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px',
                  fontFamily: 'var(--font-body)',
                }}
              >
                New password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  placeholder="••••••••••••••"
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    borderRadius: '4px',
                    border: errors.password ? '1px solid #EF4444' : '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.9375rem',
                    color: '#111827',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                  onBlur={(e) => (e.target.style.borderColor = errors.password ? '#EF4444' : '#D1D5DB')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#6B7280',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    <div style={{ flex: 1, height: '4px', backgroundColor: strength.score >= 1 ? strength.color : '#E5E7EB', borderRadius: '2px' }} />
                    <div style={{ flex: 1, height: '4px', backgroundColor: strength.score >= 2 ? strength.color : '#E5E7EB', borderRadius: '2px' }} />
                    <div style={{ flex: 1, height: '4px', backgroundColor: strength.score >= 3 ? strength.color : '#E5E7EB', borderRadius: '2px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: '#6B7280' }}>Strength:</span>
                    <span style={{ color: strength.color, fontWeight: 700 }}>{strength.label}</span>
                  </div>
                </div>
              )}

              {errors.password && (
                <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                  {errors.password}
                </span>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="confirm-new-password"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Confirm new password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }}
                  placeholder="••••••••••••••"
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    borderRadius: '4px',
                    border: errors.confirmPassword ? '1px solid #EF4444' : '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.9375rem',
                    color: '#111827',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                  onBlur={(e) => (e.target.style.borderColor = errors.confirmPassword ? '#EF4444' : '#D1D5DB')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#6B7280',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            {/* Requirements Checklist Card */}
            <div
              style={{
                padding: '14px',
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '4px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', fontFamily: 'var(--font-mono)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Password Requirements:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { met: criteria.length, text: 'At least 8 characters' },
                  { met: criteria.hasNumber, text: 'At least 1 number' },
                  { met: criteria.hasUpper, text: 'At least 1 uppercase letter' },
                  { met: criteria.hasSpecial, text: 'At least 1 special symbol (@, #, $, %...)' },
                ].map((req, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: req.met ? '#10B981' : '#E5E7EB',
                        color: req.met ? '#FFFFFF' : '#9CA3AF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </div>
                    <span style={{ color: req.met ? '#111827' : '#6B7280', fontFamily: 'var(--font-body)' }}>
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
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
                  <span>Updating password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password</span>
                  <ArrowRight size={17} strokeWidth={2.2} />
                </>
              )}
            </button>

            {/* Demo Simulation Toggle */}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsTokenExpired(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Simulate Expired/Invalid Token State (Demo)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ResetPasswordPage;
