import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
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
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      await login({ email: email.trim(), password });
      handleRedirect();
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
    const clientId =
      process.env.REACT_APP_GOOGLE_CLIENT_ID ||
      '802339246705-ulhj3r1h5e2fk5mlvns21je14q722cva.apps.googleusercontent.com';

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
            setError(
              'Trình duyệt đã chặn cửa sổ đăng nhập Google. Vui lòng nhấn vào biểu tượng ổ khóa trên thanh địa chỉ để cho phép popup và thử lại.'
            );
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
    <div className="login-card" style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
        <Logo size={46} showText={false} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h1 style={AUTH_HEADING_STYLE}>
          Đăng nhập tài khoản
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#4B5563', fontFamily: 'var(--font-body)', margin: 0 }}>
          Chưa có tài khoản?{' '}
          <a
            href="/register"
            className="auth-link"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('/register');
            }}
            style={{ fontWeight: 500 }}
          >
            Đăng ký
          </a>
        </p>
      </div>
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
            Email công việc hoặc Tên tài khoản
          </label>
          <input
            id="login-email"
            type="text"
            required
            aria-label="Email công việc hoặc Tên tài khoản"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten@congty.com"
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
              Mật khẩu
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
              Quên mật khẩu?
            </a>
          </div>
          <input
            id="login-password"
            type="password"
            required
            aria-label="Mật khẩu"
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
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              <>
                <span>Đăng nhập</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </>
            )}
          </button>

          <GoogleAuthButton label="Đăng nhập với Google" onClick={handleGoogleSignIn} disabled={loading} />
        </div>
      </form>

      <AuthLegalFooter onNavigate={onNavigate} />
    </div>
  );
};

export default LoginPage;
