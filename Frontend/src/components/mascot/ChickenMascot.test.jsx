import React from 'react';
import { render, screen } from '@testing-library/react';
import ChickenMascot from './ChickenMascot';
import HeroSection from '../../pages/Home/HeroSection';

const REQUIRED_SVG_GROUP_IDS = [
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

describe('ChickenMascot (Method A Vector SVG + GSAP)', () => {
  test('renders all 14 required independently controllable SVG groups', () => {
    const { container } = render(<ChickenMascot />);
    const svg = container.querySelector('svg.chicken-mascot-svg');
    expect(svg).not.toBeNull();

    REQUIRED_SVG_GROUP_IDS.forEach((id) => {
      const group = container.querySelector(`#${id}`);
      expect(group).not.toBeNull();
      expect(group.tagName.toLowerCase()).toBe('g');
    });
  });

  test('renders emerald #28E99F accents on eye and rice grains', () => {
    const { container } = render(<ChickenMascot />);
    const emeraldEye = container.querySelector('#chicken-eye path[fill="#28E99F"]');
    const emeraldGrain = container.querySelector('#grain-01 path[fill="#28E99F"]');
    expect(emeraldEye).not.toBeNull();
    expect(emeraldGrain).not.toBeNull();
  });

  test('supports reducedMotion={true} prop and cleans up on unmount', () => {
    const { container, unmount } = render(<ChickenMascot reducedMotion={true} />);
    expect(container.querySelector('#chicken-head')).not.toBeNull();
    expect(() => unmount()).not.toThrow();
  });

  test('renders inside HeroSection right column alongside Vietnamese headline, CTAs, and [ AGENT ] bridge section', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Quan sát\. Dự đoán\./i)).toBeInTheDocument();
    expect(screen.getByText(/Bắt đầu ngay/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem hướng dẫn/i)).toBeInTheDocument();
    expect(screen.getByTestId('chicken-mascot-stage')).toBeInTheDocument();
    expect(screen.getByTestId('agent-bridge-section')).toBeInTheDocument();
    expect(screen.getByText(/\[ AGENT \]/i)).toBeInTheDocument();
    expect(screen.getByText(/Cách Agent kết nối với dự án của bạn/i)).toBeInTheDocument();
  });
});
