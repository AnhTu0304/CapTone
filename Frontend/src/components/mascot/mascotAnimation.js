import gsap from 'gsap';

/**
 * Creates a seamless infinite GSAP timeline for the Method A Fine-Line & Emerald Rooster Mascot.
 *
 * Coordinate system: SVG viewBox="30 40 945 935" (1024x1024 base canvas, rooster facing left).
 * Note: For a left-facing character in SVG space, counter-clockwise (negative rotation) bends
 * the body, neck, and head downward toward the rice grains on the ground.
 *
 * Sequence (~3.0s loop):
 *  - STATE 1: IDLE (0.00s -> 0.72s) - Subtle breathing, sweeping tail sway, emerald eye blink
 *  - STATE 2: HEAD DOWN (0.72s -> 1.24s) - Multi-joint progressive bend toward grains
 *  - STATE 3: PECK (1.24s -> 1.88s) - Two crisp pecking strikes + emerald grain scatter
 *  - STATE 4: SWALLOW (1.88s -> 2.46s) - Head & neck lift smoothly, throat swallow pulse
 *  - STATE 5: RETURN TO IDLE (2.46s -> 3.00s) - Seamless settle back to neutral pose
 *
 * @param {SVGSVGElement | HTMLElement} scopeElement
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {gsap.core.Timeline | null}
 */
export function createMascotTimeline(scopeElement, options = {}) {
  if (!scopeElement) return null;

  const q = gsap.utils.selector(scopeElement);
  const clampRotation = gsap.utils.clamp(-22, 22);

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
  const grain01 = q('#grain-01');
  const grain02 = q('#grain-02');
  const grain03 = q('#grain-03');
  const grain04 = q('#grain-04');
  const allGrains = gsap.utils.toArray([grain01, grain02, grain03, grain04]);

  // Calibrated anatomical revolute joint pivots in 1024x1024 SVG coordinate space
  gsap.set(legs, { svgOrigin: '545 840', rotation: 0, x: 0, y: 0 });
  gsap.set(body, { svgOrigin: '545 705', rotation: 0, x: 0, y: 0, scaleY: 1 });
  gsap.set(tail, { svgOrigin: '575 415', rotation: 0, x: 0, y: 0 });
  gsap.set(wing, { svgOrigin: '445 495', rotation: 0, x: 0, y: 0 });
  gsap.set(neck, { svgOrigin: '410 548', rotation: 0, x: 0, y: 0 });
  gsap.set(head, { svgOrigin: '233 664', rotation: 0, x: 0, y: 0 });
  gsap.set(comb, { svgOrigin: '162 656', rotation: 0, x: 0, y: 0 });
  gsap.set(eye, { svgOrigin: '188 678', scaleY: 1, scaleX: 1 });
  gsap.set(beakUpper, { svgOrigin: '168 718', rotation: 0, x: 0, y: 0 });
  gsap.set(beakLower, { svgOrigin: '183 724', rotation: 0, x: 0, y: 0 });
  gsap.set(allGrains, { x: 0, y: 0, rotation: 0, scale: 1, autoAlpha: 1, transformOrigin: '50% 50%' });

  if (options.reducedMotion === true) {
    return null;
  }

  const tl = gsap.timeline({
    repeat: -1,
    defaults: { ease: 'sine.inOut' },
  });

  // =========================================================================
  // STATE 1 — IDLE (0.00s -> 0.72s)
  // =========================================================================
  tl.addLabel('idle', 0)
    .to(
      body,
      {
        y: -3.5,
        rotation: clampRotation(0.8),
        scaleY: 1.008,
        duration: 0.36,
        yoyo: true,
        repeat: 1,
      },
      'idle'
    )
    .to(
      tail,
      {
        rotation: clampRotation(2.8),
        x: 2,
        y: -2,
        duration: 0.36,
        yoyo: true,
        repeat: 1,
      },
      'idle'
    )
    .to(
      wing,
      {
        rotation: clampRotation(1.4),
        y: -2,
        duration: 0.36,
        yoyo: true,
        repeat: 1,
      },
      'idle'
    )
    .to(
      neck,
      {
        rotation: clampRotation(1.8),
        duration: 0.36,
        yoyo: true,
        repeat: 1,
      },
      'idle'
    )
    .to(
      comb,
      {
        rotation: clampRotation(-2.2),
        duration: 0.36,
        yoyo: true,
        repeat: 1,
      },
      'idle'
    )
    // Crisp emerald eye blink during idle
    .to(
      eye,
      {
        scaleY: 0.1,
        duration: 0.065,
        ease: 'power2.in',
        yoyo: true,
        repeat: 1,
      },
      'idle+=0.26'
    );

  // =========================================================================
  // STATE 2 — HEAD DOWN (0.72s -> 1.24s)
  // Progressive multi-joint bend: body leans -> neck bends -> head tilts down
  // =========================================================================
  tl.addLabel('headDown', 0.72)
    .to(
      body,
      {
        rotation: clampRotation(-2.2),
        x: -3,
        y: 3,
        duration: 0.5,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      tail,
      {
        rotation: clampRotation(-3.2),
        y: -4,
        duration: 0.5,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      wing,
      {
        rotation: clampRotation(-2.5),
        y: 2,
        duration: 0.5,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      neck,
      {
        rotation: clampRotation(-10.5),
        duration: 0.5,
        ease: 'power2.inOut',
      },
      'headDown'
    )
    .to(
      head,
      {
        rotation: clampRotation(-6.5),
        duration: 0.46,
        ease: 'power2.inOut',
      },
      'headDown+=0.04'
    )
    .to(
      comb,
      {
        rotation: clampRotation(3.5),
        duration: 0.46,
        ease: 'sine.out',
      },
      'headDown+=0.04'
    )
    .to(
      beakUpper,
      {
        rotation: clampRotation(5.5),
        duration: 0.32,
        ease: 'power2.out',
      },
      'headDown+=0.18'
    )
    .to(
      beakLower,
      {
        rotation: clampRotation(-7.5),
        duration: 0.32,
        ease: 'power2.out',
      },
      'headDown+=0.18'
    );

  // =========================================================================
  // STATE 3 — PECK (1.24s -> 1.88s)
  // Two fast, decisive pecking strikes with grain scatter & pickup
  // =========================================================================
  tl.addLabel('peck1', 1.24)
    .to(
      neck,
      {
        rotation: clampRotation(-14.2),
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck1'
    )
    .to(
      head,
      {
        rotation: clampRotation(-10.2),
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck1'
    )
    .to(
      comb,
      {
        rotation: clampRotation(-5.5),
        duration: 0.11,
        ease: 'power2.out',
      },
      'peck1'
    )
    .to(
      [beakUpper, beakLower],
      {
        rotation: 0,
        duration: 0.09,
        ease: 'power3.in',
      },
      'peck1+=0.02'
    )
    // Grain 01 & 03 jolt on first peck impact
    .to(
      grain01,
      {
        x: () => gsap.utils.random(-6, 5),
        y: -14,
        rotation: () => gsap.utils.random(-14, 14),
        duration: 0.1,
        ease: 'power2.out',
      },
      'peck1+=0.09'
    )
    .to(
      grain03,
      {
        x: () => gsap.utils.random(-8, -3),
        y: -6,
        rotation: () => gsap.utils.random(-10, 10),
        duration: 0.1,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
      },
      'peck1+=0.09'
    )
    .to(
      grain02,
      {
        x: () => gsap.utils.random(-6, -2),
        y: -4,
        duration: 0.1,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
      },
      'peck1+=0.1'
    )
    // Quick micro-rebound before second peck
    .addLabel('peckRecoil', 1.38)
    .to(
      neck,
      {
        rotation: clampRotation(-9.2),
        duration: 0.14,
        ease: 'power2.out',
      },
      'peckRecoil'
    )
    .to(
      head,
      {
        rotation: clampRotation(-5.0),
        duration: 0.14,
        ease: 'power2.out',
      },
      'peckRecoil'
    )
    .to(
      comb,
      {
        rotation: clampRotation(3.0),
        duration: 0.14,
        ease: 'sine.inOut',
      },
      'peckRecoil'
    )
    .to(
      beakUpper,
      {
        rotation: clampRotation(6.0),
        duration: 0.12,
        ease: 'power2.out',
      },
      'peckRecoil+=0.02'
    )
    .to(
      beakLower,
      {
        rotation: clampRotation(-8.0),
        duration: 0.12,
        ease: 'power2.out',
      },
      'peckRecoil+=0.02'
    )
    // Second decisive peck strike
    .addLabel('peck2', 1.54)
    .to(
      neck,
      {
        rotation: clampRotation(-14.8),
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck2'
    )
    .to(
      head,
      {
        rotation: clampRotation(-10.8),
        duration: 0.11,
        ease: 'power3.in',
      },
      'peck2'
    )
    .to(
      comb,
      {
        rotation: clampRotation(-6.2),
        duration: 0.11,
        ease: 'power2.out',
      },
      'peck2'
    )
    .to(
      [beakUpper, beakLower],
      {
        rotation: 0,
        duration: 0.09,
        ease: 'power4.in',
      },
      'peck2+=0.02'
    )
    // Grain 01 gets snatched into beak; grain 04 hops subtly
    .to(
      grain01,
      {
        y: -26,
        scale: 0.35,
        autoAlpha: 0,
        duration: 0.12,
        ease: 'power2.in',
      },
      'peck2+=0.08'
    )
    .to(
      grain04,
      {
        x: () => gsap.utils.random(3, 8),
        y: -5,
        duration: 0.11,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
      },
      'peck2+=0.09'
    );

  // =========================================================================
  // STATE 4 — SWALLOW (1.88s -> 2.46s)
  // Smooth lift up, gentle swallow pulse in neck/beak, grain 01 respawns
  // =========================================================================
  tl.addLabel('swallow', 1.88)
    .to(
      body,
      {
        rotation: clampRotation(0.6),
        x: 0,
        y: -1.5,
        duration: 0.48,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      tail,
      {
        rotation: clampRotation(2.0),
        y: 0,
        duration: 0.48,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      wing,
      {
        rotation: clampRotation(0.8),
        y: -1,
        duration: 0.48,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      neck,
      {
        rotation: clampRotation(2.4),
        duration: 0.48,
        ease: 'power2.out',
      },
      'swallow'
    )
    .to(
      head,
      {
        rotation: clampRotation(2.2),
        duration: 0.48,
        ease: 'power2.out',
      },
      'swallow+=0.03'
    )
    .to(
      comb,
      {
        rotation: clampRotation(2.5),
        duration: 0.46,
        ease: 'elastic.out(1, 0.5)',
      },
      'swallow+=0.05'
    )
    // Subtle throat/beak swallow nibble at top of lift
    .to(
      beakUpper,
      {
        rotation: clampRotation(2.5),
        duration: 0.08,
        yoyo: true,
        repeat: 1,
      },
      'swallow+=0.34'
    )
    .to(
      beakLower,
      {
        rotation: clampRotation(-3.5),
        duration: 0.08,
        yoyo: true,
        repeat: 1,
      },
      'swallow+=0.34'
    )
    .to(
      eye,
      {
        scaleY: 0.12,
        duration: 0.06,
        yoyo: true,
        repeat: 1,
      },
      'swallow+=0.38'
    )
    // Respawn grain 01 smoothly so loop is seamless
    .fromTo(
      grain01,
      { x: 0, y: 8, scale: 0.3, autoAlpha: 0, rotation: 0 },
      {
        x: 0,
        y: 0,
        scale: 1,
        autoAlpha: 1,
        rotation: 0,
        duration: 0.32,
        ease: 'back.out(1.8)',
      },
      'swallow+=0.22'
    );

  // =========================================================================
  // STATE 5 — RETURN TO IDLE (2.46s -> 3.00s)
  // Settle all parts back to exact neutral 0 state for a seamless loop
  // =========================================================================
  tl.addLabel('returnIdle', 2.46)
    .to(
      [body, tail, wing, neck, head, comb, beakUpper, beakLower],
      {
        rotation: 0,
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.54,
        ease: 'sine.inOut',
      },
      'returnIdle'
    )
    .to(
      allGrains,
      {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        autoAlpha: 1,
        duration: 0.4,
        ease: 'sine.out',
      },
      'returnIdle'
    );

  return tl;
}
