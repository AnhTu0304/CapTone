import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Cpu, 
  ShieldCheck, 
  Zap
} from 'lucide-react';

/**
 * StepDetailCard
 * 
 * Thẻ hiển thị thông tin chi tiết công nghệ cao (Floating HUD Card):
 * - Giải thích chi tiết cơ chế hoạt động kỹ thuật của từng bước trong hệ thống Self-Healing K8s.
 * - Animation mượt mà bằng GSAP (fade-in, stagger, scale pop).
 * - Tương tác chuyển bước Trước / Sau, đóng card, và tiếp tục chu trình tự động.
 */
export const StepDetailCard = ({
  step,
  totalSteps = 7,
  onClose,
  onNext,
  onPrev,
  onResumeAutoPlay,
  onSelectStep,
}) => {
  const cardRef = useRef(null);
  const contentRef = useRef(null);
  const StepIcon = step?.icon || Zap;

  // GSAP Entrance Animation
  useEffect(() => {
    if (!cardRef.current) return;

    const ctx = gsap.context(() => {
      // Card container pop-in
      gsap.fromTo(
        cardRef.current,
        { 
          opacity: 0, 
          scale: 0.92, 
          y: 12,
        },
        { 
          opacity: 1, 
          scale: 1, 
          y: 0, 
          duration: 0.35, 
          ease: 'power3.out' 
        }
      );

      // Stagger elements inside the card
      if (contentRef.current) {
        gsap.fromTo(
          contentRef.current.children,
          { opacity: 0, y: 8 },
          { 
            opacity: 1, 
            y: 0, 
            duration: 0.28, 
            stagger: 0.05, 
            ease: 'power2.out',
            delay: 0.08,
          }
        );
      }
    }, cardRef);

    return () => ctx.revert();
  }, [step?.num]);

  // Handle smooth close animation
  const handleClose = () => {
    if (!cardRef.current || process.env.NODE_ENV === 'test') {
      onClose();
      return;
    }

    gsap.to(cardRef.current, {
      opacity: 0,
      scale: 0.94,
      y: 8,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: onClose,
    });
  };

  if (!step) return null;

  return (
    <div
      ref={cardRef}
      className="step-detail-hud-card"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '92%',
        maxWidth: '430px',
        maxHeight: '490px',
        backgroundColor: 'rgba(255, 255, 255, 0.97)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(61, 59, 79, 0.22)',
        borderRadius: '8px',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(40, 233, 159, 0.3)',
        zIndex: 35,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. High-Tech Header */}
      <div
        style={{
          backgroundColor: 'var(--color-primary, #3D3B4F)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Hexagon Step Icon Badge */}
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: 'rgba(40, 233, 159, 0.2)',
              border: '1px solid var(--color-accent, #28E99F)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
          >
            <StepIcon size={16} color="#28E99F" strokeWidth={2.4} />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--color-accent, #28E99F)',
                  letterSpacing: '0.06em',
                }}
              >
                BƯỚC 0{step.num}/0{totalSteps}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.625rem',
                  padding: '1px 6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#D1D5DB',
                  borderRadius: '2px',
                  letterSpacing: '0.04em',
                }}
              >
                {step.category || 'WORKFLOW'}
              </span>
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: '#FFFFFF',
                margin: '2px 0 0 0',
                lineHeight: 1.2,
              }}
            >
              {step.title}
            </h3>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Đóng chi tiết"
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            color: '#E5E7EB',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
            e.currentTarget.style.borderColor = '#EF4444';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = '#E5E7EB';
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* 2. Scrollable Body Content */}
      <div
        ref={contentRef}
        style={{
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Step Summary Banner */}
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(40, 233, 159, 0.1)',
            borderLeft: '3px solid var(--color-accent, #28E99F)',
            borderRadius: '0 4px 4px 0',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-primary, #3D3B4F)',
              lineHeight: 1.5,
              fontWeight: 600,
              fontFamily: 'var(--font-body, sans-serif)',
            }}
          >
            {step.summary}
          </p>
        </div>

        {/* SECTION: Cách Hoạt Động (How it works) */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            <Zap size={14} color="#059669" />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#059669',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              CƠ CHẾ HOẠT ĐỘNG
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {step.howItWorks && step.howItWorks.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '7px 9px',
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '4px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    backgroundColor: 'var(--color-primary, #3D3B4F)',
                    color: '#FFFFFF',
                    borderRadius: '50%',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {idx + 1}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-body, sans-serif)',
                    fontSize: '0.78125rem',
                    color: '#374151',
                    lineHeight: 1.45,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION: Technical Specs Chips */}
        {step.techSpecs && step.techSpecs.length > 0 && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
              }}
            >
              <Cpu size={13} color="var(--text-muted, #6B7280)" />
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--text-muted, #6B7280)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                THÔNG SỐ KỸ THUẬT & GIAO THỨC
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {step.techSpecs.map((spec, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.6875rem',
                    padding: '3px 7px',
                    backgroundColor: '#F3F4F6',
                    border: '1px solid #D1D5DB',
                    color: '#1F2937',
                    borderRadius: '3px',
                    fontWeight: 600,
                  }}
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: System Benefit */}
        {step.benefit && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              backgroundColor: 'rgba(5, 150, 105, 0.06)',
              border: '1px dashed rgba(5, 150, 105, 0.3)',
              borderRadius: '4px',
            }}
          >
            <ShieldCheck size={16} color="#059669" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '0.75rem',
                color: '#065F46',
                fontFamily: 'var(--font-body, sans-serif)',
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              <strong>Lợi ích:</strong> {step.benefit}
            </span>
          </div>
        )}
      </div>

      {/* 3. Interactive Footer Toolbar */}
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: '#F9FAFB',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        {/* Navigation buttons: Prev / Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            disabled={step.num <= 1}
            onClick={onPrev}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              fontFamily: 'var(--font-body, sans-serif)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: step.num <= 1 ? '#9CA3AF' : '#374151',
              cursor: step.num <= 1 ? 'not-allowed' : 'pointer',
              opacity: step.num <= 1 ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (step.num > 1) e.currentTarget.style.backgroundColor = '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            <ChevronLeft size={14} />
            <span>Trước</span>
          </button>

          <button
            type="button"
            disabled={step.num >= totalSteps}
            onClick={onNext}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              fontFamily: 'var(--font-body, sans-serif)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: step.num >= totalSteps ? '#9CA3AF' : '#374151',
              cursor: step.num >= totalSteps ? 'not-allowed' : 'pointer',
              opacity: step.num >= totalSteps ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (step.num < totalSteps) e.currentTarget.style.backgroundColor = '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            <span>Tiếp</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Step Indicator Dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepIndex = index + 1;
            const isCurrent = stepIndex === step.num;
            return (
              <button
                key={stepIndex}
                type="button"
                aria-label={`Xem bước ${stepIndex}`}
                onClick={() => onSelectStep(stepIndex)}
                style={{
                  width: isCurrent ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: isCurrent ? 'var(--color-primary, #3D3B4F)' : '#D1D5DB',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              />
            );
          })}
        </div>

        {/* Resume Auto Play */}
        <button
          type="button"
          onClick={() => {
            handleClose();
            if (onResumeAutoPlay) onResumeAutoPlay();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 10px',
            backgroundColor: 'var(--color-accent, #28E99F)',
            color: '#000000',
            border: 'none',
            borderRadius: '4px',
            fontFamily: 'var(--font-display, sans-serif)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1FE092';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-accent, #28E99F)';
          }}
        >
          <Play size={12} fill="#000000" />
          <span>Tự động phát</span>
        </button>
      </div>
    </div>
  );
};

export default StepDetailCard;
