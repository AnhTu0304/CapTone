import React, { useRef, useEffect } from 'react';

/**
 * SectionTitleCanvas
 * Renders an architectural blueprint title strip with millimeter ruler ticks,
 * technical index stamps, and subtle mint accent guidelines.
 */
export const SectionTitleCanvas = ({ chapterNumber = '01', height = 34, className = '' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Baseline ruler line
    ctx.strokeStyle = 'rgba(61, 59, 79, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 2);
    ctx.lineTo(width, height - 2);
    ctx.stroke();

    // Millimeter ticks along the baseline
    for (let x = 0; x <= width; x += 6) {
      const isMajor = x % 30 === 0;
      const tickH = isMajor ? 8 : 4;
      ctx.beginPath();
      ctx.moveTo(x, height - 2 - tickH);
      ctx.lineTo(x, height - 2);
      ctx.stroke();
    }

    // Accent mint indicator line on the left
    ctx.strokeStyle = '#28E99F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, height - 2);
    ctx.lineTo(36, height - 2);
    ctx.stroke();

    // Chapter badge watermark text on right
    ctx.fillStyle = 'rgba(61, 59, 79, 0.22)';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SEC-INDEX // ${chapterNumber}`, width - 8, height - 8);
  }, [chapterNumber, height]);

  return (
    <canvas
      ref={canvasRef}
      className={`section-title-canvas ${className}`}
      style={{
        display: 'block',
        width: '100%',
        height: `${height}px`,
        marginBottom: '6px',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
};

export default SectionTitleCanvas;
