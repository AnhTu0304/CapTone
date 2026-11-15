import React, { useRef, useEffect } from 'react';

export const SelfHealingTimelineCanvas = ({ className = '', style = {} }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let tick = 0;

    const stages = [
      { time: 'T+0.0s', title: 'Sự cố phát sinh', desc: 'Pod OOMKilled (137)', color: '#EF4444' },
      { time: 'T+0.4s', title: 'Cô lập Workload', desc: 'Cordon node / drain traffic', color: '#F59E0B' },
      { time: 'T+0.9s', title: 'Triển khai thay thế', desc: 'Rolling restart replica mới', color: '#00F2FE' },
      { time: 'T+1.8s', title: 'Khôi phục hoàn toàn', desc: '100% SLA Ready', color: '#10B981' },
    ];

    const render = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = '#1A1926';
      ctx.fillRect(0, 0, width, height);

      const gridSize = 24;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();

      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#28E99F';
      ctx.fillText('AUTONOMOUS REMEDIATION // MAPE-K TIMELINE', 20, 24);

      const lineY = height * 0.44;
      const padL = 40;
      const padR = 40;
      const trackW = width - padL - padR;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padL, lineY);
      ctx.lineTo(padL + trackW, lineY);
      ctx.stroke();

      const sweep = ((tick * 0.012) % 1);
      const sweepX = padL + sweep * trackW;

      ctx.strokeStyle = '#28E99F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padL, lineY);
      ctx.lineTo(sweepX, lineY);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sweepX, lineY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#28E99F';
      ctx.fill();

      stages.forEach((st, idx) => {
        const sx = padL + (idx / (stages.length - 1)) * trackW;

        const isPassed = sweepX >= sx;
        ctx.beginPath();
        ctx.arc(sx, lineY, isPassed ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isPassed ? st.color : '#3D3B4F';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = st.color;
        ctx.textAlign = 'center';
        ctx.fillText(st.time, sx, lineY - 14);

        ctx.font = '600 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(st.title, sx, lineY + 22);

        ctx.font = '500 7.5px "DM Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(st.desc, sx, lineY + 34);
        ctx.textAlign = 'left';
      });

      const badgeY = height - 28;
      ctx.fillStyle = 'rgba(40, 233, 159, 0.1)';
      ctx.fillRect(16, badgeY, width - 32, 20);
      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#28E99F';
      ctx.fillText('SPEED: 1.8s FULL RECOVERY • ZERO HUMAN FATIGUE • 100% REPRODUCIBLE', 24, badgeY + 13);

      ctx.restore();
      tick += 1;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`self-healing-timeline-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: '260px',
        height: '100%',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid rgba(61, 59, 79, 0.3)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        ...style,
      }}
      data-testid="self-healing-timeline-canvas"
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
    </div>
  );
};

export default SelfHealingTimelineCanvas;
