import React from 'react';
import {
  User,
  Phone,
  Briefcase,
  Mail,
  Building2,
  Shield,
  Save,
  X,
  Lock,
  AlertCircle
} from 'lucide-react';

export const ProfileForm = ({
  profile,
  formData,
  errors,
  onChange,
  onSave,
  onCancel,
}) => {
  return (
    <form
      onSubmit={onSave}
      className="dash-card profile-form-container"
      style={{
        padding: '28px',
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--dash-border)',
        borderRadius: 'var(--dash-radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 6px 0' }}>
          Chỉnh Sửa Thông Tin Cá Nhân
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
          Cập nhật họ tên hiển thị, số điện thoại liên lạc khẩn cấp và chức danh của bạn trong hệ thống SelfHeal.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Field 1: Họ tên (Editable) */}
        <div>
          <label
            htmlFor="profile-fullname"
            style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}
          >
            Họ và tên <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="profile-fullname"
              type="text"
              value={formData.fullName}
              onChange={(e) => onChange('fullName', e.target.value)}
              placeholder="Nhập họ và tên đầy đủ"
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                border: `1px solid ${errors.fullName ? '#EF4444' : 'var(--dash-border)'}`,
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                outline: 'none',
                boxShadow: errors.fullName ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none',
              }}
            />
            <User
              size={16}
              color={errors.fullName ? '#EF4444' : 'var(--dash-text-muted)'}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
          {errors.fullName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', color: '#EF4444', fontSize: '0.75rem' }}>
              <AlertCircle size={13} />
              <span>{errors.fullName}</span>
            </div>
          )}
        </div>

        {/* Field 2: Số điện thoại (Editable) */}
        <div>
          <label
            htmlFor="profile-phone"
            style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}
          >
            Số điện thoại liên lạc
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="profile-phone"
              type="text"
              value={formData.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="Ví dụ: 0912345678"
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                border: `1px solid ${errors.phone ? '#EF4444' : 'var(--dash-border)'}`,
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                outline: 'none',
                boxShadow: errors.phone ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none',
              }}
            />
            <Phone
              size={16}
              color={errors.phone ? '#EF4444' : 'var(--dash-text-muted)'}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
          {errors.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', color: '#EF4444', fontSize: '0.75rem' }}>
              <AlertCircle size={13} />
              <span>{errors.phone}</span>
            </div>
          )}
        </div>

        {/* Field 3: Chức danh chuyên môn (Editable) */}
        <div>
          <label
            htmlFor="profile-jobtitle"
            style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}
          >
            Chức danh công việc
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="profile-jobtitle"
              type="text"
              value={formData.jobTitle}
              onChange={(e) => onChange('jobTitle', e.target.value)}
              placeholder="Ví dụ: SRE Lead / DevOps Engineer"
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                outline: 'none',
              }}
            />
            <Briefcase
              size={16}
              color="var(--dash-text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>

        {/* Field 4: Email (Read-Only) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>
              Email tài khoản
            </label>
            <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <Lock size={10} /> Không thể chỉnh sửa
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              value={profile.email}
              disabled
              readOnly
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.875rem',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-muted)',
                cursor: 'not-allowed',
              }}
            />
            <Mail
              size={16}
              color="var(--dash-text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>

        {/* Field 5: Tổ chức (Read-Only) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>
              Tổ chức trực thuộc
            </label>
            <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <Lock size={10} /> Quản trị
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={profile.organization}
              disabled
              readOnly
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.875rem',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-muted)',
                cursor: 'not-allowed',
              }}
            />
            <Building2
              size={16}
              color="var(--dash-text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>

        {/* Field 6: Vai trò hệ thống (Read-Only) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>
              Vai trò hệ thống (RBAC)
            </label>
            <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <Lock size={10} /> Quản trị
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={profile.systemRole}
              disabled
              readOnly
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.875rem',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-muted)',
                cursor: 'not-allowed',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <Shield
              size={16}
              color="var(--dash-text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          borderTop: '1px solid var(--dash-border)',
          paddingTop: '20px',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 18px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: 'var(--dash-radius-md)',
            color: 'var(--dash-text-secondary)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <X size={15} />
          <span>Hủy Bỏ Thay Đổi</span>
        </button>

        <button
          type="submit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 22px',
            backgroundColor: 'var(--dash-primary)',
            border: 'none',
            borderRadius: 'var(--dash-radius-md)',
            color: '#FFFFFF',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
          }}
        >
          <Save size={15} />
          <span>Lưu Cập Nhật</span>
        </button>
      </div>
    </form>
  );
};

export default ProfileForm;
