import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PersonalProfilePage from './PersonalProfilePage';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../context/ToastContext';
import { profileService } from '../../services/profileService';

const mockProfileData = {
  fullName: 'Quản Trị Viên Tối Cao (Super Admin)',
  email: 'superadmin@selfheal.com',
  phone: '0912345678',
  jobTitle: 'Senior DevOps Engineer',
  department: 'Kỹ Thuật & Vận Hành Hạ Tầng (SRE)',
  bio: 'Kỹ sư chịu trách nhiệm giám sát độ khả dụng 99.99%',
  systemRole: 'SUPER_ADMIN',
  accountStatus: 'ACTIVE',
  createdAt: '21/10/2026',
  lastLogin: '16:36:02 22/10/2026',
  avatar: null,
};

jest.mock('../../services/profileService', () => ({
  profileService: {
    getProfile: jest.fn(() => Promise.resolve(mockProfileData)),
    updateProfile: jest.fn((data) => Promise.resolve({
      ...mockProfileData,
      ...data,
    })),
  },
  formatVnDate: jest.fn(() => '21/10/2026'),
  formatVnDateTime: jest.fn(() => '16:36:02 22/10/2026'),
}));

const renderWithProviders = (ui) => {
  return render(
    <ToastProvider>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </ToastProvider>
  );
};

describe('PersonalProfilePage Suite (/portal/profile)', () => {
  beforeEach(() => {
    profileService.getProfile.mockImplementation(() => Promise.resolve(mockProfileData));
    profileService.updateProfile.mockImplementation((data) => Promise.resolve({
      ...mockProfileData,
      ...data,
    }));
  });

  test('renders My Profile heading, overview identity cards, and edit form', async () => {
    renderWithProviders(<PersonalProfilePage />);

    expect(screen.getByText(/My Profile — Hồ Sơ Cá Nhân/i)).toBeInTheDocument();
    expect(screen.getByText(/Thông Tin Định Danh & Liên Hệ/i)).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái tài khoản:/i)).toBeInTheDocument();
    expect(screen.getByText(/KÍCH HOẠT \(ACTIVE\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Vai trò cao nhất:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu Thay Đổi Hồ Sơ/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(profileService.getProfile).toHaveBeenCalled();
    });
  });

  test('validates required full name before submitting', async () => {
    renderWithProviders(<PersonalProfilePage />);

    const nameInput = screen.getByLabelText(/Họ và Tên \*/i);
    fireEvent.change(nameInput, { target: { value: '   ' } });

    const submitBtn = screen.getByRole('button', { name: /Lưu Thay Đổi Hồ Sơ/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Họ và tên không được để trống/i)).toBeInTheDocument();
  });

  test('updates profile successfully and displays success feedback banner', async () => {
    renderWithProviders(<PersonalProfilePage />);

    const nameInput = screen.getByLabelText(/Họ và Tên \*/i);
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn An Cập Nhật' } });

    const phoneInput = screen.getByLabelText(/Số Điện Thoại/i);
    fireEvent.change(phoneInput, { target: { value: '0987654321' } });

    const submitBtn = screen.getByRole('button', { name: /Lưu Thay Đổi Hồ Sơ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(profileService.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Nguyễn Văn An Cập Nhật',
          phone: '0987654321',
        })
      );
      expect(screen.getByText(/Đã cập nhật thông tin hồ sơ cá nhân thành công!/i)).toBeInTheDocument();
    });
  });
});
