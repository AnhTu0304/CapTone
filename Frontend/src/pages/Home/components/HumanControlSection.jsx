import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import './HumanControlSection.css';

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
      className={`human-control-section ${className}`.trim()}
      data-testid="human-control-section"
      aria-label="Tự hành thông minh, Con người kiểm soát"
    >
      {/* ================= HEADER BLOCK ================= */}
      <div className="hcs-header-container">
        <span className="hcs-label-badge">[ HITL_POLICY:= @VERIFIED ]</span>
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

      {/* ================= CYBERNETIC TOPOGRAPHIC LANDSCAPE ================= */}
      <div className="hcs-canvas-wrapper" aria-hidden="true">
        <div className="hcs-canvas-stage">
          {/* Left Telemetry Column */}
          <div className="hcs-telemetry-col-left">
            <span>TESTGEN</span>
            <span>TESTGEN</span>
            <span>AUTOMATIC TESTGEN</span>
            <span>AUTOMATIC TESTGEN</span>
            <span>EBPF_STREAM_INGEST</span>
            <span>POLICY_EVALUATE</span>
            <span>ROLLOUT_VERIFIED</span>
            <span>POD_GUARD_ACTIVE</span>
          </div>

          {/* Right Telemetry Column */}
          <div className="hcs-telemetry-col-right">
            <span>SANDBOX_EXECUTE</span>
            <span>SANDBOX_EXECUTE</span>
            <span>AUDIT_LOG_IMMUTABLE</span>
            <span>ROLLBACK_ARMED</span>
            <span>HITL_APPROVAL_GATE</span>
            <span>DRIFT_DETECTOR</span>
          </div>

          {/* Top-Right Geodesic Polyhedron Wireframe */}
          <svg
            className="hcs-polyhedron-svg"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon
              points="100,20 160,55 180,120 135,175 65,175 20,120 40,55"
              stroke="#E4FF6B"
              strokeWidth="1.2"
              strokeOpacity="0.85"
            />
            <polygon
              points="100,45 145,70 155,115 125,150 75,150 45,115 55,70"
              stroke="#E4FF6B"
              strokeWidth="0.8"
              strokeOpacity="0.6"
            />
            <line x1="100" y1="20" x2="100" y2="45" stroke="#E4FF6B" strokeWidth="0.8" />
            <line x1="160" y1="55" x2="145" y2="70" stroke="#E4FF6B" strokeWidth="0.8" />
            <line x1="180" y1="120" x2="155" y2="115" stroke="#E4FF6B" strokeWidth="0.8" />
            <line x1="135" y1="175" x2="125" y2="150" stroke="#E4FF6B" strokeWidth="0.8" />
            <line x1="65" y1="175" x2="75" y2="150" stroke="#E4FF6B" strokeWidth="0.8" />
            <line x1="20" y1="120" x2="45" y2="115" stroke="#E4FF6B" strokeWidth="0.8" />
            <line x1="40" y1="55" x2="55" y2="70" stroke="#E4FF6B" strokeWidth="0.8" />
            {/* Center Core Node */}
            <circle cx="100" cy="100" r="4" fill="#E4FF6B" />
          </svg>

          {/* Floating Metric Badges with Leader Lines */}
          <div className="hcs-floating-badge" style={{ top: '65px', left: '33%' }}>
            <div className="hcs-badge-bar-pink" />
            <div className="hcs-badge-bar-yellow" />
            <div className="hcs-badge-bar-blue" />
          </div>

          <div className="hcs-floating-badge" style={{ top: '90px', right: '34%' }}>
            <div className="hcs-badge-bar-yellow" />
            <div className="hcs-badge-bar-pink" />
            <div className="hcs-badge-bar-blue" />
          </div>

          <div className="hcs-floating-badge" style={{ top: '135px', left: '44%' }}>
            <div className="hcs-badge-bar-pink" />
            <div className="hcs-badge-bar-yellow" />
          </div>

          {/* Topographic Waveform Mountain Curves */}
          <svg
            className="hcs-waveform-svg"
            viewBox="0 0 1200 380"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            {/* Fine Leader Lines Connecting Peaks to Badges */}
            <line x1="420" y1="210" x2="400" y2="105" stroke="#FF8BA7" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="720" y1="230" x2="760" y2="125" stroke="#FEF08A" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="535" y1="185" x2="535" y2="155" stroke="#818CF8" strokeWidth="1" strokeDasharray="2 2" />

            {/* Contour Waves (Layered Undulating Curves) */}
            <g stroke="#3B82F6" strokeWidth="1.2">
              {/* Wave 1 (Deepest / Highest Peaks) */}
              <path d="M 200 240 Q 380 160 420 200 Q 510 140 550 210 Q 700 170 780 220 Q 860 170 1000 240" stroke="#2563EB" strokeWidth="1.6" />

              {/* Wave 2 */}
              <path d="M 190 250 Q 380 170 420 210 Q 510 150 550 220 Q 700 180 780 230 Q 860 180 1010 250" strokeOpacity="0.95" />

              {/* Wave 3 */}
              <path d="M 180 260 Q 380 180 420 220 Q 510 160 550 230 Q 700 190 780 240 Q 860 190 1020 260" strokeOpacity="0.9" />

              {/* Wave 4 */}
              <path d="M 170 270 Q 380 190 420 230 Q 510 170 550 240 Q 700 200 780 250 Q 860 200 1030 270" strokeOpacity="0.85" />

              {/* Wave 5 */}
              <path d="M 160 280 Q 380 200 420 240 Q 510 180 550 250 Q 700 210 780 260 Q 860 210 1040 280" strokeOpacity="0.8" />

              {/* Wave 6 */}
              <path d="M 150 290 Q 380 210 420 250 Q 510 190 550 260 Q 700 220 780 270 Q 860 220 1050 290" strokeOpacity="0.75" />

              {/* Wave 7 */}
              <path d="M 140 300 Q 380 220 420 260 Q 510 200 550 270 Q 700 230 780 280 Q 860 230 1060 300" strokeOpacity="0.7" />

              {/* Wave 8 */}
              <path d="M 130 310 Q 380 230 420 270 Q 510 210 550 280 Q 700 240 780 290 Q 860 240 1070 310" strokeOpacity="0.65" />

              {/* Wave 9 */}
              <path d="M 120 320 Q 380 240 420 280 Q 510 220 550 290 Q 700 250 780 300 Q 860 250 1080 320" strokeOpacity="0.6" />

              {/* Wave 10 */}
              <path d="M 110 330 Q 380 250 420 290 Q 510 230 550 300 Q 700 260 780 310 Q 860 260 1090 330" strokeOpacity="0.55" />

              {/* Wave 11 */}
              <path d="M 100 340 Q 380 260 420 300 Q 510 240 550 310 Q 700 270 780 320 Q 860 270 1100 340" strokeOpacity="0.5" />

              {/* Wave 12 */}
              <path d="M 90 350 Q 380 270 420 310 Q 510 250 550 320 Q 700 280 780 330 Q 860 280 1110 350" strokeOpacity="0.45" />

              {/* Wave 13 */}
              <path d="M 80 360 Q 380 280 420 320 Q 510 260 550 330 Q 700 290 780 340 Q 860 290 1120 360" strokeOpacity="0.4" />
            </g>

            {/* Glowing Peak Markers (Yellow/Gold Dots) */}
            <g className="hcs-pulse-node">
              <rect x="416" y="196" width="9" height="9" fill="#ECFFA3" rx="1.5" />
              <rect x="531" y="181" width="9" height="9" fill="#ECFFA3" rx="1.5" />
              <rect x="776" y="216" width="9" height="9" fill="#ECFFA3" rx="1.5" />
              <rect x="630" y="270" width="8" height="8" fill="#FEF08A" rx="1.5" />
              <rect x="340" y="295" width="8" height="8" fill="#FEF08A" rx="1.5" />
              <rect x="880" y="280" width="8" height="8" fill="#FEF08A" rx="1.5" />
            </g>
          </svg>
        </div>
      </div>

      {/* ================= BOTTOM RULER TRACK WITH CYCLIC TELEMETRY ================= */}
      <div className="hcs-bottom-track" aria-hidden="true">
        <span className="hcs-track-text">
          OBSERVE • PREDICT • EVALUATE • APPROVE • RECOVER • VERIFY • OBSERVE • PREDICT • RECOVER • VERIFY
        </span>
      </div>

      {/* ================= BOTTOM HATCHED RIBBON BORDER ================= */}
      <div className="hcs-bottom-hatch" aria-hidden="true" />
    </section>
  );
};

export default HumanControlSection;
