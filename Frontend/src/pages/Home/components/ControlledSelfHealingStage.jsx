import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import './ControlledSelfHealingStage.css';

import hbIdle from '../../../assets/sprites/frames/healbot_idle.png';
import hbDetecting from '../../../assets/sprites/frames/healbot_detecting.png';
import hbThinking from '../../../assets/sprites/frames/healbot_thinking.png';
import hbPointing from '../../../assets/sprites/frames/healbot_pointing.png';
import hbWaiting from '../../../assets/sprites/frames/healbot_waiting.png';
import hbCelebrating from '../../../assets/sprites/frames/healbot_celebrating.png';

import opWorking from '../../../assets/sprites/frames/operator_working.png';
import opReviewing from '../../../assets/sprites/frames/operator_reviewing.png';
import opApproving from '../../../assets/sprites/frames/operator_approving.png';
import opSmiling from '../../../assets/sprites/frames/operator_smiling.png';

export const ControlledSelfHealingStage = ({ className = '' }) => {
  const containerRef = useRef(null);
  const robotColRef = useRef(null);
  const operatorColRef = useRef(null);
  const particlesRef = useRef([]);
  const starsRef = useRef([]);
  const tlRef = useRef(null);

  const [robotPose, setRobotPose] = useState('idle');
  const [operatorPose, setOperatorPose] = useState('working');
  const [dialogState, setDialogState] = useState({
    visible: false,
    approved: false,
    badgeText: 'Awaiting SRE Approval'
  });
  const [bubbleVisible, setBubbleVisible] = useState(false);

  useEffect(() => {
    const tl = gsap.timeline({ repeat: -1 });
    tlRef.current = tl;

    tl.call(() => {
      setRobotPose('idle');
      setOperatorPose('working');
      setDialogState({ visible: false, approved: false, badgeText: 'Awaiting SRE Approval' });
      setBubbleVisible(false);
    }, null, 0);

    const stars = starsRef.current.filter(Boolean);
    if (stars.length > 0) {
      tl.set(stars, { opacity: 0, scale: 0 }, 0);
    }

    tl.to(robotColRef.current, { y: -10, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);

    tl.call(() => {
      setRobotPose('pointing');
      setOperatorPose('reviewing');
      setDialogState({ visible: true, approved: false, badgeText: 'Awaiting SRE Approval' });
    }, null, 1.4);

    tl.to(robotColRef.current, { x: 175, duration: 1.0, ease: 'power2.out' }, 1.4);

    tl.call(() => {
      setBubbleVisible(true);
    }, null, 2.0);

    tl.call(() => {
      setBubbleVisible(false);
      setRobotPose('waiting');
      setOperatorPose('approving');
      setDialogState({ visible: true, approved: true, badgeText: 'Action Approved By SRE' });
    }, null, 3.4);

    tl.call(() => {
      setRobotPose('celebrating');
      setOperatorPose('smiling');
    }, null, 5.2);

    tl.to(robotColRef.current, { x: 205, duration: 0.35, ease: 'power1.out' }, 5.2);
    tl.to(operatorColRef.current, { x: -20, duration: 0.35, ease: 'power1.out' }, 5.2);

    if (stars.length > 0) {
      tl.to(stars, {
        opacity: 1,
        scale: 1,
        duration: 0.35,
        stagger: 0.04,
        ease: 'back.out(2)'
      }, 5.2);
      tl.to(stars, {
        y: -10,
        duration: 0.65,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut'
      }, 5.55);
      tl.to(stars, {
        opacity: 0,
        scale: 0.3,
        duration: 0.35,
        stagger: 0.03,
        ease: 'power2.in'
      }, 6.8);
    }

    const particles = particlesRef.current.filter(Boolean);
    if (particles.length > 0) {
      tl.set(particles, { opacity: 1, x: 0, y: 0, scale: 1 }, 5.3);
      particles.forEach((p, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist = 38 + (i % 3) * 22;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        tl.to(p, { x: dx, y: dy, opacity: 0, scale: 0, duration: 0.8, ease: 'power2.out' }, 5.3);
      });
    }

    tl.call(() => {
      setDialogState({ visible: false, approved: true, badgeText: 'Action Approved By SRE' });
    }, null, 6.8);

    tl.call(() => {
      setRobotPose('idle');
      setOperatorPose('working');
    }, null, 7.3);

    tl.to(robotColRef.current, { x: 0, duration: 1.1, ease: 'power2.inOut' }, 7.2);
    tl.to(operatorColRef.current, { x: 0, duration: 1.1, ease: 'power2.inOut' }, 7.2);

    tl.to({}, { duration: 0.3 }, 8.3);

    tl.play();

    let observer;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              tl.play();
            } else if (entry.intersectionRatio === 0) {
              tl.pause();
            }
          });
        },
        { threshold: [0, 0.1] }
      );
      observer.observe(containerRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
      if (tl) tl.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`csh-stage-root ${className}`.trim()}
      data-testid="controlled-self-healing-stage"
      aria-label="Controlled Self-Healing Character Storyboard Stage"
    >
      <div className="csh-bg-grid" />

      <div ref={robotColRef} className="csh-actor-col csh-robot-col">
        <div className="csh-sprite-stack">
          <img
            src={hbIdle}
            alt="Robot Idle"
            className={`csh-sprite-img ${robotPose === 'idle' ? 'is-active' : ''}`}
          />
          <img
            src={hbDetecting}
            alt="Robot Detecting"
            className={`csh-sprite-img ${robotPose === 'detecting' ? 'is-active' : ''}`}
          />
          <img
            src={hbThinking}
            alt="Robot Thinking"
            className={`csh-sprite-img ${robotPose === 'thinking' ? 'is-active' : ''}`}
          />
          <img
            src={hbPointing}
            alt="Robot Pointing"
            className={`csh-sprite-img ${robotPose === 'pointing' ? 'is-active' : ''}`}
          />
          <img
            src={hbWaiting}
            alt="Robot Waiting"
            className={`csh-sprite-img ${robotPose === 'waiting' ? 'is-active' : ''}`}
          />
          <img
            src={hbCelebrating}
            alt="Robot Celebrating"
            className={`csh-sprite-img ${robotPose === 'celebrating' ? 'is-active' : ''}`}
          />
        </div>
        <div className="csh-actor-pedestal" />
        <span className="csh-actor-label">AI AGENT // HEALBOT</span>
      </div>

      <div className="csh-interaction-center">
        <div
          className={`csh-pixel-dialog ${dialogState.visible ? 'is-visible' : ''} ${
            dialogState.approved ? 'is-approved' : ''
          }`}
          data-testid="csh-pixel-dialog"
        >
          <div className="csh-dialog-header">
            <span className="csh-dialog-tag">
              {dialogState.approved ? 'Remediation Approved' : 'K8s Anomaly Alert'}
            </span>
            <span className="csh-dialog-dot" />
          </div>

          <div className="csh-dialog-body">
            <div className="csh-dialog-row">
              <span className="csh-dialog-field">Pod Status:</span>
              <span className="csh-dialog-value is-warn">CrashLoopBackOff</span>
            </div>
            <div className="csh-dialog-row">
              <span className="csh-dialog-field">Cluster Node:</span>
              <span className="csh-dialog-value">worker-node-02</span>
            </div>
            <div className="csh-dialog-row">
              <span className="csh-dialog-field">Proposed Action:</span>
              <span className="csh-dialog-value is-ok">Restart affected Pod</span>
            </div>
          </div>

          <div className="csh-dialog-badge" data-testid="csh-dialog-badge">
            {dialogState.badgeText}
          </div>
        </div>

        <div
          className={`csh-speech-bubble ${bubbleVisible ? 'is-visible' : ''}`}
          data-testid="csh-speech-bubble"
        >
          <span className="csh-bubble-icon">⟳</span>
          <span className="csh-bubble-text">Restart Pod?</span>
        </div>

        <div className="csh-celebration-stars" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, idx) => {
            const variant =
              idx % 3 === 0
                ? 'csh-star-emerald'
                : idx % 3 === 1
                ? 'csh-star-mint'
                : 'csh-star-white';
            const sizeClass = idx % 2 === 0 ? 'is-lg' : 'is-sm';
            return (
              <span
                key={idx}
                ref={(el) => (starsRef.current[idx] = el)}
                className={`csh-diamond-star ${variant} ${sizeClass} csh-star-pos-${idx}`}
              />
            );
          })}
        </div>

        <div className="csh-particles-layer">
          {Array.from({ length: 16 }).map((_, idx) => {
            const colorClass =
              idx % 4 === 0
                ? 'csh-p-emerald'
                : idx % 4 === 1
                ? 'csh-p-mint'
                : idx % 4 === 2
                ? 'csh-p-gold'
                : 'csh-p-blue';
            return (
              <span
                key={idx}
                ref={(el) => (particlesRef.current[idx] = el)}
                className={`csh-pixel-particle ${colorClass}`}
              />
            );
          })}
        </div>
      </div>

      <div ref={operatorColRef} className="csh-actor-col csh-operator-col">
        <div className="csh-sprite-stack">
          <img
            src={opWorking}
            alt="Operator Working"
            className={`csh-sprite-img ${operatorPose === 'working' ? 'is-active' : ''}`}
          />
          <img
            src={opReviewing}
            alt="Operator Reviewing"
            className={`csh-sprite-img ${operatorPose === 'reviewing' ? 'is-active' : ''}`}
          />
          <img
            src={opApproving}
            alt="Operator Approving"
            className={`csh-sprite-img ${operatorPose === 'approving' ? 'is-active' : ''}`}
          />
          <img
            src={opSmiling}
            alt="Operator Smiling"
            className={`csh-sprite-img ${operatorPose === 'smiling' ? 'is-active' : ''}`}
          />
        </div>
        <div className="csh-actor-pedestal" />
        <span className="csh-actor-label">HUMAN OPERATOR // SRE</span>
      </div>
    </div>
  );
};

export default ControlledSelfHealingStage;
