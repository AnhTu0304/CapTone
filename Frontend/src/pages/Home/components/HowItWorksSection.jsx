import React from 'react';
import { useTranslation } from 'react-i18next';
import './HowItWorksSection.css';
import videocard1 from '../../../assets/videocard1.mp4';
import videocard2 from '../../../assets/card2.mp4';
import videocard3 from '../../../assets/card3.mp4';

export const HowItWorksSection = ({ className = '' }) => {
  const { t } = useTranslation('home');
  return (
    <section
      className={`how-it-works-section ${className}`.trim()}
      data-testid="how-it-works-section"
      aria-label={t('howItWorks.ariaLabel')}
    >
      {/* Continuous Left & Right Vertical Dashed Guidelines spanning the section down to the bottom scan track dots */}
      <span className="hiw-guide-v-left" aria-hidden="true" />
      <span className="hiw-guide-v-right" aria-hidden="true" />

      {/* ================= HEADER BLOCK WITH TOP LINE, BADGE, AND SUB-LINE ================= */}
      <div className="hiw-header-block" aria-hidden="true">
        {/* Horizontal Line 1 (Above Badge) */}
        <div className="hiw-track hiw-track-top">
          <div className="hiw-track-line" />
          <span className="hiw-track-dot hiw-dot-left" />
          <span className="hiw-track-dot hiw-dot-right" />
        </div>

        {/* Badge HOW IT WORKS */}
        <div className="hiw-badge-wrapper">
          <div className="hiw-badge-box">
            <span className="hiw-badge-text">{t('howItWorks.badgeTop')}</span>
          </div>
        </div>

        {/* Horizontal Line 2 (Directly Under Badge) */}
        <div className="hiw-track hiw-track-sub">
          <div className="hiw-track-line" />
          <span className="hiw-track-dot hiw-dot-left" />
          <span className="hiw-track-dot hiw-dot-right" />
        </div>
      </div>

      {/* ================= CONTENT CONTAINER (~100px SPACING BELOW HOW IT WORKS) ================= */}
      <div className="hiw-content-container">
        {/* 3 Step Cards Grid */}
        <div className="hiw-grid">
          {/* ================= STEP 01: QUAN SÁT ================= */}
          <article className="hiw-card" id="monitoring">
            <div className="hiw-screen-frame">
              <div className="hiw-screen-inner-gap">
                <div className="hiw-screen" aria-hidden="true">
                  <video
                    className="hiw-screen-video"
                    src={videocard1}
                    autoPlay
                    loop
                    muted
                    playsInline
                    ref={(el) => {
                      if (el) el.playbackRate = 1.75;
                    }}
                    onLoadedMetadata={(e) => {
                      e.currentTarget.playbackRate = 1.75;
                    }}
                    aria-label={t('howItWorks.steps.0.videoAria')}
                  />
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">{t('howItWorks.steps.0.label')}</span>
              <h3 className="hiw-title">{t('howItWorks.steps.0.title')}</h3>
              <p className="hiw-desc">
                {t('howItWorks.steps.0.desc')}
              </p>
            </div>
          </article>

          {/* ================= STEP 02: DỰ ĐOÁN ================= */}
          <article className="hiw-card" id="prediction">
            <div className="hiw-screen-frame">
              <div className="hiw-screen-inner-gap">
                <div className="hiw-screen" aria-hidden="true">
                  <video
                    className="hiw-screen-video"
                    src={videocard2}
                    autoPlay
                    loop
                    muted
                    playsInline
                    ref={(el) => {
                      if (el) el.playbackRate = 1.75;
                    }}
                    onLoadedMetadata={(e) => {
                      e.currentTarget.playbackRate = 1.75;
                    }}
                    aria-label={t('howItWorks.steps.1.videoAria')}
                  />
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">{t('howItWorks.steps.1.label')}</span>
              <h3 className="hiw-title">{t('howItWorks.steps.1.title')}</h3>
              <p className="hiw-desc">
                {t('howItWorks.steps.1.desc')}
              </p>
            </div>
          </article>

          {/* ================= STEP 03: KHÔI PHỤC ================= */}
          <article className="hiw-card" id="self-healing">
            <div className="hiw-screen-frame">
              <div className="hiw-screen-inner-gap">
                <div className="hiw-screen" aria-hidden="true">
                  <video
                    className="hiw-screen-video"
                    src={videocard3}
                    autoPlay
                    loop
                    muted
                    playsInline
                    ref={(el) => {
                      if (el) el.playbackRate = 1.75;
                    }}
                    onLoadedMetadata={(e) => {
                      e.currentTarget.playbackRate = 1.75;
                    }}
                    aria-label={t('howItWorks.steps.2.videoAria')}
                  />
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">{t('howItWorks.steps.2.label')}</span>
              <h3 className="hiw-title">{t('howItWorks.steps.2.title')}</h3>
              <p className="hiw-desc">
                {t('howItWorks.steps.2.desc')}
              </p>
            </div>
          </article>
        </div>
      </div>

      {/* ================= PREDICTION SUMMARY FRAMED BLOCK (BELOW 3 STEPS) ================= */}
      <div className="hiw-prediction-block">
        {/* Top Horizontal Line of Prediction Block */}
        <div className="hiw-track hiw-track-divider" aria-hidden="true">
          <div className="hiw-track-line" />
          <span className="hiw-track-dot hiw-dot-left" />
          <span className="hiw-track-dot hiw-dot-right" />
        </div>

        {/* Centered Title & Description */}
        <div className="hiw-prediction-content">
          <h2 className="hiw-prediction-title">{t('howItWorks.predictionTitle')}</h2>
          <p className="hiw-prediction-desc">
            {t('howItWorks.predictionDesc')}
          </p>
        </div>

        {/* Bottom Horizontal Line of Prediction Block */}
        <div className="hiw-track hiw-track-bottom" aria-hidden="true">
          <div className="hiw-track-line" />
          <span className="hiw-track-dot hiw-dot-left" />
          <span className="hiw-track-dot hiw-dot-right" />
        </div>

        {/* Bottom Monospace Badge under the 2nd Line */}
        <div className="hiw-badge-wrapper hiw-prediction-badge-wrapper">
          <div className="hiw-badge-box">
            <span className="hiw-badge-text">{t('howItWorks.badgeBottom')}</span>
          </div>
        </div>

        {/* Multi-line Horizontal Pinstripe Band Covering Below Badge */}
        <div className="hiw-bottom-scan-track" data-testid="hiw-bottom-scan-track" aria-hidden="true">
          <span className="hiw-track-dot hiw-dot-left hiw-scan-dot" />
          <span className="hiw-track-dot hiw-dot-right hiw-scan-dot" />
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
