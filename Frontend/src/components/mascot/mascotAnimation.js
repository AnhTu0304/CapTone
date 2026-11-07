import gsap from 'gsap';

export const checkReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Creates a seamless ~3.0s infinite GSAP timeline for the Halftone Chicken Mascot.
 * Follows the 5 required states:
 *   STATE 1 — IDLE (0.00s -> 0.65s)
 *   STATE 2 — HEAD DOWN (0.65s -> 1.15s)
 *   STATE 3 — PECK (1.15s -> 1.85s)
 *   STATE 4 — SWALLOW (1.85s -> 2.45s)
 *   STATE 5 — RETURN TO IDLE (2.45s -> 3.00s)
 *
 * Uses gsap.utils.selector, gsap.utils.random, gsap.utils.toArray, and gsap.utils.clamp.
 */
export const createMascotTimeline = (scopeElement, options = {}) => {
  if (!scopeElement) return () => {};

  const isReducedMotion =
    options.reducedMotion !== undefined ? options.reducedMotion : checkReducedMotion();

  const q = gsap.utils.selector(scopeElement);

  const body = q('#chicken-body');
  const neck = q('#chicken-neck');
  const head = q('#chicken-head');
  const comb = q('#chicken-comb');
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

  // Establish anatomical pivot origins using SVG coordinate space (viewBox 0 0 680 560)
  gsap.set(body, { svgOrigin: '360 365', rotation: 0, x: 0, y: 0, scaleX: 1, scaleY: 1 });
  gsap.set(neck, { svgOrigin: '218 265', rotation: 0, x: 0, y: 0, scaleX: 1, scaleY: 1 });
  gsap.set(head, { svgOrigin: '132 342', rotation: 0, x: 0, y: 0, scaleX: 1, scaleY: 1 });
  gsap.set(comb, { svgOrigin: '96 320', rotation: 0, x: 0, y: 0 });
  gsap.set(eye, { svgOrigin: '104 346', scaleY: 1, scaleX: 1 });
  gsap.set(beakUpper, { svgOrigin: '94 374', rotation: 0, x: 0, y: 0 });
  gsap.set(beakLower, { svgOrigin: '100 384', rotation: 0, x: 0, y: 0 });
  gsap.set(wing, { svgOrigin: '305 225', rotation: 0, x: 0, y: 0 });
  gsap.set(tail, { svgOrigin: '465 255', rotation: 0, x: 0, y: 0 });
  gsap.set(legs, { svgOrigin: '335 450', rotation: 0, x: 0, y: 0 });
  gsap.set(grains, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 });

  if (isReducedMotion) {
    return () => {};
  }

  // Reusable random generators via gsap.utils.random(..., true)
  const randomGrainHopY = gsap.utils.random(-9, -4, 0.5, true);
  const randomGrainHopX = gsap.utils.random(-5, 6, 0.5, true);
  const randomGrainSpin = gsap.utils.random(-18, 18, 1, true);
  const clampRotation = gsap.utils.clamp(-25, 25);

  const tl = gsap.timeline({
    repeat: -1,
    defaults: { ease: 'sine.inOut' },
  });

  // ============================================================================
  // STATE 1 — IDLE (0.00s -> 0.65s)
  // Subtle breathing, organic tail sway, and natural eye blink
  // ============================================================================
  tl.addLabel('idle', 0)
    .to(
      body,
      {
        y: -2.5,
        rotation: 0.8,
        duration: 0.65,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      tail,
      {
        rotation: 2.6,
        y: -1.5,
        duration: 0.65,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      wing,
      {
        rotation: 1.2,
        y: -1,
        duration: 0.65,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      neck,
      {
        rotation: 2.2,
        duration: 0.65,
        ease: 'sine.inOut',
      },
      'idle'
    )
    .to(
      eye,
      {
        scaleY: 0.08,
        duration: 0.07,
        ease: 'power2.in',
        yoyo: true,
        repeat: 1,
      },
      'idle+=0.22'
    );

  // ============================================================================
  // STATE 2 — HEAD DOWN (0.65s -> 1.18s)
  // Neck bends naturally, body leans forward, beak approaches the grains
  // ============================================================================
  tl.addLabel('headDown', 0.65)
    .to(
      body,
      {
        rotation: clampRotation(-4.2),
        y: 3.5,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      tail,
      {
        rotation: -3.8,
        y: -4,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      wing,
      {
        rotation: -2.4,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      neck,
      {
        rotation: clampRotation(-14.5),
        x: -2,
        y: 5,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      head,
      {
        rotation: clampRotation(-8.5),
        x: -2,
        y: 4,
        duration: 0.53,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      comb,
      {
        rotation: -5.5,
        duration: 0.53,
        ease: 'power2.out',
      },
      'headDown'
    )
    .to(
      beakUpper,
      {
        rotation: 5,
        duration: 0.35,
        ease: 'power2.out',
      },
      'headDown+=0.18'
    )
    .to(
      beakLower,
      {
        rotation: -9,
        duration: 0.35,
        ease: 'power2.out',
      },
      'headDown+=0.18'
    );

  // ============================================================================
  // STATE 3 — PECK (1.18s -> 1.84s)
  // Two crisp, organic pecking strikes with grain scatter & comb follow-through
  // ============================================================================
  tl.addLabel('peck1', 1.18)
    // First downward strike
    .to(
      neck,
      {
        rotation: clampRotation(-19.5),
        y: 9,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck1'
    )
    .to(
      head,
      {
        rotation: clampRotation(-14),
        y: 8,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck1'
    )
    .to(
      comb,
      {
        rotation: -11,
        duration: 0.11,
        ease: 'power2.in',
      },
      'peck1'
    )
    // Beak snaps on grain impact
    .to(
      beakUpper,
      {
        rotation: 0,
        duration: 0.08,
        ease: 'power3.out',
      },
      'peck1+=0.08'
    )
    .to(
      beakLower,
      {
        rotation: -1,
        duration: 0.08,
        ease: 'power3.out',
      },
      'peck1+=0.08'
    )
    // Grains react to first peck
    .to(
      grain01,
      {
        y: () => randomGrainHopY(),
        x: () => randomGrainHopX(),
        rotation: () => randomGrainSpin(),
        scale: 0.85,
        duration: 0.12,
        ease: 'power2.out',
      },
      'peck1+=0.09'
    )
    .to(
      [grain02, grain03],
      {
        y: -4,
        x: (i) => (i === 0 ? 4 : -4),
        rotation: (i) => (i === 0 ? 12 : -14),
        duration: 0.14,
        ease: 'power2.out',
      },
      'peck1+=0.10'
    )
    // Slight rebound between pecks
    .to(
      neck,
      {
        rotation: clampRotation(-13.5),
        y: 4,
        duration: 0.15,
        ease: 'power2.out',
      },
      'peck1+=0.13'
    )
    .to(
      head,
      {
        rotation: clampRotation(-7),
        y: 3,
        duration: 0.15,
        ease: 'power2.out',
      },
      'peck1+=0.13'
    )
    .to(
      beakLower,
      {
        rotation: -8,
        duration: 0.12,
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
        duration: 0.16,
        ease: 'bounce.out',
      },
      'peck1+=0.21'
    )

    // Second quick peck (1.48s)
    .addLabel('peck2', 1.48)
    .to(
      neck,
      {
        rotation: clampRotation(-20.5),
        y: 10,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck2'
    )
    .to(
      head,
      {
        rotation: clampRotation(-15),
        y: 9,
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck2'
    )
    .to(
      body,
      {
        rotation: clampRotation(-5.2),
        y: 5,
        duration: 0.11,
        ease: 'power2.in',
      },
      'peck2'
    )
    .to(
      tail,
      {
        rotation: -5.5,
        duration: 0.11,
        ease: 'power2.in',
      },
      'peck2'
    )
    .to(
      comb,
      {
        rotation: -13,
        duration: 0.12,
        ease: 'back.out(2)',
      },
      'peck2'
    )
    // Catch grain in beak
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
        y: -12,
        x: 3,
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
        y: -5,
        x: (i) => (i === 0 ? 5 : 3),
        rotation: (i) => (i === 0 ? 15 : -10),
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
      'peck2+=0.23'
    );

  // ============================================================================
  // STATE 4 — SWALLOW (1.84s -> 2.45s)
  // Chicken lifts head, closes beak, subtle throat swallow pulse, grain respawns
  // ============================================================================
  tl.addLabel('swallow', 1.84)
    .to(
      body,
      {
        rotation: 1.2,
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
        y: 0,
        duration: 0.42,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      neck,
      {
        rotation: 4.5,
        x: 0,
        y: -2,
        scaleX: 1.03,
        scaleY: 0.98,
        duration: 0.38,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      head,
      {
        rotation: 5.5,
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
        rotation: 3.5,
        duration: 0.42,
        ease: 'elastic.out(1, 0.6)',
      },
      'swallow'
    )
    // Subtle throat & beak swallowing micro-motion
    .to(
      beakLower,
      {
        rotation: -3.5,
        duration: 0.09,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      },
      'swallow+=0.32'
    )
    .to(
      neck,
      {
        scaleX: 1,
        scaleY: 1,
        duration: 0.18,
        ease: 'sine.inOut',
      },
      'swallow+=0.40'
    )
    // Quick blink during swallow satisfaction
    .to(
      eye,
      {
        scaleY: 0.1,
        duration: 0.065,
        yoyo: true,
        repeat: 1,
        ease: 'power1.inOut',
      },
      'swallow+=0.36'
    )
    // Subtle respawn of grain-01 on the ground so loop is seamless
    .fromTo(
      grain01,
      { x: 0, y: 3, scale: 0.2, opacity: 0, rotation: 0 },
      { x: 0, y: 0, scale: 1, opacity: 1, rotation: 0, duration: 0.25, ease: 'back.out(1.7)' },
      'swallow+=0.32'
    );

  // ============================================================================
  // STATE 5 — RETURN TO IDLE (2.45s -> 3.00s)
  // Smoothly settles every group to exact initial transform (0) for zero loop jump
  // ============================================================================
  tl.addLabel('returnIdle', 2.45)
    .to(
      [body, neck, head, comb, beakUpper, beakLower, wing, tail, legs],
      {
        x: 0,
        y: 0,
        rotation: 0,
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
