import React from 'react';
import { render, screen } from '@testing-library/react';
import ChickenMascot from './ChickenMascot';
import HeroSection from '../../pages/Home/HeroSection';

const REQUIRED_SVG_GROUPS = [
  'chicken-body',
  'chicken-neck',
  'chicken-head',
  'chicken-comb',
  'chicken-eye',
  'chicken-beak-upper',
  'chicken-beak-lower',
  'chicken-wing',
  'chicken-tail',
  'chicken-legs',
  'grain-01',
  'grain-02',
  'grain-03',
  'grain-04',
];

describe('ChickenMascot & HeroSection integration', () => {
  test('renders SVG mascot with all required independently controllable group IDs and accessibility attributes', () => {
    const { container, unmount } = render(<ChickenMascot />);

    const imgRole = screen.getByRole('img', {
      name: /Minh họa gà Halftone cổ điển đang mổ thóc/i,
    });
    expect(imgRole).toBeInTheDocument();

    REQUIRED_SVG_GROUPS.forEach((groupId) => {
      const groupEl = container.querySelector(`#${groupId}`);
      expect(groupEl).not.toBeNull();
    });

    // Ensure halftone patterns and clipping paths exist
    expect(container.querySelector('#halftone-dense')).not.toBeNull();
    expect(container.querySelector('#halftone-mid')).not.toBeNull();
    expect(container.querySelector('#clip-chicken-torso')).not.toBeNull();

    // Unmount cleanly without errors
    expect(() => unmount()).not.toThrow();
  });

  test('supports static state when reducedMotion is enabled', () => {
    const { container, unmount } = render(<ChickenMascot reducedMotion={true} />);
    expect(container.querySelector('#chicken-body')).not.toBeNull();
    expect(() => unmount()).not.toThrow();
  });

  test('renders HeroSection with left editorial content and right Halftone ChickenMascot only', () => {
    const { container } = render(<HeroSection />);
    expect(screen.getByText(/Quan sát\. Dự đoán\./i)).toBeInTheDocument();
    expect(screen.getByText(/Khôi phục\./i)).toBeInTheDocument();
    expect(screen.getByText(/Bắt đầu ngay/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem hướng dẫn/i)).toBeInTheDocument();
    expect(screen.getByTestId('chicken-mascot')).toBeInTheDocument();
    expect(container.querySelector('.hero-dashboard-live')).toBeNull();
  });
});
