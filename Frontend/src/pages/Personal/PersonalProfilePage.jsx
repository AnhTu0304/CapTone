import React, { useState } from 'react';
import {
  Save,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';
import { useAuth } from '../../context/AuthContext';

export const PersonalProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(() => personalPortalService.getProfile());
  const [formData, setFormData] = useState({
    fullName: profile.fullName || user?.full_name || '',
    email: profile.email || user?.email || '',
    phone: profile.phone || '',
    jobTitle: profile.jobTitle || '',
    department: 'Kỹ Thuật & Vận Hành Hạ Tầng (SRE)',
    bio: 'Kỹ sư chịu trách nhiệm giám sát độ khả dụng 99.99% và tự động hóa phục hồi hạ tầng K8s.',
  });

  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || null);
  const [isSaved, setIsSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleAvatarChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const updated = personalPortalService.updateProfile({
        ...formData,
        avatar: avatarPreview,
      });
      setProfile(updated);
      setIsSaved(true);
      setSaveMessage('Đã cập nhật thông tin hồ sơ cá nhân thành công!');
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      alert('Không thể lưu thông tin: ' + err.message);
    }
  };

  const userInitials = (formData.fullName || 'Nguyễn Văn An')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          My Profile — Hồ Sơ Cá Nhân
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          Xem và điều chỉnh thông tin định danh người dùng, hình ảnh đại diện và vai trò thành viên.
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

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Left Column: Avatar & Overview Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          {/* Avatar with Upload */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                background: avatarPreview
                  ? `url(${avatarPreview}) center/cover no-repeat`
                  : 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                fontSize: '2rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                border: '3px solid #FFFFFF',
              }}
            >
              {!avatarPreview && userInitials}
            </div>

            <label
              htmlFor="avatar-file-input"
              title="Thay đổi ảnh đại diện"
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                border: '2px solid #FFFFFF',
              }}
            >
              <Camera size={16} />
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              {formData.fullName || 'Nguyễn Văn An'}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '4px 0 0 0' }}>
              {formData.jobTitle || 'Trưởng nhóm SRE & DevOps Lead'}
            </p>
          </div>

          <div
            style={{
              width: '100%',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              padding: '14px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              textAlign: 'left',
              fontSize: '0.78125rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Trạng thái tài khoản:</span>
              <span
                style={{
                  color: '#059669',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={13} />
                <span>KÍCH HOẠT (ACTIVE)</span>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Vai trò cao nhất:</span>
              <strong style={{ color: '#0F172A' }}>{profile.systemRole || 'SME_OWNER / ADMIN'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Ngày tham gia:</span>
              <span>{profile.createdAt || '15/01/2026'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Đăng nhập gần nhất:</span>
              <span>{profile.lastLogin || 'Vừa xong'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Editable Profile Form */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Thông Tin Định Danh & Liên Hệ
            </h3>
            <p style={{ fontSize: '0.78125rem', color: '#64748B', margin: '3px 0 0 0' }}>
              Cập nhật thông tin để các thành viên trong Company nhận diện và phối hợp công việc
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Họ và Tên *
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleFormChange}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Địa Chỉ Email (Tên đăng nhập)
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: '#F8FAFC',
                  color: '#64748B',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Số Điện Thoại
              </label>
              <input
                type="tel"
                name="phone"
                placeholder="Ví dụ: 0912345678"
                value={formData.phone}
                onChange={handleFormChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Chức Danh Chuyên Môn (Job Title)
              </label>
              <input
                type="text"
                name="jobTitle"
                placeholder="Ví dụ: Senior DevOps Engineer"
                value={formData.jobTitle}
                onChange={handleFormChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Phòng Ban / Đơn Vị Phụ Trách
            </label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleFormChange}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Giới Thiệu Ngắn (Bio)
            </label>
            <textarea
              name="bio"
              rows={3}
              value={formData.bio}
              onChange={handleFormChange}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="submit"
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
              }}
            >
              <Save size={16} />
              <span>Lưu Thay Đổi Hồ Sơ</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PersonalProfilePage;
