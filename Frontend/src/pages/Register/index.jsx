import React, { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const RegisterPage = ({ onNavigate }) => {
  const { register, loginWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [regType, setRegType] = useState('form');
  const [targetPath, setTargetPath] = useState('/onboarding/organization');
  const [resendStatus, setResendStatus] = useState('');
  const [resending, setResending] = useState(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      await register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
      setRegisteredEmail(email.trim());
      setRegType('form');
      setTargetPath('/onboarding/organization');
      setSubmitted(true);
    } catch (err) {
      setErrors({ submit: err.message || 'Đăng ký tài khoản không thành công. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    setErrors({});
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '802339246705-ulhj3r1h5e2fk5mlvns21je14q722cva.apps.googleusercontent.com';

    // Đảm bảo truy cập bằng localhost thay vì 127.0.0.1 (Google OAuth console chỉ cấp phép http://localhost:3000)
    if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
      window.location.hostname = 'localhost';
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setLoading(true);
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          setLoading(false);
          handleGoogleSignUp();
        } else if (attempts >= 15) {
          clearInterval(interval);
          setLoading(false);
          setErrors({ submit: 'Không thể kết nối dịch vụ Google. Vui lòng tắt trình chặn quảng cáo nếu có và tải lại trang.' });
        }
      }, 200);
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        callback: async (response) => {
          if (response.error) {
            setLoading(false);
            setErrors({ submit: 'Đăng ký Google không thành công: ' + response.error });
            return;
          }

          if (!response.access_token) {
            setLoading(false);
            setErrors({ submit: 'Không nhận được mã xác thực từ Google' });
            return;
          }

          setLoading(true);
          try {
            const authFn = loginWithGoogle || register;
            const user = await authFn(response.access_token);

            // Kiểm tra điều hướng: admin -> /admin, đã có org -> /dashboard, chưa có org -> /onboarding/organization
            const rawSysRoles = (user?.system_roles || []).map((r) =>
              typeof r === 'object' && r !== null ? r.name || r.role_name : r
            ).map((r) => String(r).toUpperCase());

            const isPlatformAdmin =
              rawSysRoles.includes('SUPER_ADMIN') ||
              rawSysRoles.includes('ADMIN') ||
              rawSysRoles.includes('SYSTEM_ADMIN');

            let destPath = '/dashboard';
            if (isPlatformAdmin) {
              destPath = '/admin';
            } else {
              const orgRoles = user?.organization_roles || [];
              const hasOrg = Boolean(user?.has_organization || orgRoles.length > 0 || user?.organization || user?.organization_id);
              if (!hasOrg) {
                destPath = '/onboarding/organization';
              }
            }

            setRegisteredEmail(user?.email || email.trim() || 'tài khoản Gmail của bạn');
            setRegType('google');
            setTargetPath(destPath);
            setSubmitted(true);
          } catch (err) {
            setErrors({ submit: err.message || 'Đăng ký Google không thành công. Vui lòng thử lại.' });
          } finally {
            setLoading(false);
          }
        },
        error_callback: (err) => {
          setLoading(false);
          if (err?.type === 'popup_closed') return;
          if (err?.type === 'popup_blocked_by_browser') {
            setErrors({ submit: 'Trình duyệt đã chặn cửa sổ đăng nhập Google. Vui lòng nhấn vào biểu tượng ổ khóa/popup trên thanh địa chỉ để cho phép popup và thử lại.' });
            return;
          }
          setErrors({ submit: err?.message || 'Không thể mở cửa sổ Google. Vui lòng kiểm tra chặn popup trên trình duyệt.' });
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      setErrors({ submit: 'Không thể khởi tạo phiên đăng ký Google: ' + err.message });
    }
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
            borderRadius: '6px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
          }}
        >
          {/* Email / Gmail Header Icon */}
          <div
            style={{
              width: '52px',
              height: '52px',
              backgroundColor: '#FEF2F2',
              border: '2px solid #FEE2E2',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#EA4335">
              <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
            </svg>
          </div>

          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#111827',
              margin: '0 0 8px 0',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
            }}
          >
            Kiểm tra hộp thư Gmail của bạn
          </h2>

          <p style={{ margin: '0 0 12px 0', color: '#4B5563', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {regType === 'google'
              ? 'Tài khoản của bạn đã được liên kết với Google. Email chào mừng và thông báo kích hoạt đã được gửi tới:'
              : 'Chúng tôi đã gửi email xác thực tài khoản kèm mã kích hoạt tới:'}
          </p>

          <div
            style={{
              display: 'inline-block',
              backgroundColor: '#F3F4F6',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: '#1F2937',
              marginBottom: '16px',
              border: '1px solid #E5E7EB',
              wordBreak: 'break-all',
            }}
          >
            {registeredEmail}
          </div>

          <p style={{ margin: '0 0 20px 0', color: '#6B7280', fontSize: '0.8125rem', lineHeight: 1.4 }}>
            Vui lòng mở ứng dụng hoặc trang web Gmail để kiểm tra hộp thư đến (Inbox) hoặc mục Thư rác (Spam).
          </p>

          {/* Primary Action: Open Gmail */}
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 20px',
              backgroundColor: '#EA4335',
              color: '#FFFFFF',
              borderRadius: '6px',
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(234, 67, 53, 0.25)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
            </svg>
            <span>Mở Gmail ngay</span>
          </a>

          {/* Secondary Action: Continue to Onboarding */}
          <button
            type="button"
            onClick={(e) => handleLink(e, targetPath)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 20px',
              backgroundColor: '#111827',
              color: '#FFFFFF',
              border: '1px solid #111827',
              borderRadius: '6px',
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
            <span>Tiếp tục thiết lập Onboarding</span>
            <ArrowRight size={16} />
          </button>

          {/* Optional Resend Verification for Form Registration */}
          {regType === 'form' && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F3F4F6' }}>
              {resendStatus ? (
                <div style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 600 }}>
                  {resendStatus}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={resending}
                  onClick={async () => {
                    setResending(true);
                    try {
                      await new Promise((resolve) => setTimeout(resolve, 300));
                      setResendStatus('Đã gửi lại email xác thực thành công! Vui lòng kiểm tra hộp thư.');
                    } catch {
                      setResendStatus('Không thể gửi lại email lúc này. Vui lòng thử lại sau.');
                    } finally {
                      setResending(false);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563EB',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {resending ? 'Đang gửi lại...' : 'Chưa nhận được email? Gửi lại email xác thực'}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errors.submit && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '4px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                fontSize: '0.875rem',
                lineHeight: 1.4,
              }}
            >
              {errors.submit}
            </div>
          )}
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
            disabled={loading}
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
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
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
