import React, { useState } from 'react';
import {
  KeyRound,
  Smartphone,
  Laptop,
  CheckCircle2,
  Lock,
  LogOut,
  Eye,
  EyeOff,
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
    return personalPortalService.getProfile().twoFactorEnabled ?? true;
  });

  // Active sessions state
  const [sessions, setSessions] = useState(() => personalPortalService.getActiveSessions());
  const [sessionMessage, setSessionMessage] = useState('');

  // Login history
  const [loginHistory] = useState(() => personalPortalService.getLoginHistory());

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

  // Toggle 2FA
  const handleToggle2FA = (enable) => {
    personalPortalService.toggle2FA(enable);
    setTwoFactorEnabled(enable);
  };

  // Revoke other sessions
  const handleRevokeOtherSessions = () => {
    const remaining = personalPortalService.revokeOtherSessions();
    setSessions(remaining);
    setSessionMessage('Đã đăng xuất thành công khỏi tất cả các thiết bị khác!');
    setTimeout(() => setSessionMessage(''), 3000);
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
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Các Phiên Đăng Nhập Đang Hoạt Động
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Danh sách các thiết bị và trình duyệt đang lưu phiên đăng nhập của tài khoản bạn
            </p>
          </div>

          <button
            type="button"
            onClick={handleRevokeOtherSessions}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              border: '1px solid #FCA5A5',
              fontSize: '0.78125rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogOut size={14} />
            <span>Đăng Xuất Khỏi Thiết Bị Khác</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessions.map((sess) => (
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
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Lịch Sử Đăng Nhập Gần Đây
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Ghi nhận chi tiết thời gian, địa điểm IP và trạng thái đăng nhập vào hệ thống
          </p>
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
              {loginHistory.map((item) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PersonalSecurityPage;
