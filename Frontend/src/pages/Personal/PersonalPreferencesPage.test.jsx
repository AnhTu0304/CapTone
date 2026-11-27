import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonalPreferencesPage } from './PersonalPreferencesPage';
import { personalPortalService } from '../../services/personalPortalService';

describe('PersonalPreferencesPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Language and Notification Preferences without Appearance or Regional Settings', () => {
    render(<PersonalPreferencesPage />);

    expect(screen.getByText('Tùy Chỉnh Cá Nhân')).toBeInTheDocument();
    expect(screen.getByText(/1\. Ngôn Ngữ Giao Diện/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Tùy Chọn Thông Báo Cá Nhân/i)).toBeInTheDocument();

    expect(screen.queryByText(/Preferences —/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Appearance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chủ Đề Giao Diện/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Regional Settings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Khu Vực & Thời Gian/i)).not.toBeInTheDocument();
  });

  it('saves updated language preference', () => {
    const saveSpy = jest.spyOn(personalPortalService, 'savePreferences');
    render(<PersonalPreferencesPage />);

    fireEvent.click(screen.getByText('English (US)'));
    fireEvent.click(screen.getByRole('button', { name: /Lưu Tùy Chỉnh Cá Nhân/i }));

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
    expect(screen.getByText(/Personal preferences saved successfully!|Đã lưu tùy chỉnh cá nhân thành công!/i)).toBeInTheDocument();
    saveSpy.mockRestore();
  });
});
