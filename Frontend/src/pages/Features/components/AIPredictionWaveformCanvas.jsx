import React, { useRef, useEffect } from 'react';

export const AIPredictionWaveformCanvas = ({ className = '', style = {} }) => {
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

      const padL = 48;
      const padR = 24;
      const padT = 36;
      const padB = 40;
      const plotW = width - padL - padR;
      const plotH = height - padT - padB;

      const threshY = padT + plotH * 0.28;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, threshY);
      ctx.lineTo(padL + plotW, threshY);
      ctx.stroke();
      ctx.restore();

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('CRITICAL THRESHOLD (85% OOM RISK)', padL + 8, threshY - 6);

      const splitX = padL + plotW * 0.48;

      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(splitX, padT);
      ctx.lineTo(splitX, padT + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#00F2FE';
      ctx.fillText('PAST // T0', splitX - 54, padT + plotH + 20);
      ctx.fillStyle = '#F59E0B';
      ctx.fillText('FUTURE // GRU FORECAST (+30m)', splitX + 8, padT + plotH + 20);

      ctx.beginPath();
      const pastPts = 24;
      for (let i = 0; i <= pastPts; i++) {
        const px = padL + (i / pastPts) * (splitX - padL);
        const noise = Math.sin(i * 0.4 + tick * 0.05) * 6;
        const py = padT + plotH * 0.72 - (i / pastPts) * (plotH * 0.18) + noise;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#00F2FE';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      const futurePts = 28;
      const upperPts = [];
      const lowerPts = [];
      const centerPts = [];

      for (let j = 0; j <= futurePts; j++) {
        const ratio = j / futurePts;
        const fx = splitX + ratio * (padL + plotW - splitX);
        const rise = Math.pow(ratio, 1.4) * (plotH * 0.48);
        const cy = (padT + plotH * 0.54) - rise + Math.sin(j * 0.3 + tick * 0.04) * 4;
        const spread = ratio * 18;
        centerPts.push({ x: fx, y: cy });
        upperPts.push({ x: fx, y: cy - spread });
        lowerPts.push({ x: fx, y: cy + spread });
      }

      ctx.beginPath();
      upperPts.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      for (let k = lowerPts.length - 1; k >= 0; k--) {
        ctx.lineTo(lowerPts[k].x, lowerPts[k].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      ctx.fill();

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      centerPts.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();

      const breachPt = centerPts.find((p) => p.y <= threshY) || centerPts[centerPts.length - 8];
      const pulseR = 5 + Math.sin(tick * 0.1) * 3;
      ctx.beginPath();
      ctx.arc(breachPt.x, breachPt.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(breachPt.x, breachPt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('! ANOMALY IN 14m 20s', breachPt.x - 40, breachPt.y - 12);

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#28E99F';
      ctx.fillText('AI GRU-NEURAL // CONFIDENCE 94.6%', padL, padT - 12);

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
      className={`ai-prediction-waveform-wrapper ${className}`}
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
      data-testid="ai-prediction-waveform-canvas"
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

export default AIPredictionWaveformCanvas;
