import React, { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react';

export const RegisterPage = ({ onNavigate }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  // Password strength calculation
  const calculatePasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: 'None', color: '#D1D5DB' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#EF4444' };
    if (score === 2 || score === 3) return { score: 2, label: 'Medium', color: '#F59E0B' };
    return { score: 3, label: 'Strong', color: '#10B981' };
  };

  const strength = calculatePasswordStrength(password);

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) {
      errs.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      errs.fullName = 'Full name must be at least 2 characters';
    }

    if (!email.trim()) {
      errs.email = 'Work email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid email address';
    } else if (email.toLowerCase() === 'exists@acme.corp') {
      errs.email = 'An account with this email already exists';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    } else if (strength.score < 2) {
      errs.password = 'Password is too weak. Add numbers or uppercase letters.';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirmation password is required';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    if (!agreedToTerms) {
      errs.terms = 'You must agree to the Terms of Service and Privacy Policy';
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
    }, 800);
  };

  const handleGoogleSignUp = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
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
      className="register-card"
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
            <linearGradient id="regCubeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#28E99F" />
              <stop offset="100%" stopColor="#1fd48f" />
            </linearGradient>
            <linearGradient id="regCubeGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c788" />
              <stop offset="100%" stopColor="#28E99F" />
            </linearGradient>
            <linearGradient id="regCubeGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1bb87c" />
              <stop offset="100%" stopColor="#148e5f" />
            </linearGradient>
          </defs>
          <g transform="translate(60, 60)">
            <path d="M 0 -48 L -42 -8 L -22 12 L 0 -8 Z" fill="url(#regCubeGrad1)" stroke="#148e5f" strokeWidth="1" />
            <path d="M 0 -48 L 42 -8 L 22 12 L 0 -8 Z" fill="url(#regCubeGrad2)" stroke="#148e5f" strokeWidth="1" />
            <path d="M -42 -8 L 0 34 L 0 12 L -22 -10 Z" fill="url(#regCubeGrad2)" stroke="#148e5f" strokeWidth="1" />
            <path d="M 42 -8 L 0 34 L 0 12 L 22 -10 Z" fill="url(#regCubeGrad3)" stroke="#148e5f" strokeWidth="1" />
            <circle cx="0" cy="-8" r="4" fill="#FFFFFF" opacity="0.9" />
          </g>
        </svg>
      </div>

      {/* Heading and Supporting Text */}
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
          Create your account
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'var(--font-body)', margin: 0 }}>
          Start monitoring and protecting your infrastructure.
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
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'var(--color-accent)',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Check size={22} color="#000000" strokeWidth={2.5} />
          </div>
          <strong style={{ display: 'block', marginBottom: '6px', fontSize: '1rem', color: '#065F46' }}>
            Account Created Successfully!
          </strong>
          <p style={{ margin: '0 0 18px 0', color: '#047857' }}>
            Welcome to SelfHeal! Let's set up your Organization and connect your first Kubernetes cluster.
          </p>
          <button
            type="button"
            onClick={(e) => handleLink(e, '/onboarding/organization')}
            style={{
              width: '100%',
              padding: '12px 20px',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              border: '1px solid var(--border-strong)',
              borderRadius: '4px',
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>Proceed to Workspace Onboarding</span>
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Full Name */}
          <div>
            <label
              htmlFor="register-name"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '6px',
                fontFamily: 'var(--font-body)',
              }}
            >
              Full name
            </label>
            <input
              id="register-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              placeholder="Alex Morgan"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '4px',
                border: errors.fullName ? '1px solid #EF4444' : '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                fontSize: '0.9375rem',
                color: '#111827',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={(e) => (e.target.style.borderColor = errors.fullName ? '#EF4444' : '#D1D5DB')}
            />
            {errors.fullName && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.fullName}
              </span>
            )}
          </div>

          {/* Work Email */}
          <div>
            <label
              htmlFor="register-email"
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
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder="alex@acme.corp"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '4px',
                border: errors.email ? '1px solid #EF4444' : '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                fontSize: '0.9375rem',
                color: '#111827',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={(e) => (e.target.style.borderColor = errors.email ? '#EF4444' : '#D1D5DB')}
            />
            {errors.email && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.email}
              </span>
            )}
          </div>

          {/* Password with Strength Meter */}
          <div>
            <label
              htmlFor="register-password"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '6px',
                fontFamily: 'var(--font-body)',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="At least 8 characters"
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

            {/* Password Strength Bar */}
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

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="register-confirm-password"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '6px',
                fontFamily: 'var(--font-body)',
              }}
            >
              Confirm password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder="Re-enter password"
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

          {/* Terms & Privacy Policy Checkbox */}
          <div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked);
                  if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                }}
                style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
              <span style={{ fontSize: '0.8125rem', color: '#4B5563', fontFamily: 'var(--font-body)', lineHeight: 1.4 }}>
                I agree to the{' '}
                <a href="#terms" onClick={(e) => e.preventDefault()} style={{ color: '#2563EB', textDecoration: 'underline' }}>
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" onClick={(e) => e.preventDefault()} style={{ color: '#2563EB', textDecoration: 'underline' }}>
                  Privacy Policy
                </a>.
              </span>
            </label>
            {errors.terms && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.terms}
              </span>
            )}
          </div>

          {/* Primary Action Button: Vibrant Mint "Create Account" */}
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
              marginTop: '6px',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </>
            )}
          </button>

          {/* Divider: "Or continue with" */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '4px 0',
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
              Or
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
          </div>

          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
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
              transition: 'background-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-label="Google logo">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </form>
      )}

      {/* Switch to Sign In */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'var(--font-body)', margin: 0 }}>
          Already have an account?{' '}
          <a
            href="/login"
            onClick={(e) => handleLink(e, '/login')}
            style={{
              color: '#2563EB',
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
