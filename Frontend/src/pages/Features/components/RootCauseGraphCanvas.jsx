import React, { useRef, useEffect } from 'react';

export const RootCauseGraphCanvas = ({ className = '', style = {} }) => {
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

    const nodes = [
      { id: 'ingress', label: 'Ingress Nginx', x: 0.18, y: 0.5, status: 'healthy', color: '#10B981' },
      { id: 'auth', label: 'Auth Svc', x: 0.44, y: 0.28, status: 'healthy', color: '#10B981' },
      { id: 'checkout', label: 'Checkout Pod', x: 0.44, y: 0.72, status: 'fault', color: '#EF4444' },
      { id: 'postgres', label: 'Postgres DB', x: 0.76, y: 0.5, status: 'healthy', color: '#00F2FE' },
    ];

    const edges = [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
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
      ctx.fillText('DEPENDENCY GRAPH // ROOT CAUSE TRACE', 20, 24);

      edges.forEach((edge, idx) => {
        const n1 = nodes[edge.from];
        const n2 = nodes[edge.to];
        const x1 = n1.x * width;
        const y1 = n1.y * height;
        const x2 = n2.x * width;
        const y2 = n2.y * height;

        ctx.strokeStyle = edge.to === 2 || edge.from === 2 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(0, 242, 254, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const progress = ((tick * 0.015 + idx * 0.25) % 1);
        const px = x1 + (x2 - x1) * progress;
        const py = y1 + (y2 - y1) * progress;

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = edge.to === 2 ? '#EF4444' : '#00F2FE';
        ctx.fill();
      });

      nodes.forEach((node) => {
        const nx = node.x * width;
        const ny = node.y * height;

        if (node.status === 'fault') {
          const pulse = 8 + Math.sin(tick * 0.08) * 4;
          ctx.beginPath();
          ctx.arc(nx, ny, 16 + pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(nx, ny, 14, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, nx, ny + 28);

        if (node.status === 'fault') {
          ctx.fillStyle = '#EF4444';
          ctx.fillText('! OOMKILLED (137)', nx, ny + 38);
        }
        ctx.textAlign = 'left';
      });

      const bannerY = height - 34;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(16, bannerY, width - 32, 24);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, bannerY, width - 32, 24);

      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('RCA DIAGNOSIS: Memory Leak in checkout-service • Confidence: 98.4%', 24, bannerY + 15);

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
      className={`root-cause-graph-wrapper ${className}`}
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
      data-testid="root-cause-graph-canvas"
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

export default RootCauseGraphCanvas;
