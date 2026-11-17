import React, { useRef, useEffect } from 'react';

export const SecurityAuditChainCanvas = ({ className = '', style = {} }) => {
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

    const blocks = [
      { id: '#10841', action: 'AUDIT_INIT', by: 'k8s-agent', hash: 'sha256:7a9f...c2', status: 'VERIFIED' },
      { id: '#10842', action: 'SCALE_POD', by: 'sre-operator', hash: 'sha256:8f2b...e4', status: 'COMMITTED' },
      { id: '#10843', action: 'REVERT_DIFF', by: 'hitl-gate', hash: 'sha256:4d1e...a8', status: 'IMMUTABLE' },
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
      ctx.fillText('IMMUTABLE AUDIT TRAIL // POSTGRESQL SECURE BLOCK', 20, 24);

      const blockW = Math.min(130, (width - 80) / 3);
      const blockH = height * 0.44;
      const blockY = (height - blockH) * 0.48;
      const gap = (width - 40 - (blockW * 3)) / 2;

      blocks.forEach((blk, idx) => {
        const bx = 20 + idx * (blockW + gap);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(bx, blockY, blockW, blockH);
        ctx.strokeStyle = '#28E99F';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, blockY, blockW, blockH);

        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00F2FE';
        ctx.fillText(blk.id, bx + 8, blockY + 16);

        ctx.font = '600 7.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(blk.action, bx + 8, blockY + 32);

        ctx.font = '500 7px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(`by: ${blk.by}`, bx + 8, blockY + 46);

        ctx.fillStyle = '#F59E0B';
        ctx.fillText(blk.hash, bx + 8, blockY + 60);

        ctx.fillStyle = 'rgba(40, 233, 159, 0.2)';
        ctx.fillRect(bx + 8, blockY + blockH - 18, blockW - 16, 12);
        ctx.fillStyle = '#28E99F';
        ctx.fillText(blk.status, bx + 12, blockY + blockH - 9);

        if (idx < blocks.length - 1) {
          const nextBx = bx + blockW;
          const chainEndX = nextBx + gap;
          const chainY = blockY + blockH / 2;

          ctx.strokeStyle = 'rgba(40, 233, 159, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(nextBx, chainY);
          ctx.lineTo(chainEndX, chainY);
          ctx.stroke();

          const pulseX = nextBx + ((tick * 0.03 + idx * 0.5) % 1) * gap;
          ctx.beginPath();
          ctx.arc(pulseX, chainY, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#28E99F';
          ctx.fill();
        }
      });

      const footerY = height - 26;
      ctx.fillStyle = 'rgba(0, 242, 254, 0.08)';
      ctx.fillRect(16, footerY, width - 32, 18);
      ctx.font = '700 7.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#00F2FE';
      ctx.fillText('SECURITY STATUS: ZERO INBOUND PORTS • LEAST PRIVILEGE RBAC • TLS 1.3 CERTIFIED', 22, footerY + 12);

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
      className={`security-audit-chain-wrapper ${className}`}
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
      data-testid="security-audit-chain-canvas"
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

export default SecurityAuditChainCanvas;
