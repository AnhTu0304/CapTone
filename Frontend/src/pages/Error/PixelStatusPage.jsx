import React, { useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import './PixelStatusPage.css';

export const PixelStatusPage = ({
  code,
  statusLabel,
  isTextStatus = false,
  title,
  message,
  imageSrc,
  imageAlt,
  backgroundSrc,
  backgroundFallback = 'linear-gradient(180deg, #5BA7D1 0%, #7CC1E4 48%, #D9CAA3 48.2%, #CDB98E 100%)',
  testId = 'pixel-status-page',
  embedded = false,
  warnPath = null,
}) => {
  const { warning } = useToast();
  const lastWarnedPathRef = useRef(null);

  useEffect(() => {
    if (!warnPath || lastWarnedPathRef.current === warnPath) return;
    lastWarnedPathRef.current = warnPath;
    warning(
      `Đường dẫn "${warnPath}" không tồn tại trên hệ thống hoặc đã bị di chuyển.`,
      `Cảnh báo chuyển trang — ${code || '404'}`
    );
  }, [warnPath, code, warning]);

  const displayCode = statusLabel || code;
  const stageStyle = backgroundSrc
    ? { backgroundImage: `url(${backgroundSrc})` }
    : { backgroundImage: backgroundFallback };

  return (
    <section
      className={`pixel-scenic-page ${embedded ? 'pixel-scenic-page--embedded' : ''}`}
      style={stageStyle}
      data-testid={testId}
    >
      <div className="pixel-scenic-container">
        <div className="pixel-scenic-left">
          <div
            className={`pixel-scenic-code ${isTextStatus ? 'pixel-scenic-code--text' : ''}`}
            data-testid={`${testId}-code`}
          >
            {displayCode}
          </div>

          <div
            className="pixel-scenic-bubble"
            role="alert"
            aria-live="polite"
            data-testid={`${testId}-note`}
          >
            <h1 className="pixel-scenic-note-title">{title}</h1>
            <p className="pixel-scenic-note-message">{message}</p>
          </div>
        </div>

        <div className="pixel-scenic-right">
          <img
            src={imageSrc}
            alt={imageAlt || title}
            className="pixel-scenic-artwork"
            data-testid={`${testId}-artwork`}
          />
          <div className="pixel-scenic-shadow" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
};

export default PixelStatusPage;
