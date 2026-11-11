import React from 'react';
import './HowItWorksSection.css';
import videocard1 from '../../../assets/videocard1.mp4';
import videocard2 from '../../../assets/card2.mp4';
import videocard3 from '../../../assets/card3.mp4';

export const HowItWorksSection = ({ className = '' }) => {
  return (
    <section
      className={`how-it-works-section ${className}`.trim()}
      data-testid="how-it-works-section"
      aria-label="Cách thức SelfHeal hoạt động"
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
                    aria-label="Video mô phỏng thu thập và quan sát đa chiều Kubernetes"
                  />
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">Bước 1</span>
              <h3 className="hiw-title">Thu thập &amp; Quan sát đa chiều</h3>
              <p className="hiw-desc">
                Liên tục thu thập và giám sát dữ liệu hạ tầng Kubernetes, giúp phát hiện sớm những dấu hiệu bất thường.
              </p>
            </div>
          </article>

          {/* ================= STEP 02: DỰ ĐOÁN ================= */}
          <article className="hiw-card">
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
                    aria-label="Video mô phỏng mô hình AI dự báo suy thoái Kubernetes"
                  />
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">Bước 2</span>
              <h3 className="hiw-title">Mô hình AI dự báo suy thoái</h3>
              <p className="hiw-desc">
                Phân tích dữ liệu vận hành để dự đoán rủi ro, nhận diện nguy cơ trước khi sự cố xảy ra.
              </p>
            </div>
          </article>

          {/* ================= STEP 03: KHÔI PHỤC ================= */}
          <article className="hiw-card">
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
                    aria-label="Video mô phỏng tự động phục hồi có kiểm soát Kubernetes"
                  />
                </div>
              </div>
            </div>

            <div className="hiw-info">
              <span className="hiw-step-label">Bước 3</span>
              <h3 className="hiw-title">Tự động phục hồi có kiểm soát</h3>
              <p className="hiw-desc">
                Tự động thực thi biện pháp khắc phục, với cơ chế phê duyệt và giám sát từ con người.
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
          <h2 className="hiw-prediction-title">Dự đoán các sự cố</h2>
          <p className="hiw-prediction-desc">
            Từ khả năng quan sát theo thời gian thực đến dự báo dựa trên AI và tự động phục hồi
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
            <span className="hiw-badge-text">BA GIAI ĐOẠN BẢO VỆ HẠ TẦNG PRODUCTION.</span>
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
