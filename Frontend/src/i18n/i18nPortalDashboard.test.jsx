import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import i18n, { LANG_STORAGE_KEY, PREFERENCES_STORAGE_KEY } from './index';
import viPortal from './locales/vi/portal.json';
import enPortal from './locales/en/portal.json';
import viDashboard from './locales/vi/dashboard.json';
import enDashboard from './locales/en/dashboard.json';
import LanguageSwitcherCompact from '../components/common/LanguageSwitcherCompact';
import { personalPortalService } from '../services/personalPortalService';

const collectKeyPaths = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  return Object.keys(obj)
    .sort()
    .flatMap((key) => collectKeyPaths(obj[key], prefix ? `${prefix}.${key}` : key));
};

describe('Portal & Dashboard i18n Setup, Sync & Key Parity', () => {
  beforeEach(() => {
    window.localStorage.clear();
    i18n.changeLanguage('vi');
  });

  test('vi/portal.json and en/portal.json maintain exact key parity', () => {
    expect(collectKeyPaths(viPortal)).toEqual(collectKeyPaths(enPortal));
  });

  test('vi/dashboard.json and en/dashboard.json maintain exact key parity', () => {
    expect(collectKeyPaths(viDashboard)).toEqual(collectKeyPaths(enDashboard));
  });

  test('LanguageSwitcherCompact switches VI <-> EN and syncs both selfheal_lang and personal preferences', () => {
    render(<LanguageSwitcherCompact />);

    const btn = screen.getByTestId('compact-lang-switcher');
    expect(btn).toHaveTextContent('VI');

    fireEvent.click(btn);
    fireEvent.click(screen.getByTestId('compact-lang-option-en'));

    expect(btn).toHaveTextContent('EN');
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    const savedPrefs = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY));
    expect(savedPrefs.language).toBe('en');

    fireEvent.click(btn);
    fireEvent.click(screen.getByTestId('compact-lang-option-vi'));
    expect(btn).toHaveTextContent('VI');
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('vi');
  });

  test('personalPortalService.savePreferences synchronizes global i18n language', () => {
    personalPortalService.savePreferences({ language: 'en' });
    expect(i18n.language).toBe('en');
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
  });
});
