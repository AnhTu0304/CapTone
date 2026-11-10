import React from 'react';
import { ShieldCheck, Bot, User, ArrowRight } from 'lucide-react';
import './AdaptationLearningSection.css';

export const AdaptationLearningSection = ({ className = '', onNavigate }) => {
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
      className={`adaptation-learning-section ${className}`.trim()}
      data-testid="adaptation-learning-section"
      aria-label="Tiến trình khắc phục và học hỏi liên tục từ các lỗi xảy ra"
    >
      {/* ================= TOP HEADER ================= */}
      <div className="als-header-container">
        <span className="als-label-badge">[ ADAPTATION &amp; LEARNING ]</span>
        <h2 className="als-heading">Hệ thống tự thích ứng &amp; học hỏi sau mỗi sự cố</h2>
        <p className="als-subtitle">
          Từ quy tắc tùy chỉnh theo đặc thù hạ tầng đến cơ chế học hỏi liên tục, SelfHeal ngày càng am hiểu
          hệ thống của bạn sau mỗi phiên tự phục hồi.
        </p>
      </div>

      {/* ================= CAD RULER DIVIDER ================= */}
      <div className="als-divider-ruler" aria-hidden="true" />

      {/* ================= 2-CARD GRID ================= */}
      <div className="als-grid-container">
        <div className="als-grid">
          {/* ================= CARD 1: CUSTOM RULES ================= */}
          <article className="als-card">
            <div className="als-card-frame">
              <div className="als-card-inner-gap">
                <div className="als-screen-box">
                  {/* Subtle CAD Spline Wireframe Mesh */}
                  <svg
                    className="als-wireframe-svg"
                    viewBox="0 0 450 300"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <g stroke="#3B82F6" strokeOpacity="0.28" strokeWidth="1">
                      <path d="M 30 50 C 140 180, 200 80, 420 220" />
                      <path d="M 50 40 C 150 190, 210 90, 410 240" />
                      <path d="M 70 30 C 160 200, 220 100, 400 260" />
                      <path d="M 90 20 C 170 210, 230 110, 390 280" />
                      <path d="M 30 250 C 180 120, 260 220, 420 70" />
                      <path d="M 50 260 C 190 130, 270 230, 400 60" />
                      <path d="M 70 270 C 200 140, 280 240, 380 50" />
                    </g>
                  </svg>

                  {/* Add Context / Custom Rules Mockup Box */}
                  <div className="als-mockup-card">
                    <h4 className="als-mockup-title">Thiết lập quy tắc</h4>
                    <p className="als-mockup-sub">Chỉ định chính sách và phạm vi dịch vụ áp dụng.</p>

                    <div className="als-step-badge">
                      <span className="als-step-num">1</span>
                      <span>Mô tả quy tắc khôi phục</span>
                    </div>

                    <div className="als-mockup-textarea">
                      Tự động Rolling Restart khi tỷ lệ lỗi HTTP 5xx vượt quá 5% trong 2 phút liên tiếp
                      trên deployment order-service.
                    </div>

                    <div className="als-step-badge">
                      <span className="als-step-num">2</span>
                      <span>Phạm vi dịch vụ áp dụng</span>
                    </div>

                    <div className="als-tags-row">
                      <span className="als-tag-pill">ns: production</span>
                      <span className="als-tag-pill">app: order-service</span>
                      <span className="als-tag-pill">k8s/manifests/order/*.yaml</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="als-card-info">
              <span className="als-card-tag">[ CUSTOM RULES ]</span>
              <h3 className="als-card-title">Quy tắc của bạn, quyền kiểm soát của bạn</h3>
              <p className="als-card-desc">
                Viết chính sách bằng ngôn ngữ tự nhiên hoặc cấu hình YAML declarative. Chỉ định rõ ngữ
                cảnh cụ thể cho từng cụm k8s và áp dụng nhất quán các ranh giới an toàn tuyệt đối.
              </p>
              <a
                href="/guide"
                onClick={(e) => handleNav(e, '/guide')}
                className="als-card-btn"
              >
                <span>Thiết lập quy tắc</span>
              </a>
            </div>
          </article>

          {/* ================= CARD 2: CONTINUOUS LEARNING ================= */}
          <article className="als-card">
            <div className="als-card-frame">
              <div className="als-card-inner-gap">
                <div className="als-screen-box">
                  {/* Subtle CAD Torus Wireframe Mesh */}
                  <svg
                    className="als-wireframe-svg"
                    viewBox="0 0 450 300"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <g stroke="#3B82F6" strokeOpacity="0.25" strokeWidth="1">
                      <ellipse cx="225" cy="150" rx="160" ry="70" />
                      <ellipse cx="225" cy="150" rx="140" ry="60" />
                      <ellipse cx="225" cy="150" rx="120" ry="50" />
                      <ellipse cx="225" cy="150" rx="100" ry="40" />
                      <circle cx="225" cy="150" r="80" strokeDasharray="3 3" />
                      <line x1="65" y1="150" x2="385" y2="150" strokeDasharray="4 4" />
                      <line x1="225" y1="80" x2="225" y2="220" strokeDasharray="4 4" />
                    </g>
                  </svg>

                  {/* Conversation Exchange Bubbles (DevOps Lead & SelfHeal Agent) */}
                  <div className="als-dialog-wrapper">
                    {/* User Bubble */}
                    <div className="als-chat-bubble-user">
                      <div className="als-user-avatar" aria-hidden="true">
                        <User size={18} />
                      </div>
                      <div>
                        <span className="als-bubble-sender">sre-lead @platform</span>
                        <p className="als-bubble-text-user">
                          Khi restart order-service, nhớ chờ Redis cache warm-up 30s trước khi định tuyến lại traffic.
                        </p>
                      </div>
                    </div>

                    {/* Agent Bubble */}
                    <div className="als-chat-bubble-agent">
                      <div className="als-agent-avatar" aria-hidden="true">
                        <Bot size={18} />
                      </div>
                      <div>
                        <span className="als-bubble-sender" style={{ color: '#047857' }}>selfheal-agent</span>
                        <p className="als-bubble-text-agent">
                          Đã ghi nhận bài học này vào bộ nhớ chính sách! Sẽ tự động áp dụng độ trễ 30s cho các phiên phục hồi sau.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="als-card-info">
              <span className="als-card-tag">[ LEARNING &amp; MEMORY ]</span>
              <h3 className="als-card-title">Học hỏi liên tục từ các lỗi xảy ra</h3>
              <p className="als-card-desc">
                SelfHeal liên tục phân tích phản hồi và hành động can thiệp thực tế của đội ngũ kỹ sư,
                tự động hoàn thiện tri thức vận hành để không lặp lại sai số cũ.
              </p>
              <a
                href="/guide"
                onClick={(e) => handleNav(e, '/guide')}
                className="als-card-btn"
              >
                <span>Xem tiến trình học</span>
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default AdaptationLearningSection;
