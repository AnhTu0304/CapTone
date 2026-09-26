import React from 'react';
import HeroSection from './HeroSection';

/**
 * HeroSectionSlot
 * 
 * Mounts the high-fidelity HeroSection component.
 * Allows customHeroComponent override if provided.
 */
export const HeroSectionSlot = ({ customHeroComponent, onNavigate }) => {
  if (customHeroComponent) {
    return customHeroComponent;
  }

  return <HeroSection onNavigate={onNavigate} />;
};

export default HeroSectionSlot;
