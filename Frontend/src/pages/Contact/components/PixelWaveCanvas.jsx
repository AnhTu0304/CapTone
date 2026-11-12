import React, { useRef, useEffect } from 'react';

/**
 * PixelWaveCanvas
 * High-performance 2D Canvas rendering an animated matrix pixel wave
 * with vibrant electric neon green/mint squares (#00FF88, #00FFA3, #10B981)
 */
export const PixelWaveCanvas = ({ className = '', height = 300 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let canvasHeight = height;
    let time = 0;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      canvasHeight = height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(canvasHeight * dpr);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Vibrant Electric Neon Mint Colors
    const COLORS = [
      '#00FF88', // Electric Spring Green
      '#00FFA3', // Vibrant Neon Mint
      '#10B981', // Crisp Emerald
      '#34D399', // Bright Mint
      '#6EE7B7', // Soft Pale Mint
    ];

    const PIXEL_SIZE = 7;
    const GAP = 5;
    const STEP = PIXEL_SIZE + GAP;

    const render = () => {
      ctx.clearRect(0, 0, width, canvasHeight);

      const cols = Math.ceil(width / STEP);
      const rows = Math.ceil(canvasHeight / STEP);
      const centerX = width / 2;
      const centerY = canvasHeight / 2;

      // Draw columns of animated pixel squares
      for (let c = 0; c < cols; c++) {
        const x = c * STEP;
        const distFromCenter = Math.abs(x - centerX) / (width / 2); // 0 at center, 1 at edges

        // Multi-frequency wave calculation
        const wave1 = Math.sin(c * 0.14 + time * 1.8) * 45;
        const wave2 = Math.cos(c * 0.08 - time * 1.2) * 35;
        const wave3 = Math.sin(c * 0.22 + time * 0.9) * 20;
        const totalWave = wave1 + wave2 + wave3;

        // Density increases towards left/right sides (matching Greptile reference)
        const densityFactor = 0.25 + Math.pow(distFromCenter, 1.4) * 0.75;
        const colHeight = (canvasHeight * 0.6 + totalWave) * densityFactor;

        const startY = centerY - colHeight / 2;
        const endY = centerY + colHeight / 2;

        for (let r = 0; r < rows; r++) {
          const y = r * STEP;

          // Check if within current column wave bounds
          if (y >= startY && y <= endY) {
            // Subtle pseudo-random dispersion
            const noise = Math.sin(c * 17.3 + r * 31.7 + time * 0.5);
            if (noise > -0.6) {
              const colorIndex = Math.abs(Math.floor((c + r + Math.floor(time * 2)) % COLORS.length));
              const baseColor = COLORS[colorIndex];

              // Center text clearance: fade opacity near center
              const centerFade = Math.min(1, Math.max(0.12, Math.pow(distFromCenter, 1.2)));
              const alpha = (0.35 + (noise + 1) * 0.3) * centerFade;

              ctx.save();
              ctx.globalAlpha = Math.min(alpha, 0.9);
              ctx.fillStyle = baseColor;

              // Neon glow for edge clusters
              if (distFromCenter > 0.45 && noise > 0.2) {
                ctx.shadowColor = '#00FF88';
                ctx.shadowBlur = 6;
              }

              ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
              ctx.restore();
            }
          }
        }
      }

      if (!prefersReducedMotion) {
        time += 0.022;
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [height]);

  return (
    <div
      className={`contact-pixel-wave-wrapper ${className}`.trim()}
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        data-testid="pixel-wave-canvas"
        className="contact-pixel-wave-canvas"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};

export default PixelWaveCanvas;
