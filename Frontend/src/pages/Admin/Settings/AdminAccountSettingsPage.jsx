import React, { useState } from 'react';
import {
  User,
  KeyRound,
  ShieldCheck,
  Smartphone,
  Laptop,
  LogOut,
  Bell,
  CheckCircle2,
    Save,
        } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

export const AdminAccountSettingsPage = () => {
  const { user } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password' | '2fa' | 'sessions' | 'notifications'

  // Tab 1: Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: user?.full_name || 'Phạm Thái Sang',
    email: user?.email || 'admin@selfheal.systems',
    phone: '0987 654 321',
    role: 'ADMIN (Quản Trị Vận Hành)',
  });

  // Tab 2: Password form state
  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Tab 3: 2FA State
  const [is2FAEnabled, setIs2FAEnabled] = useState(true);

  // Tab 4: Active Sessions
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1',
      device: 'Chrome 129 trên Windows 11',
      ip: '113.161.72.45 (TP. Hồ Chí Minh, VN)',
      isCurrent: true,
      lastActive: 'Vừa xong',
    },
    {
      id: 'sess-2',
      device: 'Safari Mobile trên iPhone 15 Pro',
      ip: '14.162.88.19 (Hà Nội, VN)',
      isCurrent: false,
      lastActive: 'Hôm qua, 18:30',
    },
    {
      id: 'sess-3',
      device: 'Edge trên MacOS Sonoma',
      ip: '118.69.12.80 (Đà Nẵng, VN)',
      isCurrent: false,
      lastActive: '3 ngày trước',
    },
  ]);

  // Tab 5: Notification Preferences
  const [notiPrefs, setNotiPrefs] = useState({
    emailNewCompany: true,
    emailSuspendedCompany: true,
    emailLockedUser: true,
    emailSecurityAlert: true,
    weeklyReportDigest: true,
  });

  const handleSaveProfile = (e) => {
    e.preventDefault();
    toastSuccess('Đã cập nhật thông tin hồ sơ quản trị viên!', 'Thành công');
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!pwdForm.currentPassword || !pwdForm.newPassword) {
      toastError('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toastError('Mật khẩu xác nhận không khớp');
      return;
    }
    toastSuccess('Mật khẩu của bạn đã được thay đổi thành công!', 'Bảo Mật An Toàn');
    setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleRevokeOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    toastSuccess('Đã đăng xuất khỏi tất cả các thiết bị và phiên làm việc khác!', 'Thu Hồi Phiên');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1100px',
        margin: '0 auto',
        paddingBottom: '40px',
      }}
    >
      {/* 1. Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
          Cài Đặt Tài Khoản Quản Trị Viên (ADMIN)
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: '6px 0 0 0' }}>
          Quản lý thông tin hồ sơ cá nhân, đổi mật khẩu, xác thực hai yếu tố và quản lý phiên đăng nhập.
        </p>
      </div>

      {/* 2. Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--dash-border)',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'profile' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'profile' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <User size={15} />
          <span>Hồ Sơ Cá Nhân</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('password')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'password' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'password' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'password' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <KeyRound size={15} />
          <span>Đổi Mật Khẩu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('2fa')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === '2fa' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === '2fa' ? '#ECFDF5' : 'transparent',
            color: activeTab === '2fa' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <ShieldCheck size={15} />
          <span>Xác Thực 2 Bước (2FA)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'sessions' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'sessions' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'sessions' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <Laptop size={15} />
          <span>Phiên Đăng Nhập ({sessions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'notifications' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'notifications' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'notifications' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <Bell size={15} />
          <span>Tùy Chọn Thông Báo</span>
        </button>
      </div>

      {/* 3. Tab Content */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          padding: '28px',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        {/* TAB 1: Profile */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
              Thông Tin Hồ Sơ Quản Trị Viên
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '6px' }}>
                Họ và Tên
              </label>
              <input
                type="text"
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--dash-border)', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '6px' }}>
                Địa chỉ Email
              </label>
              <input
                type="email"
                value={profileForm.email}
                disabled
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--dash-border)', backgroundColor: '#F8FAFC', fontSize: '0.875rem', color: 'var(--dash-text-muted)' }}
              />
              <span style={{ fontSize: '0.6875rem', color: '#059669', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> Email quản trị đã được xác minh bảo mật
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '6px' }}>
                Số điện thoại liên hệ
              </label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--dash-border)', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '6px' }}>
                Vai trò hệ thống
              </label>
              <input
                type="text"
                value={profileForm.role}
                disabled
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--dash-border)', backgroundColor: '#F8FAFC', fontSize: '0.875rem', color: '#1D4ED8', fontWeight: 700 }}
              />
            </div>

            <div>
              <button
                type="submit"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                }}
              >
                <Save size={15} />
                <span>Lưu Thay Đổi</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Change Password */}
        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '520px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
              Đổi Mật Khẩu Đăng Nhập
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)', margin: 0 }}>
              Để bảo vệ tài khoản quản trị website, mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và ký tự đặc biệt.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '6px' }}>
                Mật khẩu hiện tại
              </label>
              <input
                type="password"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                placeholder="Nhập mật khẩu đang dùng"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--dash-border)', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '6px' }}>
                Mật khẩu mới
              </label>
              <input
                type="password"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                placeholder="Nhập mật khẩu mới"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--dash-border)', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '6px' }}>
                Xác nhận mật khẩu mới
              </label>
              <input
                type="password"
                value={pwdForm.confirmPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                placeholder="Nhập lại mật khẩu mới"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--dash-border)', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <button
                type="submit"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <KeyRound size={15} />
                <span>Cập Nhật Mật Khẩu</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: 2FA */}
        {activeTab === '2fa' && (
          <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
              Xác Thực Hai Yếu Tố (Two-Factor Authentication - 2FA)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)', margin: 0 }}>
              Bổ sung thêm một lớp bảo mật quan trọng bằng ứng dụng Google Authenticator hoặc Authy khi đăng nhập vào hệ thống quản trị.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: is2FAEnabled ? '#ECFDF5' : '#F8FAFC',
                border: is2FAEnabled ? '1px solid #A7F3D0' : '1px solid var(--dash-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Smartphone size={24} color={is2FAEnabled ? '#059669' : '#64748B'} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    Ứng Dụng Xác Thực TOTP
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                    {is2FAEnabled ? 'Đã kích hoạt bảo mật cao cấp' : 'Chưa kích hoạt'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIs2FAEnabled((prev) => !prev);
                  toastSuccess(
                    !is2FAEnabled ? 'Đã bật xác thực 2 bước (2FA)!' : 'Đã tắt xác thực 2 bước',
                    'Cài Đặt Bảo Mật'
                  );
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  color: is2FAEnabled ? '#DC2626' : '#059669',
                }}
              >
                {is2FAEnabled ? 'Tắt 2FA' : 'Kích Hoạt Ngay'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Active Sessions */}
        {activeTab === 'sessions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
                  Các Phiên Đăng Nhập Của Bạn
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
                  Danh sách các thiết bị hiện đang duy trì phiên đăng nhập vào tài khoản quản trị này.
                </p>
              </div>

              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={handleRevokeOtherSessions}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={14} />
                  <span>Đăng Xuất Khỏi Các Phiên Khác</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    backgroundColor: sess.isCurrent ? '#ECFDF5' : '#F8FAFC',
                    border: sess.isCurrent ? '1px solid #A7F3D0' : '1px solid var(--dash-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Laptop size={20} color={sess.isCurrent ? '#059669' : '#64748B'} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{sess.device}</span>
                        {sess.isCurrent && (
                          <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#059669', backgroundColor: '#D1FAE5', padding: '2px 6px', borderRadius: '4px' }}>
                            Thiết bị này
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                        IP: {sess.ip} &bull; Hoạt động: {sess.lastActive}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: Notifications */}
        {activeTab === 'notifications' && (
          <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
              Tùy Chọn Nhận Thông Báo Cá Nhân
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)', margin: 0 }}>
              Cấu hình các loại thông báo gửi về hòm thư điện tử cá nhân của Quản trị viên.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={notiPrefs.emailNewCompany}
                  onChange={(e) => setNotiPrefs({ ...notiPrefs, emailNewCompany: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>Gửi email khi có Company mới đăng ký thành công</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={notiPrefs.emailSuspendedCompany}
                  onChange={(e) => setNotiPrefs({ ...notiPrefs, emailSuspendedCompany: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>Gửi email khi một Company bị tạm ngưng do vi phạm</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={notiPrefs.emailLockedUser}
                  onChange={(e) => setNotiPrefs({ ...notiPrefs, emailLockedUser: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>Gửi email khi tài khoản người dùng bị khóa bảo mật</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={notiPrefs.emailSecurityAlert}
                  onChange={(e) => setNotiPrefs({ ...notiPrefs, emailSecurityAlert: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>Cảnh báo bảo mật: Phát hiện đăng nhập IP lạ hoặc bất thường</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={notiPrefs.weeklyReportDigest}
                  onChange={(e) => setNotiPrefs({ ...notiPrefs, weeklyReportDigest: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>Báo cáo tổng hợp số liệu người dùng & công ty hàng tuần</span>
              </label>
            </div>

            <div>
              <button
                type="button"
                onClick={() => toastSuccess('Đã lưu tùy chọn thông báo cá nhân thành công!')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Save size={14} />
                <span>Lưu Tùy Chọn</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAccountSettingsPage;
