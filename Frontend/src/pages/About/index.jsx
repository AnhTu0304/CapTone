import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, BookOpen } from 'lucide-react';
import './About.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const AboutPage = ({ onNavigate }) => {
  const { t } = useTranslation('about');
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const notebookContainerRef = useRef(null);
  const notebookCanvasRef = useRef(null);

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

    const renderNotebook = () => {
      const nCanvas = notebookCanvasRef.current;
      const nContainer = notebookContainerRef.current;
      if (!nCanvas || !nContainer) return;

      const nCtx = nCanvas.getContext('2d');
      if (!nCtx) return;

      const rect = nContainer.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      nCanvas.width = width * dpr;
      nCanvas.height = height * dpr;
      nCanvas.style.width = `${width}px`;
      nCanvas.style.height = `${height}px`;

      nCtx.save();
      nCtx.scale(dpr, dpr);
      nCtx.clearRect(0, 0, width, height);

      const padX = width > 640 ? 12 : 6;
      const padTop = 18;
      const padBottom = 12;
      const bookX = padX;
      const bookY = padTop;
      const bookW = width - padX * 2;
      const bookH = height - padTop - padBottom;
      const radius = 6;

      const drawRoundRect = (x, y, w, h, r) => {
        nCtx.beginPath();
        nCtx.moveTo(x + r, y);
        nCtx.lineTo(x + w - r, y);
        nCtx.arcTo(x + w, y, x + w, y + r, r);
        nCtx.lineTo(x + w, y + h - r);
        nCtx.arcTo(x + w, y + h, x + w - r, y + h, r);
        nCtx.lineTo(x + r, y + h);
        nCtx.arcTo(x, y + h, x, y + h - r, r);
        nCtx.lineTo(x, y + r);
        nCtx.arcTo(x, y, x + r, y, r);
        nCtx.closePath();
      };

      // Bottom page stack layer (thickness)
      drawRoundRect(bookX + 4, bookY + 4, bookW, bookH, radius);
      nCtx.fillStyle = '#D4D4DA';
      nCtx.fill();

      // Middle page stack layer
      drawRoundRect(bookX + 2, bookY + 2, bookW, bookH, radius);
      nCtx.fillStyle = '#E2E2E8';
      nCtx.fill();

      // Main notebook top sheet (matches outer #EEEEEE background)
      drawRoundRect(bookX, bookY, bookW, bookH, radius);
      nCtx.fillStyle = '#EEEEEE';
      nCtx.fill();
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.22)';
      nCtx.lineWidth = 1;
      nCtx.stroke();

      // Ruled 24px grid on notebook paper (matching outer grid texture)
      nCtx.save();
      drawRoundRect(bookX, bookY, bookW, bookH, radius);
      if (typeof nCtx.clip === 'function') {
        nCtx.clip();
      }

      const gridSize = 24;
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.05)';
      nCtx.lineWidth = 1;
      nCtx.beginPath();
      for (let gx = bookX; gx <= bookX + bookW; gx += gridSize) {
        nCtx.moveTo(gx + 0.5, bookY);
        nCtx.lineTo(gx + 0.5, bookY + bookH);
      }
      for (let gy = bookY; gy <= bookY + bookH; gy += gridSize) {
        nCtx.moveTo(bookX, gy + 0.5);
        nCtx.lineTo(bookX + bookW, gy + 0.5);
      }
      nCtx.stroke();
      nCtx.restore();

      // Perforation line below spiral rings
      const perfY = bookY + 28;
      nCtx.save();
      if (typeof nCtx.setLineDash === 'function') {
        nCtx.setLineDash([4, 4]);
      }
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.18)';
      nCtx.beginPath();
      nCtx.moveTo(bookX, perfY + 0.5);
      nCtx.lineTo(bookX + bookW, perfY + 0.5);
      nCtx.stroke();
      nCtx.restore();

      // Spiral wire rings along top edge
      const ringStep = width > 500 ? 36 : 28;
      const ringStart = bookX + 28;
      const ringEnd = bookX + bookW - 24;

      for (let rx = ringStart; rx <= ringEnd; rx += ringStep) {
        // Punch hole
        nCtx.beginPath();
        if (typeof nCtx.ellipse === 'function') {
          nCtx.ellipse(rx, bookY + 14, 3.5, 5, 0, 0, Math.PI * 2);
        } else {
          nCtx.rect(rx - 3, bookY + 9, 6, 10);
        }
        nCtx.fillStyle = '#B8B8C4';
        nCtx.fill();
        nCtx.strokeStyle = '#8E8D9D';
        nCtx.lineWidth = 1;
        nCtx.stroke();

        // Spiral wire loop
        nCtx.beginPath();
        nCtx.moveTo(rx - 3, bookY + 16);
        nCtx.bezierCurveTo(rx - 6, bookY - 10, rx + 6, bookY - 10, rx + 3, bookY + 16);
        nCtx.lineWidth = 2.5;
        nCtx.strokeStyle = '#3D3B4F';
        nCtx.stroke();

        // Highlight
        nCtx.beginPath();
        nCtx.moveTo(rx - 1.5, bookY + 12);
        nCtx.bezierCurveTo(rx - 3.5, bookY - 7, rx + 3.5, bookY - 7, rx + 1.5, bookY + 12);
        nCtx.lineWidth = 0.9;
        nCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        nCtx.stroke();
      }

      nCtx.restore();
    };

    renderGridAndSprockets();
    renderNotebook();

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        renderGridAndSprockets();
        renderNotebook();
      });
      observer.observe(container);
      if (notebookContainerRef.current) {
        observer.observe(notebookContainerRef.current);
      }
    }

    const handleResize = () => {
      renderGridAndSprockets();
      renderNotebook();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, []);

  useGSAP(
    () => {
      const sections = gsap.utils.toArray('.about-section');
      sections.forEach((sec) => {
        gsap.from(sec, {
          y: 24,
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

  const handleNavigate = (path) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="about-page-root" data-testid="about-page">
      <header className="about-top-hero" data-testid="about-top-hero">
        <h1 className="about-hero-title">{t('hero.title')}</h1>
        <p className="about-hero-subtitle">
          {t('hero.subtitle')}
        </p>
      </header>

      <section
        ref={containerRef}
        className="about-sheet-section"
        data-testid="about-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="about-sheet-canvas"
          data-testid="about-sheet-canvas"
          aria-hidden="true"
        />

        <main className="about-content-container">
          {/* Section 01 – Our Story */}
          <section className="about-section" data-testid="about-section-story">
            <h2 className="about-headline">{t('story.heading')}</h2>
            <p className="about-description">
              {t('story.desc')}
            </p>
            <p className="about-body-text">
              {t('story.p1')}
            </p>
            <p className="about-body-text">
              {t('story.p2')}
            </p>
          </section>

          {/* Section 02 – The Problem */}
          <section className="about-section" data-testid="about-section-problem">
            <h2 className="about-headline">{t('problem.heading')}</h2>
            <p className="about-description">
              {t('problem.desc')}
            </p>
            {(Array.isArray(t('problem.items', { returnObjects: true })) ? t('problem.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="about-body-text">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 03 – Our Mission */}
          <section className="about-section" data-testid="about-section-mission">
            <h2 className="about-headline">{t('mission.heading')}</h2>
            <p className="about-description">
              {t('mission.desc')}
            </p>
            {(Array.isArray(t('mission.items', { returnObjects: true })) ? t('mission.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="about-body-text">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 04 – How SelfHeal Works */}
          <section className="about-section" data-testid="about-section-how-it-works">
            <h2 className="about-headline">{t('howItWorks.heading')}</h2>
            <p className="about-description">
              {t('howItWorks.desc')}
            </p>
            {(Array.isArray(t('howItWorks.items', { returnObjects: true })) ? t('howItWorks.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="about-body-text">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 05 – Our Principles */}
          <section className="about-section" data-testid="about-section-principles">
            <h2 className="about-headline">{t('principles.heading')}</h2>
            <p className="about-description">
              {t('principles.desc')}
            </p>
            {(Array.isArray(t('principles.items', { returnObjects: true })) ? t('principles.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="about-body-text">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 06 – Technology & Architecture */}
          <section className="about-section" data-testid="about-section-technology">
            <h2 className="about-headline">{t('technology.heading')}</h2>
            <p className="about-description">
              {t('technology.desc')}
            </p>
            {(Array.isArray(t('technology.items', { returnObjects: true })) ? t('technology.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="about-body-text">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 07 – Meet the Team */}
          <section className="about-section" data-testid="about-section-team">
            <h2 className="about-headline">{t('team.heading')}</h2>
            <p className="about-description">
              {t('team.desc')}
            </p>
            {(Array.isArray(t('team.items', { returnObjects: true })) ? t('team.items', { returnObjects: true }) : []).map((item, idx) => (
              <p key={idx} className="about-body-text">
                <strong>{item.label}</strong>{item.text}
              </p>
            ))}
          </section>

          {/* Section 08 – Final CTA Notebook */}
          <section className="about-section about-section--cta" data-testid="about-section-cta">
            <div
              ref={notebookContainerRef}
              className="about-notebook-card"
              data-testid="about-notebook-card"
            >
              <canvas
                ref={notebookCanvasRef}
                className="about-notebook-canvas"
                data-testid="about-notebook-canvas"
                aria-hidden="true"
              />
              <div className="about-notebook-content">
                <h2 className="about-cta-headline">{t('cta.headline')}</h2>
                <p className="about-cta-desc">
                  {t('cta.desc')}
                </p>
                <div className="about-cta-group">
                  <button
                    type="button"
                    className="about-btn-primary"
                    onClick={() => handleNavigate('/login')}
                    data-testid="about-cta-explore-btn"
                    title={t('cta.explore')}
                  >
                    <span>{t('cta.explore')}</span>
                    <ArrowRight size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className="about-btn-secondary"
                    onClick={() => handleNavigate('/contact')}
                    data-testid="about-cta-contact-btn"
                    title={t('cta.contact')}
                  >
                    <BookOpen size={18} strokeWidth={2.2} color="#2A2A2A" />
                    <span>{t('cta.contact')}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
};

export default AboutPage;
