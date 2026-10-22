import React, { useState } from 'react';
import {
  Globe,
  Sun,
  Moon,
  Laptop,
  Clock,
  Bell,
  Save,
  CheckCircle2,
  Info,
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

  // Preview formatting
  const sampleDate = new Date();
  const formatSampleDate = () => {
    const pad = (n) => String(n).padStart(2, '0');
    const day = pad(sampleDate.getDate());
    const month = pad(sampleDate.getMonth() + 1);
    const year = sampleDate.getFullYear();

    if (prefs.dateFormat === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
    if (prefs.dateFormat === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}`;
  };

  const formatSampleTime = () => {
    const pad = (n) => String(n).padStart(2, '0');
    const h = sampleDate.getHours();
    const m = pad(sampleDate.getMinutes());
    const s = pad(sampleDate.getSeconds());

    if (prefs.timeFormat === '12h') {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${m}:${s} ${ampm}`;
    }
    return `${pad(h)}:${m}:${s}`;
  };

  const formatSampleNumber = () => {
    if (prefs.numberFormat === 'comma_decimal') {
      return '1.248.950,75 MiB';
    }
    return '1,248,950.75 MiB';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          Preferences — Tùy Chỉnh Cá Nhân
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          Thiết lập ngôn ngữ hiển thị, chủ đề giao diện, định dạng thời gian và kênh nhận thông báo cá nhân.
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
                1. Language — Ngôn Ngữ Giao Diện
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

        {/* GROUP 2: APPEARANCE */}
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
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sun size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                2. Appearance — Chủ Đề Giao Diện
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Áp dụng đồng bộ cho Dashboard, biểu đồ Metrics, bảng Logs và các trang quản lý
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {[
              {
                id: 'light',
                title: 'Light Mode (Sáng)',
                sub: 'Độ tương phản cao, tối ưu cho môi trường văn phòng',
                icon: Sun,
                accentColor: '#D97706',
              },
              {
                id: 'dark',
                title: 'Dark Mode (Tối)',
                sub: 'Giảm mỏi mắt khi theo dõi sự cố hạ tầng ban đêm',
                icon: Moon,
                accentColor: '#6366F1',
              },
              {
                id: 'system',
                title: 'System Default (Hệ thống)',
                sub: 'Tự động chuyển đổi theo giao diện hệ điều hành',
                icon: Laptop,
                accentColor: '#059669',
              },
            ].map((theme) => {
              const isSelected = prefs.appearance === theme.id;
              const ThemeIcon = theme.icon;

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleChange('appearance', theme.id)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #059669' : '1px solid #CBD5E1',
                    backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: '#F1F5F9',
                        color: theme.accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ThemeIcon size={18} />
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          padding: '1px 8px',
                          borderRadius: '9999px',
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                        }}
                      >
                        ĐANG DÙNG
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 800, color: isSelected ? '#065F46' : '#1E293B' }}>
                      {theme.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>{theme.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* GROUP 3: REGIONAL SETTINGS */}
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
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                3. Regional Settings — Khu Vực & Thời Gian
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Định dạng múi giờ máy chủ, cách hiển thị ngày giờ và quy chuẩn dấu phân cách số
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Timezone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Múi Giờ Vận Hành (Timezone)
              </label>
              <select
                value={prefs.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7 — Việt Nam, Băng Cốc)</option>
                <option value="UTC">UTC (GMT+0 — Giờ Quốc Tế Chuẩn)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (GMT+9 — Nhật Bản, Hàn Quốc)</option>
                <option value="America/New_York">America/New_York (EST / EDT — Hoa Kỳ)</option>
                <option value="Europe/London">Europe/London (GMT / BST — Châu Âu)</option>
              </select>
            </div>

            {/* Date Format */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Định Dạng Ngày
              </label>
              <select
                value={prefs.dateFormat}
                onChange={(e) => handleChange('dateFormat', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (Chuẩn Việt Nam & Châu Âu: 22/10/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (Chuẩn Mỹ: 10/22/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (Chuẩn ISO 8601: 2026-10-22)</option>
              </select>
            </div>

            {/* Time Format */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Định Dạng Giờ
              </label>
              <select
                value={prefs.timeFormat}
                onChange={(e) => handleChange('timeFormat', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="24h">24 Giờ (Ví dụ: 14:30:45 hoặc 21:00:00)</option>
                <option value="12h">12 Giờ (Ví dụ: 02:30:45 PM hoặc 09:00:00 PM)</option>
              </select>
            </div>

            {/* Number Format */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Định Dạng Phân Cách Số
              </label>
              <select
                value={prefs.numberFormat}
                onChange={(e) => handleChange('numberFormat', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="comma_decimal">Dấu chấm phân cách ngàn, phẩy thập phân (1.234.567,89)</option>
                <option value="dot_decimal">Dấu phẩy phân cách ngàn, chấm thập phân (1,234,567.89)</option>
              </select>
            </div>
          </div>

          {/* Live Preview Box */}
          <div
            style={{
              backgroundColor: '#F8FAFC',
              borderRadius: '9px',
              border: '1px dashed #CBD5E1',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8125rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
              <Info size={16} color="#059669" />
              <span>Xem trước mẫu định dạng thời gian thực:</span>
            </div>
            <div style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono, monospace)' }}>
              {formatSampleDate()} {formatSampleTime()} • {formatSampleNumber()}
            </div>
          </div>
        </div>

        {/* GROUP 4: NOTIFICATION PREFERENCES */}
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
                4. Notification Preferences — Tùy Chọn Thông Báo Cá Nhân
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
