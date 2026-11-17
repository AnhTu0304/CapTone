import React, { useRef, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import './NotebookNoticeCard.css';

export const NotebookNoticeCard = ({
  type = 'tip',
  important = false,
  title,
  children,
  className = '',
  style = {},
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const isImportant = Boolean(important || type === 'warning');

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderCard = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height + 22;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const padX = width > 640 ? 6 : 2;
      const padTop = 16;
      const padBottom = 8;
      const bookX = padX;
      const bookY = padTop;
      const bookW = width - padX * 2;
      const bookH = height - padTop - padBottom;
      const radius = 6;

      const drawRoundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
      };

      drawRoundRect(bookX + 3, bookY + 3, bookW, bookH, radius);
      ctx.fillStyle = '#D4D4DA';
      ctx.fill();

      drawRoundRect(bookX + 1.5, bookY + 1.5, bookW, bookH, radius);
      ctx.fillStyle = '#E2E2E8';
      ctx.fill();

      drawRoundRect(bookX, bookY, bookW, bookH, radius);
      ctx.fillStyle = '#EEEEEE';
      ctx.fill();
      ctx.strokeStyle = isImportant ? 'rgba(245, 158, 11, 0.45)' : 'rgba(61, 59, 79, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      drawRoundRect(bookX, bookY, bookW, bookH, radius);
      if (typeof ctx.clip === 'function') {
        ctx.clip();
      }

      const gridSize = 24;
      ctx.strokeStyle = 'rgba(61, 59, 79, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = bookX; gx <= bookX + bookW; gx += gridSize) {
        ctx.moveTo(gx + 0.5, bookY);
        ctx.lineTo(gx + 0.5, bookY + bookH);
      }
      for (let gy = bookY; gy <= bookY + bookH; gy += gridSize) {
        ctx.moveTo(bookX, gy + 0.5);
        ctx.lineTo(bookX + bookW, gy + 0.5);
      }
      ctx.stroke();
      ctx.restore();

      const perfY = bookY + 24;
      ctx.save();
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([4, 4]);
      }
      ctx.strokeStyle = 'rgba(61, 59, 79, 0.2)';
      ctx.beginPath();
      ctx.moveTo(bookX + 2, perfY + 0.5);
      ctx.lineTo(bookX + bookW - 2, perfY + 0.5);
      ctx.stroke();
      ctx.restore();

      const ringStep = width > 500 ? 32 : 24;
      const ringStart = bookX + 22;
      const ringEnd = bookX + bookW - 18;

      for (let rx = ringStart; rx <= ringEnd; rx += ringStep) {
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(rx, bookY + 12, 3, 4.5, 0, 0, Math.PI * 2);
        } else {
          ctx.rect(rx - 3, bookY + 8, 6, 9);
        }
        ctx.fillStyle = '#B8B8C4';
        ctx.fill();
        ctx.strokeStyle = '#8E8D9D';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rx - 3, bookY + 14);
        ctx.bezierCurveTo(rx - 5, bookY - 8, rx + 5, bookY - 8, rx + 3, bookY + 14);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#3D3B4F';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rx - 1, bookY - 5);
        ctx.bezierCurveTo(rx, bookY - 7, rx + 2, bookY - 6, rx + 2, bookY - 4);
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.stroke();
      }

      if (isImportant) {
        const px = bookX + 18;
        const py = bookY - 8;
        const bodyLen = 46;
        const ferruleLen = 9;
        const eraserLen = 9;
        const woodLen = 13;
        const leadLen = 5;
        const pH = 8.5;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2.5;

        ctx.beginPath();
        ctx.moveTo(px + 4, py);
        ctx.lineTo(px + eraserLen, py);
        ctx.lineTo(px + eraserLen, py + pH);
        ctx.lineTo(px + 4, py + pH);
        ctx.arcTo(px, py + pH, px, py + pH - 4, 3);
        ctx.lineTo(px, py + 4);
        ctx.arcTo(px, py, px + 4, py, 3);
        ctx.closePath();
        ctx.fillStyle = '#F472B6';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        const ferruleX = px + eraserLen;
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(ferruleX, py, ferruleLen, pH);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(ferruleX + 3, py);
        ctx.lineTo(ferruleX + 3, py + pH);
        ctx.moveTo(ferruleX + 6, py);
        ctx.lineTo(ferruleX + 6, py + pH);
        ctx.stroke();

        const bodyX = ferruleX + ferruleLen;
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(bodyX, py, bodyLen, 2.8);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(bodyX, py + 2.8, bodyLen, 2.9);
        ctx.fillStyle = '#D97706';
        ctx.fillRect(bodyX, py + 5.7, bodyLen, 2.8);

        const woodX = bodyX + bodyLen;
        ctx.beginPath();
        ctx.moveTo(woodX, py);
        ctx.lineTo(woodX + woodLen, py + pH / 2);
        ctx.lineTo(woodX, py + pH);
        ctx.closePath();
        ctx.fillStyle = '#FDE68A';
        ctx.fill();

        const leadX = woodX + woodLen - leadLen;
        ctx.beginPath();
        ctx.moveTo(leadX, py + (pH / 2) - 1.4);
        ctx.lineTo(woodX + woodLen, py + pH / 2);
        ctx.lineTo(leadX, py + (pH / 2) + 1.4);
        ctx.closePath();
        ctx.fillStyle = '#1E293B';
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
    };

    renderCard();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => renderCard());
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, [type, isImportant]);

  const IconComponent = isImportant ? AlertTriangle : type === 'info' ? Info : CheckCircle;
  const iconColor = isImportant ? '#B45309' : type === 'info' ? '#2563EB' : '#059669';
  const typeClass = isImportant ? 'warning' : type === 'info' ? 'info' : 'tip';

  return (
    <div
      ref={containerRef}
      className={`notebook-notice-card ${className}`}
      style={style}
      data-testid="notebook-notice-card"
      data-card-type={typeClass}
      data-important={isImportant ? 'true' : 'false'}
    >
      <canvas
        ref={canvasRef}
        className="notebook-notice-canvas"
        data-testid="notebook-notice-canvas"
        aria-hidden="true"
      />
      <div className="notebook-notice-content">
        {title && (
          <div className="notebook-notice-header">
            <span className="notebook-notice-icon">
              <IconComponent size={18} color={iconColor} />
            </span>
            <h4
              className={`notebook-notice-title notebook-notice-title--${typeClass}`}
              data-testid="notebook-notice-title"
            >
              {title}
            </h4>
          </div>
        )}
        <div
          className={`notebook-notice-body notebook-notice-body--${typeClass}`}
          data-testid="notebook-notice-body"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default NotebookNoticeCard;
