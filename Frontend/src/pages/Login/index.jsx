import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage = ({ onNavigate }) => {
  const { login, loginWithGoogle, verify2FALogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTwoFactorStep, setIsTwoFactorStep] = useState(false);
  const [twoFactorTempToken, setTwoFactorTempToken] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Tải Google Identity Services SDK nếu chưa có
  useEffect(() => {
    if (typeof window === 'undefined' || window.google?.accounts?.id || window.google?.accounts?.oauth2) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const handleRedirect = () => {
    // Đăng nhập điều hướng chuẩn xác về Tầng Cá Nhân (/portal) cho tất cả tài khoản, kể cả Admin
    const targetPath = '/portal';
    if (onNavigate) {
      onNavigate(targetPath);
    } else {
      window.history.pushState({}, '', targetPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
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
        setError('Không thể kết nối đến máy chủ Backend (Port 5000). Vui lòng thử lại.');
      } else {
        setError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
      }
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setError('Vui lòng nhập mã xác thực OTP 6 số hoặc mã dự phòng');
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
      setError(err.message || 'Mã xác thực 2FA không chính xác hoặc đã hết hạn');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
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
          handleGoogleSignIn();
        } else if (attempts >= 15) {
          clearInterval(interval);
          setLoading(false);
          setError('Không thể kết nối dịch vụ Google. Vui lòng tắt trình chặn quảng cáo nếu có và tải lại trang.');
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
            setError('Đăng nhập Google không thành công: ' + response.error);
            return;
          }

          if (!response.access_token) {
            setLoading(false);
            setError('Không nhận được mã xác thực từ Google');
            return;
          }

          setLoading(true);
          try {
            const authFn = loginWithGoogle || login;
            await authFn(response.access_token);
            handleRedirect();
          } catch (err) {
            setError(err.message || 'Đăng nhập Google không thành công. Vui lòng thử lại.');
            setLoading(false);
          }
        },
        error_callback: (err) => {
          setLoading(false);
          if (err?.type === 'popup_closed') return;
          if (err?.type === 'popup_blocked_by_browser') {
            setError('Trình duyệt đã chặn cửa sổ đăng nhập Google. Vui lòng nhấn vào biểu tượng ổ khóa/popup trên thanh địa chỉ để cho phép popup và thử lại.');
            return;
          }
          setError(err?.message || 'Không thể mở cửa sổ Google. Vui lòng kiểm tra chặn popup trên trình duyệt.');
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      setError('Không thể khởi tạo phiên đăng nhập Google: ' + err.message);
    }
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
              Xác thực Hai Yếu Tố (2FA)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
              Nhập mã xác thực 6 số từ ứng dụng Google Authenticator hoặc mã dự phòng để hoàn tất đăng nhập.
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
              Mã OTP hoặc Mã dự phòng
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
            {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Xác Nhận Đăng Nhập</span>}
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
            <ArrowLeft size={16} /> Quay lại đăng nhập
          </button>
        </form>
      ) : (
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            Email hoặc Tên tài khoản
          </label>
          <input
            id="login-email"
            type="text"
            required
            aria-label="Enter work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="letanquoc hoặc me@example.com"
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
                fontSize: '0.8125rem',
                color: 'var(--color-primary)',
                fontWeight: 500,
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
              }}
            >
              Forgot password?
            </a>
          </div>
          <input
            id="login-password"
            type="password"
            required
            aria-label="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
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
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = 'var(--color-primary-hover, #0A0D12)';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            <>
              <span>Đăng nhập</span>
              <ArrowRight size={17} strokeWidth={2.2} />
            </>
          )}
        </button>

        {/* Divider: Or sign in with */}
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

        {/* Google OAuth Button */}
        <button
          type="button"
          disabled={loading}
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
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
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
