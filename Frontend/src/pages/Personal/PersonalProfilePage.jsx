import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save,
  CheckCircle2,
  Camera,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';
import { profileService, formatVnDate, formatVnDateTime } from '../../services/profileService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { resolveUserSystemRole } from '../../components/common/UserProfileDropdown';
import { getIntlLocale, normalizeLanguage } from '../../i18n';

export const PersonalProfilePage = () => {
  const { t, i18n } = useTranslation('portal');
  const { user } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState(() => {
    const p = personalPortalService.getProfile();
    if (user?.email && p?.email && user.email.toLowerCase().trim() !== p.email.toLowerCase().trim()) {
      return {
        ...p,
        email: user.email,
        fullName: user.full_name || '',
        avatar: user.avatar_url || user.avatar || null,
      };
    }
    return p;
  });
  const [formData, setFormData] = useState({
    fullName: profile.fullName || user?.full_name || '',
    email: profile.email || user?.email || '',
    phone: profile.phone || '',
    jobTitle: profile.jobTitle || '',
    department: profile.department || 'Kỹ Thuật & Vận Hành Hạ Tầng (SRE)',
    bio: profile.bio || 'Kỹ sư chịu trách nhiệm giám sát độ khả dụng 99.99% và tự động hóa phục hồi hạ tầng K8s.',
  });

  const [avatarPreview, setAvatarPreview] = useState(
    user?.avatar_url || user?.avatar || (user?.email === profile?.email ? profile?.avatar : null) || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch remote profile data from backend API with fallback
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const loadProfile = async () => {
      try {
        const remoteData = await profileService.getProfile();
        if (!isMounted || !remoteData) return;
        setProfile(remoteData);
        setFormData((prev) => ({
          ...prev,
          fullName: remoteData.fullName || user?.full_name || prev.fullName,
          email: remoteData.email || user?.email || prev.email,
          phone: remoteData.phone || prev.phone,
          jobTitle: remoteData.jobTitle || prev.jobTitle,
          department: remoteData.department || prev.department,
          bio: remoteData.bio || prev.bio,
        }));
        setAvatarPreview(remoteData.avatar || null);
      } catch (err) {
        console.warn('Profile fetch error, using local fallback:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage(t('profile.messages.invalidImage'));
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        setErrorMessage(t('profile.messages.imageTooLarge'));
        return;
      }
      setErrorMessage('');
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
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      setErrorMessage(t('profile.messages.fullNameRequired'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // 1. Cập nhật cơ sở dữ liệu qua API Backend
      const payload = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim() || null,
        jobTitle: formData.jobTitle.trim() || null,
        avatar: avatarPreview,
        department: formData.department.trim(),
        bio: formData.bio.trim(),
      };

      const updated = await profileService.updateProfile(payload);

      // 2. Cập nhật Tầng Cá Nhân (Personal Portal store & activity history)
      personalPortalService.updateProfile({
        ...updated,
        department: formData.department.trim(),
        bio: formData.bio.trim(),
      });

      setProfile((prev) => ({
        ...prev,
        ...updated,
        department: formData.department,
        bio: formData.bio,
      }));

      setIsSaved(true);
      setSaveMessage(t('profile.messages.savedSuccess'));
      if (toast?.success) {
        toast.success(t('profile.messages.savedToast'));
      }

      setTimeout(() => setIsSaved(false), 3500);
    } catch (err) {
      const msg = err.message || t('profile.messages.saveFailed');
      setErrorMessage(msg);
      if (toast?.error) {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const userInitials = (formData.fullName || user?.full_name || t('profile.defaultAdminInitials'))
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  const resolvedSystemRole = resolveUserSystemRole(user);
  const highestRole = resolvedSystemRole || t('profile.noSystemRole');

  const accountStatus = (profile.accountStatus || user?.status || 'ACTIVE').toUpperCase();
  const intlLocale = getIntlLocale(i18n.language);
  const joinedDate =
    profile.createdAt ||
    (user?.created_at
      ? normalizeLanguage(i18n.language) === 'en'
        ? new Date(user.created_at).toLocaleDateString(intlLocale)
        : formatVnDate(user.created_at)
      : '21/10/2026');
  const lastLoginTime =
    profile.lastLogin ||
    (user?.last_login_at
      ? normalizeLanguage(i18n.language) === 'en'
        ? new Date(user.last_login_at).toLocaleString(intlLocale)
        : formatVnDateTime(user.last_login_at)
      : '16:36:02 22/10/2026');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          {t('profile.title')}
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          {t('profile.subtitle')}
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

      {errorMessage && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} color="#DC2626" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="portal-grid-asymmetric" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Left Column: Avatar & Identity Overview Card */}
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
          {/* Avatar with Camera Upload Icon */}
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
              title={t('profile.changeAvatarTitle')}
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
                transition: 'transform 0.15s ease',
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
              {formData.fullName || t('profile.defaultUserName')}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '4px 0 0 0' }}>
              {formData.jobTitle || t('profile.defaultJobTitle')}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>{t('profile.statusLabel')}</span>
              <span
                style={{
                  color: accountStatus === 'ACTIVE' ? '#059669' : '#DC2626',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={13} />
                <span>{accountStatus === 'ACTIVE' ? t('profile.statusActive') : accountStatus}</span>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>{t('profile.highestRoleLabel')}</span>
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono, monospace)' }}>
                {highestRole}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>{t('profile.joinedDateLabel')}</span>
              <span>{joinedDate}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>{t('profile.lastLoginLabel')}</span>
              <span>{lastLoginTime}</span>
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
              {t('profile.formTitle')}
            </h3>
            <p style={{ fontSize: '0.78125rem', color: '#64748B', margin: '3px 0 0 0' }}>
              {t('profile.formSubtitle')}
            </p>
          </div>

          <div className="portal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label htmlFor="field-fullname" style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                {t('profile.fields.fullName')}
              </label>
              <input
                id="field-fullname"
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
              <label htmlFor="field-email" style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                {t('profile.fields.email')}
              </label>
              <input
                id="field-email"
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
              <label htmlFor="field-phone" style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                {t('profile.fields.phone')}
              </label>
              <input
                id="field-phone"
                type="tel"
                name="phone"
                placeholder={t('profile.fields.phonePlaceholder')}
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
              <label htmlFor="field-jobtitle" style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                {t('profile.fields.jobTitle')}
              </label>
              <input
                id="field-jobtitle"
                type="text"
                name="jobTitle"
                placeholder={t('profile.fields.jobTitlePlaceholder')}
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
            <label htmlFor="field-department" style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              {t('profile.fields.department')}
            </label>
            <input
              id="field-department"
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
            <label htmlFor="field-bio" style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              {t('profile.fields.bio')}
            </label>
            <textarea
              id="field-bio"
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
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                opacity: isSubmitting ? 0.75 : 1,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t('profile.submitting')}</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{t('profile.submit')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PersonalProfilePage;
