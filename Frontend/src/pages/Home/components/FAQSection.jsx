import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import './FAQSection.css';

export const FAQSection = ({ className = '', onNavigate }) => {
  const { t } = useTranslation('home');
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

  const translatedFaq = t('faq.items', { returnObjects: true });
  const faqData = Array.isArray(translatedFaq) ? translatedFaq : [];

  return (
    <section
      id="faq"
      className={`faq-section ${className}`.trim()}
      data-testid="faq-section"
      aria-label={t('faq.ariaLabel')}
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
      <h2 className="faq-title">{t('faq.title')}</h2>

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
          <span>{t('faq.notFound')}</span>
          <a
            href="/guide"
            onClick={handleContactClick}
            className="faq-contact-link"
          >
            {t('faq.contactUs')}
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
