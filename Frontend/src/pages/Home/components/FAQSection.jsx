import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './FAQSection.css';

export const FAQSection = ({ className = '', onNavigate }) => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleItem = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  const handleContactClick = (e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/guide');
    } else {
      window.history.pushState({}, '', '/guide');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const faqData = [
    {
      q: 'SelfHeal hoạt động với Kubernetes như thế nào?',
      a: 'SelfHeal triển khai dưới dạng DaemonSet hoặc Helm chart siêu nhẹ, thu thập eBPF telemetry và pod metrics theo thời gian thực mà không tiêu tốn tài nguyên cụm, phát hiện sớm suy thoái trước khi dịch vụ gián đoạn.',
    },
    {
      q: 'SelfHeal có thể tự lưu trữ (self-hosted) trên hạ tầng riêng không?',
      a: 'Có, SelfHeal hỗ trợ triển khai on-premises và trong private VPC hoàn chỉnh. Toàn bộ dữ liệu telemetry, nhật ký kiểm toán và mô hình dự báo được lưu giữ an toàn tuyệt đối trong mạng nội bộ của bạn.',
    },
    {
      q: 'Cơ chế Human-in-the-Loop (HITL) bảo vệ hệ thống ra sao?',
      a: 'Mọi hành động có rủi ro cao như restart rolling hàng loạt hoặc thay đổi cấu hình tài nguyên đều phải có chữ ký phê duyệt từ kỹ sư trực on-call trước khi thực thi, đảm bảo con người luôn nắm quyền kiểm soát cao nhất.',
    },
    {
      q: 'SelfHeal hỗ trợ những phiên bản Kubernetes và nền tảng đám mây nào?',
      a: 'SelfHeal hỗ trợ mọi cụm Kubernetes từ v1.22+ trên AWS EKS, Google GKE, Azure AKS, K3s, cũng như các cụm bare-metal và hybrid cloud tiêu chuẩn.',
    },
    {
      q: 'Có bản dùng thử miễn phí hoặc gói dành cho doanh nghiệp SME không?',
      a: 'Hoàn toàn có. SelfHeal cung cấp gói Community miễn phí trọn đời cho cụm K8s quy mô dưới 15 nodes và gói Enterprise với đầy đủ tính năng suy luận AI, RCA 3D chuyên sâu cùng SLA hỗ trợ 24/7.',
    },
    {
      q: 'Dữ liệu log và chỉ số của hệ thống có được bảo mật không?',
      a: 'Tuyệt đối bảo mật. SelfHeal tuân thủ nguyên tắc Least Privilege, chỉ phân tích các chỉ số telemetry và metadata số liệu, tuyệt đối không đọc dữ liệu kinh doanh của ứng dụng hay payload nhạy cảm.',
    },
  ];

  return (
    <section
      id="faq"
      className={`faq-section ${className}`.trim()}
      data-testid="faq-section"
      aria-label="Câu hỏi thường gặp"
    >
      {/* ================= LEFT CONSTELLATION GRID ================= */}
      <div className="faq-constellation-left" aria-hidden="true">
        <svg
          className="faq-constellation-svg"
          viewBox="0 0 200 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Parallel Vertical Lines */}
          <line x1="30" y1="0" x2="30" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" />
          <line x1="70" y1="0" x2="70" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="110" y1="0" x2="110" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" />
          <line x1="150" y1="0" x2="150" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="190" y1="0" x2="190" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" />

          {/* Scattered Neon Lime Node Dots */}
          <g className="faq-constellation-node">
            <rect x="26" y="80" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="66" y="160" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="106" y="60" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="146" y="240" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="26" y="320" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="106" y="380" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="66" y="460" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="186" y="520" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="146" y="430" width="8" height="8" fill="#ECFFA3" rx="1.5" />
          </g>
        </svg>
      </div>

      {/* ================= RIGHT CONSTELLATION GRID ================= */}
      <div className="faq-constellation-right" aria-hidden="true">
        <svg
          className="faq-constellation-svg"
          viewBox="0 0 200 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Parallel Vertical Lines */}
          <line x1="10" y1="0" x2="10" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" />
          <line x1="50" y1="0" x2="50" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="90" y1="0" x2="90" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" />
          <line x1="130" y1="0" x2="130" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="170" y1="0" x2="170" y2="600" stroke="rgba(85, 83, 104, 0.14)" strokeWidth="1" />

          {/* Scattered Neon Lime Node Dots */}
          <g className="faq-constellation-node">
            <rect x="6" y="100" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="46" y="210" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="86" y="140" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="126" y="290" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="166" y="80" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="86" y="390" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="46" y="470" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="126" y="530" width="8" height="8" fill="#ECFFA3" rx="1.5" />
            <rect x="166" y="410" width="8" height="8" fill="#ECFFA3" rx="1.5" />
          </g>
        </svg>
      </div>

      {/* ================= TITLE ================= */}
      <h2 className="faq-title">FAQ</h2>

      {/* ================= ACCORDION LIST ================= */}
      <div className="faq-accordion-container">
        <div className="faq-list">
          {faqData.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="faq-item">
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => toggleItem(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span className="faq-question-text">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`faq-chevron ${isOpen ? 'faq-chevron-open' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                <div
                  id={`faq-answer-${idx}`}
                  className={`faq-answer-collapse ${isOpen ? 'faq-answer-collapse-open' : ''}`}
                >
                  <div className="faq-answer-inner">
                    <p className="faq-answer-text">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Contact Text */}
        <div className="faq-bottom-contact">
          <span>Bạn không tìm thấy câu trả lời? </span>
          <a
            href="/guide"
            onClick={handleContactClick}
            className="faq-contact-link"
          >
            Liên hệ với chúng tôi.
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
