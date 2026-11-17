import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import './HumanControlSection.css';
import { ControlledSelfHealingStage } from './ControlledSelfHealingStage';

export const HumanControlSection = ({ className = '', onNavigate }) => {
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
      aria-label="Tự hành thông minh, Con người kiểm soát"
    >
      <div className="hcs-header-container">
        <span className="hcs-label-badge">[ Chính Sách & Xác Minh ]</span>
        <h2 className="hcs-heading">Tự hành thông minh, Con người kiểm soát</h2>
        <p className="hcs-subtitle">
          SelfHeal vận hành tự động trong ranh giới an toàn tuyệt đối, tự động tạm dừng để bạn phê duyệt
          trước các hành động có rủi ro cao.
        </p>
        <a
          href="/guide"
          onClick={(e) => handleNav(e, '/guide')}
          className="hcs-cta-btn"
        >
          <span>Khám phá Human-in-the-Loop</span>
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
