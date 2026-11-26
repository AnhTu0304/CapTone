import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
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

export const LoginPage = ({ onNavigate }) => {
  const { t } = useTranslation('auth');
  const { login, loginWithGoogle, verify2FALogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTwoFactorStep, setIsTwoFactorStep] = useState(false);
  const [twoFactorTempToken, setTwoFactorTempToken] = useState('');
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || window.google?.accounts?.id || window.google?.accounts?.oauth2) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const navigateTo = (path) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleRedirect = () => {
    navigateTo('/portal');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginRes = await login({ email: email.trim(), password });
      if (loginRes?.require_2fa) {
        setTwoFactorTempToken(loginRes.temp_token);
        setIsTwoFactorStep(true);
        setLoading(false);
        return;
      }
      handleRedirect();
    } catch (err) {
      if (err.message === 'Failed to fetch' || err.message?.toLowerCase().includes('fetch')) {
        setError(t('login.errors.backendUnreachable'));
      } else {
        setError(err.message || t('login.errors.loginFailed'));
      }
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setError(t('login.twoFactor.missingOtp'));
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (verify2FALogin) {
        await verify2FALogin(twoFactorTempToken, otpCode.trim());
      }
      handleRedirect();
    } catch (err) {
      setError(err.message || t('login.twoFactor.invalidOtp'));
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
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
          handleGoogleSignIn();
        } else if (attempts >= 15) {
          clearInterval(interval);
          setLoading(false);
          setError(t('login.errors.googleConnectFailed'));
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
            setError(t('login.errors.googleFailedPrefix') + response.error);
            return;
          }

          if (!response.access_token) {
            setLoading(false);
            setError(t('login.errors.googleNoToken'));
            return;
          }

          setLoading(true);
          try {
            const authFn = loginWithGoogle || login;
            await authFn(response.access_token);
            handleRedirect();
          } catch (err) {
            setError(err.message || t('login.errors.googleRetry'));
            setLoading(false);
          }
        },
        error_callback: (err) => {
          setLoading(false);
          if (err?.type === 'popup_closed') return;
          if (err?.type === 'popup_blocked_by_browser') {
            setError(t('login.errors.googlePopupBlocked'));
            return;
          }
          setError(err?.message || t('login.errors.googlePopupFailed'));
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      setError(t('login.errors.googleInitFailedPrefix') + err.message);
    }
  };

  return (
    <div className="login-card" style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
        <Logo size={46} showText={false} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h1 style={AUTH_HEADING_STYLE}>
          {t('login.title')}
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#4B5563', fontFamily: 'var(--font-body)', margin: 0 }}>
          {t('login.noAccount')}{' '}
          <a
            href="/register"
            className="auth-link"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('/register');
            }}
            style={{ fontWeight: 500 }}
          >
            {t('login.registerLink')}
          </a>
        </p>
      </div>

      {isTwoFactorStep ? (
        <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto',
              }}
            >
              <ShieldCheck size={26} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
              {t('login.twoFactor.heading')}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
              {t('login.twoFactor.subtitle')}
            </p>
          </div>

          {error && (
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
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-2fa-otp"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
                textAlign: 'center',
              }}
            >
              {t('login.twoFactor.otpLabel')}
            </label>
            <input
              id="login-2fa-otp"
              type="text"
              autoFocus
              required
              maxLength={8}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\s+/g, ''))}
              placeholder="123456"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                fontSize: '1.25rem',
                letterSpacing: '3px',
                textAlign: 'center',
                fontWeight: 700,
                color: '#111827',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '4px',
              backgroundColor: 'var(--color-primary, #000000)',
              color: '#FFFFFF',
              fontSize: '0.9375rem',
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <span>{t('login.twoFactor.submit')}</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsTwoFactorStep(false);
              setOtpCode('');
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px',
            }}
          >
            <ArrowLeft size={16} /> {t('login.twoFactor.backToLogin')}
          </button>
        </form>
      ) : (
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {error && (
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
            {error}
          </div>
        )}

        <div>
          <label htmlFor="login-email" style={AUTH_LABEL_STYLE}>
            {t('login.emailLabel')}
          </label>
          <input
            id="login-email"
            type="text"
            required
            aria-label={t('login.emailLabel')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('login.emailPlaceholder')}
            style={AUTH_INPUT_STYLE}
            onFocus={(e) => {
              e.target.style.borderColor = '#111827';
              e.target.style.boxShadow = '0 0 0 1px #111827';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#D1D5DB';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label htmlFor="login-password" style={{ ...AUTH_LABEL_STYLE, marginBottom: 0 }}>
              {t('login.passwordLabel')}
            </label>
            <a
              href="/forgot-password"
              className="auth-link-subtle"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/forgot-password');
              }}
              style={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
              }}
            >
              {t('login.forgotPassword')}
            </a>
          </div>
          <input
            id="login-password"
            type="password"
            required
            aria-label={t('login.passwordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            style={AUTH_INPUT_STYLE}
            onFocus={(e) => {
              e.target.style.borderColor = '#111827';
              e.target.style.boxShadow = '0 0 0 1px #111827';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#D1D5DB';
              e.target.style.boxShadow = 'none';
            }}
          />
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
                <span>{t('login.submitting')}</span>
              </>
            ) : (
              <>
                <span>{t('login.submit')}</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </>
            )}
          </button>

          <GoogleAuthButton label={t('login.googleBtn')} onClick={handleGoogleSignIn} disabled={loading} />
        </div>
      </form>
      )}

      <AuthLegalFooter onNavigate={onNavigate} />
    </div>
  );
};

export default LoginPage;
