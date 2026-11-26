import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { 
  UserPlus, 
  Building2, 
  Layers, 
  Server, 
  Key, 
  Terminal, 
  Activity,
  Play,
  Pause,
  Info
} from 'lucide-react';
import HexagonStepNode from './HexagonStepNode';
import ConnectingArrow from './ConnectingArrow';
import MiniDashboardBloom from './MiniDashboardBloom';
import StepDetailCard from './StepDetailCard';

const STEP_LAYOUT = [
  { num: 1, icon: UserPlus, x: -160, y: -150 },
  { num: 2, icon: Building2, x: 0, y: -165 },
  { num: 3, icon: Layers, x: 160, y: -150 },
  { num: 4, icon: Server, x: 135, y: 0 },
  { num: 5, icon: Key, x: -5, y: 10 },
  { num: 6, icon: Terminal, x: -145, y: 15 },
  { num: 7, icon: Activity, x: 0, y: 165 },
];

export const OnboardingSequence3D = () => {
  const { t } = useTranslation('auth');
  const containerRef = useRef(null);
  const tiltStageRef = useRef(null);
  const quickTiltRef = useRef({ rx: null, ry: null });
  const [currentStep, setCurrentStep] = useState(1);
  const [phase, setPhase] = useState('steps'); // 'steps' | 'converging' | 'dashboard'
  const [selectedStep, setSelectedStep] = useState(null); // 1-7 or null
  const [isPaused, setIsPaused] = useState(false);
  const [isHoveringNode, setIsHoveringNode] = useState(false);
  const selectedStepRef = useRef(selectedStep);
  selectedStepRef.current = selectedStep;

  const translatedSteps = t('onboarding3d.steps', { returnObjects: true });
  const steps = STEP_LAYOUT.map((meta, idx) => ({
    ...(Array.isArray(translatedSteps) && translatedSteps[idx] ? translatedSteps[idx] : {}),
    ...meta,
  }));

  // GSAP quickTo animates 3D tilt directly on the compositor without React re-renders per mouse pixel
  useEffect(() => {
    const stageEl = tiltStageRef.current;
    if (!stageEl) return undefined;
    quickTiltRef.current = {
      rx: gsap.quickTo(stageEl, 'rotationX', { duration: 0.25, ease: 'power3.out' }),
      ry: gsap.quickTo(stageEl, 'rotationY', { duration: 0.25, ease: 'power3.out' }),
    };
    return () => {
      gsap.killTweensOf(stageEl);
    };
  }, []);

  // Mouse parallax tracking
  const handleMouseMove = useCallback((e) => {
    const container = containerRef.current;
    const { rx, ry } = quickTiltRef.current;
    if (!container || !rx || !ry) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1
    const tiltFactor = selectedStepRef.current !== null ? 0.25 : 1;
    rx(-y * 5 * tiltFactor);
    ry(x * 7 * tiltFactor);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const { rx, ry } = quickTiltRef.current;
    if (rx) rx(0);
    if (ry) ry(0);
    setIsHoveringNode(false);
  }, []);

  // State Machine Timer Loop (Auto-play)
  useEffect(() => {
    let timeoutId;

    // Do not auto-advance if paused, inspecting details, or hovering a node
    if (isPaused || selectedStep !== null || isHoveringNode) {
      return () => clearTimeout(timeoutId);
    }

    if (phase === 'steps') {
      if (currentStep < 7) {
        timeoutId = setTimeout(() => {
          setCurrentStep((prev) => prev + 1);
        }, 1100);
      } else {
        // After Step 7 holds for 1.5s, start converging
        timeoutId = setTimeout(() => {
          setPhase('converging');
        }, 1500);
      }
    } else if (phase === 'converging') {
      // Convergence animation takes 850ms, then bloom out dashboard
      timeoutId = setTimeout(() => {
        setPhase('dashboard');
      }, 850);
    } else if (phase === 'dashboard') {
      // Hold Dashboard for 6.5s, then reset back to step 1
      timeoutId = setTimeout(() => {
        setPhase('steps');
        setCurrentStep(1);
      }, 6500);
    }

    return () => clearTimeout(timeoutId);
  }, [phase, currentStep, isPaused, selectedStep, isHoveringNode]);

  // Click on a step node
  const handleStepClick = useCallback((stepNum) => {
    setSelectedStep(stepNum);
    setIsPaused(true);
    setPhase((prev) => (prev !== 'steps' ? 'steps' : prev));
  }, []);

  const handleNodeMouseEnter = useCallback(() => {
    setIsHoveringNode(true);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setIsHoveringNode(false);
  }, []);

  // Switch to next/previous step inside detail card
  const handleNextStep = () => {
    setSelectedStep((prev) => Math.min((prev || 1) + 1, 7));
  };

  const handlePrevStep = () => {
    setSelectedStep((prev) => Math.max((prev || 1) - 1, 1));
  };

  // Replay from Step 1
  const handleReplay = () => {
    setSelectedStep(null);
    setIsPaused(false);
    setPhase('steps');
    setCurrentStep(1);
  };

  // Toggle pause/play
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const currentSelectedStepData = steps.find((s) => s.num === selectedStep);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="onboarding-3d-root"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '520px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1200px',
        overflow: 'visible',
      }}
    >
      {/* Background Subtle Technical Grid & Crosshairs */}
      <div
        style={{
          position: 'absolute',
          inset: '16px',
          border: '1px dashed rgba(61, 59, 79, 0.16)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <span style={{ position: 'absolute', top: '-7px', left: '-6px', color: 'var(--color-accent, #28E99F)', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>+</span>
        <span style={{ position: 'absolute', top: '-7px', right: '-6px', color: 'var(--color-accent, #28E99F)', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>+</span>
        <span style={{ position: 'absolute', bottom: '-7px', left: '-6px', color: 'var(--color-accent, #28E99F)', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>+</span>
        <span style={{ position: 'absolute', bottom: '-7px', right: '-6px', color: 'var(--color-accent, #28E99F)', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>+</span>

        {/* Status Indicator Tag & Controls at Top-Right */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'auto',
          }}
        >
          {/* Pause / Play Toggle Button */}
          <button
            type="button"
            onClick={handleTogglePause}
            title={isPaused ? t('onboarding3d.resumeTitle') : t('onboarding3d.pauseTitle')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 7px',
              backgroundColor: isPaused ? 'rgba(40, 233, 159, 0.2)' : 'var(--color-canvas, #F4F5F6)',
              border: '1px solid var(--border-default, #D1D5DB)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: isPaused ? '#059669' : 'var(--color-primary, #3D3B4F)',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            {isPaused ? <Play size={10} fill="#059669" /> : <Pause size={10} fill="currentColor" />}
            <span>{isPaused ? t('onboarding3d.paused') : t('onboarding3d.auto')}</span>
          </button>

          {/* Current Step Status Tag */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              backgroundColor: 'var(--color-canvas, #F4F5F6)',
              border: '1px solid var(--border-default, #D1D5DB)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--color-primary, #3D3B4F)',
              borderRadius: '2px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: selectedStep !== null
                  ? '#28E99F'
                  : phase === 'dashboard'
                    ? '#28E99F'
                    : '#3D3B4F',
                boxShadow: selectedStep !== null ? '0 0 6px #28E99F' : 'none',
              }}
            />
            {selectedStep !== null
              ? t('onboarding3d.statusDetail', { step: selectedStep })
              : phase === 'dashboard'
                ? t('onboarding3d.statusDashboard')
                : phase === 'converging'
                  ? t('onboarding3d.statusConverging')
                  : t('onboarding3d.statusStep', { step: currentStep })}
          </div>
        </div>

        {/* Bottom Left Hint: Interactive Mouse Prompt */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            color: 'var(--text-muted, #6B7280)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.625rem',
            letterSpacing: '0.02em',
            pointerEvents: 'none',
          }}
        >
          <Info size={11} color="#059669" />
          <span>{t('onboarding3d.hint')}</span>
        </div>
      </div>

      {/* 3D Tilt Stage Wrapper */}
      <div
        ref={tiltStageRef}
        className="tilt-stage-wrapper"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          zIndex: 5,
        }}
      >
        {/* ================= 1. THE 7 HEXAGON NODES ================= */}
        {steps.map((step) => {
          const isSelected = selectedStep === step.num;
          const isActive = selectedStep === null && phase === 'steps' && currentStep === step.num;
          const isCompleted = selectedStep !== null 
            ? step.num < selectedStep 
            : (phase === 'steps' ? currentStep > step.num : true);

          return (
            <HexagonStepNode
              key={step.num}
              stepNum={step.num}
              title={step.title}
              icon={step.icon}
              isActive={isActive}
              isCompleted={isCompleted}
              isSelected={isSelected}
              isConverging={selectedStep === null && (phase === 'converging' || phase === 'dashboard')}
              x={step.x}
              y={step.y}
              onClick={handleStepClick}
              onMouseEnter={handleNodeMouseEnter}
              onMouseLeave={handleNodeMouseLeave}
            />
          );
        })}

        {/* ================= 2. CONNECTING ARROWS ================= */}
        {steps.slice(0, 6).map((step, idx) => {
          const nextStep = steps[idx + 1];
          const isArrowActive = selectedStep !== null
            ? selectedStep === step.num + 1
            : (phase === 'steps' && currentStep === step.num + 1);
          const isArrowCompleted = selectedStep !== null
            ? step.num + 1 < selectedStep
            : (phase === 'steps' && currentStep > step.num + 1);

          return (
            <ConnectingArrow
              key={`arrow-${step.num}`}
              fromX={step.x}
              fromY={step.y}
              toX={nextStep.x}
              toY={nextStep.y}
              isActive={isArrowActive}
              isCompleted={isArrowCompleted}
              isConverging={selectedStep === null && (phase === 'converging' || phase === 'dashboard')}
            />
          );
        })}

        {/* ================= 3. MINI DASHBOARD BLOOM ================= */}
        {selectedStep === null && (
          <MiniDashboardBloom
            isVisible={phase === 'dashboard'}
            onReplay={handleReplay}
          />
        )}
      </div>

      {/* ================= 4. STEP DETAIL MODAL OVERLAY ================= */}
      {selectedStep !== null && (
        <>
          {/* Subtle click-outside backdrop */}
          <div
            onClick={() => setSelectedStep(null)}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(61, 59, 79, 0.2)',
              backdropFilter: 'blur(3px)',
              zIndex: 32,
              cursor: 'pointer',
            }}
          />

          {/* Animated Detail Card */}
          <StepDetailCard
            step={currentSelectedStepData}
            totalSteps={7}
            onClose={() => setSelectedStep(null)}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            onSelectStep={(num) => setSelectedStep(num)}
            onResumeAutoPlay={() => {
              setSelectedStep(null);
              setIsPaused(false);
            }}
          />
        </>
      )}

      <style>{`
        @keyframes hexPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 1; }
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bloomExpand {
          0% {
            opacity: 0;
            transform: scale(0.3) translateZ(-80px);
          }
          60% {
            opacity: 1;
            transform: scale(1.03) translateZ(30px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateZ(20px);
          }
        }
      `}</style>
    </div>
  );
};

export default OnboardingSequence3D;
