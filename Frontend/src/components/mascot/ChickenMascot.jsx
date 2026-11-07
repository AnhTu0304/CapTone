import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { createMascotTimeline, checkReducedMotion } from './mascotAnimation';
import './ChickenMascot.css';

gsap.registerPlugin(useGSAP);

/**
 * ChickenMascot — Editorial Halftone Engraving Rooster
 *
 * Production-grade vector reconstruction of the sharp, confident rooster
 * pecking rice grains in a three-quarter editorial engraving style.
 *
 * Independently controllable SVG groups:
 * - #chicken-body
 * - #chicken-neck (with multi-joint hackle articulation layers: .neck-upper-hackle, .neck-lower-hackle)
 * - #chicken-head
 * - #chicken-comb
 * - #chicken-eye
 * - #chicken-beak-upper
 * - #chicken-beak-lower
 * - #chicken-wing
 * - #chicken-tail
 * - #chicken-legs
 * - #grain-01 .. #grain-04
 */
export const ChickenMascot = ({ className = '', reducedMotion }) => {
  const containerRef = useRef(null);

  useGSAP(
    () => {
      if (!containerRef.current) return undefined;
      const isReduced =
        reducedMotion !== undefined ? reducedMotion : checkReducedMotion();
      const cleanup = createMascotTimeline(containerRef.current, {
        reducedMotion: isReduced,
      });
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    },
    { scope: containerRef, dependencies: [reducedMotion], revertOnUpdate: true }
  );

  return (
    <div
      ref={containerRef}
      className={`chicken-mascot-stage ${className}`.trim()}
      data-testid="chicken-mascot"
    >
      <svg
        className="chicken-mascot-svg"
        viewBox="0 0 800 620"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="chicken-mascot-title chicken-mascot-desc"
      >
        <title id="chicken-mascot-title">
          Minh họa gà trống Halftone cổ điển đang mổ thóc
        </title>
        <desc id="chicken-mascot-desc">
          Linh vật chú gà trống sắc sảo phong cách khắc báo cổ điển đen trắng kết
          hợp họa tiết chấm bi Halftone đang cúi mổ từng hạt thóc theo vòng lặp tự
          nhiên.
        </desc>

        <defs>
          {/* 1. Heavy Halftone Stipple (Deep core shadows on breast, thigh, under-tail) */}
          <pattern
            id="halftone-dense"
            width="4.5"
            height="4.5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(28)"
          >
            <circle cx="1.5" cy="1.5" r="1.42" fill="#141413" />
            <circle cx="3.8" cy="3.8" r="1.12" fill="#141413" />
          </pattern>

          {/* 2. Medium-Dense Halftone Stipple (Midtone engraving transition) */}
          <pattern
            id="halftone-mid"
            width="5.8"
            height="5.8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(28)"
          >
            <circle cx="1.8" cy="1.8" r="1.15" fill="#141413" />
            <circle cx="4.7" cy="4.7" r="0.72" fill="#141413" />
          </pattern>

          {/* 3. Fine Halftone Stipple (Soft thigh, saddle & ground transitions) */}
          <pattern
            id="halftone-light"
            width="7.2"
            height="7.2"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(28)"
          >
            <circle cx="2.2" cy="2.2" r="0.82" fill="#1F1F1D" />
            <circle cx="5.8" cy="5.8" r="0.48" fill="#27272A" />
          </pattern>

          {/* 4. Ultra-Fine Highlight Stipple (Upper neck, shoulder & ground fade) */}
          <pattern
            id="halftone-ultrafine"
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(18)"
          >
            <circle cx="3" cy="3" r="0.58" fill="#27272A" />
            <circle cx="7.5" cy="6.5" r="0.38" fill="#3F3F46" />
          </pattern>

          {/* 5. Sharp Woodcut Engraving Hatch Pattern (Sickle tail & wing vanes) */}
          <pattern
            id="engraving-hatch"
            width="5.5"
            height="5.5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-26)"
          >
            <line
              x1="0"
              y1="1.5"
              x2="5.5"
              y2="1.5"
              stroke="#141413"
              strokeWidth="1.25"
            />
            <line
              x1="0"
              y1="4.2"
              x2="5.5"
              y2="4.2"
              stroke="#141413"
              strokeWidth="0.8"
              strokeDasharray="3.5 1.5"
            />
          </pattern>

          {/* Clipping Paths for Rooster Torso & Wing */}
          <clipPath id="clip-chicken-torso">
            <path d="M332 272 C376 206 432 184 494 186 C558 188 612 242 606 322 C600 392 558 446 506 456 C464 464 426 436 390 422 C352 406 320 350 332 272 Z" />
          </clipPath>

          <clipPath id="clip-chicken-wing">
            <path d="M418 232 C486 212 582 254 636 344 C574 348 498 340 444 318 C408 302 394 256 418 232 Z" />
          </clipPath>
        </defs>

        {/* =====================================================================
            1. GROUND STIPPLE SHADOW & SCATTERED RICE GRAINS (#grain-01 .. #grain-04)
            Faithfully reproduces the stippled earth and oval rice grains
        ===================================================================== */}
        <g id="ground-shadow" aria-hidden="true">
          {/* Outer ultra-fine stipple ground horizon */}
          <ellipse
            cx="458"
            cy="534"
            rx="288"
            ry="28"
            fill="url(#halftone-ultrafine)"
            opacity="0.85"
          />
          {/* Mid-density stipple ground shadow under feet and pecking zone */}
          <ellipse
            cx="442"
            cy="530"
            rx="224"
            ry="20"
            fill="url(#halftone-light)"
            opacity="0.88"
          />
          {/* Dense contact shadow directly beneath both planted claws */}
          <ellipse
            cx="408"
            cy="522"
            rx="78"
            ry="9"
            fill="url(#halftone-mid)"
            opacity="0.9"
          />
          <ellipse
            cx="506"
            cy="536"
            rx="92"
            ry="11"
            fill="url(#halftone-mid)"
            opacity="0.92"
          />
          <ellipse
            cx="296"
            cy="532"
            rx="68"
            ry="10"
            fill="url(#halftone-light)"
            opacity="0.78"
          />

          {/* Hand-placed stipple earth specks around the pecking zone */}
          <circle cx="248" cy="528" r="1.4" fill="#141413" />
          <circle cx="264" cy="536" r="1.6" fill="#141413" />
          <circle cx="272" cy="529" r="1.2" fill="#141413" />
          <circle cx="284" cy="534" r="1.5" fill="#141413" />
          <circle cx="298" cy="527" r="1.3" fill="#141413" />
          <circle cx="312" cy="536" r="1.6" fill="#141413" />
          <circle cx="324" cy="531" r="1.2" fill="#141413" />
          <circle cx="338" cy="538" r="1.4" fill="#141413" />
          <circle cx="628" cy="534" r="1.3" fill="#141413" />
          <circle cx="654" cy="539" r="1.1" fill="#141413" />
          <circle cx="682" cy="536" r="0.9" fill="#141413" />

          {/* Ambient scattered rice grains matching the left & right foreground of reference */}
          <g id="ambient-rice-grains">
            {/* Far left grain */}
            <path
              d="M98 532 C102 529.2 110 529.2 114 532 C110 534.8 102 534.8 98 532 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="1.9"
            />
            {/* Upper left grain */}
            <path
              d="M130 523 C134.5 519.8 143.5 519.8 148 523 C143.5 526.2 134.5 526.2 130 523 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2"
            />
            {/* Lower left grain */}
            <path
              d="M144 549 C149 545.6 158 545.6 163 549 C158 552.4 149 552.4 144 549 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2"
            />
            {/* Mid-left grain */}
            <path
              d="M168 530 C172.5 526.8 181.5 526.8 186 530 C181.5 533.2 172.5 533.2 168 530 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2"
            />
            {/* High left grain */}
            <path
              d="M184 512 C188.5 508.8 197.5 508.8 202 512 C197.5 515.2 188.5 515.2 184 512 Z"
              transform="rotate(6 193 512)"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2"
            />
            {/* Inner left grain */}
            <path
              d="M194 533 C198.5 529.8 207.5 529.8 212 533 C207.5 536.2 198.5 536.2 194 533 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2"
            />
            {/* Right of cluster grains */}
            <path
              d="M274 519 C278.5 515.8 287.5 515.8 292 519 C287.5 522.2 278.5 522.2 274 519 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2"
            />
            <path
              d="M292 540 C296.5 536.8 305.5 536.8 310 540 C305.5 543.2 296.5 543.2 292 540 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2"
            />
            <path
              d="M270 558 C274.5 554.8 283.5 554.8 288 558 C283.5 561.2 274.5 561.2 270 558 Z"
              transform="rotate(8 279 558)"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2"
            />
            <path
              d="M324 558 C328 555.2 336 555.2 340 558 C336 560.8 328 560.8 324 558 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="1.9"
            />
          </g>
        </g>

        {/* GRAIN 01 — Primary target grain cluster directly beneath the sharp beak tip (244, 535) */}
        <g id="grain-01">
          <path
            d="M225 537 C230 533.2 240 533.2 245 537 C240 540.8 230 540.8 225 537 Z"
            transform="rotate(-10 235 537)"
            fill="#FAF8F5"
            stroke="#141413"
            strokeWidth="2.1"
          />
          <path
            d="M236 531 C241 527.5 249 527.5 254 531 C249 534.5 241 534.5 236 531 Z"
            transform="rotate(14 245 531)"
            fill="#FAF8F5"
            stroke="#141413"
            strokeWidth="2.1"
          />
          <path
            d="M242 538 C247 534.5 256 534.5 261 538 C256 541.5 247 541.5 242 538 Z"
            transform="rotate(6 251 538)"
            fill="#FAF8F5"
            stroke="#141413"
            strokeWidth="2.1"
          />
          <path
            d="M231 536.5 H239 M246 538 H255"
            stroke="#141413"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>

        {/* GRAIN 02 — Angled rice grain right below the beak */}
        <g id="grain-02">
          <path
            d="M247 521 C251.5 517.5 261.5 517.5 266 521 C261.5 524.5 251.5 524.5 247 521 Z"
            transform="rotate(24 256.5 521)"
            fill="#FAF8F5"
            stroke="#141413"
            strokeWidth="2.1"
          />
          <path
            d="M252 519.5 L261 522.5"
            stroke="#141413"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>

        {/* GRAIN 03 — Upper-left target grain near beak */}
        <g id="grain-03">
          <path
            d="M219 520 C223.5 516.5 233.5 516.5 238 520 C233.5 523.5 223.5 523.5 219 520 Z"
            transform="rotate(-18 228.5 520)"
            fill="#FAF8F5"
            stroke="#141413"
            strokeWidth="2.1"
          />
          <path
            d="M224 521.5 L233 518.5"
            stroke="#141413"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>

        {/* GRAIN 04 — Foreground bottom grain below cluster */}
        <g id="grain-04">
          <path
            d="M212 555 C216.5 551.5 226.5 551.5 231 555 C226.5 558.5 216.5 558.5 212 555 Z"
            transform="rotate(-6 221.5 555)"
            fill="#FAF8F5"
            stroke="#141413"
            strokeWidth="2.1"
          />
          <path
            d="M217 555.5 L226 554.5"
            stroke="#141413"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>

        {/* =====================================================================
            2. ROOSTER LEGS (#chicken-legs)
            Both sturdy, scaly legs planted firmly on the ground with sharp claws & spurs
        ===================================================================== */}
        <g id="chicken-legs">
          {/* LEFT / BACKGROUND LEG (Angled forward from dark feathered hock) */}
          <g id="rooster-leg-left">
            {/* Dark feathered upper hock */}
            <path
              d="M412 412 C420 434 432 452 442 462 C456 454 468 438 474 418 Z"
              fill="#141413"
            />
            {/* Shank & Toes Silhouette */}
            <path
              d="M438 446 L396 502 L338 518 C346 522 362 522 384 516 L348 538 C362 538 384 528 402 516 L448 528 C442 520 426 512 412 506 L456 452 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            {/* Stipple shading along left leg */}
            <path
              d="M438 446 L396 502 L352 534 L402 516 L444 526 L412 506 L456 452 Z"
              fill="url(#halftone-light)"
              opacity="0.72"
            />
            {/* Engraved reptilian scale lines & sharp black talons */}
            <path
              d="M430 462 L444 468 M422 473 L436 479 M414 484 L428 490 M406 495 L420 501 M368 512 L374 518 M382 508 L388 514 M372 522 L380 528 M386 516 L394 522"
              stroke="#141413"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            {/* Dark sharp claws */}
            <path
              d="M338 518 L328 521 L342 522 Z M348 538 L338 543 L354 539 Z M448 528 L458 532 L444 524 Z"
              fill="#141413"
            />
          </g>

          {/* RIGHT / FOREGROUND LEG (Planted directly under muscular thigh) */}
          <g id="rooster-leg-right">
            {/* Shank & Spread Talons Silhouette */}
            <path
              d="M518 444 L498 514 L436 535 C450 539 474 535 496 528 L478 564 C490 556 504 542 514 530 L568 552 C558 540 538 528 522 518 L544 446 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Halftone shading on back edge of shank */}
            <path
              d="M530 446 L512 518 L558 546 L522 518 L544 446 Z"
              fill="url(#halftone-mid)"
              opacity="0.75"
            />
            {/* Scute scale rings down the tarsus & toes */}
            <path
              d="M516 462 L536 466 M513 474 L533 478 M510 486 L530 490 M506 498 L526 502 M502 510 L522 514 M464 526 L470 534 M480 522 L486 530 M492 536 L502 542 M486 546 L496 552 M532 528 L538 536 M546 536 L552 544"
              stroke="#141413"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Sharp Black Talons */}
            <path
              d="M436 535 L424 540 L442 538 Z M478 564 L472 574 L486 560 Z M568 552 L580 558 L562 546 Z"
              fill="#141413"
            />
          </g>
        </g>

        {/* =====================================================================
            3. ROOSTER ARCHING SICKLE TAIL (#chicken-tail)
            Long, sweeping, high-contrast engraved sickle & covert plumes
        ===================================================================== */}
        <g id="chicken-tail">
          {/* Deep Black Under-Tail Base & Lower Plumes */}
          <path
            d="M474 220 C512 184 576 174 628 214 C668 244 684 304 662 356 C654 332 638 316 618 308 C638 336 644 368 632 396 C618 368 598 348 576 338 C596 364 602 394 592 418 L484 328 Z"
            fill="#141413"
          />
          <path
            d="M524 236 C568 228 616 254 644 308 C616 336 574 348 532 332 Z"
            fill="url(#halftone-dense)"
          />

          {/* SICKLE PLUME 1 — Highest Top-Left Arching Feather */}
          <path
            d="M482 178 C504 102 554 36 618 16 C594 42 574 78 564 116 C536 132 508 154 482 178 Z"
            fill="#141413"
            stroke="#141413"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M496 164 C518 102 560 48 608 24 C594 44 580 72 570 102 C544 120 518 142 496 164 Z"
            fill="#FAF8F5"
          />
          <path
            d="M502 158 C524 102 562 52 604 30 C584 62 568 96 558 126 Z"
            fill="url(#engraving-hatch)"
          />

          {/* SICKLE PLUME 2 — Broad Sweeping Upper Arch */}
          <path
            d="M512 162 C558 76 638 30 714 58 C684 56 648 72 618 106 C666 64 724 72 754 126 C714 96 664 102 618 138 L524 184 Z"
            fill="#141413"
            stroke="#141413"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M534 152 C576 84 644 48 704 62 C668 68 632 90 602 126 Z"
            fill="#FAF8F5"
          />
          <path
            d="M542 148 C582 90 644 56 696 66 C662 78 628 100 600 130 Z"
            fill="url(#halftone-mid)"
          />

          {/* SICKLE PLUME 3 — Long Main Arching Plume Curving Far Right & Down */}
          <path
            d="M536 166 C604 94 702 92 758 198 C722 146 672 134 618 158 C688 134 764 188 776 312 C748 238 698 198 636 196 L544 208 Z"
            fill="#141413"
            stroke="#141413"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* White & hatched upper vane of main sickle feather */}
          <path
            d="M554 168 C618 114 704 124 756 218 C768 244 772 274 774 302 C748 228 692 178 624 176 C596 176 572 174 554 168 Z"
            fill="#FAF8F5"
          />
          <path
            d="M568 168 C630 124 708 138 756 232 C730 188 682 164 626 168 Z"
            fill="url(#engraving-hatch)"
          />
          {/* Quill shaft line */}
          <path
            d="M548 172 C628 132 722 162 772 298"
            stroke="#141413"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* SICKLE PLUME 4 — Inner Drooping Plume with Rich White/Stipple Vane */}
          <path
            d="M528 188 C596 146 684 178 712 288 C720 322 714 358 696 388 C698 342 684 294 652 260 C676 304 676 358 652 402 C648 352 626 306 588 278 L518 232 Z"
            fill="#141413"
            stroke="#141413"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M542 192 C604 160 676 192 698 286 C704 316 702 346 694 374 C686 314 654 256 598 232 C576 222 556 208 542 192 Z"
            fill="#FAF8F5"
          />
          <path
            d="M556 196 C614 172 674 206 694 294 C674 252 636 222 588 214 Z"
            fill="url(#halftone-light)"
          />
          {/* Engraved feather barbs along Plume 4 */}
          <path
            d="M552 194 C616 174 682 216 696 364 M576 184 L592 204 M602 186 L616 210 M628 196 L638 222 M652 212 L658 240 M672 236 L674 264 M686 264 L684 294 M694 296 L688 326"
            stroke="#141413"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* SADDLE HACKLES & TAIL COVERTS — Overlapping pointed feathers bridging back to tail */}
          <path
            d="M446 194 C462 162 484 136 506 122 C498 148 494 170 494 188 C524 156 564 142 606 148 C578 164 556 182 542 202 C582 182 628 188 666 218 C632 216 600 222 574 238 C614 234 652 256 676 294 C640 276 604 270 572 278 C602 288 626 314 638 346 C604 322 568 310 532 308 L442 246 Z"
            fill="#FAF8F5"
            stroke="#141413"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path
            d="M462 198 C504 166 562 162 612 188 C576 202 546 222 526 248 C568 234 612 248 642 282 C602 274 562 280 528 296 Z"
            fill="url(#halftone-mid)"
          />
          {/* Fine dark covert feather ribs */}
          <path
            d="M468 184 C506 164 548 160 588 168 M482 204 C526 190 574 196 618 218 M494 226 C540 218 588 232 628 262 M504 248 C546 248 586 266 616 298"
            stroke="#141413"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* =====================================================================
            4. ROOSTER BODY (#chicken-body)
            Muscular torso with 4-tier halftone stipple breast/thigh shading,
            folded primary wing (#chicken-wing), and multi-joint neck (#chicken-neck)
        ===================================================================== */}
        <g id="chicken-body">
          {/* Torso Base Silhouette (Warm cream highlight paper base) */}
          <path
            d="M332 272 C376 206 432 184 494 186 C558 188 612 242 606 322 C600 392 558 446 506 456 C464 464 426 436 390 422 C352 406 320 350 332 272 Z"
            fill="#FAF8F5"
            stroke="#141413"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />

          {/* Multi-layered Halftone Stipple Shading inside Torso */}
          <g clipPath="url(#clip-chicken-torso)">
            {/* Layer 1: Light stipple spreading across mid-body, breast & thigh */}
            <path
              d="M342 268 C402 248 486 258 578 302 C598 368 564 442 504 456 C442 462 368 424 334 362 Z"
              fill="url(#halftone-light)"
            />

            {/* Layer 2: Medium stipple modeling the round muscular thigh & breast */}
            <path
              d="M348 318 C396 312 448 334 484 382 C492 342 536 328 584 344 C592 396 558 444 508 456 C456 462 384 432 344 378 Z"
              fill="url(#halftone-mid)"
            />

            {/* Layer 3: Heavy stipple in deep shadow under wing, groin & lower breast */}
            <path
              d="M352 364 C394 374 436 394 468 428 C432 438 386 424 352 394 Z M534 332 C568 334 596 354 604 388 C588 426 556 448 524 454 C554 422 556 372 534 332 Z"
              fill="url(#halftone-dense)"
            />

            {/* Crisp white highlight core on the rounded thigh front */}
            <ellipse
              cx="508"
              cy="388"
              rx="36"
              ry="44"
              transform="rotate(-14 508 388)"
              fill="#FAF8F5"
              opacity="0.72"
            />
            <ellipse
              cx="508"
              cy="388"
              rx="32"
              ry="40"
              transform="rotate(-14 508 388)"
              fill="url(#halftone-ultrafine)"
            />

            {/* Upper back & saddle fine stipple */}
            <path
              d="M398 192 C446 182 502 188 544 218 C504 236 446 238 398 220 Z"
              fill="url(#halftone-ultrafine)"
            />
          </g>

          {/* Jagged Feathered Outline along Under-Belly, Hock & Rear Fluff */}
          <path
            d="M366 404 L358 416 L376 410 L372 424 L390 416 L388 430 L406 420 L408 436 L424 426 L432 440 L446 428 L460 442 L472 432 M482 438 L488 454 L500 444 L508 458 L520 446 L532 458 L542 444 L554 452 L560 436 L574 442 L578 422 L592 426 L592 404 L606 406 L602 384 L616 382 L608 358"
            fill="#141413"
            stroke="#141413"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* =================================================================
              5. ROOSTER WING (#chicken-wing)
              Dark stippled shoulder coverts + long pointed primary feathers
          ================================================================= */}
          <g id="chicken-wing">
            {/* Wing Base Silhouette */}
            <path
              d="M418 232 C486 212 582 254 636 344 C574 348 498 340 444 318 C408 302 394 256 418 232 Z"
              fill="#FAF8F5"
              stroke="#141413"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            <g clipPath="url(#clip-chicken-wing)">
              {/* Dark Stippled Shoulder Patch (Wing Bow / Coverts matching reference) */}
              <path
                d="M406 236 C452 222 504 242 528 284 C508 318 456 326 414 304 Z"
                fill="url(#halftone-dense)"
              />
              <path
                d="M428 228 C478 218 532 244 556 292 C526 324 468 328 424 302 Z"
                fill="url(#halftone-mid)"
              />
              {/* Lower primary feathers subtle stipple */}
              <path
                d="M506 268 C558 274 604 304 636 344 L468 326 Z"
                fill="url(#halftone-light)"
              />
            </g>

            {/* Dark Scalloped Wing Bar (Middle Coverts) */}
            <path
              d="M436 236 C458 242 474 256 472 272 C454 276 436 266 426 252 M464 234 C488 242 504 258 500 276 C482 280 462 268 452 252 M492 238 C516 248 530 266 526 284 C506 286 488 274 478 256 M422 272 C446 280 462 296 458 312 C438 312 420 300 412 284 M452 276 C478 286 494 302 488 318 C468 318 448 304 440 288 M482 280 C508 290 524 308 518 324 C498 324 478 310 470 292"
              fill="#141413"
              stroke="#FAF8F5"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* Long Pointed Primary & Secondary Flight Feathers */}
            <path
              d="M518 252 C562 268 602 296 632 332 M508 272 C554 288 596 314 634 342 M494 292 C542 308 588 328 628 344 M476 310 C526 322 574 336 616 344"
              stroke="#141413"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Fine feather barb lines between primaries */}
            <path
              d="M526 262 L618 326 M514 282 L616 338 M498 302 L602 342"
              stroke="#141413"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeDasharray="10 4"
            />
          </g>

          {/* =================================================================
              6. ROOSTER ARTICULATED NECK (#chicken-neck)
              Sharp, cascading jagged hackle feathers split into sub-layers
              so the neck bends organically instead of rotating as a rigid block!
          ================================================================= */}
          <g id="chicken-neck">
            {/* Circular shoulder joint bridge inside torso (pivot: 382, 292) */}
            <circle cx="382" cy="292" r="68" fill="#FAF8F5" />

            {/* SUB-LAYER A: Lower Shoulder Hackle Cascade (.neck-lower-hackle)
                Dark jagged pointed tips overlapping the front shoulder & breast */}
            <g className="neck-lower-hackle">
              <path
                d="M398 192 C354 216 314 258 282 316 L318 398 C346 408 378 412 412 406 L388 394 L424 392 L396 378 L434 374 L404 358 L442 352 L412 336 L446 328 L414 312 L448 302 L416 286 L446 274 L414 260 L442 246 L410 234 L434 218 L404 210 L422 196 Z"
                fill="#141413"
                stroke="#141413"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              {/* Stipple midtone transition inside hackle tips */}
              <path
                d="M388 204 C348 230 312 272 284 328 C318 364 366 382 414 374 C426 322 422 252 388 204 Z"
                fill="#FAF8F5"
              />
              <path
                d="M388 204 C348 230 312 272 284 328 C318 364 366 382 414 374 C426 322 422 252 388 204 Z"
                fill="url(#halftone-mid)"
              />
            </g>

            {/* SUB-LAYER B: Upper & Mid Hackle Plumes (.neck-upper-hackle)
                Bright cream dorsal crest with sharp spiky edges & dark engraved streaks */}
            <g className="neck-upper-hackle">
              <path
                d="M402 188 L384 196 L392 184 L366 202 L374 190 L346 214 L354 202 L326 232 L334 220 L308 256 L316 244 L292 284 L298 274 L276 318 L282 308 L262 354 L252 406 C284 416 332 414 378 398 L352 388 L388 382 L362 368 L398 360 L370 346 L404 336 L376 322 L408 310 L380 296 L410 282 L382 268 L408 252 L382 238 L406 222 Z"
                fill="#FAF8F5"
                stroke="#141413"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />

              {/* Fine halftone stipple along lower hackle curve */}
              <path
                d="M268 358 C298 378 342 384 386 368 C398 326 394 268 368 228 C342 268 304 316 268 358 Z"
                fill="url(#halftone-light)"
              />

              {/* Sharp Engraved Hackle Feather Streaks radiating from nape to collar */}
              <path
                d="M276 382 C308 348 346 308 386 276 M282 394 C318 364 358 328 398 298 M294 402 C332 378 370 348 404 322 M272 366 C304 326 342 282 382 246 M284 336 C316 294 352 252 388 218 M302 298 C332 262 362 228 392 200"
                stroke="#141413"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M268 374 L356 286 M278 388 L372 304 M290 398 L382 326 M280 348 L362 256 M296 314 L372 228"
                stroke="#141413"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeDasharray="14 5 8 4"
              />
            </g>

            {/* ===============================================================
                7. ROOSTER HEAD (#chicken-head)
                Nested inside #chicken-neck at cranial pivot (274, 418).
                Features tall serrated comb, fierce brow, focused eye,
                pendulous stippled wattles, and sharp curved beak.
            =============================================================== */}
            <g id="chicken-head">
              {/* Seamless Cranial Pivot Base */}
              <circle cx="274" cy="418" r="32" fill="#FAF8F5" />

              {/* PENDULOUS WATTLES & EAR LOBE (Richly stippled double wattle under chin) */}
              <g id="chicken-wattles">
                {/* Back wattle */}
                <path
                  d="M262 464 C256 484 264 504 280 506 C292 506 298 492 294 474 Z"
                  fill="#141413"
                  stroke="#141413"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                {/* Main foreground wattle */}
                <path
                  d="M272 458 C268 482 278 510 298 512 C314 512 322 492 312 468 C304 452 284 448 272 458 Z"
                  fill="#FAF8F5"
                  stroke="#141413"
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M274 460 C270 482 280 508 298 510 C312 510 318 492 310 470 Z"
                  fill="url(#halftone-dense)"
                />
                {/* Vertical engraving shading lines on wattle */}
                <path
                  d="M282 468 C280 482 284 496 292 504 M290 466 C290 482 294 496 302 504 M298 466 C300 480 304 494 310 500"
                  stroke="#141413"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Cheek Ear Lobe (Textured almond patch behind eye) */}
                <path
                  d="M294 408 C304 404 314 414 312 428 C310 442 298 450 290 444 C284 438 286 414 294 408 Z"
                  fill="#FAF8F5"
                  stroke="#141413"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M294 408 C304 404 314 414 312 428 C310 442 298 450 290 444 Z"
                  fill="url(#halftone-mid)"
                />
              </g>

              {/* ROOSTER SERRATED COMB (#chicken-comb)
                  7 sharp, dramatic saw-tooth spikes curving over the skull */}
              <g id="chicken-comb">
                <path
                  d="M244 460 L218 454 L232 444 L212 428 L230 422 L212 396 L234 398 L222 362 L246 376 L244 332 L266 358 L274 318 L290 354 L298 338 L298 378 C280 404 260 434 244 460 Z"
                  fill="#141413"
                  stroke="#141413"
                  strokeWidth="2.6"
                  strokeLinejoin="round"
                />
                {/* Fine white engraved highlight striations inside comb spikes */}
                <path
                  d="M274 330 L278 368 M250 344 L260 382 M230 372 L246 398 M220 402 L238 416 M220 430 L236 436 M224 452 L238 452"
                  stroke="#FAF8F5"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Stippled base of comb */}
                <path
                  d="M246 448 C256 422 272 394 292 372 L284 364 C264 388 248 416 238 444 Z"
                  fill="#FAF8F5"
                  opacity="0.35"
                />
              </g>

              {/* UPPER BEAK (#chicken-beak-upper) — Sharp, hooked predator-like rooster beak */}
              <g id="chicken-beak-upper">
                <path
                  d="M248 454 C236 472 234 494 242 514 C250 496 260 480 272 466 Z"
                  fill="#FAF8F5"
                  stroke="#141413"
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                {/* Upper culmen ridge & nostril slit */}
                <path
                  d="M246 464 C240 478 239 494 242 508 M252 466 L248 476"
                  stroke="#141413"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>

              {/* LOWER BEAK (#chicken-beak-lower) — Tapered mandible */}
              <g id="chicken-beak-lower">
                <path
                  d="M258 466 C250 480 248 494 250 506 C258 494 266 480 274 468 Z"
                  fill="#FAF8F5"
                  stroke="#141413"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              </g>

              {/* CRANIAL FACE & FIERCE BROW RIDGE */}
              <path
                d="M246 454 C254 424 272 392 296 372 C304 386 302 414 292 438 C282 456 264 462 246 454 Z"
                fill="#FAF8F5"
                stroke="#141413"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <path
                d="M250 450 C258 424 274 398 294 380 C298 396 296 418 288 438 C278 452 264 456 250 450 Z"
                fill="url(#halftone-light)"
              />

              {/* CHICKEN EYE (#chicken-eye) — Focused, sharp rooster eye with angled brow */}
              <g id="chicken-eye">
                {/* Outer Orbital Ring */}
                <circle
                  cx="272"
                  cy="436"
                  r="8.2"
                  fill="#FAF8F5"
                  stroke="#141413"
                  strokeWidth="2.5"
                />
                {/* Dark Focused Iris/Pupil */}
                <circle cx="272" cy="436" r="4.5" fill="#141413" />
                {/* Sharp Specular Eye Glint */}
                <circle cx="270.2" cy="434.2" r="1.5" fill="#FAF8F5" />
                {/* Fierce Angled Supraorbital Brow Ridge */}
                <path
                  d="M260 434 C264 426 274 424 282 429"
                  stroke="#141413"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                {/* Lower eyelid engraving crease */}
                <path
                  d="M263 443 C268 447 276 447 281 442"
                  stroke="#141413"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default ChickenMascot;
