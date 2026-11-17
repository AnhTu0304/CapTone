import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Mail, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import Logo from '../../components/common/Logo';
import {
  AUTH_HEADING_STYLE,
  AUTH_INPUT_STYLE,
  AUTH_LABEL_STYLE,
  AUTH_PRIMARY_BTN_STYLE,
  AuthLegalFooter,
} from '../../components/auth/AuthShared';

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
      setError('Vui lòng nhập địa chỉ email công việc');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Vui lòng nhập địa chỉ email hợp lệ');
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
            Kiểm tra hộp thư của bạn
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
            Chúng tôi đã gửi liên kết đặt lại mật khẩu tới:
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
            Liên kết khôi phục có hiệu lực trong 60 phút. Nếu chưa thấy email, vui lòng kiểm tra thêm mục Thư rác (Spam).
          </p>

          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#F8FAFC',
              border: '1px dashed #CBD5E1',
              borderRadius: '6px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#64748B', marginBottom: '6px' }}>
              LIÊN KẾT MÔ PHỎNG DEMO
            </div>
            <button
              type="button"
              onClick={(e) => handleLink(e, '/reset-password')}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563EB',
                fontFamily: 'var(--font-dm-sans)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'underline',
              }}
            >
              <span>Mở liên kết đặt lại mật khẩu</span>
              <ExternalLink size={13} />
            </button>
          </div>

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
                  ? 'Đang gửi lại email...'
                  : resendCooldown > 0
                    ? `Gửi lại email sau ${resendCooldown}s`
                    : 'Chưa nhận được email? Gửi lại'}
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
            <span>Quay lại đăng nhập</span>
          </a>
        </div>
      ) : (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h1 style={AUTH_HEADING_STYLE}>
              Quên mật khẩu?
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#4B5563', fontFamily: 'var(--font-body)', margin: 0, lineHeight: 1.55 }}>
              Nhập email công việc gắn với tài khoản để nhận liên kết khôi phục mật khẩu.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <label htmlFor="forgot-email" style={AUTH_LABEL_STYLE}>
                Email công việc
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                aria-label="Email công việc"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="ten@congty.com"
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
                  <span>Đang gửi liên kết...</span>
                </>
              ) : (
                <>
                  <span>Gửi liên kết khôi phục</span>
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
                <span>Quay lại đăng nhập</span>
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
