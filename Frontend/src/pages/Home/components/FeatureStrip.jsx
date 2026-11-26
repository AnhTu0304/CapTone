import React from 'react';
import { useTranslation } from 'react-i18next';
import './FeatureStrip.css';

export const FeatureStrip = ({ className = '', onNavigate }) => {
  const { t } = useTranslation('home');
  const handleLearnMore = (e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/guide');
    } else {
      window.history.pushState({}, '', '/guide');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <section
      className={`agent-bridge-banner ${className}`.trim()}
      data-testid="agent-bridge-section"
      aria-label={t('featureStrip.ariaLabel')}
    >
      {/* 2. Top Parallel Pinstripe Scanline Bar with Guideline Nodes */}
      <div className="agent-scan-track" aria-hidden="true">
        <span className="agent-track-node agent-node-top-left" />
        <span className="agent-track-node agent-node-top-right" />
      </div>

      {/* 3. Continuous Vertical Guidelines */}
      <span aria-hidden="true" className="agent-guide-v-left" />
      <span aria-hidden="true" className="agent-guide-v-right" />

      {/* 4. Framed Box (Horizontal Tracks + 4 Corner Hexagon Pin Nodes + Inner Content Box) */}
      <div className="agent-framed-box-wrapper">
        {/* Full-width Top Horizontal Guideline */}
        <div className="agent-box-line-track agent-line-top" aria-hidden="true" />

        {/* 4 Corner Hexagon Pin Nodes at the 4 Box Intersections */}
        <span aria-hidden="true" className="agent-corner-pin pin-tl" />
        <span aria-hidden="true" className="agent-corner-pin pin-tr" />
        <span aria-hidden="true" className="agent-corner-pin pin-bl" />
        <span aria-hidden="true" className="agent-corner-pin pin-br" />

        {/* Inner Content Area framed directly between the vertical guidelines */}
        <div className="agent-box-inner">
          {/* Left Content: [ AGENT ] tag, headline, concise bridge description */}
          <div className="agent-bridge-content">
            <div className="agent-tag">{t('featureStrip.tag')}</div>

            <h2 className="agent-heading">
              {t('featureStrip.heading')}
            </h2>

            <p className="agent-description">
              {t('featureStrip.description')}
            </p>
          </div>

          {/* Right Hexagon Button */}
          <div className="agent-bridge-action">
            <a
              href="/guide"
              onClick={handleLearnMore}
              className="agent-btn-learn-more"
              title={t('featureStrip.learnMore')}
            >
              {t('featureStrip.learnMore')}
            </a>
          </div>
        </div>

        {/* Full-width Bottom Horizontal Guideline */}
        <div className="agent-box-line-track agent-line-bottom" aria-hidden="true" />
      </div>

      {/* Bottom spacer for clean cadence before HowItWorksSection */}
      <div className="agent-bottom-spacer" aria-hidden="true" />
    </section>
  );
};

export default FeatureStrip;
