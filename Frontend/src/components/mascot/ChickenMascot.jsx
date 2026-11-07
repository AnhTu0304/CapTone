import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { createMascotTimeline, checkReducedMotion } from './mascotAnimation';
import './ChickenMascot.css';

gsap.registerPlugin(useGSAP);

/**
 * ChickenMascot
 *
 * Premium Black & White Halftone / Vintage Woodcut Engraving SVG Mascot
 * of a chicken pecking grains in a three-quarter editorial pose.
 *
 * Exposes all required independently controllable SVG groups:
 * - #chicken-body
 * - #chicken-neck
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
        viewBox="0 0 680 560"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="chicken-mascot-title chicken-mascot-desc"
      >
        <title id="chicken-mascot-title">
          Minh họa gà Halftone cổ điển đang mổ thóc
        </title>
        <desc id="chicken-mascot-desc">
          Linh vật chú gà phong cách khắc báo cổ điển đen trắng kết hợp họa tiết chấm
          bi Halftone đang cúi mổ từng hạt thóc theo vòng lặp tự nhiên.
        </desc>

        <defs>
          {/* 1. Dense Halftone Stipple Pattern (Dark midtones) */}
          <pattern
            id="halftone-dense"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(32)"
          >
            <circle cx="2" cy="2" r="1.8" fill="#18181B" />
            <circle cx="5" cy="5" r="1.2" fill="#18181B" />
          </pattern>

          {/* 2. Medium Halftone Stipple Pattern (Editorial newspaper shading) */}
          <pattern
            id="halftone-mid"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(32)"
          >
            <circle cx="2.5" cy="2.5" r="1.35" fill="#18181B" />
            <circle cx="6" cy="6" r="0.8" fill="#27272A" />
          </pattern>

          {/* 3. Light Halftone Stipple Pattern (Highlight transition) */}
          <pattern
            id="halftone-light"
            width="8.5"
            height="8.5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(32)"
          >
            <circle cx="3" cy="3" r="1.05" fill="#27272A" />
            <circle cx="7" cy="7" r="0.55" fill="#3F3F46" />
          </pattern>

          {/* 4. Vintage Woodcut Engraving Hatch Pattern */}
          <pattern
            id="engraving-hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-24)"
          >
            <line
              x1="0"
              y1="2"
              x2="8"
              y2="2"
              stroke="#18181B"
              strokeWidth="1.35"
            />
            <line
              x1="0"
              y1="6"
              x2="8"
              y2="6"
              stroke="#18181B"
              strokeWidth="0.95"
              strokeDasharray="5 2"
            />
          </pattern>

          {/* Clipping paths for layered halftone zones */}
          <clipPath id="clip-chicken-torso">
            <path d="M138 256 C182 178 256 128 348 128 C398 128 446 146 492 178 C544 214 584 268 576 332 C568 394 504 438 426 442 C354 446 286 418 228 380 C176 346 132 302 138 256 Z" />
          </clipPath>

          <clipPath id="clip-chicken-wing">
            <path d="M254 168 C332 146 436 174 504 238 C532 264 544 304 522 336 C496 372 432 378 368 358 C306 338 248 294 234 238 C226 206 234 178 254 168 Z" />
          </clipPath>
        </defs>

        {/* =====================================================================
            GROUND ENGRAVING & SCATTERED GRAINS (#grain-01 .. #grain-04)
        ===================================================================== */}
        <g id="ground-shadow" aria-hidden="true">
          <ellipse
            cx="306"
            cy="508"
            rx="232"
            ry="28"
            fill="url(#halftone-light)"
            opacity="0.55"
          />
          {/* Horizontal vintage newspaper engraving lines */}
          <path
            d="M84 492 H504 M102 499 H520 M72 506 H532 M90 513 H514 M114 520 H492 M138 527 H464 M172 534 H422 M212 541 H372"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M122 495.5 H458 M86 502.5 H488 M108 509.5 H502 M130 516.5 H476 M154 523.5 H446 M190 530.5 H398"
            stroke="#18181B"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="18 6 8 5 28 7"
          />
          {/* Stipple soil dots */}
          <circle cx="76" cy="497" r="2.2" fill="#18181B" />
          <circle cx="64" cy="507" r="1.7" fill="#18181B" />
          <circle cx="96" cy="524" r="2.1" fill="#18181B" />
          <circle cx="128" cy="532" r="1.8" fill="#18181B" />
          <circle cx="526" cy="496" r="1.9" fill="#18181B" />
          <circle cx="540" cy="507" r="2.1" fill="#18181B" />
          <circle cx="508" cy="522" r="1.7" fill="#18181B" />
        </g>

        {/* GRAIN 01 — Primary target grain right beneath the pecking beak */}
        <g id="grain-01">
          <ellipse
            cx="84"
            cy="478"
            rx="9"
            ry="4.8"
            transform="rotate(-18 84 478)"
            fill="#F4F1EA"
            stroke="#18181B"
            strokeWidth="2.5"
          />
          <ellipse
            cx="84"
            cy="478"
            rx="7"
            ry="3.2"
            transform="rotate(-18 84 478)"
            fill="url(#halftone-mid)"
            opacity="0.65"
          />
          <path
            d="M78 480 L90 476"
            stroke="#18181B"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>

        {/* GRAIN 02 — Secondary grain adjacent to target */}
        <g id="grain-02">
          <ellipse
            cx="106"
            cy="486"
            rx="8.2"
            ry="4.4"
            transform="rotate(14 106 486)"
            fill="#F4F1EA"
            stroke="#18181B"
            strokeWidth="2.4"
          />
          <ellipse
            cx="106"
            cy="486"
            rx="6.4"
            ry="2.8"
            transform="rotate(14 106 486)"
            fill="url(#halftone-mid)"
            opacity="0.6"
          />
          <path
            d="M101 484.5 L111 487.5"
            stroke="#18181B"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </g>

        {/* GRAIN 03 — Foreground left grain */}
        <g id="grain-03">
          <ellipse
            cx="66"
            cy="488"
            rx="7.5"
            ry="4"
            transform="rotate(-26 66 488)"
            fill="#F4F1EA"
            stroke="#18181B"
            strokeWidth="2.3"
          />
          <path
            d="M61.5 490 L70.5 486"
            stroke="#18181B"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>

        {/* GRAIN 04 — Mid-ground right grain */}
        <g id="grain-04">
          <ellipse
            cx="126"
            cy="481"
            rx="7.2"
            ry="3.8"
            transform="rotate(9 126 481)"
            fill="#F4F1EA"
            stroke="#18181B"
            strokeWidth="2.2"
          />
          <path
            d="M121.5 480.5 L130.5 481.5"
            stroke="#18181B"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>

        {/* =====================================================================
            CHICKEN LEGS (#chicken-legs)
            Raised foreground claw + planted weight-bearing leg with woodcut scales
        ===================================================================== */}
        <g id="chicken-legs">
          {/* Raised Left Leg (stepping/poised claw matching character reference) */}
          <path
            d="M276 376 C248 378 214 404 196 446 C191 458 188 474 191 486 C198 474 206 456 218 442 C220 456 220 472 226 484 C232 470 235 452 241 436 C250 448 264 456 280 456 C268 446 258 432 256 416 C272 402 292 394 316 396 Z"
            fill="#F4F1EA"
            stroke="#18181B"
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          {/* Engraved scale ridges on raised leg */}
          <path
            d="M254 392 L264 404 M238 402 L250 414 M224 415 L237 426 M212 430 L225 439 M202 446 L214 453 M225 448 L236 454 M254 432 L264 442"
            stroke="#18181B"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Planted Right Leg (bearing body weight on ground) */}
          <path
            d="M362 396 L334 456 L264 462 C276 472 302 474 324 472 L248 504 C272 504 306 494 332 482 L298 532 C318 520 338 498 352 480 L398 486 C384 476 368 470 356 466 L388 402 Z"
            fill="#F4F1EA"
            stroke="#18181B"
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          {/* Engraved scale ridges on planted leg */}
          <path
            d="M360 414 L376 420 M353 428 L370 434 M346 442 L363 448 M338 456 L356 462 M296 482 L308 490 M316 474 L328 482 M318 500 L330 508"
            stroke="#18181B"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>

        {/* =====================================================================
            CHICKEN TAIL (#chicken-tail)
            Fanned upright vintage engraved tail feathers
        ===================================================================== */}
        <g id="chicken-tail">
          {/* Outer dark silhouette of fanned tail */}
          <path
            d="M404 156 C444 108 492 50 534 18 C558 4 578 16 572 44 C598 34 616 52 602 80 C628 74 644 96 626 124 C654 126 664 150 644 176 C666 186 666 214 642 234 C658 250 652 278 626 292 C636 312 622 338 594 344 L448 310 Z"
            fill="#18181B"
            stroke="#18181B"
            strokeWidth="4"
            strokeLinejoin="round"
          />

          {/* Halftone & cream feather vanes inside tail */}
          <path
            d="M432 156 C468 112 508 62 546 32 C556 24 564 30 558 44 C530 82 492 132 452 174 Z"
            fill="#F4F1EA"
          />
          <path
            d="M456 176 C496 134 544 86 586 58 C596 52 602 60 592 74 C556 112 512 154 470 192 Z"
            fill="url(#halftone-light)"
          />
          <path
            d="M474 198 C520 162 572 122 612 98 C622 94 626 104 614 116 C578 148 532 182 486 214 Z"
            fill="#F4F1EA"
          />
          <path
            d="M490 224 C538 198 590 168 632 150 C642 146 644 158 632 168 C592 194 544 218 498 240 Z"
            fill="url(#halftone-mid)"
          />

          {/* Tiered scalloped covert feathers at base of tail */}
          <path
            d="M424 166 C452 152 482 158 492 178 C468 186 442 184 424 166 Z M448 192 C478 178 510 184 520 206 C494 214 466 210 448 192 Z M468 222 C500 210 532 218 540 240 C512 248 484 242 468 222 Z M482 256 C514 246 546 254 552 276 C524 284 496 276 482 256 Z"
            fill="#F4F1EA"
          />

          {/* Fine woodcut quill lines */}
          <path
            d="M548 28 L468 142 M588 54 L490 168 M614 94 L506 196 M634 146 L520 224 M636 198 L534 254 M622 254 L540 284"
            stroke="#F4F1EA"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>

        {/* =====================================================================
            CHICKEN BODY (#chicken-body)
            Includes torso, fluffy undercarriage, wing (#chicken-wing),
            and articulated neck/head hierarchy (#chicken-neck -> #chicken-head)
        ===================================================================== */}
        <g id="chicken-body">
          {/* Main Torso Silhouette */}
          <path
            d="M138 256 C182 178 256 128 348 128 C398 128 446 146 492 178 C544 214 584 268 576 332 C568 394 504 438 426 442 C354 446 286 418 228 380 C176 346 132 302 138 256 Z"
            fill="#18181B"
            stroke="#18181B"
            strokeWidth="4.2"
            strokeLinejoin="round"
          />

          {/* Halftone & Stipple Zones Clipped to Torso */}
          <g clipPath="url(#clip-chicken-torso)">
            {/* Upper back cream highlight zone with halftone gradient */}
            <path
              d="M204 162 C268 122 362 120 438 158 C414 204 352 228 284 222 C236 218 202 194 204 162 Z"
              fill="#F4F1EA"
            />
            <path
              d="M214 168 C276 132 366 132 436 168 C412 214 348 242 278 234 C232 228 206 200 214 168 Z"
              fill="url(#halftone-mid)"
            />

            {/* Mid-body newspaper stipple belt */}
            <path
              d="M176 268 C248 244 378 254 494 316 C472 374 392 406 308 394 C236 382 182 332 176 268 Z"
              fill="#F4F1EA"
              opacity="0.92"
            />
            <path
              d="M176 268 C248 244 378 254 494 316 C472 374 392 406 308 394 C236 382 182 332 176 268 Z"
              fill="url(#halftone-dense)"
            />
          </g>

          {/* Woodcut Undercarriage & Breast Feather Strokes */}
          <path
            d="M188 322 C214 338 244 354 276 364 M204 342 C234 360 268 374 302 382 M234 366 C268 384 306 396 344 402 M278 390 C316 406 358 416 398 418 M334 410 C376 422 422 426 462 420 M396 416 C438 422 482 414 516 396 M452 402 C492 402 528 386 552 362"
            stroke="#F4F1EA"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeDasharray="16 6 10 5 22 7"
          />

          {/* jagged fluffythigh & belly edge spikes */}
          <path
            d="M254 392 L246 406 L266 398 L262 414 L282 404 L280 420 L300 410 L302 426 L322 416 L326 432 L346 420 L352 436 L372 424 L382 440 L402 428 L414 442 L432 428 L446 440 L464 424 L480 434 L496 416 L514 424 L526 404 L544 408 L552 386"
            fill="#18181B"
            stroke="#18181B"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* =================================================================
              CHICKEN WING (#chicken-wing)
              Layered scalloped covert feathers + primary flight feathers
          ================================================================= */}
          <g id="chicken-wing">
            {/* Wing Base Silhouette */}
            <path
              d="M248 168 C328 144 436 172 506 238 C534 264 546 306 522 338 C496 374 430 380 364 358 C302 338 244 292 230 236 C222 204 230 178 248 168 Z"
              fill="#18181B"
              stroke="#18181B"
              strokeWidth="3.8"
              strokeLinejoin="round"
            />

            {/* Cream & Halftone Scalloped Shoulder Coverts (3-quarter view highlight) */}
            <g clipPath="url(#clip-chicken-wing)">
              <path
                d="M236 174 C308 152 388 172 426 218 C394 268 322 288 258 264 C228 246 220 202 236 174 Z"
                fill="#F4F1EA"
              />
              <path
                d="M256 184 C322 166 394 186 426 226 C396 272 326 290 266 266 C240 248 238 208 256 184 Z"
                fill="url(#halftone-light)"
              />
              <path
                d="M312 204 C372 196 436 224 468 268 C436 312 368 322 308 296 Z"
                fill="url(#halftone-mid)"
              />
            </g>

            {/* Scalloped Feather Rows (Woodcut Engraving Lines) */}
            <path
              d="M262 198 C284 202 298 220 288 238 C274 252 252 248 242 234 M296 188 C320 194 334 214 322 234 C306 248 282 244 272 228 M332 184 C358 192 370 214 358 234 C342 248 318 242 308 224 M368 188 C394 198 406 222 392 242 C376 254 352 248 342 230"
              stroke="#18181B"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />

            <path
              d="M282 246 C306 252 318 272 304 290 C288 302 266 296 256 278 M320 244 C346 252 358 274 342 292 C326 304 302 296 294 278 M358 246 C384 256 396 278 380 296 C362 308 338 300 330 280 M396 252 C422 262 432 286 416 304 C398 314 374 306 366 286"
              stroke="#18181B"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Primary Flight Feathers (Long parallel woodcut striations on lower-back wing) */}
            <path
              d="M362 314 C412 326 466 332 512 326 M378 298 C428 312 480 318 524 310 M394 282 C442 296 492 302 532 292 M410 266 C456 280 500 284 534 274 M424 250 C466 264 504 268 530 256 M436 234 C472 246 502 250 522 240"
              stroke="#F4F1EA"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Outer wing contour highlight */}
            <path
              d="M244 252 C276 312 352 356 444 364"
              stroke="#F4F1EA"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray="24 6 12 6"
            />
          </g>

          {/* =================================================================
              CHICKEN NECK (#chicken-neck)
              Articulated with circular overlap at (218, 265) so head & neck
              never visually separate during rotation!
          ================================================================= */}
          <g id="chicken-neck">
            {/* Circular overlap joint base inside torso */}
            <circle cx="218" cy="265" r="76" fill="#18181B" />

            {/* Sweeping Hackle (Neck) Silhouette */}
            <path
              d="M236 164 C178 190 124 242 92 314 C84 332 92 354 114 362 C154 374 212 362 258 328 C292 284 288 202 236 164 Z"
              fill="#18181B"
              stroke="#18181B"
              strokeWidth="3.8"
              strokeLinejoin="round"
            />

            {/* Cream & Halftone Hackle Feather Cascade */}
            <path
              d="M226 178 C178 204 134 248 106 308 C138 332 192 332 238 302 C262 262 258 206 226 178 Z"
              fill="#F4F1EA"
            />
            <path
              d="M226 178 C178 204 134 248 106 308 C138 332 192 332 238 302 C262 262 258 206 226 178 Z"
              fill="url(#halftone-mid)"
            />

            {/* Engraved Hackle Feather Streaks flowing from head to shoulder */}
            <path
              d="M112 302 C142 262 182 222 228 194 M118 314 C152 278 194 242 242 214 M126 326 C164 296 208 264 252 238 M138 336 C178 312 220 286 258 264 M152 346 C192 328 230 308 262 288"
              stroke="#18181B"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M106 294 C138 250 180 210 226 182 M122 320 C160 286 204 252 248 226 M144 342 C184 320 224 296 260 276"
              stroke="#F4F1EA"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            {/* ===============================================================
                CHICKEN HEAD (#chicken-head)
                Nested inside #chicken-neck with joint pivot at (132, 342)
            =============================================================== */}
            <g id="chicken-head">
              {/* Seamless cranial joint circle */}
              <circle cx="122" cy="342" r="36" fill="#18181B" />

              {/* CHICKEN COMB (#chicken-comb) — Classic serrated woodcut crest */}
              <g id="chicken-comb">
                <path
                  d="M78 358 C56 346 46 322 64 308 C48 292 58 268 80 274 C72 252 90 236 108 252 C110 234 132 232 138 254 C146 244 162 252 156 270 C142 304 110 342 78 358 Z"
                  fill="#18181B"
                  stroke="#18181B"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                {/* Engraved highlight ridges inside comb lobes */}
                <path
                  d="M64 334 C72 336 82 334 90 328 M68 302 C78 306 88 306 98 302 M84 272 C92 278 100 282 108 282 M108 256 C114 264 118 272 120 280 M132 256 C134 264 134 274 132 282"
                  stroke="#F4F1EA"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </g>

              {/* UPPER BEAK (#chicken-beak-upper) */}
              <g id="chicken-beak-upper">
                <path
                  d="M82 362 C62 380 54 410 66 438 C76 420 92 402 108 388 Z"
                  fill="#F4F1EA"
                  stroke="#18181B"
                  strokeWidth="3.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M74 378 C66 394 64 412 68 428"
                  stroke="#18181B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </g>

              {/* LOWER BEAK (#chicken-beak-lower) */}
              <g id="chicken-beak-lower">
                <path
                  d="M94 380 C84 398 84 418 96 432 C106 416 114 400 120 384 Z"
                  fill="#F4F1EA"
                  stroke="#18181B"
                  strokeWidth="3.6"
                  strokeLinejoin="round"
                />
              </g>

              {/* Wattles & Ear Lobe (Classic woodcut detail below beak/cheek) */}
              <path
                d="M112 376 C106 398 114 422 132 424 C146 424 154 404 146 384 C162 390 174 378 170 362 C166 346 146 342 132 352 Z"
                fill="#18181B"
                stroke="#18181B"
                strokeWidth="3.2"
                strokeLinejoin="round"
              />
              {/* Wattle engraving lines */}
              <path
                d="M122 392 C122 402 126 410 134 412 M130 388 C132 396 136 402 140 404 M144 362 C152 364 158 368 160 374"
                stroke="#F4F1EA"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Cranial & Cheek Halftone Patch */}
              <path
                d="M84 348 C86 324 108 310 132 316 C148 320 156 338 146 356 C134 372 106 376 90 364 Z"
                fill="#F4F1EA"
                stroke="#18181B"
                strokeWidth="3"
              />
              <path
                d="M88 348 C90 328 110 316 130 320 C144 324 150 338 142 354 C132 366 108 370 94 360 Z"
                fill="url(#halftone-light)"
              />
              {/* Cheek & Brow Woodcut Contour Lines */}
              <path
                d="M92 332 C102 322 118 320 132 326 M118 346 C126 350 134 348 140 342 M96 364 C108 368 122 366 132 358"
                stroke="#18181B"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />

              {/* CHICKEN EYE (#chicken-eye) */}
              <g id="chicken-eye">
                <circle
                  cx="104"
                  cy="346"
                  r="9.5"
                  fill="#18181B"
                  stroke="#F4F1EA"
                  strokeWidth="2.2"
                />
                <circle cx="101.5" cy="343.5" r="3.2" fill="#F4F1EA" />
                <circle cx="107" cy="348.5" r="1.3" fill="#F4F1EA" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default ChickenMascot;
