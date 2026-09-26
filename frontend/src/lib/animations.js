import gsap from 'gsap';

/**
 * Subtle GSAP animation helpers for modern DevOps SaaS
 * Follows restraint principles: no flashy bounce, no over-animation.
 */

export const initPageFadeIn = (element) => {
  if (!element) return;
  gsap.fromTo(
    element,
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
  );
};

export const animateCardHover = (element, isHovered) => {
  if (!element) return;
  gsap.to(element, {
    y: isHovered ? -2 : 0,
    boxShadow: isHovered ? '0 4px 12px rgba(15, 23, 42, 0.08)' : '0 1px 3px rgba(15, 23, 42, 0.06)',
    duration: 0.2,
    ease: 'power1.out',
  });
};

const animations = {
  initPageFadeIn,
  animateCardHover,
};

export default animations;
