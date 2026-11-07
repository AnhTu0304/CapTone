import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  Smartphone,
  Laptop,
  CheckCircle2,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';

export const PersonalSecurityPage = () => {
  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({ success: false, message: '' });

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => {
    return personalPortalService.getProfile?.()?.twoFactorEnabled ?? false;
  });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [setupOtp, setSetupOtp] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);

  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Lấy trạng thái 2FA từ server khi tải trang
  useEffect(() => {
    let isMounted = true;
    const fetch2FA = async () => {
      try {
        if (personalPortalService.get2FAStatus) {
          const status = await personalPortalService.get2FAStatus();
          if (isMounted && status && typeof status.is_enabled === 'boolean') {
            setTwoFactorEnabled(status.is_enabled);
          }
        }
      } catch (err) {
        console.warn('Lỗi lấy trạng thái 2FA:', err);
      }
    };
    fetch2FA();
    return () => { isMounted = false; };
  }, []);

  // Active sessions state
  const [sessions, setSessions] = useState(() => personalPortalService.getActiveSessions?.() || []);
  const [sessionMessage, setSessionMessage] = useState('');

  // Login history state (Real data from database audit_logs)
  const [loginHistory, setLoginHistory] = useState(() => personalPortalService.getLoginHistory?.() || []);
  const [isLoadingLogins, setIsLoadingLogins] = useState(false);
  const [loginCurrentPage, setLoginCurrentPage] = useState(1);
  const [loginPageSize, setLoginPageSize] = useState(10);
  const [loginTotalItems, setLoginTotalItems] = useState(0);

  const totalLoginPages = Math.max(1, Math.ceil(loginTotalItems / loginPageSize));

  const loadLoginHistory = useCallback(async (page = loginCurrentPage, limit = loginPageSize) => {
    setIsLoadingLogins(true);
    try {
      const history = await personalPortalService.fetchLoginHistory({ page, limit });
      if (history) {
        if (Array.isArray(history)) {
          setLoginHistory(history);
          setLoginTotalItems(typeof history.total === 'number' ? history.total : history.length);
        } else if (history.items) {
          setLoginHistory(history.items);
          setLoginTotalItems(typeof history.total === 'number' ? history.total : history.items.length);
        }
      }
    } catch (err) {
      console.warn('Lỗi tải lịch sử đăng nhập:', err);
    } finally {
      setIsLoadingLogins(false);
    }
  }, [loginCurrentPage, loginPageSize]);

  useEffect(() => {
    loadLoginHistory(loginCurrentPage, loginPageSize);
  }, [loadLoginHistory, loginCurrentPage, loginPageSize]);

  const handleRefreshLoginHistory = () => {
    loadLoginHistory(loginCurrentPage, loginPageSize);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalLoginPages && newPage !== loginCurrentPage) {
      setLoginCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize) => {
    setLoginPageSize(newSize);
    setLoginCurrentPage(1);
  };

  // Handle password submit
  const handlePasswordChange = (e) => {
    e.preventDefault();
    setPasswordStatus({ success: false, message: '' });

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ success: false, message: 'Mật khẩu xác nhận không trùng khớp!' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ success: false, message: 'Mật khẩu mới phải có ít nhất 8 ký tự!' });
      return;
    }

    try {
      personalPortalService.changePassword({ oldPassword, newPassword });
      setPasswordStatus({ success: true, message: 'Đổi mật khẩu thành công! Hãy lưu lại mật khẩu mới.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus({ success: false, message: '' }), 4000);
    } catch (err) {
      setPasswordStatus({ success: false, message: err.message || 'Lỗi khi đổi mật khẩu' });
    }
  };

  // Bắt đầu quy trình thiết lập 2FA (tạo secret & mã QR)
  const handleStartSetup2FA = async () => {
    setIsSettingUp(true);
    setSetupError('');
    try {
      if (personalPortalService.setup2FA) {
        const data = await personalPortalService.setup2FA();
        setSetupData(data);
        setShowSetupModal(true);
      } else {
        personalPortalService.toggle2FA(true);
        setTwoFactorEnabled(true);
      }
    } catch (err) {
      setSetupError(err?.message || 'Không thể khởi tạo mã QR xác thực');
      alert(err?.message || 'Không thể khởi tạo mã QR xác thực');
    } finally {
      setIsSettingUp(false);
    }
  };

  // Xác nhận mã OTP để kích hoạt 2FA
  const handleConfirm2FA = async (e) => {
    e.preventDefault();
    if (!setupOtp || setupOtp.trim().length !== 6) {
      setSetupError('Vui lòng nhập đầy đủ 6 chữ số OTP từ ứng dụng');
      return;
    }
    setIsSettingUp(true);
    setSetupError('');
    try {
      if (personalPortalService.enable2FA) {
        await personalPortalService.enable2FA(setupOtp.trim());
      } else {
        personalPortalService.toggle2FA(true);
      }
      setTwoFactorEnabled(true);
      setShowSetupModal(false);
      setBackupCodes(setupData?.backupCodes || []);
      setShowBackupModal(true);
      setSetupOtp('');
    } catch (err) {
      setSetupError(err?.message || 'Mã xác thực 2FA không chính xác hoặc đã hết hạn');
    } finally {
      setIsSettingUp(false);
    }
  };

  // Xác nhận vô hiệu hóa 2FA
  const handleConfirmDisable2FA = async (e) => {
    e.preventDefault();
    setIsDisabling(true);
    setDisableError('');
    try {
      if (personalPortalService.disable2FA) {
        await personalPortalService.disable2FA(disablePassword);
      } else {
        personalPortalService.toggle2FA(false);
      }
      setTwoFactorEnabled(false);
      setShowDisableModal(false);
      setDisablePassword('');
    } catch (err) {
      setDisableError(err?.message || 'Không thể vô hiệu hóa 2FA');
    } finally {
      setIsDisabling(false);
    }
  };

  // Toggle 2FA button handler
  const handleToggle2FA = (enable) => {
    if (enable) {
      handleStartSetup2FA();
    } else {
      setDisableError('');
      setDisablePassword('');
      setShowDisableModal(true);
    }
  };

  // Revoke other sessions
  const handleRevokeOtherSessions = () => {
    const otherSessions = sessions.filter((s) => !s.isCurrent);
    if (otherSessions.length === 0) {
      setSessionMessage('Tài khoản của bạn chỉ đang đăng nhập duy nhất trên thiết bị này, không có phiên đăng nhập lạ nào khác.');
      setTimeout(() => setSessionMessage(''), 3500);
      return;
    }
    const remaining = personalPortalService.revokeOtherSessions();
    setSessions(remaining);
    setSessionMessage('Đã đăng xuất thành công khỏi tất cả các thiết bị khác!');
    setTimeout(() => setSessionMessage(''), 3500);
  };

  // Password strength checker
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: 'Trống', color: '#94A3B8' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 1, label: 'Yếu', color: '#EF4444' };
    if (score === 2) return { score: 2, label: 'Trung bình', color: '#F59E0B' };
    if (score === 3) return { score: 3, label: 'Khá', color: '#3B82F6' };
    return { score: 4, label: 'Mạnh (Tốt nhất)', color: '#059669' };
  };

  const strength = getPasswordStrength(newPassword);

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const otherSessions = safeSessions.filter((s) => !s.isCurrent);
  const safeLoginHistory = Array.isArray(loginHistory) ? loginHistory : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          Security — Bảo Mật Tài Khoản
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          Thiết lập mật khẩu mạnh, kích hoạt xác thực hai yếu tố và quản lý các phiên đăng nhập đang hoạt động.
        </p>
      </div>

      {sessionMessage && (
        <div
          style={{
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>{sessionMessage}</span>
        </div>
      )}

      {/* Grid: Change Password & 2FA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* SECTION 1: CHANGE PASSWORD */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KeyRound size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Đổi Mật Khẩu Đăng Nhập
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Khuyến nghị đổi mật khẩu tối thiểu 90 ngày một lần
              </p>
            </div>
          </div>

          {passwordStatus.message && (
            <div
              style={{
                backgroundColor: passwordStatus.success ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${passwordStatus.success ? '#A7F3D0' : '#FCA5A5'}`,
                color: passwordStatus.success ? '#065F46' : '#DC2626',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              {passwordStatus.message}
            </div>
          )}

          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Old Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Mật Khẩu Hiện Tại *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOldPass ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Nhập mật khẩu cũ của bạn"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowOldPass(!showOldPass)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                  }}
                >
                  {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Mật Khẩu Mới (Tối thiểu 8 ký tự) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới an toàn"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                  }}
                >
                  {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength bar */}
              {newPassword && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', marginBottom: '3px' }}>
                    <span style={{ color: '#64748B' }}>Độ mạnh mật khẩu:</span>
                    <strong style={{ color: strength.color }}>{strength.label}</strong>
                  </div>
                  <div style={{ height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(strength.score / 4) * 100}%`,
                        backgroundColor: strength.color,
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Xác Nhận Mật Khẩu Mới *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                marginTop: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Lock size={15} />
              <span>Cập Nhật Mật Khẩu</span>
            </button>
          </form>
        </div>

        {/* SECTION 2: TWO-FACTOR AUTHENTICATION (2FA) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Smartphone size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Xác Thực Hai Yếu Tố (2FA)
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  Bảo vệ tài khoản qua ứng dụng Google Authenticator hoặc OTP
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: twoFactorEnabled ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${twoFactorEnabled ? '#BBF7D0' : '#FECACA'}`,
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: twoFactorEnabled ? '#166534' : '#991B1B' }}>
                  {twoFactorEnabled ? '2FA Đang Được Bật' : '2FA Đang Bị Tắt'}
                </div>
                <div style={{ fontSize: '0.75rem', color: twoFactorEnabled ? '#15803D' : '#B91C1C', marginTop: '2px' }}>
                  {twoFactorEnabled
                    ? 'Mỗi lần đăng nhập đều yêu cầu mã xác thực OTP 6 số'
                    : 'Tài khoản chưa có lớp bảo vệ thứ 2, có nguy cơ bị xâm nhập'}
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: twoFactorEnabled ? '#059669' : '#DC2626',
                  color: '#FFFFFF',
                }}
              >
                {twoFactorEnabled ? 'BẢO VỆ TỐI ĐA' : 'NGUY HIỂM'}
              </span>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              Khi kích hoạt 2FA, bên cạnh mật khẩu bạn sẽ cần nhập thêm mã số từ ứng dụng xác thực trên điện thoại (Google Authenticator, Microsoft Authenticator hoặc Authy).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {twoFactorEnabled ? (
              <button
                type="button"
                onClick={() => handleToggle2FA(false)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  border: '1px solid #FCA5A5',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Vô Hiệu Hóa 2FA
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggle2FA(true)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Kích Hoạt 2FA Ngay
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: ACTIVE SESSIONS */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Các Phiên Đăng Nhập Đang Hoạt Động
              </h3>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
                  border: '1px solid #A7F3D0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheck size={12} />
                <span>{safeSessions.length} phiên đang kết nối</span>
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
              {otherSessions.length === 0
                ? 'Bảo vệ an toàn: Tài khoản hiện chỉ duy trì 1 phiên đăng nhập duy nhất từ thiết bị bạn đang sử dụng.'
                : 'Danh sách các thiết bị và trình duyệt đang lưu phiên đăng nhập của tài khoản bạn.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRevokeOtherSessions}
            disabled={otherSessions.length === 0}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: otherSessions.length === 0 ? '#F8FAFC' : '#FEF2F2',
              color: otherSessions.length === 0 ? '#94A3B8' : '#DC2626',
              border: `1px solid ${otherSessions.length === 0 ? '#E2E8F0' : '#FCA5A5'}`,
              fontSize: '0.78125rem',
              fontWeight: 700,
              cursor: otherSessions.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogOut size={14} />
            <span>
              Đăng Xuất Khỏi Thiết Bị Khác ({otherSessions.length})
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {safeSessions.map((sess) => (
            <div
              key={sess.id}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: '9px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: sess.isCurrent ? '#F0FDF4' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: sess.deviceType === 'MOBILE' ? '#EFF6FF' : '#F1F5F9',
                    color: sess.deviceType === 'MOBILE' ? '#2563EB' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {sess.deviceType === 'MOBILE' ? <Smartphone size={18} /> : <Laptop size={18} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                      {sess.deviceName}
                    </span>
                    {sess.isCurrent && (
                      <span
                        data-testid="current-device-badge"
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '9999px',
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                        }}
                      >
                        Thiết bị này
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                    IP: {sess.ipAddress} • {sess.lastActive}
                  </div>
                </div>
              </div>

              <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono, monospace)' }}>
                {sess.browser}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: LOGIN HISTORY */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Lịch Sử Đăng Nhập Gần Đây
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Ghi nhận chi tiết thời gian, địa chỉ IP và trạng thái đăng nhập từ cơ sở dữ liệu kiểm toán hệ thống
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isLoadingLogins && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748B' }}>
                <Loader2 size={13} className="animate-spin" color="#059669" />
                <span>Đang đồng bộ...</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleRefreshLoginHistory}
              disabled={isLoadingLogins}
              title="Làm mới lịch sử từ cơ sở dữ liệu"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                color: '#334155',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: isLoadingLogins ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={13} className={isLoadingLogins ? 'animate-spin' : ''} />
              <span>Làm Mới</span>
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Thời Gian</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Phương Thức</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Địa Chỉ IP</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Vị Trí Ước Tính</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Thiết Bị</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {safeLoginHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#94A3B8' }}>
                    {isLoadingLogins
                      ? 'Đang đồng bộ lịch sử đăng nhập từ cơ sở dữ liệu...'
                      : 'Chưa có bản ghi lịch sử đăng nhập nào được ghi nhận.'}
                  </td>
                </tr>
              ) : (
                safeLoginHistory.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F172A' }}>{item.timestamp}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{item.method}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono, monospace)', color: '#0F172A' }}>
                      {item.ipAddress}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748B' }}>{item.location}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{item.device}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: item.status === 'SUCCESS' ? '#ECFDF5' : '#FEF2F2',
                          color: item.status === 'SUCCESS' ? '#059669' : '#DC2626',
                        }}
                      >
                        {item.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Thanh Phân Trang (Pagination) chuẩn giao diện */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '14px',
            borderTop: '1px solid #F1F5F9',
            fontSize: '0.8125rem',
            color: '#334155',
          }}
        >
          {/* Cụm trái: Hiển thị mỗi trang */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Hiển thị mỗi trang:</span>
            <select
              aria-label="Hiển thị mỗi trang"
              value={loginPageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '0.8125rem',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Cụm phải: Số trang và nút Trước / Sau */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>
              Trang {loginCurrentPage} trên tổng {totalLoginPages}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handlePageChange(loginCurrentPage - 1)}
                disabled={loginCurrentPage <= 1 || isLoadingLogins}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: loginCurrentPage <= 1 || isLoadingLogins ? '#94A3B8' : '#0F172A',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: loginCurrentPage <= 1 || isLoadingLogins ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                &lsaquo; Trước
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(loginCurrentPage + 1)}
                disabled={loginCurrentPage >= totalLoginPages || isLoadingLogins}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: loginCurrentPage >= totalLoginPages || isLoadingLogins ? '#94A3B8' : '#0F172A',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: loginCurrentPage >= totalLoginPages || isLoadingLogins ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                Sau &rsaquo;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: SETUP 2FA */}
      {showSetupModal && setupData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Kích Hoạt Xác Thực 2FA
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Mở ứng dụng <strong>Google Authenticator</strong> hoặc <strong>Authy</strong> trên điện thoại, quét mã QR dưới đây để thêm tài khoản:
            </p>

            {/* QR Code Container */}
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              {setupData.qrCodeDataUrl ? (
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="2FA QR Code"
                  style={{
                    width: '180px',
                    height: '180px',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    padding: '8px',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  }}
                />
              ) : null}
            </div>

            {/* Manual Secret Key */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Khóa thiết lập thủ công
                </div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'monospace', color: '#0F172A', letterSpacing: '1px' }}>
                  {setupData.secret}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(setupData.secret);
                  setCopiedSecret(true);
                  setTimeout(() => setCopiedSecret(false), 2000);
                }}
                style={{
                  backgroundColor: copiedSecret ? '#ECFDF5' : '#FFFFFF',
                  border: `1px solid ${copiedSecret ? '#A7F3D0' : '#CBD5E1'}`,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: copiedSecret ? '#059669' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
                {copiedSecret ? 'Đã chép' : 'Sao chép'}
              </button>
            </div>

            {/* Form submit OTP to confirm */}
            <form onSubmit={handleConfirm2FA}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                  Nhập mã 6 số từ ứng dụng xác thực
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={setupOtp}
                  onChange={(e) => setSetupOtp(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '1.25rem',
                    letterSpacing: '4px',
                    fontWeight: 700,
                    textAlign: 'center',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {setupError && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    fontSize: '0.75rem',
                    marginBottom: '16px',
                  }}
                >
                  {setupError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#F1F5F9',
                    border: 'none',
                    color: '#475569',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSettingUp || setupOtp.length !== 6}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#059669',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: isSettingUp || setupOtp.length !== 6 ? 'not-allowed' : 'pointer',
                    opacity: isSettingUp || setupOtp.length !== 6 ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {isSettingUp ? <Loader2 size={16} className="animate-spin" /> : 'Xác Nhận & Kích Hoạt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BACKUP CODES */}
      {showBackupModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
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
                <CheckCircle2 size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                Kích Hoạt 2FA Thành Công!
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Hãy lưu lại 8 mã dự phòng dưới đây. Mỗi mã có thể dùng 1 lần để đăng nhập khi bạn không mang theo điện thoại.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '16px',
              }}
            >
              {backupCodes.map((code, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: '#0F172A',
                    letterSpacing: '1px',
                  }}
                >
                  {code}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'));
                  setCopiedBackup(true);
                  setTimeout(() => setCopiedBackup(false), 2000);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: copiedBackup ? '#ECFDF5' : '#F1F5F9',
                  border: `1px solid ${copiedBackup ? '#A7F3D0' : '#E2E8F0'}`,
                  color: copiedBackup ? '#059669' : '#0F172A',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {copiedBackup ? <Check size={16} /> : <Copy size={16} />}
                {copiedBackup ? 'Đã sao chép tất cả' : 'Sao chép 8 mã'}
              </button>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Đã Lưu & Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DISABLE 2FA CONFIRMATION */}
      {showDisableModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Vô Hiệu Hóa 2FA
              </h3>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Bạn có chắc chắn muốn tắt Xác thực 2 Yếu tố? Tài khoản của bạn sẽ chỉ được bảo vệ bởi mật khẩu thông thường.
            </p>

            {disableError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  fontSize: '0.75rem',
                  marginBottom: '16px',
                }}
              >
                {disableError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDisableModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: '#F1F5F9',
                  border: 'none',
                  color: '#475569',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDisable2FA}
                disabled={isDisabling}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: isDisabling ? 'not-allowed' : 'pointer',
                  opacity: isDisabling ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {isDisabling ? <Loader2 size={16} className="animate-spin" /> : 'Xác Nhận Tắt 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalSecurityPage;
