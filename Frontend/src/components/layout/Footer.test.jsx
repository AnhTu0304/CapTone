import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Footer from './Footer';

describe('Footer (Greptile CAD Blueprint Alignment)', () => {
  it('renders the blueprint drafting logo and wordmark', () => {
    render(<Footer />);
    const logo = screen.getByLabelText(/SelfHeal Blueprint Logo/i);
    expect(logo).toBeInTheDocument();
    expect(screen.getByText('selfheal')).toBeInTheDocument();
  });

  it('renders all key navigation column titles and categories', () => {
    render(<Footer />);
    expect(screen.getByText('PRODUCT')).toBeInTheDocument();
    expect(screen.getByText('COMPANY')).toBeInTheDocument();
    expect(screen.getByText('RESOURCES')).toBeInTheDocument();
    expect(screen.getByText('SUPPORT')).toBeInTheDocument();
  });

  it('renders status indicator and link', () => {
    render(<Footer />);
    const statusLink = screen.getByText('VIEW STATUS');
    expect(statusLink).toBeInTheDocument();
  });

  it('renders copyright and system compliance metadata', () => {
    render(<Footer />);
    expect(screen.getByText(/SelfHeal Systems, Inc./i)).toBeInTheDocument();
    expect(screen.getByText(/COMPLIANT K8S 1.28\+/i)).toBeInTheDocument();
  });

  it('calls onNavigate when internal link is clicked', () => {
    const mockNavigate = jest.fn();
    render(<Footer onNavigate={mockNavigate} />);

    const pricingLink = screen.getByText('PRICING');
    fireEvent.click(pricingLink);

    expect(mockNavigate).toHaveBeenCalledWith('/pricing');
  });

  it('renders social media buttons', () => {
    render(<Footer />);
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    expect(screen.getByLabelText('X (Twitter)')).toBeInTheDocument();
    expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByLabelText('Discord')).toBeInTheDocument();
  });
});
