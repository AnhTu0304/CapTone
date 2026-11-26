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

export const LANG_STORAGE_KEY = 'selfheal_lang';
export const SUPPORTED_LANGUAGES = ['vi', 'en'];
export const DEFAULT_LANGUAGE = 'vi';

export const normalizeLanguage = (lng) => {
  const short = String(lng || '').trim().toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
};

export const getSavedLanguage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved) return normalizeLanguage(saved);
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
    },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: 'common',
  ns: ['common', 'security', 'auth', 'home', 'legal', 'contact', 'about', 'guide', 'features', 'error'],
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
