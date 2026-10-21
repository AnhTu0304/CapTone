import React, { useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  Edit3,
  Save,
  X,
  Building2,
  Shield,
  Briefcase
} from 'lucide-react';

export const ProfileHeader = ({
  profile,
  isEditing,
  avatarPreview,
  onStartEdit,
  onCancelEdit,
  onSave,
  onAvatarChange,
  avatarError,
}) => {
  const fileInputRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onAvatarChange(file);
    }
  };

  return (
    <div
      className="dash-card profile-header-card"
      style={{
        padding: '28px',
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--dash-border)',
        borderRadius: 'var(--dash-radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
      }}
    >
      {/* Left: Avatar + Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {/* Avatar Container with Upload */}
        <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt={profile.fullName}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--dash-mint-100)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            />
          ) : (
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'var(--dash-primary)',
                color: '#28E99F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                border: '3px solid var(--dash-mint-100)',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
              }}
            >
              {getInitials(profile.fullName)}
            </div>
          )}

          {/* Camera upload button in Edit mode */}
          {isEditing && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                aria-label="Tải lên ảnh đại diện"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Thay đổi ảnh đại diện"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--dash-primary)',
                  color: '#FFFFFF',
                  border: '2px solid #FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                }}
              >
                <Camera size={14} />
              </button>
            </>
          )}
        </div>

        {/* User Identity Details */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2
              style={{
                fontSize: '1.375rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {profile.fullName}
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                fontSize: '0.6875rem',
                fontWeight: 700,
                border: '1px solid #A7F3D0',
              }}
            >
              <CheckCircle2 size={12} />
              <span>{profile.accountStatus === 'ACTIVE' ? 'Đang Hoạt Động' : profile.accountStatus}</span>
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '6px',
              flexWrap: 'wrap',
              fontSize: '0.8125rem',
              color: 'var(--dash-text-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Briefcase size={14} color="var(--dash-primary)" />
              <span>{profile.jobTitle || 'Kỹ Sư Nền Tảng'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Building2 size={14} color="var(--dash-text-muted)" />
              <span>{profile.organization}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Shield size={14} color="#2563EB" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#1E40AF' }}>
                {profile.systemRole}
              </span>
            </div>
          </div>

          {avatarError && (
            <p style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', margin: 0 }}>
              {avatarError}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {!isEditing ? (
          <button
            type="button"
            onClick={onStartEdit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-primary)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <Edit3 size={15} />
            <span>Chỉnh Sửa Hồ Sơ</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onCancelEdit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
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
              <span>Hủy Bỏ</span>
            </button>
            <button
              type="button"
              onClick={onSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
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
              <span>Lưu Thay Đổi</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
