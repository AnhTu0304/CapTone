import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import viCommon from './locales/vi/common.json';
import enCommon from './locales/en/common.json';
import viSecurity from './locales/vi/security.json';
import enSecurity from './locales/en/security.json';
import viAuth from './locales/vi/auth.json';
import enAuth from './locales/en/auth.json';
import viHome from './locales/vi/home.json';
import enHome from './locales/en/home.json';
import viLegal from './locales/vi/legal.json';
import enLegal from './locales/en/legal.json';
import viContact from './locales/vi/contact.json';
import enContact from './locales/en/contact.json';
import viAbout from './locales/vi/about.json';
import enAbout from './locales/en/about.json';
import viGuide from './locales/vi/guide.json';
import enGuide from './locales/en/guide.json';
import viFeatures from './locales/vi/features.json';
import enFeatures from './locales/en/features.json';
import viError from './locales/vi/error.json';
import enError from './locales/en/error.json';
import viPortal from './locales/vi/portal.json';
import enPortal from './locales/en/portal.json';
import viDashboard from './locales/vi/dashboard.json';
import enDashboard from './locales/en/dashboard.json';
import viDashMonitoring from './locales/vi/dashMonitoring.json';
import enDashMonitoring from './locales/en/dashMonitoring.json';
import viDashHealing from './locales/vi/dashHealing.json';
import enDashHealing from './locales/en/dashHealing.json';
import viDashAdmin from './locales/vi/dashAdmin.json';
import enDashAdmin from './locales/en/dashAdmin.json';

export const LANG_STORAGE_KEY = 'selfheal_lang';
export const PREFERENCES_STORAGE_KEY = 'selfheal_personal_preferences_v1';
export const SUPPORTED_LANGUAGES = ['vi', 'en'];
export const DEFAULT_LANGUAGE = 'vi';

export const normalizeLanguage = (lng) => {
  const short = String(lng || '').trim().toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
};

export const getIntlLocale = (lng) => (normalizeLanguage(lng) === 'en' ? 'en-US' : 'vi-VN');

export const getSavedLanguage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved) return normalizeLanguage(saved);
      const rawPrefs = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        if (parsed?.language) return normalizeLanguage(parsed.language);
      }
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return DEFAULT_LANGUAGE;
};

const syncLanguageSideEffects = (lng) => {
  const normalized = normalizeLanguage(lng);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LANG_STORAGE_KEY, normalized);
      const rawPrefs = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
      const parsedPrefs = rawPrefs ? JSON.parse(rawPrefs) : {};
      if (parsedPrefs.language !== normalized) {
        window.localStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify({ ...parsedPrefs, language: normalized })
        );
      }
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = normalized;
    }
  } catch {
    // Ignore storage/DOM errors
  }
};

const initialLanguage = getSavedLanguage();

i18n.use(initReactI18next).init({
  resources: {
    vi: {
      common: viCommon,
      security: viSecurity,
      auth: viAuth,
      home: viHome,
      legal: viLegal,
      contact: viContact,
      about: viAbout,
      guide: viGuide,
      features: viFeatures,
      error: viError,
      portal: viPortal,
      dashboard: viDashboard,
      dashMonitoring: viDashMonitoring,
      dashHealing: viDashHealing,
      dashAdmin: viDashAdmin,
    },
    en: {
      common: enCommon,
      security: enSecurity,
      auth: enAuth,
      home: enHome,
      legal: enLegal,
      contact: enContact,
      about: enAbout,
      guide: enGuide,
      features: enFeatures,
      error: enError,
      portal: enPortal,
      dashboard: enDashboard,
      dashMonitoring: enDashMonitoring,
      dashHealing: enDashHealing,
      dashAdmin: enDashAdmin,
    },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: 'common',
  ns: ['common', 'security', 'auth', 'home', 'legal', 'contact', 'about', 'guide', 'features', 'error', 'portal', 'dashboard', 'dashMonitoring', 'dashHealing', 'dashAdmin'],
  initImmediate: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.lang = initialLanguage;
}

i18n.on('languageChanged', syncLanguageSideEffects);

export default i18n;
