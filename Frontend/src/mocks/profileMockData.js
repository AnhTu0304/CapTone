/**
 * Mock data for Personal Profile (Frontend-only)
 * Key: selfheal_mock_profile_v1
 */

export const STORAGE_PROFILE_KEY = 'selfheal_mock_profile_v1';

export const INITIAL_PROFILE = {
  id: 'USR-2026-0881',
  avatar: null, // null uses generated initials avatar
  fullName: 'Nguyễn Văn An',
  email: 'an.nguyen@acmecorp.vn',
  phone: '0912345678',
  jobTitle: 'Trưởng nhóm SRE & DevOps Lead',
  organization: 'Acme Corporation',
  systemRole: 'SME_OWNER / ADMIN',
  organizationRole: 'Chủ sở hữu & Quản trị trưởng (Owner)',
  accountStatus: 'ACTIVE', // ACTIVE | SUSPENDED | PENDING
  createdAt: '15/01/2026',
  lastLogin: '19/10/2026 18:45',
  timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
  twoFactorEnabled: true,
};

export const getStoredProfile = () => {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE_KEY);
    if (!raw) return INITIAL_PROFILE;
    return { ...INITIAL_PROFILE, ...JSON.parse(raw) };
  } catch {
    return INITIAL_PROFILE;
  }
};

export const saveStoredProfile = (profile) => {
  try {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.warn('Could not persist profile to localStorage:', err);
  }
};
