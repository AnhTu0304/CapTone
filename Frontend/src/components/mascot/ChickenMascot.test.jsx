import React from 'react';
import { render, screen } from '@testing-library/react';
import ChickenMascot from './ChickenMascot';
import HeroSection from '../../pages/Home/HeroSection';

describe('ChickenMascot (HTML5 Video) & HeroSection integration', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = jest.fn();
  });

  test('renders HTML5 video mascot with required attributes (autoPlay, muted, loop, playsInline, preload="metadata", no controls)', () => {
    const { container } = render(<ChickenMascot reducedMotion={false} />);

    const videoEl = screen.getByTestId('chicken-mascot-video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl.tagName).toBe('VIDEO');
    expect(videoEl).toHaveAttribute('src', '/videos/chicken-mascot.mp4');
    expect(videoEl).toHaveAttribute('preload', 'metadata');
    expect(videoEl).toHaveAttribute('playsinline');
    expect(videoEl).toHaveAttribute('loop');
    expect(videoEl).toHaveAttribute('autoplay');
    expect(videoEl).not.toHaveAttribute('controls');
    expect(videoEl.muted).toBe(true);

    // Ensure both /videos/chicken-mascot.mp4 and bundled asset source tags exist
    const sources = container.querySelectorAll('source');
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources[0]).toHaveAttribute('src', '/videos/chicken-mascot.mp4');
    expect(sources[0]).toHaveAttribute('type', 'video/mp4');
  });

  test('pauses video and disables autoplay when prefers-reduced-motion is active', () => {
    render(<ChickenMascot reducedMotion={true} />);

    const videoEl = screen.getByTestId('chicken-mascot-video');
    expect(videoEl).not.toHaveAttribute('autoplay');
    expect(videoEl).toHaveAttribute('poster');
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  test('renders HeroSection with preserved left editorial content and right HTML5 video mascot only', () => {
    const { container } = render(<HeroSection />);

    expect(screen.getByText(/Quan sát\. Dự đoán\./i)).toBeInTheDocument();
    expect(screen.getByText(/Khôi phục\./i)).toBeInTheDocument();
    expect(screen.getByText(/Bắt đầu ngay/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem hướng dẫn/i)).toBeInTheDocument();

    const videos = container.querySelectorAll('video.chicken-mascot-video');
    expect(videos).toHaveLength(1);
  });
});
