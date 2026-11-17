import React, { useRef, useEffect } from 'react';

/**
 * PixelWaveCanvas
 * High-performance 2D Canvas rendering an animated matrix pixel wave
 * with soft, bright pastel mint squares (#C4FBD4, #B8F8CE, #D2FCE3, #A5F3C8)
 * densely packed in an architectural CAD frame.
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

    // Soft, light, bright pastel mint colors (sampled from reference image: #C4FBD4)
    const COLORS = [
      '#C4FBD4', // Soft pale mint
      '#B8F8CE', // Fresh bright mint
      '#CCF9DA', // Airy luminous mint
      '#A7F3C8', // Clean mint tone
      '#DDFBEB', // Light pastel highlight
    ];

    // Tight pixel grid for dense ("dằn dặn") matrix columns
    const PIXEL_SIZE = 5;
    const GAP = 2.5;
    const STEP = PIXEL_SIZE + GAP;

    const render = () => {
      ctx.clearRect(0, 0, width, canvasHeight);

      const cols = Math.ceil(width / STEP);
      const rows = Math.ceil(canvasHeight / STEP);
      const centerX = width / 2;
      const centerY = canvasHeight / 2;

      for (let c = 0; c < cols; c++) {
        const x = c * STEP;
        const normDistX = Math.abs(x - centerX) / (width / 2); // 0 at center, 1 at edges

        // Multi-frequency smooth wave motion
        const wave1 = Math.sin(c * 0.12 + time * 1.6) * 38;
        const wave2 = Math.cos(c * 0.07 - time * 1.1) * 26;
        const wave3 = Math.sin(c * 0.22 + time * 0.7) * 16;
        const totalWave = wave1 + wave2 + wave3;

        // Density & column height increase significantly towards the flanks
        const columnSpanFactor = 0.35 + Math.pow(normDistX, 1.2) * 0.65;
        const colHeight = (canvasHeight * 0.72 + totalWave) * columnSpanFactor;

        const startY = centerY - colHeight / 2;
        const endY = centerY + colHeight / 2;

        for (let r = 0; r < rows; r++) {
          const y = r * STEP;
          const normDistY = Math.abs(y - centerY) / (canvasHeight / 2);

          // Center clearance zone for title & subtitle legibility
          const inCenterTextZone = normDistX < 0.42 && normDistY < 0.44;

          // Check if pixel falls inside column wave envelope
          if (y >= startY && y <= endY) {
            // Pseudorandom matrix noise for organic yet structured column density
            const cellNoise = Math.sin(c * 19.3 + r * 37.1 + time * 0.4);

            let shouldDraw = false;
            let alpha = 0.85;

            if (inCenterTextZone) {
              // Very faint, occasional light pixels in text area for subtle depth
              if (cellNoise > 0.45 && normDistY > 0.28) {
                shouldDraw = true;
                alpha = 0.18;
              }
            } else {
              // Dense ("dằn dặn") coverage outside center text zone
              const densityThreshold = normDistX > 0.38 ? -0.7 : -0.25;
              if (cellNoise > densityThreshold) {
                shouldDraw = true;
                alpha = normDistX > 0.45 ? 0.88 : (0.4 + normDistX * 0.5);
              }
            }

            if (shouldDraw) {
              const colorIdx = Math.abs((c * 3 + r * 5 + Math.floor(time * 2)) % COLORS.length);
              const color = COLORS[colorIdx];

              ctx.save();
              ctx.globalAlpha = Math.min(alpha, 0.95);
              ctx.fillStyle = color;
              ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
              ctx.restore();
            }
          }
        }
      }

      if (!prefersReducedMotion) {
        time += 0.016;
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
