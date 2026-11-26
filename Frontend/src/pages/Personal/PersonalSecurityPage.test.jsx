import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PersonalSecurityPage } from './PersonalSecurityPage';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profileService';
import { personalPortalService } from '../../services/personalPortalService';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/profileService', () => ({
  profileService: {
    getProfile: jest.fn(),
  },
}));

jest.mock('../../services/personalPortalService', () => ({
  personalPortalService: {
    getProfile: jest.fn(() => ({})),
    getActiveSessions: jest.fn(() => []),
    getLoginHistory: jest.fn(() => []),
    fetchLoginHistory: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    get2FAStatus: jest.fn().mockResolvedValue({ is_enabled: false }),
  },
}));

describe('PersonalSecurityPage Google OAuth password card behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    personalPortalService.getProfile.mockReturnValue({});
  });

  test('hides change-password form and shows Google notice when has_password is false', async () => {
    useAuth.mockReturnValue({
      user: { email: 'google.user@gmail.com', has_password: false },
    });
    profileService.getProfile.mockResolvedValue({ hasPassword: false });

    render(<PersonalSecurityPage />);

    await waitFor(() => {
      expect(screen.getByText('Tài khoản được đăng nhập bằng Google')).toBeInTheDocument();
    });
    expect(screen.getByText('google.user@gmail.com')).toBeInTheDocument();
    expect(screen.queryByText('Cập Nhật Mật Khẩu')).not.toBeInTheDocument();
    expect(screen.queryByText('Mật Khẩu Hiện Tại *')).not.toBeInTheDocument();
  });

  test('renders change-password form when has_password is true', async () => {
    useAuth.mockReturnValue({
      user: { email: 'local.user@example.com', has_password: true },
    });
    profileService.getProfile.mockResolvedValue({ hasPassword: true });

    render(<PersonalSecurityPage />);

    await waitFor(() => {
      expect(screen.getByText('Cập Nhật Mật Khẩu')).toBeInTheDocument();
    });
    expect(screen.getByText('Mật Khẩu Hiện Tại *')).toBeInTheDocument();
    expect(screen.queryByText('Tài khoản được đăng nhập bằng Google')).not.toBeInTheDocument();
  });
});
