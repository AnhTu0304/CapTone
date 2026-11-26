import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import Logo from '../../components/common/Logo';
import {
  AUTH_HEADING_STYLE,
  AUTH_INPUT_STYLE,
  AUTH_LABEL_STYLE,
  AUTH_PRIMARY_BTN_STYLE,
  AuthLegalFooter,
  GoogleAuthButton,
} from '../../components/auth/AuthShared';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';

export const RegisterPage = ({ onNavigate }) => {
  const { t } = useTranslation('auth');
  const { register, loginWithGoogle, verifyEmail, resendVerification } = useAuth();
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
  const [targetPath, setTargetPath] = useState('/portal');
  const [errors, setErrors] = useState({});

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const otpInputsRef = useRef([]);

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  useEffect(() => {
    if (!submitted || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, resendCooldown]);

  const calculatePasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '#D1D5DB' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: t('register.strength.weak'), color: '#EF4444' };
    if (score === 2 || score === 3) return { score: 2, label: t('register.strength.medium'), color: '#F59E0B' };
    return { score: 3, label: t('register.strength.strong'), color: '#10B981' };
  };

  const strength = calculatePasswordStrength(password);

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) {
      errs.fullName = t('register.validation.fullNameRequired');
    } else if (fullName.trim().length < 2) {
      errs.fullName = t('register.validation.fullNameMin');
    }

    if (!email.trim()) {
      errs.email = t('register.validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = t('register.validation.emailInvalid');
    }

    if (!password) {
      errs.password = t('register.validation.passwordRequired');
    } else if (password.length < 8) {
      errs.password = t('register.validation.passwordMin');
    } else if (strength.score < 2) {
      errs.password = t('register.validation.passwordWeak');
    }

    if (!confirmPassword) {
      errs.confirmPassword = t('register.validation.confirmRequired');
    } else if (password !== confirmPassword) {
      errs.confirmPassword = t('register.validation.confirmMismatch');
    }

    if (!agreedToTerms) {
      errs.terms = t('register.validation.termsRequired');
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
      setTargetPath('/portal');
      setOtp(['', '', '', '', '', '']);
      setOtpError('');
      setOtpSuccess(false);
      setResendStatus('');
      setResendCooldown(60);
      setSubmitted(true);
    } catch (err) {
      setErrors({ submit: err.message || t('register.errors.registerFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    setErrors({});
    const clientId =
      process.env.REACT_APP_GOOGLE_CLIENT_ID ||
      '382317913247-5abqr8bdkm6si7en6asjeckrnnfgsas3.apps.googleusercontent.com';

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
          setErrors({
            submit: t('register.errors.googleConnectFailed'),
          });
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
            setErrors({ submit: t('register.errors.googleFailedPrefix') + response.error });
            return;
          }

          if (!response.access_token) {
            setLoading(false);
            setErrors({ submit: t('register.errors.googleNoToken') });
            return;
          }

          setLoading(true);
          try {
            const authFn = loginWithGoogle || register;
            await authFn(response.access_token);
            handleLink(null, '/portal');
          } catch (err) {
            setErrors({ submit: err.message || t('register.errors.googleRetry') });
          } finally {
            setLoading(false);
          }
        },
        error_callback: (err) => {
          setLoading(false);
          if (err?.type === 'popup_closed') return;
          if (err?.type === 'popup_blocked_by_browser') {
            setErrors({
              submit: t('register.errors.googlePopupBlocked'),
            });
            return;
          }
          setErrors({ submit: err?.message || t('register.errors.googlePopupFailed') });
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      setErrors({ submit: t('register.errors.googleInitFailedPrefix') + err.message });
    }
  };

  const handleLink = (e, path) => {
    if (e && e.preventDefault) e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleOtpChange = (index, e) => {
    const rawVal = e.target.value;
    setOtpError('');
    setResendStatus('');

    const cleanDigits = rawVal.replace(/\D/g, '');
    if (cleanDigits.length > 1) {
      const newOtp = [...otp];
      const digitsArr = cleanDigits.slice(0, 6).split('');
      for (let i = 0; i < digitsArr.length; i++) {
        newOtp[i] = digitsArr[i];
      }
      setOtp(newOtp);
      const nextIdx = Math.min(digitsArr.length, 5);
      otpInputsRef.current[nextIdx]?.focus();

      if (digitsArr.length === 6) {
        handleVerifyOtp(newOtp.join(''));
      }
      return;
    }

    const char = cleanDigits.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    if (char && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    if (char && index === 5) {
      const fullCode = newOtp.join('');
      if (fullCode.length === 6) {
        handleVerifyOtp(fullCode);
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        otpInputsRef.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    setOtpError('');
    setResendStatus('');
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    const digitsArr = pasted.split('');
    for (let i = 0; i < 6; i++) {
      newOtp[i] = digitsArr[i] || '';
    }
    setOtp(newOtp);

    const nextIdx = Math.min(digitsArr.length, 5);
    otpInputsRef.current[nextIdx]?.focus();

    if (digitsArr.length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleVerifyOtp = async (codeToVerify) => {
    const fullCode = (typeof codeToVerify === 'string' ? codeToVerify : otp.join('')).trim();
    if (fullCode.length !== 6) {
      setOtpError(t('register.otp.missingSixDigits'));
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');
    try {
      if (verifyEmail) {
        await verifyEmail(fullCode);
      } else {
        await authService.verifyEmail(fullCode);
      }
      setOtpSuccess(true);
      setTimeout(() => {
        handleLink(null, targetPath);
      }, 900);
    } catch (err) {
      setOtpError(err.message || t('register.otp.invalidOtp'));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendingOtp) return;

    setResendingOtp(true);
    setOtpError('');
    setResendStatus('');

    try {
      if (resendVerification) {
        await resendVerification();
      } else {
        await authService.resendVerification();
      }
      setResendStatus(t('register.otp.resendSuccess'));
      setResendCooldown(60);
    } catch (err) {
      setResendStatus(t('register.otp.resendFallback'));
      setResendCooldown(60);
    } finally {
      setResendingOtp(false);
    }
  };

  return (
    <div className="register-card" style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
        <Logo size={46} showText={false} />
      </div>

      {!submitted && (
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={AUTH_HEADING_STYLE}>
            {t('register.title')}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#4B5563', fontFamily: 'var(--font-body)', margin: 0 }}>
            {t('register.hasAccount')}{' '}
            <a
              href="/login"
              className="auth-link"
              onClick={(e) => handleLink(e, '/login')}
              style={{ fontWeight: 500 }}
            >
              {t('register.loginLink')}
            </a>
          </p>
        </div>
      )}

      {submitted ? (
        <div
          style={{
            padding: '24px 16px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              backgroundColor: '#EFF6FF',
              border: '2px solid #DBEAFE',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <KeyRound size={26} color="#2563EB" />
          </div>

          <h2
            style={{
              ...AUTH_HEADING_STYLE,
              fontSize: '1.45rem',
            }}
          >
            {t('register.otp.title')}
          </h2>

          <p style={{ margin: '0 0 12px 0', color: '#4B5563', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {t('register.otp.sentTo')}
          </p>

          <div
            style={{
              display: 'inline-block',
              backgroundColor: '#F3F4F6',
              padding: '6px 16px',
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
            {t('register.otp.instructions')}
          </p>

          <div
            className="register-otp-grid"
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
            onPaste={handleOtpPaste}
          >
            {otp.map((digit, idx) => (
              <input
                key={idx}
                className="register-otp-input"
                ref={(el) => (otpInputsRef.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                aria-label={t('register.otp.digitAria', { index: idx + 1 })}
                style={{
                  width: '44px',
                  height: '50px',
                  textAlign: 'center',
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: '#111827',
                  backgroundColor: digit ? '#FFFFFF' : '#F9FAFB',
                  border: otpError ? '2px solid #EF4444' : digit ? '2px solid #2563EB' : '1px solid #D1D5DB',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
                  boxShadow: digit ? '0 0 0 2px rgba(37, 99, 235, 0.1)' : 'none',
                }}
              />
            ))}
          </div>

          {otpError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                fontSize: '0.84rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{otpError}</span>
            </div>
          )}

          {otpSuccess && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '0.84rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} color="#059669" />
              <span>{t('register.otp.verifiedSuccess')}</span>
            </div>
          )}

          <button
            type="button"
            disabled={otp.join('').length < 6 || verifyingOtp || otpSuccess}
            onClick={() => handleVerifyOtp()}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 20px',
              backgroundColor: otp.join('').length === 6 && !verifyingOtp && !otpSuccess ? '#111827' : '#9CA3AF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '0.875rem',
              cursor: otp.join('').length === 6 && !verifyingOtp && !otpSuccess ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.15s ease',
              marginBottom: '16px',
            }}
          >
            {verifyingOtp ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('register.otp.verifying')}</span>
              </>
            ) : otpSuccess ? (
              <>
                <Check size={16} />
                <span>{t('register.otp.verifiedBtn')}</span>
              </>
            ) : (
              <>
                <span>{t('register.otp.verifyBtn')}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div style={{ paddingTop: '12px', borderTop: '1px solid #F3F4F6', fontSize: '0.8125rem' }}>
            {resendStatus && (
              <div style={{ color: '#059669', fontWeight: 600, marginBottom: '8px' }}>{resendStatus}</div>
            )}

            {resendCooldown > 0 ? (
              <span style={{ color: '#6B7280' }}>
                {t('register.otp.resendCountdownPrefix')}<strong style={{ color: '#111827' }}>{resendCooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                disabled={resendingOtp}
                onClick={handleResendOtp}
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
                {resendingOtp ? t('register.otp.resending') : t('register.otp.resendBtn')}
              </button>
            )}
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setOtp(['', '', '', '', '', '']);
                setOtpError('');
                setResendStatus('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#6B7280',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ArrowLeft size={14} />
              <span>{t('register.otp.changeEmail')}</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errors.submit && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
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

          <div>
            <label htmlFor="register-name" style={AUTH_LABEL_STYLE}>
              {t('register.fullNameLabel')}
            </label>
            <input
              id="register-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              placeholder={t('register.fullNamePlaceholder')}
              style={{
                ...AUTH_INPUT_STYLE,
                border: errors.fullName ? '1px solid #EF4444' : '1px solid #D1D5DB',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#111827';
                e.target.style.boxShadow = '0 0 0 1px #111827';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = errors.fullName ? '#EF4444' : '#D1D5DB';
                e.target.style.boxShadow = 'none';
              }}
            />
            {errors.fullName && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.fullName}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="register-email" style={AUTH_LABEL_STYLE}>
              {t('register.emailLabel')}
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder={t('register.emailPlaceholder')}
              style={{
                ...AUTH_INPUT_STYLE,
                border: errors.email ? '1px solid #EF4444' : '1px solid #D1D5DB',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#111827';
                e.target.style.boxShadow = '0 0 0 1px #111827';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = errors.email ? '#EF4444' : '#D1D5DB';
                e.target.style.boxShadow = 'none';
              }}
            />
            {errors.email && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.email}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="register-password" style={AUTH_LABEL_STYLE}>
              {t('register.passwordLabel')}
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
                placeholder="••••••••••••"
                style={{
                  ...AUTH_INPUT_STYLE,
                  paddingRight: '40px',
                  border: errors.password ? '1px solid #EF4444' : '1px solid #D1D5DB',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#111827';
                  e.target.style.boxShadow = '0 0 0 1px #111827';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.password ? '#EF4444' : '#D1D5DB';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                aria-label={showPassword ? t('register.hidePassword') : t('register.showPassword')}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.password}
              </span>
            )}

            {password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', height: '4px', marginBottom: '4px' }}>
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      style={{
                        flex: 1,
                        backgroundColor: strength.score >= level ? strength.color : '#E5E7EB',
                        borderRadius: '2px',
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: strength.color, fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="register-confirm-password" style={AUTH_LABEL_STYLE}>
              {t('register.confirmPasswordLabel')}
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
                placeholder="••••••••••••"
                style={{
                  ...AUTH_INPUT_STYLE,
                  paddingRight: '40px',
                  border: errors.confirmPassword ? '1px solid #EF4444' : '1px solid #D1D5DB',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#111827';
                  e.target.style.boxShadow = '0 0 0 1px #111827';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.confirmPassword ? '#EF4444' : '#D1D5DB';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? t('register.hideConfirmPassword') : t('register.showConfirmPassword')}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.confirmPassword}
              </span>
            )}
          </div>

          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: '#4B5563',
                lineHeight: 1.45,
              }}
            >
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked);
                  if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                }}
                style={{
                  marginTop: '2px',
                  accentColor: '#111827',
                  cursor: 'pointer',
                }}
              />
              <span>
                {t('register.agreePrefix')}{' '}
                <a
                  href="/terms"
                  className="auth-link"
                  onClick={(e) => handleLink(e, '/terms')}
                >
                  {t('register.termsLink')}
                </a>{' '}
                {t('register.and')}{' '}
                <a
                  href="/privacy"
                  className="auth-link"
                  onClick={(e) => handleLink(e, '/privacy')}
                >
                  {t('register.privacyLink')}
                </a>
              </span>
            </label>
            {errors.terms && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.terms}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                ...AUTH_PRIMARY_BTN_STYLE,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#1BD48E';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#22E59B';
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{t('register.submitting')}</span>
                </>
              ) : (
                <>
                  <span>{t('register.submit')}</span>
                  <ArrowRight size={17} strokeWidth={2.2} />
                </>
              )}
            </button>

            <GoogleAuthButton label={t('register.googleBtn')} onClick={handleGoogleSignUp} disabled={loading} />
          </div>
        </form>
      )}

      <AuthLegalFooter onNavigate={onNavigate} />
    </div>
  );
};

export default RegisterPage;
