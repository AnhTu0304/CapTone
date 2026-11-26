import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import './Terms.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const TermsPage = () => {
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
      const sections = gsap.utils.toArray('.terms-content-container section');
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
    <div className="terms-page-root" data-testid="terms-page">
      <header className="terms-top-hero" data-testid="terms-top-hero">
        <h1 className="terms-hero-title">{t('terms.hero.title')}</h1>
        <p className="terms-hero-subtitle">
          {t('terms.hero.subtitle')}
        </p>
      </header>

      <section
        ref={containerRef}
        className="terms-sheet-section"
        data-testid="terms-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="terms-sheet-canvas"
          data-testid="terms-sheet-canvas"
          aria-hidden="true"
        />

        <main className="terms-content-container">
          <div className="terms-last-updated" data-testid="terms-last-updated">
            {t('terms.lastUpdated')}
          </div>

          <p className="terms-intro-paragraph">
            {t('terms.intro')}
          </p>

          <section id="terms-acceptance" data-testid="terms-section-acceptance">
            <h2 className="terms-heading-1">{t('terms.s1.heading')}</h2>
            <p className="terms-body-paragraph">
              {t('terms.s1.p1')}
            </p>
            <p className="terms-body-paragraph">
              {t('terms.s1.p2')}
            </p>
          </section>

          <section id="terms-license" data-testid="terms-section-license">
            <h2 className="terms-heading-1">{t('terms.s2.heading')}</h2>
            <p className="terms-body-paragraph">
              {t('terms.s2.p1')}
            </p>
            <h3 className="terms-heading-2">{t('terms.s2.prohibitedHeading')}</h3>
            <ul className="terms-list">
              {(Array.isArray(t('terms.s2.prohibitedList', { returnObjects: true })) ? t('terms.s2.prohibitedList', { returnObjects: true }) : []).map((li, idx) => (
                <li key={idx}>{li}</li>
              ))}
            </ul>
          </section>

          <section id="terms-intellectual-property" data-testid="terms-section-intellectual-property">
            <h2 className="terms-heading-1">{t('terms.s3.heading')}</h2>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s3.customerLabel')}</strong>{t('terms.s3.customerBody')}
            </p>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s3.selfhealLabel')}</strong>{t('terms.s3.selfhealBody')}
            </p>
          </section>

          <section id="terms-agent-infrastructure" data-testid="terms-section-agent-infrastructure">
            <h2 className="terms-heading-1">{t('terms.s4.heading')}</h2>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s4.rbacLabel')}</strong>{t('terms.s4.rbacBody')}
            </p>
            <div className="terms-highlight-box">
              <p className="terms-body-paragraph" style={{ margin: 0, fontWeight: 500 }}>
                {t('terms.s4.keysHighlight')}
              </p>
            </div>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s4.costLabel')}</strong>{t('terms.s4.costBody')}
            </p>
          </section>

          <section id="terms-ai-hitl" data-testid="terms-section-ai-hitl">
            <h2 className="terms-heading-1">{t('terms.s5.heading')}</h2>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s5.aiLabel')}</strong>{t('terms.s5.aiBody')}
            </p>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s5.hitlLabel')}</strong>{t('terms.s5.hitlBody')}
            </p>
          </section>

          <section id="terms-liability-disclaimer" data-testid="terms-section-liability-disclaimer">
            <h2 className="terms-heading-1">{t('terms.s6.heading')}</h2>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s6.asIsLabel')}</strong>{t('terms.s6.asIsBody')}
            </p>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s6.exclusionLabel')}</strong>{t('terms.s6.exclusionBody')}
            </p>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s6.capLabel')}</strong>{t('terms.s6.capBody')}
            </p>
          </section>

          <section id="terms-termination" data-testid="terms-section-termination">
            <h2 className="terms-heading-1">{t('terms.s7.heading')}</h2>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s7.suspendLabel')}</strong>{t('terms.s7.suspendBody')}
            </p>
            <ul className="terms-list">
              {(Array.isArray(t('terms.s7.suspendList', { returnObjects: true })) ? t('terms.s7.suspendList', { returnObjects: true }) : []).map((li, idx) => (
                <li key={idx}>{li}</li>
              ))}
            </ul>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s7.effectLabel')}</strong>{t('terms.s7.effectBody')}
            </p>
          </section>

          <section id="terms-governing-law" data-testid="terms-section-governing-law">
            <h2 className="terms-heading-1">{t('terms.s8.heading')}</h2>
            <p className="terms-body-paragraph">
              {t('terms.s8.p1')}
            </p>
            <p className="terms-body-paragraph">
              {t('terms.s8.p2')}
            </p>
            <p className="terms-body-paragraph">
              <strong>{t('terms.s8.emailLabel')}</strong>{' '}
              <a href="mailto:legal@selfheal.dev" className="terms-email-link">
                legal@selfheal.dev
              </a>
            </p>
          </section>
        </main>
      </section>
    </div>
  );
};

export default TermsPage;
