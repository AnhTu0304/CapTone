import React from 'react';
import './HowItWorksSection.css';
import { TelemetryStreamIllustration } from './illustrations/TelemetryStreamIllustration';

export const HowItWorksSection = ({ className = '' }) => {
  return (
    <section
      className={`how-it-works-section ${className}`.trim()}
      data-testid="how-it-works-section"
      aria-label="Cách thức SelfHeal hoạt động"
    >
      {/* Continuous Left & Right Vertical Dashed Guidelines spanning the entire section */}
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
            <span className="hiw-badge-text">HOW IT WORKS</span>
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
          <article className="hiw-card">
            <div className="hiw-screen-frame">
              <div className="hiw-screen-inner-gap">
                <div className="hiw-screen" aria-hidden="true">
                  <TelemetryStreamIllustration className="hiw-svg-canvas" />
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">STEP 01</span>
              <h3 className="hiw-title">Thu thập &amp; Quan sát đa chiều</h3>
              <p className="hiw-desc">
                Lập bản đồ topo toàn bộ cụm k8s — liên tục thu nạp eBPF telemetry, pod metrics và event stream thời gian thực mà không gây ảnh hưởng hiệu năng.
              </p>
            </div>
          </article>

          {/* ================= STEP 02: DỰ ĐOÁN ================= */}
          <article className="hiw-card">
            <div className="hiw-screen-frame">
              <div className="hiw-screen-inner-gap">
                <div className="hiw-screen" aria-hidden="true">
                  <svg
                    className="hiw-svg-canvas"
                    viewBox="0 0 420 270"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <radialGradient id="hiw-core-glow-2" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#28E99F" stopOpacity="0.75" />
                        <stop offset="60%" stopColor="#3B67F6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#3B67F6" stopOpacity="0" />
                      </radialGradient>
                    </defs>

                    {/* Perspective Top Ceiling Plane */}
                    <g stroke="#9CE8C9" strokeOpacity="0.22" strokeWidth="0.9">
                      <line x1="200" y1="20" x2="330" y2="20" />
                      <line x1="175" y1="40" x2="355" y2="40" />
                      <line x1="150" y1="65" x2="380" y2="65" />
                      <line x1="200" y1="20" x2="150" y2="65" />
                      <line x1="240" y1="20" x2="220" y2="65" />
                      <line x1="290" y1="20" x2="300" y2="65" />
                      <line x1="330" y1="20" x2="380" y2="65" />
                    </g>

                    {/* Perspective Bottom Floor Plane */}
                    <g stroke="#9CE8C9" strokeOpacity="0.22" strokeWidth="0.9">
                      <line x1="150" y1="205" x2="380" y2="205" />
                      <line x1="175" y1="230" x2="355" y2="230" />
                      <line x1="200" y1="250" x2="330" y2="250" />
                      <line x1="150" y1="205" x2="200" y2="250" />
                      <line x1="220" y1="205" x2="240" y2="250" />
                      <line x1="300" y1="205" x2="290" y2="250" />
                      <line x1="380" y1="205" x2="330" y2="250" />
                    </g>

                    {/* Target Connecting Leader Lines */}
                    <polyline points="145,95 240,95 245,115" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.7" fill="none" />
                    <polyline points="145,135 230,135" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.7" fill="none" />
                    <polyline points="145,175 238,175 245,155" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.7" fill="none" />

                    {/* 3 Parallel Agent Badges on Left */}
                    <g transform="translate(30, 83)">
                      <rect width="112" height="24" fill="#1C1A26" stroke="#9CE8C9" strokeOpacity="0.5" rx="2" />
                      <circle cx="12" cy="12" r="3" fill="#28E99F" />
                      <text x="24" y="16" fill="#C6F9E2" fontFamily="var(--font-mono)" fontSize="9" fontWeight="600" letterSpacing="0.08em">
                        PARALLEL AGENT
                      </text>
                    </g>

                    <g transform="translate(30, 123)">
                      <rect width="112" height="24" fill="#1C1A26" stroke="#9CE8C9" strokeOpacity="0.5" rx="2" />
                      <circle cx="12" cy="12" r="3" fill="#28E99F" />
                      <text x="24" y="16" fill="#C6F9E2" fontFamily="var(--font-mono)" fontSize="9" fontWeight="600" letterSpacing="0.08em">
                        PARALLEL AGENT
                      </text>
                    </g>

                    <g transform="translate(30, 163)">
                      <rect width="112" height="24" fill="#1C1A26" stroke="#9CE8C9" strokeOpacity="0.5" rx="2" />
                      <circle cx="12" cy="12" r="3" fill="#28E99F" />
                      <text x="24" y="16" fill="#C6F9E2" fontFamily="var(--font-mono)" fontSize="9" fontWeight="600" letterSpacing="0.08em">
                        PARALLEL AGENT
                      </text>
                    </g>

                    {/* Center Inference Predictive Core Box */}
                    <rect x="232" y="92" width="85" height="85" fill="#3B67F6" rx="2" />
                    <circle cx="274" cy="135" r="42" fill="url(#hiw-core-glow-2)" />

                    {/* Globe with Target Beacon */}
                    <circle cx="274" cy="135" r="30" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.8" fill="none" />
                    <ellipse cx="274" cy="135" rx="30" ry="12" stroke="#ECFFA3" strokeWidth="0.9" fill="none" />
                    <ellipse cx="274" cy="135" rx="12" ry="30" stroke="#9CE8C9" strokeWidth="0.9" fill="none" />

                    {/* Target Pins */}
                    <circle cx="245" cy="115" r="3" fill="#28E99F" />
                    <circle cx="232" cy="135" r="3" fill="#28E99F" />
                    <circle cx="245" cy="155" r="3" fill="#28E99F" />

                    {/* Corner Markers */}
                    <rect x="228" y="88" width="7" height="7" fill="#ECFFA3" rx="1" />
                    <rect x="312" y="88" width="7" height="7" fill="#ECFFA3" rx="1" />
                    <rect x="228" y="172" width="7" height="7" fill="#ECFFA3" rx="1" />
                    <rect x="312" y="172" width="7" height="7" fill="#ECFFA3" rx="1" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">STEP 02</span>
              <h3 className="hiw-title">Mô hình AI dự báo suy thoái</h3>
              <p className="hiw-desc">
                Phân tích chuỗi thời gian và độ dốc tài nguyên nhằm phát hiện sớm nguy cơ rò rỉ bộ nhớ (OOM) cùng chuỗi lỗi pod trước khi người dùng gặp sự cố.
              </p>
            </div>
          </article>

          {/* ================= STEP 03: KHÔI PHỤC ================= */}
          <article className="hiw-card">
            <div className="hiw-screen-frame">
              <div className="hiw-screen-inner-gap">
                <div className="hiw-screen" aria-hidden="true">
                  <svg
                    className="hiw-svg-canvas"
                    viewBox="0 0 420 270"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Subtle cybernetic backdrop lines */}
                    <line x1="30" y1="135" x2="390" y2="135" stroke="rgba(198, 249, 226, 0.08)" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="210" y1="30" x2="210" y2="240" stroke="rgba(198, 249, 226, 0.08)" strokeWidth="1" strokeDasharray="3 3" />

                    {/* Floating Anchor Node at Top */}
                    <rect x="205" y="70" width="10" height="10" fill="#FF8BA7" rx="1" />

                    {/* Central Healing Confirmation Card */}
                    <g className="hiw-float-box" transform="translate(85, 105)">
                      {/* Top Pill / Badge Header */}
                      <rect width="250" height="34" fill="#28E99F" rx="2" />
                      <g transform="translate(14, 10)">
                        {/* Brain / Circuit Shield Hexagon Icon */}
                        <circle cx="6" cy="7" r="5" fill="#18221D" />
                        <text
                          x="20"
                          y="11"
                          fill="#18221D"
                          fontFamily="var(--font-mono)"
                          fontSize="10"
                          fontWeight="700"
                          letterSpacing="0.04em"
                        >
                          1 new learning
                        </text>
                      </g>

                      {/* Bottom Message Body */}
                      <rect y="34" width="250" height="42" fill="#FFFFFF" rx="2" />
                      <text
                        x="16"
                        y="58"
                        fill="#3D3B4F"
                        fontFamily="var(--font-mono)"
                        fontSize="9.5"
                        fontWeight="500"
                      >
                        auto-recovery policy verified: zero downtime
                      </text>
                    </g>

                    {/* Subtle Target Guide Crosshair Ticks */}
                    <line x1="80" y1="135" x2="88" y2="135" stroke="#9CE8C9" strokeWidth="1.5" strokeOpacity="0.6" />
                    <line x1="332" y1="135" x2="340" y2="135" stroke="#9CE8C9" strokeWidth="1.5" strokeOpacity="0.6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">STEP 03</span>
              <h3 className="hiw-title">Tự động phục hồi có kiểm soát</h3>
              <p className="hiw-desc">
                Kích hoạt chính sách tự phục hồi tất định (rolling restart, scale pod, rollback) với cơ chế bảo vệ ranh giới an toàn và con người giám sát (HITL).
              </p>
            </div>
          </article>
        </div>
      </div>

      {/* ================= BOTTOM FRAMING TRACK (HORIZONTAL LINE AT FOOTER) ================= */}
      <div className="hiw-track hiw-track-bottom" aria-hidden="true">
        <div className="hiw-track-line" />
        <span className="hiw-track-dot hiw-dot-left" />
        <span className="hiw-track-dot hiw-dot-right" />
      </div>
    </section>
  );
};

export default HowItWorksSection;
