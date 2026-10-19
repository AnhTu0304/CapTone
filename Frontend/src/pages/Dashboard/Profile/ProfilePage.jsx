import React from 'react';
import { useMockProfile } from '../../../hooks/useMockProfile';
import ProfileHeader from './ProfileHeader';
import ProfileOverview from './ProfileOverview';
import ProfileForm from './ProfileForm';
import { UserCheck } from 'lucide-react';

export const ProfilePage = () => {
  const {
    profile,
    isEditing,
    formData,
    avatarPreview,
    errors,
    startEdit,
    cancelEdit,
    handleChange,
    handleAvatarFile,
    saveChanges,
  } = useMockProfile();

  return (
    <div
      className="dashboard-profile-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Page Title & Subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={22} color="var(--dash-primary)" />
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Hồ Sơ Cá Nhân & Quản Trị Danh Tính
            </h1>
          </div>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--dash-text-secondary)',
              marginTop: '4px',
              margin: 0,
            }}
          >
            Quản lý thông tin định danh, chức danh chuyên môn và vai trò quản trị hạ tầng tự phục hồi (Self-Healing).
          </p>
        </div>
      </div>

      {/* Profile Header with Avatar Preview & Action Toggle */}
      <ProfileHeader
        profile={profile}
        isEditing={isEditing}
        avatarPreview={avatarPreview}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSave={saveChanges}
        onAvatarChange={handleAvatarFile}
        avatarError={errors.avatar}
      />

      {/* Main Content: Overview cards or Editable Form */}
      {isEditing ? (
        <ProfileForm
          profile={profile}
          formData={formData}
          errors={errors}
          onChange={handleChange}
          onSave={saveChanges}
          onCancel={cancelEdit}
        />
      ) : (
        <ProfileOverview profile={profile} />
      )}
    </div>
  );
};

export default ProfilePage;
