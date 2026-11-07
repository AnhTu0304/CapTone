import gsap from 'gsap';

export const checkReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Creates a seamless ~3.0s infinite GSAP timeline for the Halftone Engraving Rooster.
 *
 * Implements multi-joint articulation so the neck and head bend organically
 * (shoulder collar -> lower hackle -> upper hackle -> cranial joint -> beak/wattles/comb)
 * rather than rotating as a single rigid object.
 *
 * Sequence:
 *   STATE 1 — IDLE (0.00s -> 0.62s)
 *   STATE 2 — HEAD DOWN (0.62s -> 1.15s)
 *   STATE 3 — PECK (1.15s -> 1.84s)
 *   STATE 4 — SWALLOW (1.84s -> 2.45s)
 *   STATE 5 — RETURN TO IDLE (2.45s -> 3.00s)
 */
export const createMascotTimeline = (scopeElement, options = {}) => {
  if (!scopeElement) return () => {};

  const isReducedMotion =
    options.reducedMotion !== undefined ? options.reducedMotion : checkReducedMotion();

  const q = gsap.utils.selector(scopeElement);

  const body = q('#chicken-body');
  const neck = q('#chicken-neck');
  const lowerHackle = q('.neck-lower-hackle');
  const upperHackle = q('.neck-upper-hackle');
  const head = q('#chicken-head');
  const comb = q('#chicken-comb');
  const wattles = q('#chicken-wattles');
  const eye = q('#chicken-eye');
  const beakUpper = q('#chicken-beak-upper');
  const beakLower = q('#chicken-beak-lower');
  const wing = q('#chicken-wing');
  const tail = q('#chicken-tail');
  const legs = q('#chicken-legs');
  const grains = gsap.utils.toArray(
    q('#grain-01, #grain-02, #grain-03, #grain-04')
  );
  const grain01 = q('#grain-01');
  const grain02 = q('#grain-02');
  const grain03 = q('#grain-03');
  const grain04 = q('#grain-04');

  // Anatomical pivot origins in SVG coordinate space (viewBox 0 0 800 620)
  gsap.set(body, {
    svgOrigin: '485 415',
    rotation: 0,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  });
  gsap.set(neck, {
    svgOrigin: '382 292',
    rotation: 0,
    skewX: 0,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  });
  gsap.set(lowerHackle, {
    svgOrigin: '388 280',
    rotation: 0,
    skewX: 0,
    x: 0,
    y: 0,
  });
  gsap.set(upperHackle, {
    svgOrigin: '345 315',
    rotation: 0,
    skewX: 0,
    x: 0,
    y: 0,
  });
  gsap.set(head, {
    svgOrigin: '274 418',
    rotation: 0,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  });
  gsap.set(comb, { svgOrigin: '268 395', rotation: 0, x: 0, y: 0 });
  gsap.set(wattles, { svgOrigin: '286 458', rotation: 0, x: 0, y: 0 });
  gsap.set(eye, { svgOrigin: '272 436', scaleY: 1, scaleX: 1 });
  gsap.set(beakUpper, { svgOrigin: '258 462', rotation: 0, x: 0, y: 0 });
  gsap.set(beakLower, { svgOrigin: '264 470', rotation: 0, x: 0, y: 0 });
  gsap.set(wing, { svgOrigin: '440 255', rotation: 0, x: 0, y: 0 });
  gsap.set(tail, { svgOrigin: '510 235', rotation: 0, x: 0, y: 0 });
  gsap.set(legs, { svgOrigin: '475 510', rotation: 0, x: 0, y: 0 });
  gsap.set(grains, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 });

  if (isReducedMotion) {
    return () => {};
  }

  // Reusable GSAP utility functions
  const randomGrainHopY = gsap.utils.random(-8, -3.5, 0.5, true);
  const randomGrainHopX = gsap.utils.random(-5, 6, 0.5, true);
  const randomGrainSpin = gsap.utils.random(-16, 16, 1, true);
  const clampAngle = gsap.utils.clamp(-24, 24);

  const tl = gsap.timeline({
    repeat: -1,
    defaults: { ease: 'sine.inOut' },
  });

  // ============================================================================
  // STATE 1 — IDLE (0.00s -> 0.62s)
  // Confident breathing, sickle tail plume sway, hackle ruffling, sharp blink
  // ============================================================================
  tl.addLabel('idle', 0)
    .to(
      body,
      {
        y: -2,
        rotation: 0.7,
        duration: 0.62,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      tail,
      {
        rotation: 2.4,
        y: -1.5,
        duration: 0.62,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      wing,
      {
        rotation: 1.1,
        duration: 0.62,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      neck,
      {
        rotation: 1.8,
        duration: 0.62,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      upperHackle,
      {
        rotation: 1.2,
        duration: 0.62,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      head,
      {
        rotation: 1.5,
        duration: 0.62,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      eye,
      {
        scaleY: 0.08,
        duration: 0.065,
        ease: 'power2.in',
        yoyo: true,
        repeat: 1,
      },
      'idle+=0.22'
    );

  // ============================================================================
  // STATE 2 — HEAD DOWN (0.62s -> 1.15s)
  // Progressive multi-segment neck curvature (torso -> shoulder -> hackles -> head)
  // ============================================================================
  tl.addLabel('headDown', 0.62)
    .to(
      body,
      {
        rotation: clampAngle(-3.2),
        y: 3,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      tail,
      {
        rotation: -3.2,
        y: -3,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      wing,
      {
        rotation: -1.8,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    // Primary neck articulation bends downward
    .to(
      neck,
      {
        rotation: clampAngle(-7.5),
        skewX: -2.2,
        x: -2,
        y: 5,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    // Lower hackle flares slightly to preserve smooth dorsal curve
    .to(
      lowerHackle,
      {
        rotation: 2.2,
        skewX: -1.5,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    // Upper hackle bends deeper toward the head
    .to(
      upperHackle,
      {
        rotation: -3.5,
        skewX: -2,
        y: 2,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    // Head flexes at the cranial joint so the beak aims directly at #grain-01
    .to(
      head,
      {
        rotation: clampAngle(-7.2),
        x: -2,
        y: 5,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      comb,
      {
        rotation: -4.2,
        duration: 0.53,
        ease: 'power2.out',
      },
      'headDown'
    )
    .to(
      wattles,
      {
        rotation: 6.5,
        x: -1,
        y: 2,
        duration: 0.53,
        ease: 'sine.out',
      },
      'headDown'
    )
    // Beak opens slightly in anticipation of the peck
    .to(
      beakUpper,
      {
        rotation: 4.5,
        duration: 0.34,
        ease: 'power2.out',
      },
      'headDown+=0.18'
    )
    .to(
      beakLower,
      {
        rotation: -8.5,
        duration: 0.34,
        ease: 'power2.out',
      },
      'headDown+=0.18'
    );

  // ============================================================================
  // STATE 3 — PECK (1.15s -> 1.84s)
  // Two rapid, decisive rooster strikes into the grain cluster with secondary follow-through
  // ============================================================================
  tl.addLabel('peck1', 1.15)
    .to(
      neck,
      {
        rotation: clampAngle(-11.2),
        skewX: -3.5,
        y: 9,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck1'
    )
    .to(
      upperHackle,
      {
        rotation: -5.5,
        y: 4,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck1'
    )
    .to(
      head,
      {
        rotation: clampAngle(-11.8),
        y: 9,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck1'
    )
    .to(
      comb,
      {
        rotation: -9.5,
        duration: 0.11,
        ease: 'power2.in',
      },
      'peck1'
    )
    .to(
      wattles,
      {
        rotation: 12,
        y: 3,
        duration: 0.12,
        ease: 'power2.out',
      },
      'peck1'
    )
    // Beak snaps shut on first grain contact
    .to(
      beakUpper,
      {
        rotation: 0,
        duration: 0.075,
        ease: 'power3.out',
      },
      'peck1+=0.08'
    )
    .to(
      beakLower,
      {
        rotation: -1,
        duration: 0.075,
        ease: 'power3.out',
      },
      'peck1+=0.08'
    )
    // Rice grains scatter & hop in response to strike 1
    .to(
      grain01,
      {
        y: () => randomGrainHopY(),
        x: () => randomGrainHopX(),
        rotation: () => randomGrainSpin(),
        scale: 0.9,
        duration: 0.12,
        ease: 'power2.out',
      },
      'peck1+=0.09'
    )
    .to(
      [grain02, grain03],
      {
        y: -4.5,
        x: (i) => (i === 0 ? 4.5 : -4),
        rotation: (i) => (i === 0 ? 14 : -15),
        duration: 0.13,
        ease: 'power2.out',
      },
      'peck1+=0.09'
    )
    // Quick elastic recoil between pecks
    .to(
      neck,
      {
        rotation: clampAngle(-7.2),
        skewX: -2,
        y: 4.5,
        duration: 0.14,
        ease: 'power2.out',
      },
      'peck1+=0.13'
    )
    .to(
      upperHackle,
      {
        rotation: -2.8,
        y: 2,
        duration: 0.14,
        ease: 'power2.out',
      },
      'peck1+=0.13'
    )
    .to(
      head,
      {
        rotation: clampAngle(-6),
        y: 4,
        duration: 0.14,
        ease: 'power2.out',
      },
      'peck1+=0.13'
    )
    .to(
      beakLower,
      {
        rotation: -7.5,
        duration: 0.11,
        ease: 'power2.out',
      },
      'peck1+=0.15'
    )
    .to(
      [grain01, grain02, grain03],
      {
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.15,
        ease: 'bounce.out',
      },
      'peck1+=0.20'
    )

    // Second decisive peck (1.46s)
    .addLabel('peck2', 1.46)
    .to(
      body,
      {
        rotation: clampAngle(-4.2),
        y: 4.5,
        duration: 0.11,
        ease: 'power2.in',
      },
      'peck2'
    )
    .to(
      tail,
      {
        rotation: -4.8,
        duration: 0.11,
        ease: 'power2.in',
      },
      'peck2'
    )
    .to(
      neck,
      {
        rotation: clampAngle(-12.2),
        skewX: -4,
        y: 10,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck2'
    )
    .to(
      upperHackle,
      {
        rotation: -6.2,
        y: 5,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck2'
    )
    .to(
      head,
      {
        rotation: clampAngle(-12.8),
        y: 10,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck2'
    )
    .to(
      comb,
      {
        rotation: -11.5,
        duration: 0.12,
        ease: 'back.out(2)',
      },
      'peck2'
    )
    .to(
      wattles,
      {
        rotation: 14,
        y: 4,
        duration: 0.12,
        ease: 'back.out(1.8)',
      },
      'peck2'
    )
    // Beak catches the rice grain
    .to(
      beakLower,
      {
        rotation: 0,
        duration: 0.08,
        ease: 'power3.inOut',
      },
      'peck2+=0.08'
    )
    .to(
      grain01,
      {
        y: -14,
        x: 4,
        scale: 0.35,
        opacity: 0,
        duration: 0.14,
        ease: 'power2.in',
      },
      'peck2+=0.08'
    )
    .to(
      [grain02, grain04],
      {
        y: -4.5,
        x: (i) => (i === 0 ? 5 : -3.5),
        rotation: (i) => (i === 0 ? 16 : -12),
        duration: 0.14,
        ease: 'power2.out',
      },
      'peck2+=0.09'
    )
    .to(
      [grain02, grain04],
      {
        y: 0,
        x: 0,
        rotation: 0,
        duration: 0.22,
        ease: 'bounce.out',
      },
      'peck2+=0.22'
    );

  // ============================================================================
  // STATE 4 — SWALLOW (1.84s -> 2.45s)
  // Rooster lifts neck & head in a smooth wave, swallows grain, wattles swing back
  // ============================================================================
  tl.addLabel('swallow', 1.84)
    .to(
      body,
      {
        rotation: 1,
        y: -1.5,
        duration: 0.42,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      tail,
      {
        rotation: 1.8,
        y: -1,
        duration: 0.42,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      wing,
      {
        rotation: 0.8,
        duration: 0.42,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      neck,
      {
        rotation: 3.6,
        skewX: 1.2,
        x: 0,
        y: -2,
        scaleX: 1.025,
        scaleY: 0.985,
        duration: 0.38,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      lowerHackle,
      {
        rotation: -1.2,
        skewX: 0,
        duration: 0.38,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      upperHackle,
      {
        rotation: 2.5,
        skewX: 1,
        y: -1,
        duration: 0.38,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      head,
      {
        rotation: 4.8,
        x: 0,
        y: -2,
        duration: 0.38,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      comb,
      {
        rotation: 3.2,
        duration: 0.42,
        ease: 'elastic.out(1, 0.6)',
      },
      'swallow'
    )
    .to(
      wattles,
      {
        rotation: -4.5,
        x: 0,
        y: 0,
        duration: 0.42,
        ease: 'elastic.out(1, 0.5)',
      },
      'swallow'
    )
    // Subtle mandible & throat swallow motion
    .to(
      beakLower,
      {
        rotation: -3.2,
        duration: 0.085,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      },
      'swallow+=0.30'
    )
    .to(
      neck,
      {
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        duration: 0.18,
        ease: 'sine.inOut',
      },
      'swallow+=0.38'
    )
    .to(
      eye,
      {
        scaleY: 0.1,
        duration: 0.06,
        yoyo: true,
        repeat: 1,
        ease: 'power1.inOut',
      },
      'swallow+=0.34'
    )
    // Respawn grain-01 smoothly on the ground so the loop continues seamlessly
    .fromTo(
      grain01,
      { x: 0, y: 3, scale: 0.2, opacity: 0, rotation: 0 },
      {
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.24,
        ease: 'back.out(1.7)',
      },
      'swallow+=0.32'
    );

  // ============================================================================
  // STATE 5 — RETURN TO IDLE (2.45s -> 3.00s)
  // Settles all multi-joint segments back to exact zero state for a jump-free loop
  // ============================================================================
  tl.addLabel('returnIdle', 2.45)
    .to(
      [
        body,
        neck,
        lowerHackle,
        upperHackle,
        head,
        comb,
        wattles,
        beakUpper,
        beakLower,
        wing,
        tail,
        legs,
      ],
      {
        x: 0,
        y: 0,
        rotation: 0,
        skewX: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.55,
        ease: 'sine.inOut',
      },
      'returnIdle'
    )
    .to(
      grains,
      {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        duration: 0.35,
        ease: 'sine.out',
      },
      'returnIdle'
    );

  return () => {
    tl.kill();
  };
};

export default createMascotTimeline;
