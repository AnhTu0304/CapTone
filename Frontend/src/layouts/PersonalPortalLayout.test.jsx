import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonalPortalLayout } from './PersonalPortalLayout';

import { personalPortalService } from '../services/personalPortalService';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'user@example.com', full_name: 'Nguyen Van A' },
    logout: jest.fn(),
    isSuperAdmin: () => false,
    isAdmin: () => false,
  }),
}));

jest.mock('../services/personalPortalService', () => ({
  personalPortalService: {
    getMyCompanies: jest.fn(),
    fetchMyCompanies: jest.fn(),
    getNotifications: jest.fn(),
    getProfile: jest.fn(),
  },
}));

describe('PersonalPortalLayout Responsive & Mobile Drawer Suite', () => {
  beforeEach(() => {
    personalPortalService.getMyCompanies.mockReturnValue([]);
    personalPortalService.fetchMyCompanies.mockResolvedValue([]);
    personalPortalService.getNotifications.mockReturnValue([]);
    personalPortalService.getProfile.mockReturnValue({});
  });

  test('renders mobile drawer toggle button and opens/closes slide-over drawer with Escape and item click', () => {
    const onNavigate = jest.fn();
    render(
      <PersonalPortalLayout currentPath="/portal" onNavigate={onNavigate}>
        <div>Portal Page Content</div>
      </PersonalPortalLayout>
    );

    const mobileToggle = screen.getByLabelText(/mở menu điều hướng di động/i);
    expect(mobileToggle).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /menu điều hướng di động/i })).not.toBeInTheDocument();

    fireEvent.click(mobileToggle);
    const drawer = screen.getByRole('dialog', { name: /menu điều hướng di động/i });
    expect(drawer).toBeInTheDocument();

    // Pressing Escape closes mobile drawer
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /menu điều hướng di động/i })).not.toBeInTheDocument();

    // Re-open and navigate closes drawer and invokes onNavigate
    fireEvent.click(mobileToggle);
    const drawerAfter = screen.getByRole('dialog', { name: /menu điều hướng di động/i });
    const companiesBtn = drawerAfter.querySelector('button[aria-label="Công Ty Của Tôi"]');
    expect(companiesBtn).toBeTruthy();
    fireEvent.click(companiesBtn);

    expect(onNavigate).toHaveBeenCalledWith('/portal/companies');
    expect(screen.queryByRole('dialog', { name: /menu điều hướng di động/i })).not.toBeInTheDocument();
  });

  test('applies portal responsive wrapper and viewport classes', () => {
    const { container } = render(
      <PersonalPortalLayout currentPath="/portal" onNavigate={jest.fn()}>
        <div>Content</div>
      </PersonalPortalLayout>
    );

    expect(container.querySelector('.portal-desktop-sidebar')).toBeInTheDocument();
    expect(container.querySelector('.portal-main-viewport')).toBeInTheDocument();
    expect(container.querySelector('.portal-top-header')).toBeInTheDocument();
  });
});
