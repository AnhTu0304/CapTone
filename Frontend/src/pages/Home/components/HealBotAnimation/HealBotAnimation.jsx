import React, { useState, useEffect } from 'react';
import './HealBotAnimation.css';

import eggIdleImg from '../../../../assets/sprites/healbot/healbot_egg_idle.png';
import eggCrackingImg from '../../../../assets/sprites/healbot/healbot_egg_cracking.png';
import chickHatchingImg from '../../../../assets/sprites/healbot/healbot_chick_hatching.png';
import healbotGuardianImg from '../../../../assets/sprites/healbot/healbot_guardian.png';

const PHASES = [
  {
    id: 'egg_idle',
    label: 'AGENT INITIALIZING',
    image: eggIdleImg,
    alt: 'Quả trứng HealBot bập bênh khởi tạo hạ tầng',
    duration: 1200,
  },
  {
    id: 'egg_cracking',
    label: 'ANOMALY DETECTED // WAKING',
    image: eggCrackingImg,
    alt: 'Trứng HealBot nứt vỏ khi phát hiện tín hiệu sự cố',
    duration: 1200,
  },
  {
    id: 'chick_hatching',
    label: 'HEALBOT HATCHING // CONNECTING',
    image: chickHatchingImg,
    alt: 'HealBot nở ra từ vỏ trứng và vươn người vỗ cánh',
    duration: 1400,
  },
  {
    id: 'guardian',
    label: 'AGENT ONLINE // PROTECTION ACTIVE',
    image: healbotGuardianImg,
    alt: 'HealBot Guardian vẫy cánh và kích hoạt khiên bảo vệ',
    duration: 1600,
  },
  {
    id: 'dissolve',
    label: 'CYCLE VERIFIED // RE-SYNCING',
    image: healbotGuardianImg,
    alt: 'HealBot đồng bộ hóa trạng thái và chuẩn bị chu kỳ mới',
    duration: 600,
  },
];

export const HealBotAnimation = ({ className = '', reducedMotion = false }) => {
  const [phaseIndex, setPhaseIndex] = useState(reducedMotion ? 3 : 0);

  useEffect(() => {
    if (reducedMotion) {
      setPhaseIndex(3);
      return undefined;
    }

    const currentDuration = PHASES[phaseIndex].duration;
    const timer = setTimeout(() => {
      setPhaseIndex((prev) => (prev + 1) % PHASES.length);
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [phaseIndex, reducedMotion]);

  const currentPhase = PHASES[phaseIndex];
  const isDissolve = currentPhase.id === 'dissolve';

  return (
    <div
      className={`healbot-stage ${className}`.trim()}
      data-testid="healbot-animation-stage"
      aria-label="Hoạt ảnh tiến hóa linh vật HealBot Kubernetes Guardian"
    >
      {/* Pixel Sprite Frame — Pure Character Frames on Section Background */}
      <div className={`healbot-sprite-frame healbot-frame-${currentPhase.id}`}>
        <img
          src={currentPhase.image}
          alt={currentPhase.alt}
          className={`healbot-pixel-img ${isDissolve ? 'healbot-img-dissolve' : ''}`}
          data-testid="healbot-sprite-image"
        />
      </div>
    </div>
  );
};

export default HealBotAnimation;
