import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationsPage from './NotificationsPage';
import { DashboardProvider } from '../context/DashboardContext';
import { ToastProvider } from '../../../context/ToastContext';
import { AuthProvider } from '../../../context/AuthContext';
import { STORAGE_NOTIFICATIONS_KEY } from '../../../mocks/notificationMockData';

const renderWithDashboard = (ui) => {
  return render(
    <ToastProvider>
      <AuthProvider>
        <DashboardProvider>
          {ui}
        </DashboardProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

describe('NotificationsPage Suite (/dashboard/notifications)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders page title, unread count badge and notification items', () => {
    renderWithDashboard(<NotificationsPage />);

    expect(screen.getByText(/Trung Tâm Thông Báo & Điều Phối Cảnh Báo/i)).toBeInTheDocument();
    expect(screen.getByTestId('header-unread-badge')).toBeInTheDocument();
    expect(screen.getByText(/Yêu cầu phê duyệt khẩn cấp: Tháo tải máy chủ worker-03/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Dự báo sớm: Nguy cơ tràn RAM/i)).toBeInTheDocument();
    expect(screen.getByTestId('btn-mark-all-read')).toBeInTheDocument();
  });

  test('filters notifications by Unread and Read status tabs', () => {
    renderWithDashboard(<NotificationsPage />);

    // Click 'Chưa Đọc' tab via testid
    const unreadTab = screen.getByTestId('filter-status-UNREAD');
    fireEvent.click(unreadTab);

    // Only unread items should be shown
    expect(screen.getByText(/Yêu cầu phê duyệt khẩn cấp: Tháo tải máy chủ worker-03/i)).toBeInTheDocument();

    // Click 'Đã Đọc' tab via testid
    const readTab = screen.getByTestId('filter-status-READ');
    fireEvent.click(readTab);

    // Read item should appear
    expect(screen.getByText(/Tự phục hồi thành công: Khởi động lại Pod order-processor/i)).toBeInTheDocument();
  });

  test('filters notifications by Type category chips', () => {
    renderWithDashboard(<NotificationsPage />);

    // Click 'Bảo Mật' type filter via testid
    const securityFilter = screen.getByTestId('filter-type-SECURITY');
    fireEvent.click(securityFilter);

    expect(screen.getByText(/Cảnh báo bảo mật: Phát hiện đăng nhập từ dải IP quản trị mới/i)).toBeInTheDocument();

    // Click 'Tự Phục Hồi' type filter via testid
    const selfHealingFilter = screen.getByTestId('filter-type-SELF_HEALING');
    fireEvent.click(selfHealingFilter);

    expect(screen.getByText(/Tự phục hồi thành công: Khởi động lại Pod order-processor/i)).toBeInTheDocument();
  });

  test('toggles single notification read/unread state', () => {
    renderWithDashboard(<NotificationsPage />);

    // Target the toggle button of the first notification via testid
    const toggleBtn = screen.getByTestId('btn-toggle-read-NOTIF-2026-001');
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);

    // Check localStorage was updated
    const stored = JSON.parse(localStorage.getItem(STORAGE_NOTIFICATIONS_KEY));
    expect(stored).not.toBeNull();
  });

  test('marks all notifications as read and updates unread badge to 0', async () => {
    renderWithDashboard(<NotificationsPage />);

    const markAllBtn = screen.getByTestId('btn-mark-all-read');
    expect(markAllBtn).not.toBeDisabled();

    fireEvent.click(markAllBtn);

    // Unread count badge in header should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('header-unread-badge')).not.toBeInTheDocument();
    });

    // Mark all button should now be disabled
    expect(screen.getByTestId('btn-mark-all-read')).toBeDisabled();

    // In localStorage, all should be read
    const stored = JSON.parse(localStorage.getItem(STORAGE_NOTIFICATIONS_KEY));
    expect(stored.every((n) => n.read || !n.unread)).toBe(true);
  });

  test('displays empty state when filter returns no matching items', () => {
    renderWithDashboard(<NotificationsPage />);

    // Mark all read first
    fireEvent.click(screen.getByTestId('btn-mark-all-read'));

    // Click 'Chưa Đọc' tab when none are unread
    fireEvent.click(screen.getByTestId('filter-status-UNREAD'));

    expect(screen.getByText(/Không tìm thấy thông báo nào trong phân mục này/i)).toBeInTheDocument();
  });
});
