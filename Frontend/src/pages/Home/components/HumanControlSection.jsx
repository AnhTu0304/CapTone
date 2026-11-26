import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import './HumanControlSection.css';
import { ControlledSelfHealingStage } from './ControlledSelfHealingStage';

export const HumanControlSection = ({ className = '', onNavigate }) => {
  const { t } = useTranslation('home');
  const handleNav = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <section
      id="human-approval"
      className={`human-control-section ${className}`.trim()}
      data-testid="human-control-section"
      aria-label={t('humanControl.ariaLabel')}
    >
      <div className="hcs-header-container">
        <span className="hcs-label-badge">{t('humanControl.badge')}</span>
        <h2 className="hcs-heading">{t('humanControl.heading')}</h2>
        <p className="hcs-subtitle">
          {t('humanControl.subtitle')}
        </p>
        <a
          href="/guide"
          onClick={(e) => handleNav(e, '/guide')}
          className="hcs-cta-btn"
        >
          <span>{t('humanControl.cta')}</span>
          <ArrowRight size={16} />
        </a>
      </div>

      <div className="hcs-canvas-wrapper">
        <div className="hcs-canvas-stage">
          <ControlledSelfHealingStage />
        </div>
      </div>

      <div className="hcs-bottom-track" aria-hidden="true">
        <span className="hcs-track-text">
          OBSERVE • PREDICT • EVALUATE • APPROVE • RECOVER • VERIFY • OBSERVE • PREDICT • RECOVER • VERIFY
        </span>
      </div>

      <div className="hcs-bottom-hatch" aria-hidden="true" />
    </section>
  );
};

export default HumanControlSection;
