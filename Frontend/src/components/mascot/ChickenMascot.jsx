import React, { useEffect, useRef, useState } from 'react';
import mascotVideoAsset from '../../assets/mascot/gemini_generated_video_1189c89b.mp4';
import mascotPosterSvg from '../../assets/mascot/chicken.svg';
import './ChickenMascot.css';

const checkReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * ChickenMascot
 *
 * Renders the animated chicken mascot HTML5 video inside the Hero Section's
 * right column.
 *
 * Features:
 * - Uses HTML5 <video> with autoPlay, muted, loop, playsInline, preload="metadata"
 * - Hides all native playback controls, borders, and shadows
 * - Preserves 16:9 (1280x720) aspect ratio with object-fit: contain and zero layout shift
 * - Respects prefers-reduced-motion by pausing the video and offering static poster fallback
 */
export const ChickenMascot = ({ className = '', reducedMotion }) => {
  const videoRef = useRef(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    reducedMotion !== undefined ? reducedMotion : checkReducedMotion()
  );

  useEffect(() => {
    if (reducedMotion !== undefined) {
      setPrefersReducedMotion(reducedMotion);
      return undefined;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e) => setPrefersReducedMotion(e.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    return undefined;
  }, [reducedMotion]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Ensure muted attribute is strictly enforced for browser autoplay compliance
    videoEl.muted = true;
    videoEl.defaultMuted = true;

    if (prefersReducedMotion) {
      if (typeof videoEl.pause === 'function') {
        videoEl.pause();
      }
      return;
    }

    if (typeof videoEl.play === 'function') {
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay fallback handled silently via poster attribute
        });
      }
    }
  }, [prefersReducedMotion]);

  return (
    <div
      className={`chicken-mascot-stage ${className}`.trim()}
      data-testid="chicken-mascot"
    >
      <video
        ref={videoRef}
        className="chicken-mascot-video"
        data-testid="chicken-mascot-video"
        src="/videos/chicken-mascot.mp4"
        poster={mascotPosterSvg}
        width={1280}
        height={720}
        autoPlay={!prefersReducedMotion}
        muted
        loop
        playsInline
        preload="metadata"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        aria-label="Video linh vật gà trống SelfHeal đang mổ thóc"
      >
        <source src="/videos/chicken-mascot.mp4" type="video/mp4" />
        <source src={mascotVideoAsset} type="video/mp4" />
        <img
          src={mascotPosterSvg}
          alt="Minh họa linh vật gà trống SelfHeal đang mổ thóc"
          className="chicken-mascot-poster-fallback"
          width={1280}
          height={720}
        />
      </video>
    </div>
  );
};

export default React.memo(ChickenMascot);
