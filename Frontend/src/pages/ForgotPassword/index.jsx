import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Mail, Loader2, RefreshCw } from 'lucide-react';
import Logo from '../../components/common/Logo';
import authService from '../../services/authService';
import {
  AUTH_HEADING_STYLE,
  AUTH_INPUT_STYLE,
  AUTH_LABEL_STYLE,
  AUTH_PRIMARY_BTN_STYLE,
  AuthLegalFooter,
} from '../../components/auth/AuthShared';

export const ForgotPasswordPage = ({ onNavigate }) => {
  const { t } = useTranslation('auth');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('forgotPassword.errors.emailRequired'));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('forgotPassword.errors.emailInvalid'));
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
      setResendCooldown(30);
    } catch (err) {
      setError(err?.message || t('forgotPassword.errors.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email.trim()) return;
    setResending(true);
    setError('');
    try {
      await authService.forgotPassword(email.trim());
      setResendCooldown(30);
    } catch (err) {
      setError(err?.message || t('forgotPassword.errors.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="forgot-password-card" style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
        <Logo size={46} showText={false} />
      </div>

      {sent ? (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: 'rgba(34, 229, 155, 0.16)',
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
              ...AUTH_HEADING_STYLE,
              fontSize: '1.65rem',
            }}
          >
            {t('forgotPassword.sent.title')}
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
            {t('forgotPassword.sent.sentTo')}
          </p>

          <div
            style={{
              display: 'inline-block',
              padding: '6px 14px',
              backgroundColor: '#F3F4F6',
              border: '1px solid #E5E7EB',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: '#111827',
              marginBottom: '16px',
              borderRadius: '6px',
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
            {t('forgotPassword.sent.note')}
          </p>

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
                  ? t('forgotPassword.sent.resending')
                  : resendCooldown > 0
                    ? t('forgotPassword.sent.resendIn', { seconds: resendCooldown })
                    : t('forgotPassword.sent.resendBtn')}
              </span>
            </button>
          </div>

          <a
            href="/login"
            className="auth-link"
            onClick={(e) => handleLink(e, '/login')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500,
              fontSize: '0.875rem',
              fontFamily: 'var(--font-body)',
            }}
          >
            <ArrowLeft size={15} />
            <span>{t('forgotPassword.backToLogin')}</span>
          </a>
        </div>
      ) : (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h1 style={AUTH_HEADING_STYLE}>
              {t('forgotPassword.title')}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#4B5563', fontFamily: 'var(--font-body)', margin: 0, lineHeight: 1.55 }}>
              {t('forgotPassword.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <label htmlFor="forgot-email" style={AUTH_LABEL_STYLE}>
                {t('forgotPassword.emailLabel')}
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                aria-label={t('forgotPassword.emailLabel')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder={t('forgotPassword.emailPlaceholder')}
                style={{
                  ...AUTH_INPUT_STYLE,
                  border: error ? '1px solid #EF4444' : '1px solid #D1D5DB',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#111827';
                  e.target.style.boxShadow = '0 0 0 1px #111827';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? '#EF4444' : '#D1D5DB';
                  e.target.style.boxShadow = 'none';
                }}
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
                ...AUTH_PRIMARY_BTN_STYLE,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                marginTop: '4px',
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
                  <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>{t('forgotPassword.submitting')}</span>
                </>
              ) : (
                <>
                  <span>{t('forgotPassword.submit')}</span>
                  <ArrowRight size={17} strokeWidth={2.2} />
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <a
                href="/login"
                className="auth-link-muted"
                onClick={(e) => handleLink(e, '/login')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <ArrowLeft size={15} />
                <span>{t('forgotPassword.backToLogin')}</span>
              </a>
            </div>
          </form>
        </div>
      )}

      <AuthLegalFooter onNavigate={onNavigate} />
    </div>
  );
};

export default ForgotPasswordPage;
