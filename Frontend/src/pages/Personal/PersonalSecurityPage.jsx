import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profileService';

const resolveHasPassword = (authUser, storedProfile) => {
  if (typeof authUser?.has_password === 'boolean') return authUser.has_password;
  if (typeof authUser?.hasPassword === 'boolean') return authUser.hasPassword;
  if (typeof storedProfile?.hasPassword === 'boolean') return storedProfile.hasPassword;
  return true;
};

export const PersonalSecurityPage = () => {
  const { t } = useTranslation('portal');
  const { user } = useAuth() || {};
  const [hasPassword, setHasPassword] = useState(() =>
    resolveHasPassword(user, personalPortalService.getProfile?.())
  );
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  // Đồng bộ cờ hasPassword từ AuthContext & profile backend (/users/me)
  useEffect(() => {
    setHasPassword((prev) => {
      if (typeof user?.has_password === 'boolean') return user.has_password;
      if (typeof user?.hasPassword === 'boolean') return user.hasPassword;
      return prev;
    });
  }, [user?.has_password, user?.hasPassword]);

  // Lấy trạng thái 2FA & hồ sơ từ server khi tải trang
  useEffect(() => {
    let isMounted = true;
    const fetchSecurityMeta = async () => {
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
      try {
        const prof = await profileService.getProfile?.();
        if (isMounted && typeof prof?.hasPassword === 'boolean') {
          setHasPassword(prof.hasPassword);
        }
      } catch {}
    };
    fetchSecurityMeta();
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
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordStatus({ success: false, message: '' });

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ success: false, message: t('security.password.mismatch') });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ success: false, message: t('security.password.tooShort') });
      return;
    }

    setIsChangingPassword(true);
    try {
      await personalPortalService.changePassword({ oldPassword, newPassword });
      setPasswordStatus({ success: true, message: t('security.password.success') });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus({ success: false, message: '' }), 4000);
    } catch (err) {
      setPasswordStatus({ success: false, message: err.message || t('security.password.failed') });
    } finally {
      setIsChangingPassword(false);
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
      setSetupError(err?.message || t('security.twoFactor.errors.setupInit'));
      alert(err?.message || t('security.twoFactor.errors.setupInit'));
    } finally {
      setIsSettingUp(false);
    }
  };

  // Xác nhận mã OTP để kích hoạt 2FA
  const handleConfirm2FA = async (e) => {
    e.preventDefault();
    if (!setupOtp || setupOtp.trim().length !== 6) {
      setSetupError(t('security.twoFactor.errors.otpLength'));
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
      setSetupError(err?.message || t('security.twoFactor.errors.otpInvalid'));
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
      setDisableError(err?.message || t('security.twoFactor.errors.disableFailed'));
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
      setSessionMessage(t('security.sessions.noOtherSessions'));
      setTimeout(() => setSessionMessage(''), 3500);
      return;
    }
    const remaining = personalPortalService.revokeOtherSessions();
    setSessions(remaining);
    setSessionMessage(t('security.sessions.revokedSuccess'));
    setTimeout(() => setSessionMessage(''), 3500);
  };

  // Password strength checker
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: t('security.password.strengthEmpty'), color: '#94A3B8' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 1, label: t('security.password.strengthWeak'), color: '#EF4444' };
    if (score === 2) return { score: 2, label: t('security.password.strengthFair'), color: '#F59E0B' };
    if (score === 3) return { score: 3, label: t('security.password.strengthGood'), color: '#3B82F6' };
    return { score: 4, label: t('security.password.strengthStrong'), color: '#059669' };
  };

  const strength = getPasswordStrength(newPassword);

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const otherSessions = safeSessions.filter((s) => !s.isCurrent);
  const safeLoginHistory = Array.isArray(loginHistory) ? loginHistory : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          {t('security.title')}
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          {t('security.subtitle')}
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
      <div className="portal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                {t('security.password.title')}
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                {hasPassword ? t('security.password.subHasPassword') : t('security.password.subGoogleOAuth')}
              </p>
            </div>
          </div>

          {!hasPassword ? (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                    <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                    {t('security.password.googleTitle')}
                  </div>
                  {user?.email && (
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '1px' }}>
                      {user.email}
                    </div>
                  )}
                </div>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.55, margin: 0 }}>
                {t('security.password.googleDesc')}
              </p>
            </div>
          ) : (
            <>
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
                {t('security.password.oldLabel')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOldPass ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={t('security.password.oldPlaceholder')}
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
                {t('security.password.newLabel')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('security.password.newPlaceholder')}
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
                    <span style={{ color: '#64748B' }}>{t('security.password.strengthLabel')}</span>
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
                {t('security.password.confirmLabel')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('security.password.confirmPlaceholder')}
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
              disabled={isChangingPassword}
              style={{
                marginTop: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                opacity: isChangingPassword ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Lock size={15} />
              <span>{isChangingPassword ? t('security.password.updating') : t('security.password.submit')}</span>
            </button>
          </form>
            </>
          )}
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
                  {t('security.twoFactor.title')}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  {t('security.twoFactor.subtitle')}
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
                  {twoFactorEnabled ? t('security.twoFactor.enabledTitle') : t('security.twoFactor.disabledTitle')}
                </div>
                <div style={{ fontSize: '0.75rem', color: twoFactorEnabled ? '#15803D' : '#B91C1C', marginTop: '2px' }}>
                  {twoFactorEnabled
                    ? t('security.twoFactor.enabledDesc')
                    : t('security.twoFactor.disabledDesc')}
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
                {twoFactorEnabled ? t('security.twoFactor.badgeProtected') : t('security.twoFactor.badgeRisk')}
              </span>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              {t('security.twoFactor.info')}
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
                {t('security.twoFactor.disableBtn')}
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
                {t('security.twoFactor.enableBtn')}
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
                {t('security.sessions.title')}
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
                <span>{t('security.sessions.connectedBadge', { count: safeSessions.length })}</span>
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
              {otherSessions.length === 0
                ? t('security.sessions.singleSessionDesc')
                : t('security.sessions.multiSessionDesc')}
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
              {t('security.sessions.revokeOthersBtn', { count: otherSessions.length })}
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
                        {t('security.sessions.currentDeviceBadge')}
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
              {t('security.loginHistory.title')}
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('security.loginHistory.subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isLoadingLogins && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748B' }}>
                <Loader2 size={13} className="animate-spin" color="#059669" />
                <span>{t('security.loginHistory.syncing')}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleRefreshLoginHistory}
              disabled={isLoadingLogins}
              title={t('security.loginHistory.refreshTitle')}
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
              <span>{t('security.loginHistory.refresh')}</span>
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('security.loginHistory.colTime')}</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('security.loginHistory.colMethod')}</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('security.loginHistory.colIp')}</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('security.loginHistory.colLocation')}</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('security.loginHistory.colDevice')}</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>{t('security.loginHistory.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {safeLoginHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#94A3B8' }}>
                    {isLoadingLogins
                      ? t('security.loginHistory.loadingRow')
                      : t('security.loginHistory.emptyRow')}
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
                        {item.status === 'SUCCESS' ? t('security.loginHistory.statusSuccess') : t('security.loginHistory.statusFailed')}
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
            <span>{t('security.loginHistory.perPageLabel')}</span>
            <select
              aria-label={t('security.loginHistory.perPageAria')}
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
              {t('security.loginHistory.pageInfo', { current: loginCurrentPage, total: totalLoginPages })}
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
                {t('security.loginHistory.prev')}
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
                {t('security.loginHistory.next')}
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
            className="portal-modal-card"
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
                  {t('security.setupModal.title')}
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
              {t('security.setupModal.descPrefix')} <strong>Google Authenticator</strong> {t('security.setupModal.descOr')} <strong>Authy</strong> {t('security.setupModal.descSuffix')}
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
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  {t('security.setupModal.manualKeyLabel')}
                </div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'monospace', color: '#0F172A', letterSpacing: '1px', wordBreak: 'break-all' }}>
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
                {copiedSecret ? t('security.setupModal.copied') : t('security.setupModal.copy')}
              </button>
            </div>

            {/* Form submit OTP to confirm */}
            <form onSubmit={handleConfirm2FA}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                  {t('security.setupModal.otpLabel')}
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
                  {t('security.setupModal.cancel')}
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
                  {isSettingUp ? <Loader2 size={16} className="animate-spin" /> : t('security.setupModal.confirm')}
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
                {t('security.backupModal.title')}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                {t('security.backupModal.desc')}
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
                {copiedBackup ? t('security.backupModal.copiedAll') : t('security.backupModal.copyAll')}
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
                {t('security.backupModal.done')}
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
                {t('security.disableModal.title')}
              </h3>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              {hasPassword
                ? t('security.disableModal.descPassword')
                : t('security.disableModal.descGoogle')}
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="disable-2fa-credential"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                {hasPassword ? t('security.disableModal.labelPasswordOrOtp') : t('security.disableModal.labelOtpOnly')}
              </label>
              <input
                id="disable-2fa-credential"
                type={hasPassword ? 'password' : 'text'}
                value={disablePassword}
                onChange={(e) => {
                  setDisablePassword(e.target.value);
                  if (disableError) setDisableError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isDisabling) {
                    handleConfirmDisable2FA(e);
                  }
                }}
                placeholder={hasPassword ? t('security.disableModal.placeholderPasswordOrOtp') : t('security.disableModal.placeholderOtpOnly')}
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${disableError ? '#FCA5A5' : '#CBD5E1'}`,
                  fontSize: '0.8125rem',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
            </div>

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
                {t('security.disableModal.cancel')}
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
                {isDisabling ? <Loader2 size={16} className="animate-spin" /> : t('security.disableModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalSecurityPage;
