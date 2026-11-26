import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { aiService } from '../../../services/aiService';

const mockToastSuccess = jest.fn();
const mockToastWarning = jest.fn();
const mockToastError = jest.fn();

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => ({
    currentOrg: { id: 'org-real-1', name: 'Acme Corp' },
    currentUserRole: 'SME_OWNER',
  }),
}));

jest.mock('../../../context/ToastContext', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    warning: mockToastWarning,
    error: mockToastError,
  }),
}));

jest.mock('../../../services/aiService', () => ({
  aiService: {
    getOrgAlertSettings: jest.fn(),
    updateOrgAlertSettings: jest.fn(),
  },
}));

describe('SettingsPage — Alert Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiService.getOrgAlertSettings.mockResolvedValue({
      critical_email_enabled: true,
      notify_on_no_action: true,
      notify_on_healing_failed: true,
      cooldown_minutes: 15,
      extra_emails: [],
      default_recipients: [
        { user_id: 'u1', email: 'owner@acme.vn', role_code: 'SME_OWNER' },
      ],
    });
    aiService.updateOrgAlertSettings.mockResolvedValue({
      critical_email_enabled: true,
      notify_on_no_action: true,
      notify_on_healing_failed: true,
      cooldown_minutes: 15,
      extra_emails: [],
    });
  });

  it('does not render test email input or button and saves alert settings cleanly', async () => {
    render(<SettingsPage />);
    await screen.findByText('owner@acme.vn');

    expect(screen.queryByPlaceholderText(/Email nhận test/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gửi Email Test Cảnh Báo/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Lưu Cấu Hình Cảnh Báo/i }));

    await waitFor(() => {
      expect(aiService.updateOrgAlertSettings).toHaveBeenCalledWith('org-real-1', {
        critical_email_enabled: true,
        notify_on_no_action: true,
        notify_on_healing_failed: true,
        cooldown_minutes: 15,
        extra_emails: [],
      });
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});
