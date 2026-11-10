import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { createMascotTimeline } from './mascotAnimation';
import { ROOSTER_SVG_PATHS } from './roosterSvgData';
import './ChickenMascot.css';

gsap.registerPlugin(useGSAP);

export const ChickenMascot = ({ className = '', reducedMotion = false }) => {
  const containerRef = useRef(null);

  useGSAP(
    () => {
      if (!containerRef.current) return undefined;
      const timeline = createMascotTimeline(containerRef.current, {
        reducedMotion: Boolean(reducedMotion),
      });
      return () => {
        if (timeline) timeline.kill();
      };
    },
    { scope: containerRef, dependencies: [reducedMotion] }
  );

  return (
    <div
      ref={containerRef}
      className={`chicken-mascot-stage ${className}`.trim()}
      data-testid="chicken-mascot-stage"
    >
      <svg
        className="chicken-mascot-svg"
        viewBox="30 40 945 935"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Fine-line vector rooster mascot pecking glowing emerald rice grains"
      >
        <defs>
          <filter id="emerald-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="ground-shadow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#11151C" stopOpacity="0.14" />
            <stop offset="65%" stopColor="#11151C" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#11151C" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle editorial ground shadow beneath talons and grains */}
        <ellipse cx="385" cy="918" rx="330" ry="34" fill="url(#ground-shadow-grad)" />

        {/* Glowing Emerald Rice Grains (#grain-01 .. #grain-04) */}
        <g id="rooster-grains-group">
          <g id="grain-01" className="mascot-anim-part">
            <path
              fill="#28E99F"
              fillOpacity="0.34"
              filter="url(#emerald-glow)"
              fillRule="evenodd"
              d={ROOSTER_SVG_PATHS.grain01.dark}
            />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.grain01.dark} />
            <path fill="#28E99F" fillRule="evenodd" d={ROOSTER_SVG_PATHS.grain01.emerald} />
          </g>

          <g id="grain-02" className="mascot-anim-part">
            <path
              fill="#28E99F"
              fillOpacity="0.32"
              filter="url(#emerald-glow)"
              fillRule="evenodd"
              d={ROOSTER_SVG_PATHS.grain02.dark}
            />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.grain02.dark} />
            <path fill="#28E99F" fillRule="evenodd" d={ROOSTER_SVG_PATHS.grain02.emerald} />
          </g>

          <g id="grain-03" className="mascot-anim-part">
            <path
              fill="#28E99F"
              fillOpacity="0.32"
              filter="url(#emerald-glow)"
              fillRule="evenodd"
              d={ROOSTER_SVG_PATHS.grain03.dark}
            />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.grain03.dark} />
            <path fill="#28E99F" fillRule="evenodd" d={ROOSTER_SVG_PATHS.grain03.emerald} />
          </g>

          <g id="grain-04" className="mascot-anim-part">
            <path
              fill="#28E99F"
              fillOpacity="0.32"
              filter="url(#emerald-glow)"
              fillRule="evenodd"
              d={ROOSTER_SVG_PATHS.grain04.dark}
            />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.grain04.dark} />
            <path fill="#28E99F" fillRule="evenodd" d={ROOSTER_SVG_PATHS.grain04.emerald} />
          </g>
        </g>

        {/* Rooster Anatomical Hierarchy */}
        <g id="rooster-character-rig">
          {/* Stationary Grounded Legs (#chicken-legs) */}
          <g id="chicken-legs" className="mascot-anim-part">
            <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.legs.white} />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.legs.dark} />
          </g>

          {/* Sweeping Sickle Tail Plumes (#chicken-tail) */}
          <g id="chicken-tail" className="mascot-anim-part">
            <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.tail.white} />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.tail.dark} />
          </g>

          {/* Torso, Breast & Saddle (#chicken-body) */}
          <g id="chicken-body" className="mascot-anim-part">
            <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.body.white} />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.body.dark} />
          </g>

          {/* Layered Wing (#chicken-wing) */}
          <g id="chicken-wing" className="mascot-anim-part">
            <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.wing.white} />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.wing.dark} />
          </g>

          {/* Articulated Hackle Neck (#chicken-neck) + Distal Head Assembly */}
          <g id="chicken-neck" className="mascot-anim-part">
            <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.neck.white} />
            <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.neck.dark} />

            {/* Articulated Head (#chicken-head) */}
            <g id="chicken-head" className="mascot-anim-part">
              {/* Serrated Rooster Comb (#chicken-comb) */}
              <g id="chicken-comb" className="mascot-anim-part">
                <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.comb.white} />
                <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.comb.dark} />
              </g>

              {/* Lower Mandible (#chicken-beak-lower) */}
              <g id="chicken-beak-lower" className="mascot-anim-part">
                <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.beakLower.white} />
                <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.beakLower.dark} />
              </g>

              {/* Upper Hooked Beak (#chicken-beak-upper) */}
              <g id="chicken-beak-upper" className="mascot-anim-part">
                <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.beakUpper.white} />
                <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.beakUpper.dark} />
              </g>

              {/* Cranial Base, Brow, Ear-Lobe & Wattle */}
              <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.head.white} />
              <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.head.dark} />

              {/* Focused Emerald Eye (#chicken-eye) */}
              <g id="chicken-eye" className="mascot-anim-part">
                <path fill="#11151C" fillRule="evenodd" d={ROOSTER_SVG_PATHS.eye.dark} />
                <path
                  fill="#28E99F"
                  fillRule="evenodd"
                  filter="url(#emerald-glow)"
                  d={ROOSTER_SVG_PATHS.eye.emerald}
                />
                <path fill="#FFFFFF" fillRule="evenodd" d={ROOSTER_SVG_PATHS.eye.glint} />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default ChickenMascot;
