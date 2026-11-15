import React, { useRef, useEffect } from 'react';

export const TelemetryPulseCanvas = ({ className = '', style = {} }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let angle = 0;

    const pods = [
      { id: 'auth-gw-1', r: 0.42, a: 0.8, color: '#10B981', label: 'auth-gw-1', ping: 0 },
      { id: 'api-core-2', r: 0.65, a: 2.1, color: '#10B981', label: 'api-core-2', ping: 0 },
      { id: 'checkout-3', r: 0.52, a: 3.6, color: '#10B981', label: 'checkout-3', ping: 0 },
      { id: 'db-pool-4', r: 0.78, a: 4.8, color: '#00F2FE', label: 'db-pool-4', ping: 0 },
      { id: 'worker-5', r: 0.35, a: 5.7, color: '#10B981', label: 'worker-5', ping: 0 },
    ];

    const wavePoints = [];
    for (let i = 0; i < 60; i++) {
      wavePoints.push(Math.sin(i * 0.2) * 10 + 20);
    }

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

      const radarW = Math.min(width * 0.55, height - 32);
      const cx = radarW * 0.55;
      const cy = height * 0.5;
      const maxR = radarW * 0.42;

      ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, angle - 0.45, angle);
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      grad.addColorStop(0, 'rgba(40, 233, 159, 0.25)');
      grad.addColorStop(1, 'rgba(40, 233, 159, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.strokeStyle = '#28E99F';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();

      pods.forEach((p) => {
        const px = cx + Math.cos(p.a) * (p.r * maxR);
        const py = cy + Math.sin(p.a) * (p.r * maxR);

        const diff = Math.abs((angle % (Math.PI * 2)) - (p.a % (Math.PI * 2)));
        if (diff < 0.1) {
          p.ping = 1.0;
        }

        if (p.ping > 0) {
          ctx.beginPath();
          ctx.arc(px, py, 4 + (1 - p.ping) * 12, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(40, 233, 159, ${p.ping * 0.6})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          p.ping = Math.max(0, p.ping - 0.02);
        }

        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '600 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillText(p.label, px + 6, py - 4);
      });

      const waveX = Math.max(cx + maxR + 24, width * 0.54);
      const waveW = width - waveX - 20;
      if (waveW > 80) {
        const waveH = height * 0.52;
        const waveY = (height - waveH) * 0.5;

        ctx.strokeStyle = 'rgba(61, 59, 79, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(waveX, waveY, waveW, waveH);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(waveX, waveY, waveW, waveH);

        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00F2FE';
        ctx.fillText('LIVE TELEMETRY // eBPF STREAM', waveX + 10, waveY + 16);

        ctx.font = '600 8px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('LATENCY: 0.8ms • POLL: 10s • TLS: 443', waveX + 10, waveY + 30);

        wavePoints.shift();
        const nextVal = Math.sin((angle * 3) + Math.random() * 0.4) * (waveH * 0.22) + (waveH * 0.58);
        wavePoints.push(nextVal);

        ctx.strokeStyle = '#28E99F';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const step = waveW / (wavePoints.length - 1);
        wavePoints.forEach((val, idx) => {
          const ptX = waveX + idx * step;
          const ptY = waveY + val;
          if (idx === 0) ctx.moveTo(ptX, ptY);
          else ctx.lineTo(ptX, ptY);
        });
        ctx.stroke();
      }

      ctx.restore();
      angle += 0.024;
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
      className={`telemetry-pulse-canvas-wrapper ${className}`}
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
      data-testid="telemetry-pulse-canvas"
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

export default TelemetryPulseCanvas;
