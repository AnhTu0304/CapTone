import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminSystemSettingsPage from './AdminSystemSettingsPage';

describe('AdminSystemSettingsPage - Integrated Audit Logs & Retention', () => {
  test('renders all tabs including Audit Logs', () => {
    render(<AdminSystemSettingsPage />);
    expect(screen.getByText(/AI Model & Configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/Self-Healing Policy/i)).toBeInTheDocument();
    expect(screen.getByText(/Platform Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Maintenance & Updates/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Management & Storage/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhật Ký Kiểm Toán \(Audit Logs\)/i)).toBeInTheDocument();
  });

  test('switches to Data Management & Storage tab and displays retention settings', () => {
    render(<AdminSystemSettingsPage />);
    const retentionTab = screen.getByText(/Data Management & Storage/i);
    fireEvent.click(retentionTab);

    expect(screen.getByText(/Thời Gian Lưu Trữ Nhật Ký Kiểm Toán/i)).toBeInTheDocument();
    expect(screen.getByText(/Dung Lượng PostgreSQL Đang Sử Dụng/i)).toBeInTheDocument();
  });

  test('switches to Audit Logs tab and mounts AdminAuditLogsPage', async () => {
    render(<AdminSystemSettingsPage />);
    const auditTab = screen.getByText(/Nhật Ký Kiểm Toán \(Audit Logs\)/i);
    fireEvent.click(auditTab);

    await waitFor(() => {
      expect(screen.getByText(/Nhật Ký Kiểm Toán SHA-256/i)).toBeInTheDocument();
    });
  });
});
