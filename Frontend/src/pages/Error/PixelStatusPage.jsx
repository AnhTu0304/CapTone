import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import './PixelStatusPage.css';

export const PixelStatusPage = ({
  code,
  statusKey,
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
  warnTitle = null,
  warnMessage = null,
}) => {
  const { t } = useTranslation('error');
  const { warning } = useToast();
  const lastWarnedPathRef = useRef(null);

  const resolvedTitle = title || (statusKey ? t(`statuses.${statusKey}.title`) : '');
  const resolvedMessage = message || (statusKey ? t(`statuses.${statusKey}.message`) : '');
  const resolvedImageAlt = imageAlt || (statusKey ? t(`statuses.${statusKey}.imageAlt`) : resolvedTitle);

  useEffect(() => {
    if (!warnPath || lastWarnedPathRef.current === warnPath) return;
    lastWarnedPathRef.current = warnPath;
    warning(
      warnMessage || t('defaultWarnMessage', { path: warnPath }),
      warnTitle || t('defaultWarnTitle', { code: code || '404' })
    );
  }, [warnPath, warnTitle, warnMessage, code, warning, t]);

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
            <h1 className="pixel-scenic-note-title">{resolvedTitle}</h1>
            <p className="pixel-scenic-note-message">{resolvedMessage}</p>
          </div>
        </div>

        <div className="pixel-scenic-right">
          <img
            src={imageSrc}
            alt={resolvedImageAlt || resolvedTitle}
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
