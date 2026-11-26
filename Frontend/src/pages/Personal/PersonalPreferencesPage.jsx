import React, { useState } from 'react';
import {
  Globe,
  Bell,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';

export const PersonalPreferencesPage = () => {
  const [prefs, setPrefs] = useState(() => personalPortalService.getPreferences());
  const [isSaved, setIsSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleChange = (field, value) => {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  };

  const handleNotifToggle = (key) => {
    setPrefs((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    personalPortalService.savePreferences(prefs);
    setIsSaved(true);
    setSaveMessage('Đã lưu tùy chỉnh cá nhân thành công! Cài đặt đã được áp dụng.');
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          Tùy Chỉnh Cá Nhân
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          Thiết lập ngôn ngữ hiển thị và kênh nhận thông báo cá nhân.
        </p>
      </div>

      {isSaved && (
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
          <span>{saveMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* GROUP 1: LANGUAGE */}
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
              <Globe size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                1. Ngôn Ngữ Giao Diện
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Chọn ngôn ngữ sử dụng xuyên suốt toàn bộ các menu, nút bấm, thông báo và tài liệu
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              {
                id: 'vi',
                label: 'Tiếng Việt',
                sub: 'Ngôn ngữ mặc định cho nền tảng và người dùng Việt Nam',
                flag: '🇻🇳',
              },
              {
                id: 'en',
                label: 'English (US)',
                sub: 'Global cloud operations standard terminology',
                flag: '🇺🇸',
              },
            ].map((lang) => {
              const isSelected = prefs.language === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => handleChange('language', lang.id)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #059669' : '1px solid #CBD5E1',
                    backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '1.75rem' }}>{lang.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: isSelected ? '#065F46' : '#1E293B' }}>
                      {lang.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>{lang.sub}</div>
                  </div>
                  {isSelected && (
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* GROUP 2: NOTIFICATION PREFERENCES */}
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
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                2. Tùy Chọn Thông Báo Cá Nhân
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Bật/tắt từng loại tin và kênh nhận (In-App và Email). Các luật cảnh báo CPU, RAM, Pod lỗi vẫn áp dụng theo Company Workspace.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              {
                key: 'inApp',
                title: 'Thông báo trong ứng dụng (In-App)',
                desc: 'Hiển thị badge đỏ và danh sách tại biểu tượng quả chuông trên thanh Header',
              },
              {
                key: 'email',
                title: 'Gửi thông báo qua Email',
                desc: 'Chuyển tiếp bản tin khẩn cấp tới địa chỉ email đăng ký tài khoản',
              },
              {
                key: 'companyInvites',
                title: 'Lời mời tham gia Company',
                desc: 'Nhận thông báo khi được quản trị viên mời vào tổ chức doanh nghiệp mới',
              },
              {
                key: 'roleChanges',
                title: 'Thay đổi quyền hoặc vai trò',
                desc: 'Nhận cảnh báo khi vai trò của bạn được nâng cấp (SME Owner, DevOps Lead, Viewer)',
              },
              {
                key: 'securityAlerts',
                title: 'Đăng nhập bất thường & Cảnh báo bảo mật',
                desc: 'Cảnh báo tức thì khi phát hiện đăng nhập từ IP lạ hoặc thay đổi mật khẩu/2FA',
              },
              {
                key: 'systemMaintenance',
                title: 'Thông báo hệ thống hoặc bảo trì',
                desc: 'Nhận lịch bảo trì máy chủ và phát hành phiên bản động cơ SelfAI mới',
              },
            ].map((item) => {
              const isChecked = Boolean(prefs.notifications[item.key]);

              return (
                <div
                  key={item.key}
                  onClick={() => handleNotifToggle(item.key)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '9px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: isChecked ? '#F0FDF4' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#059669',
                      marginTop: '2px',
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', lineHeight: 1.3 }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="submit"
            style={{
              padding: '11px 24px',
              borderRadius: '9px',
              backgroundColor: '#059669',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
            }}
          >
            <Save size={16} />
            <span>Lưu Tùy Chỉnh Cá Nhân</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonalPreferencesPage;
