import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminLayout from './AdminLayout';
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminHeader from '../components/admin/AdminHeader';
import AdminBreadcrumb from '../components/admin/AdminBreadcrumb';
import AdminNotificationButton from '../components/admin/AdminNotificationButton';
import AdminProfileMenu from '../components/admin/AdminProfileMenu';

describe('Admin Application Shell Suite', () => {
  describe('AdminLayout Component', () => {
    test('renders application shell with sidebar, header and placeholder by default', () => {
      render(<AdminLayout currentPath="/admin" />);

      // Verify brand titles
      expect(screen.getAllByText(/SelfHeal/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Admin/i).length).toBeGreaterThan(0);

      // Verify placeholder
      expect(screen.getByText(/Khung Ứng Dụng Quản Trị Hệ Thống/i)).toBeInTheDocument();
      expect(screen.getByText(/APPLICATION SHELL SẴN SÀNG/i)).toBeInTheDocument();
    });

    test('renders custom children when provided inside main viewport', () => {
      render(
        <AdminLayout currentPath="/admin">
          <div data-testid="custom-child-content">Nội dung thử nghiệm admin</div>
        </AdminLayout>
      );

      expect(screen.getByTestId('custom-child-content')).toBeInTheDocument();
      expect(screen.queryByText(/APPLICATION SHELL SẴN SÀNG/i)).not.toBeInTheDocument();
    });

    test('toggles sidebar collapsed state via desktop header button', () => {
      render(<AdminLayout currentPath="/admin" />);

      const toggleButton = screen.getByLabelText(/Thu gọn thanh điều hướng/i);
      expect(toggleButton).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(toggleButton);

      // Label should now be expand
      expect(screen.getByLabelText(/Mở rộng thanh điều hướng/i)).toBeInTheDocument();
    });

    test('toggles sidebar collapsed state via Ctrl+B keyboard shortcut', () => {
      render(<AdminLayout currentPath="/admin" />);

      expect(screen.getByLabelText(/Thu gọn thanh điều hướng/i)).toBeInTheDocument();

      // Dispatch Ctrl+B
      fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
      expect(screen.getByLabelText(/Mở rộng thanh điều hướng/i)).toBeInTheDocument();

      // Dispatch Ctrl+B again to expand
      fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
      expect(screen.getByLabelText(/Thu gọn thanh điều hướng/i)).toBeInTheDocument();
    });
  });

  describe('AdminSidebar Component', () => {
    test('highlights active route correctly', () => {
      const handleNavigate = jest.fn();
      render(
        <AdminSidebar
          currentPath="/admin/clusters"
          onNavigate={handleNavigate}
          isCollapsed={false}
        />
      );

      // Find Cụm Kubernetes button
      const clustersBtn = screen.getByText('Cụm Kubernetes').closest('button');
      expect(clustersBtn).toBeInTheDocument();

      // Click calls onNavigate
      fireEvent.click(clustersBtn);
      expect(handleNavigate).toHaveBeenCalledWith('/admin/clusters');
    });

    test('renders grouped navigation sections', () => {
      render(<AdminSidebar currentPath="/admin" isCollapsed={false} />);

      expect(screen.getByText(/TỔNG QUAN HỆ THỐNG/i)).toBeInTheDocument();
      expect(screen.getByText(/TỰ LÀNH & HITL GATE/i)).toBeInTheDocument();
      expect(screen.getByText(/QUẢN TRỊ HẠ TẦNG K8S/i)).toBeInTheDocument();
      expect(screen.getByText(/BẢO MẬT & KIỂM TOÁN/i)).toBeInTheDocument();
      expect(screen.getByText(/CẤU HÌNH & TỔ CHỨC/i)).toBeInTheDocument();
    });

    test('displays tooltip when hovering item in collapsed state', () => {
      render(<AdminSidebar currentPath="/admin" isCollapsed={true} />);

      // Find the button with icon in collapsed mode (first item is Bàn Điều Khiển)
      const buttons = screen.getAllByRole('button');
      // Hover over an item button
      fireEvent.mouseEnter(buttons[0]);

      // Tooltip should appear
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent(/Bàn Điều Khiển/i);

      // Mouse leave hides tooltip
      fireEvent.mouseLeave(buttons[0]);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('AdminBreadcrumb Component', () => {
    test('parses path segments into hierarchy and supports navigation', () => {
      const handleNavigate = jest.fn();
      render(
        <AdminBreadcrumb
          currentPath="/admin/clusters"
          onNavigate={handleNavigate}
        />
      );

      expect(screen.getByText('Quản Trị Hệ Thống')).toBeInTheDocument();
      expect(screen.getByText('Cụm Kubernetes')).toBeInTheDocument();

      // Parent link is clickable
      const parentLink = screen.getByRole('button', { name: 'Quản Trị Hệ Thống' });
      fireEvent.click(parentLink);
      expect(handleNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  describe('AdminNotificationButton Component', () => {
    test('renders unread badge and opens popover on click', () => {
      render(<AdminNotificationButton />);

      // Check button exists
      const notifBtn = screen.getByLabelText(/Thông báo hệ thống quản trị/i);
      expect(notifBtn).toBeInTheDocument();

      // Click to open popover
      fireEvent.click(notifBtn);

      expect(screen.getByText(/Thông Báo Quản Trị/i)).toBeInTheDocument();
      expect(screen.getByText(/Cần Phê Duyệt HITL Khẩn Cấp/i)).toBeInTheDocument();

      // Click "Đã đọc tất cả"
      const markAllBtn = screen.getByText(/Đã đọc tất cả/i);
      fireEvent.click(markAllBtn);

      // Unread count badge should disappear
      expect(screen.queryByText(/Đã đọc tất cả/i)).not.toBeInTheDocument();
    });
  });

  describe('AdminProfileMenu Component', () => {
    test('renders user avatar and opens profile menu on click', () => {
      const handleNavigate = jest.fn();
      render(<AdminProfileMenu onNavigate={handleNavigate} />);

      const profileBtn = screen.getByLabelText(/Menu hồ sơ quản trị viên/i);
      expect(profileBtn).toBeInTheDocument();
      expect(screen.getByText('AD')).toBeInTheDocument();
      expect(screen.getByText('Quản Trị Viên')).toBeInTheDocument();

      // Click opens menu
      fireEvent.click(profileBtn);

      expect(screen.getByText('admin@selfheal.systems')).toBeInTheDocument();
      expect(screen.getByText('Hồ Sơ Quản Trị Viên')).toBeInTheDocument();
      expect(screen.getByText('Đăng Xuất Khỏi Admin')).toBeInTheDocument();

      // Click logout
      fireEvent.click(screen.getByText('Đăng Xuất Khỏi Admin'));
      expect(handleNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
