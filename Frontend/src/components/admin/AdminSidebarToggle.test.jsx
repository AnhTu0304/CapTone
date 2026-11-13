import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminLayout from '../../layouts/AdminLayout';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

describe('Admin Sidebar Floating Edge Toggle', () => {
  test('renders floating circular edge button in AdminLayout and removes old header/footer toggles', () => {
    const { container } = render(
      <AdminLayout currentPath="/admin">
        <div>Admin content</div>
      </AdminLayout>
    );

    // Old toggles must not exist
    expect(container.querySelector('.admin-desktop-toggle')).toBeNull();
    expect(screen.queryByText(/THU GỌN SIDEBAR/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Thu gọn sidebar/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Mở rộng sidebar/i)).not.toBeInTheDocument();

    // New floating circular green toggle button exists
    const edgeToggle = container.querySelector('button.admin-sidebar-edge-toggle');
    expect(edgeToggle).not.toBeNull();
    expect(edgeToggle).toHaveAttribute('aria-label', 'Thu gọn thanh điều hướng');
    expect(edgeToggle.style.borderRadius).toBe('50%');
    expect(edgeToggle.style.right).toBe('-13px');
    expect(edgeToggle.style.top).toBe('20px');

    const aside = screen.getByLabelText('Thanh điều hướng bên Admin');
    expect(aside.style.width).toBe('260px');

    // Click to collapse
    fireEvent.click(edgeToggle);
    expect(edgeToggle).toHaveAttribute('aria-label', 'Mở rộng thanh điều hướng');
    expect(aside.style.width).toBe('72px');

    // Click to expand again
    fireEvent.click(edgeToggle);
    expect(edgeToggle).toHaveAttribute('aria-label', 'Thu gọn thanh điều hướng');
    expect(aside.style.width).toBe('260px');
  });

  test('supports Ctrl+B shortcut alongside floating edge button', () => {
    render(
      <AdminLayout currentPath="/admin">
        <div>Admin content</div>
      </AdminLayout>
    );

    const aside = screen.getByLabelText('Thanh điều hướng bên Admin');
    expect(aside.style.width).toBe('260px');

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(screen.getByLabelText('Mở rộng thanh điều hướng')).toBeInTheDocument();
    expect(aside.style.width).toBe('72px');

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(screen.getByLabelText('Thu gọn thanh điều hướng')).toBeInTheDocument();
    expect(aside.style.width).toBe('260px');
  });

  test('omits floating edge toggle when onToggleCollapse is null (mobile drawer)', () => {
    const { container } = render(
      <AdminSidebar currentPath="/admin" isCollapsed={false} onToggleCollapse={null} />
    );

    expect(container.querySelector('.admin-sidebar-edge-toggle')).toBeNull();
    expect(screen.queryByText(/THU GỌN SIDEBAR/i)).not.toBeInTheDocument();
  });

  test('AdminHeader keeps mobile toggle without old desktop collapse button', () => {
    const { container } = render(
      <AdminHeader currentPath="/admin" onToggleMobileDrawer={jest.fn()} />
    );

    expect(container.querySelector('.admin-desktop-toggle')).toBeNull();
    expect(container.querySelector('.admin-mobile-toggle')).not.toBeNull();
  });
});
