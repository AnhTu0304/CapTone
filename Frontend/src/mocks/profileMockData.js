/**
 * Mock data for Personal Profile (Frontend-only)
 * Key: selfheal_mock_profile_v1
 * Hỗ trợ phân lập dữ liệu theo tài khoản (Account Isolation)
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
  systemRole: 'USER',
  organizationRole: 'Chủ sở hữu & Quản trị trưởng (Owner)',
  accountStatus: 'ACTIVE', // ACTIVE | SUSPENDED | PENDING
  createdAt: '15/01/2026',
  lastLogin: '15:30:49 21/10/2026',
  timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
  twoFactorEnabled: true,
};

export const getCurrentAuthUser = () => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('selfheal_auth_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getProfileStorageKey = () => {
  const authUser = getCurrentAuthUser();
  if (authUser?.email) {
    return `selfheal_profile_${authUser.email.toLowerCase().trim()}`;
  }
  if (authUser?.id) {
    return `selfheal_profile_${authUser.id}`;
  }
  return STORAGE_PROFILE_KEY;
};

export const getStoredProfile = () => {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_PROFILE;
    const authUser = getCurrentAuthUser();
    const key = getProfileStorageKey();
    const raw = localStorage.getItem(key);

    const base = {
      ...INITIAL_PROFILE,
      fullName: authUser?.full_name || authUser?.name || INITIAL_PROFILE.fullName,
      email: authUser?.email || INITIAL_PROFILE.email,
      avatar: authUser?.avatar_url || authUser?.avatar || null,
    };

    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      ...base,
      ...parsed,
      ...(authUser?.email && parsed.email && authUser.email.toLowerCase().trim() !== parsed.email.toLowerCase().trim()
        ? { email: authUser.email, fullName: authUser.full_name || base.fullName, avatar: authUser.avatar_url || null }
        : {}),
    };
  } catch {
    return INITIAL_PROFILE;
  }
};

export const saveStoredProfile = (profile) => {
  try {
    if (typeof localStorage === 'undefined') return false;
    const key = getProfileStorageKey();
    localStorage.setItem(key, JSON.stringify(profile));

    // Đồng bộ ngược vào selfheal_auth_user để toàn bộ ứng dụng cập nhật tức thì
    try {
      const rawAuth = localStorage.getItem('selfheal_auth_user');
      if (rawAuth) {
        const authUser = JSON.parse(rawAuth);
        if (profile.fullName) authUser.full_name = profile.fullName;
        if (profile.avatar !== undefined) {
          authUser.avatar_url = profile.avatar || null;
          authUser.avatar = profile.avatar || null;
        }
        localStorage.setItem('selfheal_auth_user', JSON.stringify(authUser));
      }
    } catch {}

    // Kích hoạt sự kiện toàn cục để Header / Dropdown cập nhật avatar ngay lập tức
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('selfheal_profile_updated', { detail: profile }));
      }
    } catch {}

    return true;
  } catch (err) {
    console.warn('Could not persist full profile to localStorage, attempting fallback without avatar:', err);
    try {
      const key = getProfileStorageKey();
      const fallback = { ...profile, avatar: null };
      localStorage.setItem(key, JSON.stringify(fallback));
      return true;
    } catch (fallbackErr) {
      console.warn('LocalStorage quota exceeded entirely:', fallbackErr);
      return false;
    }
  }
};
