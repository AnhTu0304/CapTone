import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import './Privacy.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const PrivacyPage = () => {
  const { t } = useTranslation('legal');
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderGridAndSprockets = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#EEEEEE';
      ctx.fillRect(0, 0, width, height);

      const gridSize = 24;
      ctx.strokeStyle = 'rgba(61, 59, 79, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();

      if (width > 640) {
        const holeW = 16;
        const holeH = 20;
        const radius = 5;
        const stepY = 36;
        const leftX = 26;
        const rightX = width - 26 - holeW;

        const drawHole = (x, y) => {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + holeW, y, x + holeW, y + holeH, radius);
          ctx.arcTo(x + holeW, y + holeH, x, y + holeH, radius);
          ctx.arcTo(x, y + holeH, x, y, radius);
          ctx.arcTo(x, y, x + holeW, y, radius);
          ctx.closePath();
          ctx.fillStyle = '#E0E0E6';
          ctx.fill();
          ctx.strokeStyle = '#B8B8C2';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        };

        for (let y = 8; y < height; y += stepY) {
          drawHole(leftX, y);
          drawHole(rightX, y);
        }
      }

      ctx.restore();
    };

    renderGridAndSprockets();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => renderGridAndSprockets());
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, []);

  useGSAP(
    () => {
      const sections = gsap.utils.toArray('.privacy-content-container section');
      sections.forEach((sec) => {
        gsap.from(sec, {
          y: 20,
          opacity: 0,
          duration: 0.65,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sec,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <div className="privacy-page-root" data-testid="privacy-page">
      <header className="privacy-top-hero" data-testid="privacy-top-hero">
        <h1 className="privacy-hero-title">{t('privacy.hero.title')}</h1>
        <p className="privacy-hero-subtitle">
          {t('privacy.hero.subtitle')}
        </p>
      </header>

      <section
        ref={containerRef}
        className="privacy-sheet-section"
        data-testid="privacy-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="privacy-sheet-canvas"
          data-testid="privacy-sheet-canvas"
          aria-hidden="true"
        />

        <main className="privacy-content-container">
          <div className="privacy-last-updated" data-testid="privacy-last-updated">
            {t('privacy.lastUpdated')}
          </div>

          <p className="privacy-intro-paragraph">
            {t('privacy.intro')}
          </p>

          {/* Section 01: Scope & Principles */}
          <section id="privacy-scope" data-testid="privacy-section-scope">
            <h2 className="privacy-heading-1">{t('privacy.s1.heading')}</h2>
            <p className="privacy-body-paragraph">
              {t('privacy.s1.p1')}
            </p>
            <p className="privacy-body-paragraph">
              {t('privacy.s1.p2Before')}<strong>{t('privacy.s1.p2Strong')}</strong>{t('privacy.s1.p2After')}
            </p>
          </section>

          {/* Section 02: Information Collected */}
          <section id="privacy-data-collected" data-testid="privacy-section-data-collected">
            <h2 className="privacy-heading-1">{t('privacy.s2.heading')}</h2>
            <p className="privacy-body-paragraph">
              {t('privacy.s2.intro')}
            </p>
            <h3 className="privacy-heading-2">{t('privacy.s2.accountTitle')}</h3>
            <p className="privacy-body-paragraph">
              {t('privacy.s2.accountBody')}
            </p>
            <h3 className="privacy-heading-2">{t('privacy.s2.telemetryTitle')}</h3>
            <p className="privacy-body-paragraph">
              {t('privacy.s2.telemetryBody')}
            </p>
            <p className="privacy-body-paragraph">
              <strong>{t('privacy.s2.noBusinessLabel')}</strong>{t('privacy.s2.noBusinessBody')}
            </p>
          </section>

          {/* Section 03: Purpose of Use */}
          <section id="privacy-usage" data-testid="privacy-section-usage">
            <h2 className="privacy-heading-1">{t('privacy.s3.heading')}</h2>
            <p className="privacy-body-paragraph">
              {t('privacy.s3.intro')}
            </p>
            {(Array.isArray(t('privacy.s3.items', { returnObjects: true })) ? t('privacy.s3.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="privacy-body-paragraph">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 04: Storage & Protection */}
          <section id="privacy-security" data-testid="privacy-section-security">
            <h2 className="privacy-heading-1">{t('privacy.s4.heading')}</h2>
            <p className="privacy-body-paragraph">
              {t('privacy.s4.intro')}
            </p>
            {(Array.isArray(t('privacy.s4.items', { returnObjects: true })) ? t('privacy.s4.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="privacy-body-paragraph">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 05: Data Sharing */}
          <section id="privacy-sharing" data-testid="privacy-section-sharing">
            <h2 className="privacy-heading-1">{t('privacy.s5.heading')}</h2>
            <p className="privacy-body-paragraph">
              <strong>{t('privacy.s5.noSellLabel')}</strong>{t('privacy.s5.noSellBody')}
            </p>
            <p className="privacy-body-paragraph">
              {t('privacy.s5.p2')}
            </p>
          </section>

          {/* Section 06: Your Rights */}
          <section id="privacy-rights" data-testid="privacy-section-rights">
            <h2 className="privacy-heading-1">{t('privacy.s6.heading')}</h2>
            <p className="privacy-body-paragraph">
              {t('privacy.s6.intro')}
            </p>
            {(Array.isArray(t('privacy.s6.items', { returnObjects: true })) ? t('privacy.s6.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="privacy-body-paragraph">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 07: Cookies & Sessions */}
          <section id="privacy-cookies" data-testid="privacy-section-cookies">
            <h2 className="privacy-heading-1">{t('privacy.s7.heading')}</h2>
            <p className="privacy-body-paragraph">
              {t('privacy.s7.body')}
            </p>
          </section>

          {/* Section 08: Contact & Inquiries */}
          <section id="privacy-contact" data-testid="privacy-section-contact">
            <h2 className="privacy-heading-1">{t('privacy.s8.heading')}</h2>
            <p className="privacy-body-paragraph">
              {t('privacy.s8.before')}<span className="privacy-contact-highlight">privacy@selfheal.dev</span>{t('privacy.s8.after')}
            </p>
          </section>
        </main>
      </section>
    </div>
  );
};

export default PrivacyPage;
