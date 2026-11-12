import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContactPage from './ContactPage';

describe('ContactPage (Greptile-Style Architectural Contact Form in Vietnamese)', () => {
  it('renders the Contact Sales hero banner (300px) with Vietnamese title, subtitle and pixel wave canvas', () => {
    render(<ContactPage />);

    expect(screen.getByRole('heading', { level: 1, name: /Liên Hệ Tư Vấn/i })).toBeInTheDocument();
    expect(screen.getByText(/Cảm ơn bạn đã quan tâm đến SelfHeal/i)).toBeInTheDocument();
    expect(screen.getByTestId('contact-hero-banner')).toBeInTheDocument();
    expect(screen.getByTestId('pixel-wave-canvas')).toBeInTheDocument();
  });

  it('renders all form fields matching the Vietnamese technical specification', () => {
    render(<ContactPage />);

    expect(screen.getByLabelText(/^TÊN$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^HỌ$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/EMAIL DOANH NGHIỆP/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/SỐ ĐIỆN THOẠI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/TÊN DOANH NGHIỆP \/ CÔNG TY/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/QUY MÔ ĐỘI NGŨ KỸ SƯ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/BẠN CẦN CHÚNG TÔI HỖ TRỢ/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Gửi Yêu Cầu Tư Vấn/i });
    expect(submitBtn).toBeInTheDocument();
  });

  it('allows user to type in fields with background matching outer page background', () => {
    render(<ContactPage />);

    const firstNameInput = screen.getByLabelText(/^TÊN$/i);
    fireEvent.change(firstNameInput, { target: { value: 'Tú' } });
    expect(firstNameInput.value).toBe('Tú');
    expect(firstNameInput).toHaveClass('contact-input');

    const emailInput = screen.getByLabelText(/EMAIL DOANH NGHIỆP/i);
    fireEvent.change(emailInput, { target: { value: 'tungo342005@gmail.com' } });
    expect(emailInput.value).toBe('tungo342005@gmail.com');
  });

  it('submits form successfully when required fields are filled', async () => {
    render(<ContactPage />);

    fireEvent.change(screen.getByLabelText(/^TÊN$/i), { target: { value: 'Tú' } });
    fireEvent.change(screen.getByLabelText(/^HỌ$/i), { target: { value: 'Ngô' } });
    fireEvent.change(screen.getByLabelText(/EMAIL DOANH NGHIỆP/i), { target: { value: 'tungo342005@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/TÊN DOANH NGHIỆP \/ CÔNG TY/i), { target: { value: 'Acme Inc.' } });
    fireEvent.change(screen.getByLabelText(/QUY MÔ ĐỘI NGŨ KỸ SƯ/i), { target: { value: '11-50' } });

    const submitBtn = screen.getByRole('button', { name: /Gửi Yêu Cầu Tư Vấn/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cảm ơn bạn!/i)).toBeInTheDocument();
    });
  });

  it('displays validation alert if required fields are missing', () => {
    render(<ContactPage />);

    const submitBtn = screen.getByRole('button', { name: /Gửi Yêu Cầu Tư Vấn/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Vui lòng điền đầy đủ các thông tin bắt buộc/i)).toBeInTheDocument();
  });
});
