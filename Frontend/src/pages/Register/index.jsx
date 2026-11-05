import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Loader2, KeyRound, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';

export const RegisterPage = ({ onNavigate }) => {
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

  // OTP Verification States
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const otpInputsRef = useRef([]);

  // Auto-focus ô nhập OTP đầu tiên khi chuyển sang màn hình OTP
  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  // Bộ đếm ngược thời gian gửi lại OTP (60s)
  useEffect(() => {
    if (!submitted || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, resendCooldown]);

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
      setTargetPath('/portal');
      setOtp(['', '', '', '', '', '']);
      setOtpError('');
      setOtpSuccess(false);
      setResendStatus('');
      setResendCooldown(60);
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

            // Đăng ký thành công điều hướng về Tầng Cá Nhân (/portal) cho mọi tài khoản kể cả Admin
            const destPath = '/portal';

            // Google OAuth tài khoản đã tự động xác thực email, điều hướng trực tiếp
            if (onNavigate) {
              onNavigate(destPath);
            } else {
              window.history.pushState({}, '', destPath);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
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
    if (e && e.preventDefault) e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Xử lý thay đổi từng ô ký tự OTP
  const handleOtpChange = (index, e) => {
    const rawVal = e.target.value;
    setOtpError('');
    setResendStatus('');

    // Xử lý nếu người dùng dán hoặc autofill chuỗi nhiều số vào 1 ô
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

    // Tự động nhảy con trỏ sang ô tiếp theo
    if (char && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    // Nếu đã đủ 6 số ở ô cuối cùng thì tự động gửi xác thực
    if (char && index === 5) {
      const fullCode = newOtp.join('');
      if (fullCode.length === 6) {
        handleVerifyOtp(fullCode);
      }
    }
  };

  // Xử lý phím Backspace và phím mũi tên trái/phải
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

  // Xử lý dán mã OTP từ clipboard (Ctrl+V)
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

  // Gửi mã OTP lên backend xác thực
  const handleVerifyOtp = async (codeToVerify) => {
    const fullCode = (typeof codeToVerify === 'string' ? codeToVerify : otp.join('')).trim();
    if (fullCode.length !== 6) {
      setOtpError('Vui lòng nhập đầy đủ 6 chữ số mã OTP');
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
      setOtpError(err.message || 'Mã xác thực không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Gửi lại mã OTP
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
      setResendStatus('Đã gửi lại mã OTP mới thành công! Vui lòng kiểm tra hộp thư.');
      setResendCooldown(60);
    } catch (err) {
      // Fallback thông báo thân thiện
      setResendStatus('Đã gửi lại mã xác thực tới email của bạn. Vui lòng kiểm tra hộp thư.');
      setResendCooldown(60);
    } finally {
      setResendingOtp(false);
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
            padding: '28px 20px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
          }}
        >
          {/* Header Icon: Key/Shield */}
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
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#111827',
              margin: '0 0 8px 0',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
            }}
          >
            Nhập mã xác thực OTP
          </h2>

          <p style={{ margin: '0 0 12px 0', color: '#4B5563', fontSize: '0.875rem', lineHeight: 1.5 }}>
            Chúng tôi đã gửi mã xác thực gồm 6 chữ số đến email:
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
            Vui lòng kiểm tra hộp thư (hoặc mục Spam) và nhập mã OTP 6 số bên dưới để kích hoạt tài khoản.
          </p>

          {/* 6 Ô nhập ký tự OTP */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '16px',
            }}
            onPaste={handleOtpPaste}
          >
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (otpInputsRef.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                aria-label={`Mã OTP số ${idx + 1}`}
                style={{
                  width: '46px',
                  height: '52px',
                  textAlign: 'center',
                  fontSize: '1.5rem',
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
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563EB';
                  e.target.style.backgroundColor = '#FFFFFF';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = otpError ? '#EF4444' : digit ? '#2563EB' : '#D1D5DB';
                  e.target.style.backgroundColor = digit ? '#FFFFFF' : '#F9FAFB';
                  e.target.style.boxShadow = digit ? '0 0 0 2px rgba(37, 99, 235, 0.1)' : 'none';
                }}
              />
            ))}
          </div>

          {/* Thông báo lỗi nếu OTP không hợp lệ */}
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

          {/* Thông báo xác thực thành công */}
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
              <span>Xác thực OTP thành công! Đang chuyển hướng...</span>
            </div>
          )}

          {/* Nút hành động chính: Xác nhận mã OTP */}
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
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              fontWeight: 700,
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
                <span>Đang xác thực OTP...</span>
              </>
            ) : otpSuccess ? (
              <>
                <Check size={16} />
                <span>Đã xác thực thành công</span>
              </>
            ) : (
              <>
                <span>Xác nhận mã OTP</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Gửi lại mã OTP và đếm ngược thời gian */}
          <div style={{ paddingTop: '12px', borderTop: '1px solid #F3F4F6', fontSize: '0.8125rem' }}>
            {resendStatus && (
              <div style={{ color: '#059669', fontWeight: 600, marginBottom: '8px' }}>
                {resendStatus}
              </div>
            )}

            {resendCooldown > 0 ? (
              <span style={{ color: '#6B7280' }}>
                Chưa nhận được mã? Gửi lại sau <strong style={{ color: '#111827' }}>{resendCooldown}s</strong>
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
                {resendingOtp ? 'Đang gửi lại mã...' : 'Chưa nhận được mã? Gửi lại mã OTP'}
              </button>
            )}
          </div>

          {/* Đổi email khác / Quay lại */}
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
              <span>Đổi địa chỉ email khác</span>
            </button>
          </div>
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
              placeholder="alex@company.com"
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

          {/* Password */}
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
                placeholder="••••••••"
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
                  transition: 'border-color 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                onBlur={(e) => (e.target.style.borderColor = errors.password ? '#EF4444' : '#D1D5DB')}
              />
              <button
                type="button"
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

            {/* Password Strength Indicator */}
            {password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', height: '4px', marginBottom: '4px' }}>
                  <div
                    style={{
                      flex: 1,
                      backgroundColor: strength.score >= 1 ? strength.color : '#E5E7EB',
                      borderRadius: '2px',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      backgroundColor: strength.score >= 2 ? strength.color : '#E5E7EB',
                      borderRadius: '2px',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      backgroundColor: strength.score >= 3 ? strength.color : '#E5E7EB',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: strength.color, fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                  {strength.label} password
                </span>
              </div>
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
                placeholder="••••••••"
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
                  transition: 'border-color 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                onBlur={(e) => (e.target.style.borderColor = errors.confirmPassword ? '#EF4444' : '#D1D5DB')}
              />
              <button
                type="button"
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

          {/* Terms Agreement Checkbox */}
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
                lineHeight: 1.4,
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
                  accentColor: 'var(--color-primary)',
                  cursor: 'pointer',
                }}
              />
              <span>
                I agree to the{' '}
                <a
                  href="/terms"
                  style={{ color: '#2563EB', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  style={{ color: '#2563EB', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  Privacy Policy
                </a>
              </span>
            </label>
            {errors.terms && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#EF4444', fontFamily: 'var(--font-body)' }}>
                {errors.terms}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#111827',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.9375rem',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: loading ? 0.7 : 1,
              marginTop: '4px',
              transition: 'background-color 0.15s ease',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Divider */}
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
