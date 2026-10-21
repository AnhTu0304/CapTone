import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { AuthProvider } from '../../../context/AuthContext';
import { ToastProvider } from '../../../context/ToastContext';
import { STORAGE_PROFILE_KEY, INITIAL_PROFILE } from '../../../mocks/profileMockData';

const renderWithProviders = (ui) => {
  return render(
    <ToastProvider>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </ToastProvider>
  );
};

describe('ProfilePage Suite (/dashboard/profile)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders Profile Page heading and all required personal, org, and security fields', () => {
    renderWithProviders(<ProfilePage />);

    // Page title
    expect(screen.getByText(/Hồ Sơ Cá Nhân & Quản Trị Danh Tính/i)).toBeInTheDocument();

    // Required fields in Profile Header & Overview
    expect(screen.getAllByText(/Nguyễn Văn An/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/an.nguyen@acmecorp.vn/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0912345678/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Trưởng nhóm SRE & DevOps Lead/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Acme Corporation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SME_OWNER \/ ADMIN/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Chủ sở hữu & Quản trị trưởng/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Đang Hoạt Động|Hoạt động \(Active\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/15\/01\/2026/i)).toBeInTheDocument();

    // Edit button
    expect(screen.getByRole('button', { name: /Chỉnh Sửa Hồ Sơ/i })).toBeInTheDocument();
  });

  test('switches to Edit mode and displays editable and read-only fields', () => {
    renderWithProviders(<ProfilePage />);

    const editBtn = screen.getByRole('button', { name: /Chỉnh Sửa Hồ Sơ/i });
    fireEvent.click(editBtn);

    // Form should appear
    expect(screen.getByText(/Chỉnh Sửa Thông Tin Cá Nhân/i)).toBeInTheDocument();

    // Editable inputs
    const nameInput = screen.getByLabelText(/Họ và tên/i);
    const phoneInput = screen.getByLabelText(/Số điện thoại/i);
    const jobTitleInput = screen.getByLabelText(/Chức danh công việc/i);

    expect(nameInput).toBeInTheDocument();
    expect(nameInput).not.toBeDisabled();
    expect(phoneInput).not.toBeDisabled();
    expect(jobTitleInput).not.toBeDisabled();

    // Read-only fields
    const emailInput = screen.getByDisplayValue(/an.nguyen@acmecorp.vn/i);
    expect(emailInput).toBeDisabled();

    const orgInput = screen.getByDisplayValue(/Acme Corporation/i);
    expect(orgInput).toBeDisabled();

    const roleInput = screen.getByDisplayValue(/SME_OWNER \/ ADMIN/i);
    expect(roleInput).toBeDisabled();

    // Action buttons in edit mode
    expect(screen.getAllByRole('button', { name: /Lưu Thay Đổi|Lưu Cập Nhật/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Hủy Bỏ/i }).length).toBeGreaterThan(0);
  });

  test('validates required name field and shows inline error message when empty', () => {
    renderWithProviders(<ProfilePage />);

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /Chỉnh Sửa Hồ Sơ/i }));

    const nameInput = screen.getByLabelText(/Họ và tên/i);
    fireEvent.change(nameInput, { target: { value: '   ' } });

    // Submit
    const saveBtn = screen.getByRole('button', { name: /Lưu Cập Nhật/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText(/Họ và tên không được để trống/i)).toBeInTheDocument();
  });

  test('validates phone number format and shows inline error message on invalid input', () => {
    renderWithProviders(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: /Chỉnh Sửa Hồ Sơ/i }));

    const phoneInput = screen.getByLabelText(/Số điện thoại/i);
    fireEvent.change(phoneInput, { target: { value: '123abcxyz' } });

    const saveBtn = screen.getByRole('button', { name: /Lưu Cập Nhật/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText(/Số điện thoại không đúng định dạng/i)).toBeInTheDocument();
  });

  test('successfully saves valid updates and updates localStorage and view mode', async () => {
    renderWithProviders(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: /Chỉnh Sửa Hồ Sơ/i }));

    const nameInput = screen.getByLabelText(/Họ và tên/i);
    const phoneInput = screen.getByLabelText(/Số điện thoại/i);
    const jobTitleInput = screen.getByLabelText(/Chức danh công việc/i);

    fireEvent.change(nameInput, { target: { value: 'Trần Văn Bảo' } });
    fireEvent.change(phoneInput, { target: { value: '0987654321' } });
    fireEvent.change(jobTitleInput, { target: { value: 'Principal Platform Architect' } });

    const saveBtn = screen.getByRole('button', { name: /Lưu Cập Nhật/i });
    fireEvent.click(saveBtn);

    // Should return to view mode with updated values
    await waitFor(() => {
      expect(screen.getAllByText('Trần Văn Bảo').length).toBeGreaterThan(0);
      expect(screen.getByText('0987654321')).toBeInTheDocument();
      expect(screen.getAllByText('Principal Platform Architect').length).toBeGreaterThan(0);
    });

    // Check localStorage persistence
    const saved = JSON.parse(localStorage.getItem(STORAGE_PROFILE_KEY));
    expect(saved.fullName).toBe('Trần Văn Bảo');
    expect(saved.phone).toBe('0987654321');
    expect(saved.jobTitle).toBe('Principal Platform Architect');
  });

  test('cancels edit mode and reverts modified fields to original profile data', () => {
    renderWithProviders(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: /Chỉnh Sửa Hồ Sơ/i }));

    const nameInput = screen.getByLabelText(/Họ và tên/i);
    fireEvent.change(nameInput, { target: { value: 'Tên Không Được Lưu' } });

    const cancelBtn = screen.getByRole('button', { name: /Hủy Bỏ Thay Đổi/i });
    fireEvent.click(cancelBtn);

    // View mode restored with original values
    expect(screen.getAllByText(/Nguyễn Văn An/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Tên Không Được Lưu/i)).not.toBeInTheDocument();
  });

  test('validates avatar file upload and rejects non-image or oversized files', () => {
    renderWithProviders(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: /Chỉnh Sửa Hồ Sơ/i }));

    const fileInput = screen.getByLabelText(/Tải lên ảnh đại diện/i);

    // 1. Non-image file test
    const textFile = new File(['hello'], 'document.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [textFile] } });
    expect(screen.getByText(/Vui lòng chọn tệp hình ảnh hợp lệ/i)).toBeInTheDocument();

    // 2. Oversized image test (>2MB)
    const largeFile = new File([new ArrayBuffer(3 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [largeFile] } });
    expect(screen.getByText(/Kích thước tệp không được vượt quá 2MB/i)).toBeInTheDocument();
  });
});

