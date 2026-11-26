import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Bot, Users, Cpu, Check, Terminal, Layers, ArrowRight } from 'lucide-react';
import './OnboardingWorkflowSection.css';

export const OnboardingWorkflowSection = ({ className = '', onNavigate }) => {
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
      className={`onboarding-workflow-section ${className}`.trim()}
      data-testid="onboarding-workflow-section"
      aria-label={t('onboardingWorkflow.ariaLabel')}
    >
      {/* ================= HEADER BLOCK ================= */}
      <div className="ows-header-container">
        <div className="ows-header-flex">
          <div className="ows-header-left">
            <span className="ows-label-badge">{t('onboardingWorkflow.badge')}</span>
            <h2 className="ows-heading">{t('onboardingWorkflow.heading')}</h2>
            <p className="ows-subtitle">
              {t('onboardingWorkflow.subtitle')}
            </p>
          </div>

          <a
            href="/login"
            onClick={(e) => handleNav(e, '/login')}
            className="ows-header-btn"
          >
            <span>{t('onboardingWorkflow.cta')}</span>
          </a>
        </div>
      </div>

      {/* ================= FULL-WIDTH CAD RULER & BADGE BAND ================= */}
      <div className="ows-divider-container" aria-hidden="true">
        {/* Top Full-Width CAD Ruler Track with Precision Millimeter Ticks */}
        <div className="ows-ruler-track" />

        {/* Centered Neon Lime Badge aligned right in the middle between the 2 lines */}
        <span className="ows-neon-pill">{t('onboardingWorkflow.bandPill')}</span>

        {/* Bottom Full-Width Horizontal Dashed Guideline */}
        <div className="ows-band-bottom-line" />
      </div>

      {/* ================= FULL-WIDTH 4-CARD BLUEPRINT GRID ================= */}
      <div className="ows-grid-container">
        <div className="ows-grid">
          {/* ================= STEP 01: TẠO TỔ CHỨC & THIẾT LẬP MÔI TRƯỜNG ================= */}
          <article className="ows-card">
            <div className="ows-card-frame-row">
              <div className="ows-card-frame">
                <div className="ows-screen-box">
                  {/* Subtle CAD grid curve */}
                  <svg
                    className="ows-wireframe-svg"
                    viewBox="0 0 200 150"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M 10 30 Q 100 120 190 40" stroke="#3B82F6" strokeOpacity="0.25" strokeWidth="1" />
                    <path d="M 10 60 Q 100 140 190 70" stroke="#3B82F6" strokeOpacity="0.25" strokeWidth="1" />
                    <path d="M 10 90 Q 100 160 190 100" stroke="#3B82F6" strokeOpacity="0.2" strokeWidth="1" />
                  </svg>

                  {/* Form Mockup */}
                  <div className="ows-mockup-org">
                    <div className="ows-mockup-header-bar">
                      <span>{t('onboardingWorkflow.steps.step1.orgHeader')}</span>
                      <span className="ows-pill-active">{t('onboardingWorkflow.steps.step1.ready')}</span>
                    </div>
                    <div className="ows-form-row">
                      <span>Org Name:</span>
                      <span className="ows-form-val">Acme Cloud</span>
                    </div>
                    <div className="ows-form-row">
                      <span>K8s Cluster:</span>
                      <span className="ows-form-val">k8s-prod-01</span>
                    </div>
                    <div className="ows-form-row">
                      <span>Region:</span>
                      <span className="ows-form-val">ap-southeast-1</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ows-card-info">
              <span className="ows-step-num">01</span>
              <h3 className="ows-card-title">{t('onboardingWorkflow.steps.step1.title')}</h3>
              <p className="ows-card-desc">
                {t('onboardingWorkflow.steps.step1.desc')}
              </p>
            </div>
          </article>

          {/* ================= STEP 02: KẾT NỐI AGENT ================= */}
          <article className="ows-card">
            <div className="ows-card-frame-row">
              <div className="ows-card-frame">
                <div className="ows-screen-box">
                  {/* Subtle CAD rings */}
                  <svg
                    className="ows-wireframe-svg"
                    viewBox="0 0 200 150"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <ellipse cx="100" cy="75" rx="70" ry="30" stroke="#28E99F" strokeOpacity="0.3" strokeWidth="1" />
                    <ellipse cx="100" cy="75" rx="50" ry="20" stroke="#28E99F" strokeOpacity="0.2" strokeWidth="1" />
                  </svg>

                  {/* Agent Mockup */}
                  <div className="ows-mockup-agent">
                    <div className="ows-agent-cube" aria-hidden="true">
                      <Cpu size={22} color="#18221D" />
                    </div>
                    <div className="ows-cmd-pill">
                      helm install selfheal-agent
                    </div>
                    <div className="ows-policy-status">
                      <Check size={12} />
                      <span>eBPF Telemetry Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ows-card-info">
              <span className="ows-step-num">02</span>
              <h3 className="ows-card-title">{t('onboardingWorkflow.steps.step2.title')}</h3>
              <p className="ows-card-desc">
                {t('onboardingWorkflow.steps.step2.desc')}
              </p>
            </div>
          </article>

          {/* ================= STEP 03: MỜI NGƯỜI VÀO TỔ CHỨC ================= */}
          <article className="ows-card">
            <div className="ows-card-frame-row">
              <div className="ows-card-frame">
                <div className="ows-screen-box">
                  {/* Subtle CAD mesh */}
                  <svg
                    className="ows-wireframe-svg"
                    viewBox="0 0 200 150"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <line x1="20" y1="75" x2="180" y2="75" stroke="#3B82F6" strokeOpacity="0.2" strokeDasharray="3 3" />
                    <line x1="100" y1="20" x2="100" y2="130" stroke="#3B82F6" strokeOpacity="0.2" strokeDasharray="3 3" />
                  </svg>

                  {/* Members Mockup */}
                  <div className="ows-mockup-invite">
                    <div className="ows-mockup-header-bar">
                      <span>{t('onboardingWorkflow.steps.step3.header')}</span>
                      <Users size={12} color="#555368" />
                    </div>
                    <div className="ows-member-row">
                      <span>sre-lead@acme.com</span>
                      <span className="ows-role-badge">Admin</span>
                    </div>
                    <div className="ows-member-row">
                      <span>oncall-dev@acme.com</span>
                      <span className="ows-role-badge">Operator</span>
                    </div>
                    <div className="ows-member-row">
                      <span>viewer@acme.com</span>
                      <span className="ows-role-badge">Auditor</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ows-card-info">
              <span className="ows-step-num">03</span>
              <h3 className="ows-card-title">{t('onboardingWorkflow.steps.step3.title')}</h3>
              <p className="ows-card-desc">
                {t('onboardingWorkflow.steps.step3.desc')}
              </p>
            </div>
          </article>

          {/* ================= STEP 04: QUẢN LÝ NGƯỜI DÙNG VÀ POLICY VỚI AI ================= */}
          <article className="ows-card">
            <div className="ows-card-frame-row">
              <div className="ows-card-frame">
                <div className="ows-screen-box">
                  {/* Subtle CAD lines */}
                  <svg
                    className="ows-wireframe-svg"
                    viewBox="0 0 200 150"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M 40 40 L 160 110" stroke="#28E99F" strokeOpacity="0.3" strokeDasharray="2 2" />
                    <path d="M 40 110 L 160 40" stroke="#28E99F" strokeOpacity="0.3" strokeDasharray="2 2" />
                  </svg>

                  {/* Policy Gauge Mockup */}
                  <div className="ows-mockup-policy">
                    <div className="ows-gauge-badge ows-gauge-35">3/5 Auto-Review</div>
                    <div className="ows-gauge-badge ows-gauge-45">4/5 Safety Check</div>
                    <div className="ows-gauge-badge ows-gauge-55">5/5 READY TO HEAL!</div>
                    <div className="ows-policy-status">
                      <ShieldCheck size={12} color="#059669" />
                      <span>HITL Policy Enforced</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ows-card-info">
              <span className="ows-step-num">04</span>
              <h3 className="ows-card-title">{t('onboardingWorkflow.steps.step4.title')}</h3>
              <p className="ows-card-desc">
                {t('onboardingWorkflow.steps.step4.desc')}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default OnboardingWorkflowSection;
