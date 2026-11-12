import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContactPage from './ContactPage';

describe('ContactPage (Greptile-Style Architectural Contact Form)', () => {
  it('renders the Contact Sales hero banner with title and subtitle', () => {
    render(<ContactPage />);

    expect(screen.getByRole('heading', { level: 1, name: /Contact Sales/i })).toBeInTheDocument();
    expect(screen.getByText(/Thanks for your interest in SelfHeal\. Fill out the form and our team will reach out ASAP\./i)).toBeInTheDocument();
    expect(screen.getByTestId('contact-hero-banner')).toBeInTheDocument();
  });

  it('renders all form fields matching the technical specification', () => {
    render(<ContactPage />);

    expect(screen.getByLabelText(/FIRST NAME/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/LAST NAME/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/WORK EMAIL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PHONE NUMBER/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/COMPANY NAME/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/HOW MANY ENGINEERS/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/WHAT WOULD BE HELPFUL/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Submit/i });
    expect(submitBtn).toBeInTheDocument();
  });

  it('allows user to type in fields and displays blue-tint active styling class', () => {
    render(<ContactPage />);

    const firstNameInput = screen.getByLabelText(/FIRST NAME/i);
    fireEvent.change(firstNameInput, { target: { value: 'Tú' } });
    expect(firstNameInput.value).toBe('Tú');
    expect(firstNameInput).toHaveClass('contact-input-filled');

    const emailInput = screen.getByLabelText(/WORK EMAIL/i);
    fireEvent.change(emailInput, { target: { value: 'tungo342005@gmail.com' } });
    expect(emailInput.value).toBe('tungo342005@gmail.com');
  });

  it('submits form successfully when required fields are filled', async () => {
    render(<ContactPage />);

    fireEvent.change(screen.getByLabelText(/FIRST NAME/i), { target: { value: 'Tú' } });
    fireEvent.change(screen.getByLabelText(/LAST NAME/i), { target: { value: 'Ngô' } });
    fireEvent.change(screen.getByLabelText(/WORK EMAIL/i), { target: { value: 'tungo342005@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/COMPANY NAME/i), { target: { value: 'Acme Inc.' } });
    fireEvent.change(screen.getByLabelText(/HOW MANY ENGINEERS/i), { target: { value: '11-50' } });

    const submitBtn = screen.getByRole('button', { name: /Submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cảm ơn bạn!/i)).toBeInTheDocument();
    });
  });

  it('displays validation alert if required fields are missing', () => {
    render(<ContactPage />);

    const submitBtn = screen.getByRole('button', { name: /Submit/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Vui lòng điền đầy đủ các thông tin bắt buộc/i)).toBeInTheDocument();
  });
});
