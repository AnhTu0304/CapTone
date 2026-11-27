import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Bell,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';
import { normalizeLanguage } from '../../i18n';

export const PersonalPreferencesPage = () => {
  const { t, i18n } = useTranslation('portal');
  const [prefs, setPrefs] = useState(() => personalPortalService.getPreferences());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const normalized = normalizeLanguage(i18n.language);
    setPrefs((prev) => (prev.language === normalized ? prev : { ...prev, language: normalized }));
  }, [i18n.language]);

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
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          {t('preferences.title')}
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          {t('preferences.subtitle')}
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
          <span>{t('preferences.savedMessage')}</span>
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
                {t('preferences.languageSection.title')}
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                {t('preferences.languageSection.subtitle')}
              </p>
            </div>
          </div>

          <div className="portal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              {
                id: 'vi',
                label: t('preferences.languageSection.viLabel'),
                sub: t('preferences.languageSection.viSub'),
                flag: '🇻🇳',
              },
              {
                id: 'en',
                label: t('preferences.languageSection.enLabel'),
                sub: t('preferences.languageSection.enSub'),
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
                {t('preferences.notificationsSection.title')}
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                {t('preferences.notificationsSection.subtitle')}
              </p>
            </div>
          </div>

          <div className="portal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              {
                key: 'inApp',
                title: t('preferences.notificationsSection.items.inApp.title'),
                desc: t('preferences.notificationsSection.items.inApp.desc'),
              },
              {
                key: 'email',
                title: t('preferences.notificationsSection.items.email.title'),
                desc: t('preferences.notificationsSection.items.email.desc'),
              },
              {
                key: 'companyInvites',
                title: t('preferences.notificationsSection.items.companyInvites.title'),
                desc: t('preferences.notificationsSection.items.companyInvites.desc'),
              },
              {
                key: 'roleChanges',
                title: t('preferences.notificationsSection.items.roleChanges.title'),
                desc: t('preferences.notificationsSection.items.roleChanges.desc'),
              },
              {
                key: 'securityAlerts',
                title: t('preferences.notificationsSection.items.securityAlerts.title'),
                desc: t('preferences.notificationsSection.items.securityAlerts.desc'),
              },
              {
                key: 'systemMaintenance',
                title: t('preferences.notificationsSection.items.systemMaintenance.title'),
                desc: t('preferences.notificationsSection.items.systemMaintenance.desc'),
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
            <span>{t('preferences.saveButton')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonalPreferencesPage;
