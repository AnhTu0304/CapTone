import React, { useRef, useEffect } from 'react';

/**
 * GuideNotebookCanvas
 * High-performance 2D Canvas rendering an interactive technical blueprint & millimeter grid
 * with animated telemetry coordinates and magnetic particle pulse around the mouse cursor.
 */
export const GuideNotebookCanvas = ({ height = 240, className = '' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = 0;
    let canvasHeight = height;
    let mouse = { x: -1000, y: -1000, active: false };

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

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const GRID_SIZE = 24;
    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, canvasHeight);

      // 1. Draw subtle notebook graph paper grid
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(61, 59, 79, 0.08)';

      for (let x = 0; x <= width; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }

      for (let y = 0; y <= canvasHeight; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw millimeter micro-ticks along top and bottom border
      ctx.strokeStyle = 'rgba(61, 59, 79, 0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 6) {
        const tickH = x % 24 === 0 ? 8 : 4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, tickH);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, canvasHeight - tickH);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }

      // 3. Technical Coordinate Crosshairs (+) at key grid intersections
      ctx.strokeStyle = 'rgba(61, 59, 79, 0.28)';
      ctx.lineWidth = 1;
      const step = GRID_SIZE * 3;
      for (let x = step; x < width; x += step) {
        for (let y = step; y < canvasHeight; y += step) {
          ctx.beginPath();
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x, y + 3);
          ctx.stroke();
        }
      }

      // 4. Subtle telemetry wave in mint (#28E99F)
      if (!prefersReducedMotion) {
        ctx.beginPath();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = 'rgba(40, 233, 159, 0.45)';
        for (let x = 0; x <= width; x += 4) {
          const wave = Math.sin((x * 0.015) + time) * 14 + Math.cos((x * 0.03) - time * 0.8) * 8;
          const y = (canvasHeight * 0.52) + wave;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 5. Interactive Magnetic Mouse Ripple
        if (mouse.active) {
          const radius = 64;
          const grad = ctx.createRadialGradient(mouse.x, mouse.y, 4, mouse.x, mouse.y, radius);
          grad.addColorStop(0, 'rgba(40, 233, 159, 0.35)');
          grad.addColorStop(0.5, 'rgba(40, 233, 159, 0.12)');
          grad.addColorStop(1, 'rgba(40, 233, 159, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // Reticle cursor crosshair
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2);
          ctx.moveTo(mouse.x - 14, mouse.y);
          ctx.lineTo(mouse.x + 14, mouse.y);
          ctx.moveTo(mouse.x, mouse.y - 14);
          ctx.lineTo(mouse.x, mouse.y + 14);
          ctx.stroke();
        }

        time += 0.02;
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      className={`guide-notebook-canvas ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${height}px`,
        pointerEvents: 'auto',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
};

export default GuideNotebookCanvas;
