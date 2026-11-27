import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import i18n, { LANG_STORAGE_KEY, PREFERENCES_STORAGE_KEY } from './index';
import viCommon from './locales/vi/common.json';
import enCommon from './locales/en/common.json';
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
import PersonalHeader from '../components/personal/PersonalHeader';
import PersonalSidebar from '../components/personal/PersonalSidebar';
import PersonalPreferencesPage from '../pages/Personal/PersonalPreferencesPage';
import { CopyButton } from '../components/common/CodeBlock';
import { personalPortalService } from '../services/personalPortalService';
import AuthContext from '../context/AuthContext';

const collectKeyPaths = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  return Object.keys(obj)
    .sort()
    .flatMap((key) => collectKeyPaths(obj[key], prefix ? `${prefix}.${key}` : key));
};

const mockAuthValue = {
  user: { id: 'u-1', full_name: 'Tester', email: 'tester@example.com', system_roles: ['USER'] },
  isAuthenticated: true,
  loading: false,
  logout: jest.fn(),
  getInitials: () => 'T',
  getPrimaryRole: () => 'USER',
  isSuperAdmin: () => false,
  isAdmin: () => false,
  isOwner: () => false,
  isDevOps: () => true,
};

describe('Portal & Dashboard i18n Setup, Sync & Key Parity', () => {
  beforeEach(() => {
    window.localStorage.clear();
    i18n.changeLanguage('vi');
  });

  test.each([
    ['common', viCommon, enCommon],
    ['portal', viPortal, enPortal],
    ['dashboard', viDashboard, enDashboard],
    ['dashMonitoring', viDashMonitoring, enDashMonitoring],
    ['dashHealing', viDashHealing, enDashHealing],
    ['dashAdmin', viDashAdmin, enDashAdmin],
  ])('vi/%s.json and en/%s.json maintain non-empty exact key parity', (_ns, viJson, enJson) => {
    const viKeys = collectKeyPaths(viJson);
    const enKeys = collectKeyPaths(enJson);
    expect(viKeys.length).toBeGreaterThan(5);
    expect(viKeys).toEqual(enKeys);
  });

  test('PersonalHeader omits compact header language switcher and PersonalPreferencesPage switches Portal & CodeBlock UI cleanly', () => {
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <PersonalHeader currentPath="/portal/preferences" />
        <PersonalSidebar currentPath="/portal/preferences" />
        <PersonalPreferencesPage />
        <CopyButton text="kubectl get pods" />
      </AuthContext.Provider>
    );

    expect(screen.queryByTestId('compact-lang-switcher')).not.toBeInTheDocument();
    expect(screen.getAllByText('Trung Tâm Điều Khiển').length).toBeGreaterThan(0);
    expect(screen.getByText('Chức Năng Cá Nhân')).toBeInTheDocument();
    expect(screen.getByText('Sao chép')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pref-lang-en'));
    fireEvent.click(screen.getByRole('button', { name: /Lưu Tùy Chỉnh Cá Nhân/i }));

    expect(screen.getAllByText('Control Center').length).toBeGreaterThan(0);
    expect(screen.getByText('Personal Features')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    const savedPrefs = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY));
    expect(savedPrefs.language).toBe('en');

    fireEvent.click(screen.getByTestId('pref-lang-vi'));
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/i }));
    expect(screen.getAllByText('Trung Tâm Điều Khiển').length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('vi');
  });

  test('dashboard breadcrumbs translate cleanly in both VI and EN', () => {
    expect(i18n.t('dashboard:layout.breadcrumbs.incidents', { lng: 'vi' })).toBe('Quản Lý Sự Cố & RCA');
    expect(i18n.t('dashboard:layout.breadcrumbs.incidents', { lng: 'en' })).toBe('Incidents & RCA');
    expect(i18n.t('dashboard:layout.breadcrumbs.clusters', { lng: 'en' })).toBe('Kubernetes Clusters');
    expect(i18n.t('dashboard:pipeline.canvas.rcaCard.rootCauseHeader', { lng: 'en' })).toBe('Root Cause');
  });

  test('personalPortalService.savePreferences synchronizes global i18n language', () => {
    personalPortalService.savePreferences({ language: 'en' });
    expect(i18n.language).toBe('en');
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
  });
});
