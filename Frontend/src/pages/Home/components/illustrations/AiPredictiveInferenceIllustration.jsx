import React from 'react';

/**
 * AiPredictiveInferenceIllustration
 * High-fidelity animated SVG representing Step 2 of HowItWorks:
 * AI Predictive Degradation Model receiving and ingesting multi-directional
 * telemetry, event logs, and metric packets into a central Gyroscope Neural Core.
 * Hardware-accelerated 60FPS GPU keyframes, matching Cybernetic CAD Blueprint architecture.
 */
export const AiPredictiveInferenceIllustration = ({ className = '' }) => {
  return (
    <svg
      className={`ai-predictive-inference-svg ${className}`.trim()}
      viewBox="0 0 420 270"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Mô hình AI dự báo suy thoái với các luồng dữ liệu K8s hội tụ vào đầu não trung tâm"
    >
      <defs>
        {/* Core Radial Glow Gradients */}
        <radialGradient id="apii-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#28E99F" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#38BDF8" stopOpacity="0.5" />
          <stop offset="85%" stopColor="#3B67F6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3B67F6" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="apii-beacon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>

        {/* Soft Glow Blur Filter for Photons & Beacons */}
        <filter id="apii-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>

        {/* Embedded CSS Keyframes for High Performance 60FPS GPU Rendering */}
        <style>{`
          .apii-orbit-vert {
            transform-origin: 210px 135px;
            animation: apii-spin-vert 11s linear infinite;
          }
          .apii-orbit-horiz {
            transform-origin: 210px 135px;
            animation: apii-spin-horiz 8s linear infinite;
          }
          .apii-core-pulse {
            transform-origin: 210px 135px;
            animation: apii-breathe 2.8s ease-in-out infinite;
          }
          .apii-port-pulse {
            animation: apii-blink 1.8s ease-in-out infinite alternate;
          }
          .apii-beacon-glow-anim {
            transform-origin: center;
            animation: apii-beacon-shine 2s ease-in-out infinite alternate;
          }
          .apii-stream-dash-left {
            stroke-dasharray: 6 14;
            animation: apii-dash-left 1.2s linear infinite;
          }
          .apii-stream-dash-right {
            stroke-dasharray: 6 14;
            animation: apii-dash-right 1.2s linear infinite;
          }
          .apii-radar-spin {
            transform-origin: 210px 135px;
            animation: apii-radar-slow 45s linear infinite;
          }

          @keyframes apii-spin-vert {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes apii-spin-horiz {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes apii-breathe {
            0%, 100% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.12); opacity: 1; }
          }
          @keyframes apii-blink {
            0% { filter: brightness(1); }
            100% { filter: brightness(1.4) drop-shadow(0 0 4px #FF8BA7); }
          }
          @keyframes apii-beacon-shine {
            0% { opacity: 0.65; transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1.25); }
          }
          @keyframes apii-dash-left {
            from { stroke-dashoffset: 40; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes apii-dash-right {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: 40; }
          }
          @keyframes apii-radar-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </defs>

      {/* ================= 1. CAD BACKGROUND CROSSHAIRS & RADAR ================= */}
      <g stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" strokeDasharray="3 3">
        <line x1="15" y1="135" x2="405" y2="135" />
        <line x1="210" y1="15" x2="210" y2="255" />
      </g>

      {/* Subtle Concentric Alignment Circles */}
      <circle cx="210" cy="135" r="65" stroke="rgba(40, 233, 159, 0.12)" strokeWidth="1" strokeDasharray="4 4" fill="none" />
      <g className="apii-radar-spin">
        <circle cx="210" cy="135" r="110" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="5 7" fill="none" />
        <circle cx="210" cy="135" r="155" stroke="rgba(59, 130, 246, 0.06)" strokeWidth="1" strokeDasharray="6 8" fill="none" />
      </g>

      {/* ================= 2. CONVERGING INGRESS STREAM PATHS ================= */}
      {/* Static Sub-Guide Lines (Left to Center) */}
      <g stroke="#9CE8C9" strokeWidth="1" fill="none" opacity="0.25">
        <path d="M 20 48 L 165 112" />
        <path d="M 10 135 L 165 135" />
        <path d="M 20 222 L 165 158" />
      </g>

      {/* Animated Dash Highways for Left Flow */}
      <g stroke="#28E99F" strokeWidth="1.4" fill="none" opacity="0.6" className="apii-stream-dash-left">
        <path d="M 20 48 L 165 112" />
        <path d="M 10 135 L 165 135" />
        <path d="M 20 222 L 165 158" />
      </g>

      {/* Static Sub-Guide Lines (Right to Center) */}
      <g stroke="#9CE8C9" strokeWidth="1" fill="none" opacity="0.25">
        <path d="M 400 48 L 255 112" />
        <path d="M 410 135 L 255 135" />
        <path d="M 400 222 L 255 158" />
      </g>

      {/* Animated Dash Highways for Right Flow */}
      <g stroke="#28E99F" strokeWidth="1.4" fill="none" opacity="0.6" className="apii-stream-dash-right">
        <path d="M 400 48 L 255 112" />
        <path d="M 410 135 L 255 135" />
        <path d="M 400 222 L 255 158" />
      </g>

      {/* ================= 3. CONTINUOUS DATA PACKETS STREAMING TO CORE ================= */}
      {/* --- Flow Along Left Streams --- */}
      {/* Top-Left Stream */}
      <circle r="3.5" fill="#FF8BA7">
        <animateMotion dur="2.4s" repeatCount="indefinite" path="M 20 48 L 165 112" />
      </circle>
      <circle r="3" fill="#ECFFA3">
        <animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path="M 20 48 L 165 112" />
      </circle>
      <circle r="2.8" fill="#28E99F">
        <animateMotion dur="2.4s" begin="1.6s" repeatCount="indefinite" path="M 20 48 L 165 112" />
      </circle>

      {/* Mid-Left Stream */}
      <circle r="3.2" fill="#28E99F">
        <animateMotion dur="1.9s" repeatCount="indefinite" path="M 10 135 L 165 135" />
      </circle>
      <circle r="3.5" fill="#FFFFFF" filter="url(#apii-blur)">
        <animateMotion dur="1.9s" begin="0.6s" repeatCount="indefinite" path="M 10 135 L 165 135" />
      </circle>
      <circle r="2" fill="#FFFFFF">
        <animateMotion dur="1.9s" begin="0.6s" repeatCount="indefinite" path="M 10 135 L 165 135" />
      </circle>
      <circle r="3" fill="#FF8BA7">
        <animateMotion dur="1.9s" begin="1.3s" repeatCount="indefinite" path="M 10 135 L 165 135" />
      </circle>

      {/* Bottom-Left Stream */}
      <circle r="3.2" fill="#28E99F">
        <animateMotion dur="2.5s" repeatCount="indefinite" path="M 20 222 L 165 158" />
      </circle>
      <circle r="3" fill="#FF8BA7">
        <animateMotion dur="2.5s" begin="0.85s" repeatCount="indefinite" path="M 20 222 L 165 158" />
      </circle>
      <circle r="3.2" fill="#ECFFA3">
        <animateMotion dur="2.5s" begin="1.7s" repeatCount="indefinite" path="M 20 222 L 165 158" />
      </circle>

      {/* --- Flow Along Right Streams --- */}
      {/* Top-Right Stream */}
      <circle r="3.5" fill="#ECFFA3">
        <animateMotion dur="2.4s" repeatCount="indefinite" path="M 400 48 L 255 112" />
      </circle>
      <circle r="3" fill="#FF8BA7">
        <animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path="M 400 48 L 255 112" />
      </circle>
      <circle r="2.8" fill="#28E99F">
        <animateMotion dur="2.4s" begin="1.6s" repeatCount="indefinite" path="M 400 48 L 255 112" />
      </circle>

      {/* Mid-Right Stream */}
      <circle r="3.5" fill="#FFFFFF" filter="url(#apii-blur)">
        <animateMotion dur="1.8s" repeatCount="indefinite" path="M 410 135 L 255 135" />
      </circle>
      <circle r="2" fill="#FFFFFF">
        <animateMotion dur="1.8s" repeatCount="indefinite" path="M 410 135 L 255 135" />
      </circle>
      <circle r="3.2" fill="#28E99F">
        <animateMotion dur="1.8s" begin="0.6s" repeatCount="indefinite" path="M 410 135 L 255 135" />
      </circle>
      <circle r="3" fill="#ECFFA3">
        <animateMotion dur="1.8s" begin="1.2s" repeatCount="indefinite" path="M 410 135 L 255 135" />
      </circle>

      {/* Bottom-Right Stream */}
      <circle r="3.5" fill="#ECFFA3">
        <animateMotion dur="2.5s" repeatCount="indefinite" path="M 400 222 L 255 158" />
      </circle>
      <circle r="3" fill="#28E99F">
        <animateMotion dur="2.5s" begin="0.85s" repeatCount="indefinite" path="M 400 222 L 255 158" />
      </circle>
      <circle r="3.2" fill="#FF8BA7">
        <animateMotion dur="2.5s" begin="1.7s" repeatCount="indefinite" path="M 400 222 L 255 158" />
      </circle>

      {/* ================= 4. CENTRAL BLUE AI NEURAL CORE ================= */}
      {/* Main Solid Blue Machine Body */}
      <rect
        x="165"
        y="90"
        width="90"
        height="90"
        fill="#3B67F6"
        stroke="#2554EB"
        strokeWidth="1.2"
        rx="2"
      />

      {/* 4 Yellow Corner Square Pins */}
      <rect x="160" y="85" width="9" height="9" fill="#ECFFA3" rx="1.5" />
      <rect x="251" y="85" width="9" height="9" fill="#ECFFA3" rx="1.5" />
      <rect x="160" y="176" width="9" height="9" fill="#ECFFA3" rx="1.5" />
      <rect x="251" y="176" width="9" height="9" fill="#ECFFA3" rx="1.5" />

      {/* 4 Pink Connector Port Tabs with Soft Breathing */}
      <g className="apii-port-pulse">
        {/* Top edge ports */}
        <rect x="187" y="86" width="8" height="8" fill="#FF8BA7" rx="1" />
        <rect x="225" y="86" width="8" height="8" fill="#FF8BA7" rx="1" />
        {/* Bottom edge ports */}
        <rect x="187" y="176" width="8" height="8" fill="#FF8BA7" rx="1" />
        <rect x="225" y="176" width="8" height="8" fill="#FF8BA7" rx="1" />
        {/* Lateral ports */}
        <rect x="161" y="131" width="8" height="8" fill="#FF8BA7" rx="1" />
        <rect x="251" y="131" width="8" height="8" fill="#FF8BA7" rx="1" />
      </g>

      {/* 2 Lateral Glowing White Beacons / Flare Stars */}
      {/* Left Beacon */}
      <g transform="translate(138, 135)">
        <circle cx="0" cy="0" r="10" fill="#FFFFFF" opacity="0.3" filter="url(#apii-blur)" className="apii-beacon-glow-anim" />
        <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
        <line x1="-7" y1="0" x2="7" y2="0" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.8" />
        <line x1="0" y1="-7" x2="0" y2="7" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.8" />
      </g>

      {/* Right Beacon */}
      <g transform="translate(282, 135)">
        <circle cx="0" cy="0" r="10" fill="#FFFFFF" opacity="0.3" filter="url(#apii-blur)" className="apii-beacon-glow-anim" />
        <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
        <line x1="-7" y1="0" x2="7" y2="0" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.8" />
        <line x1="0" y1="-7" x2="0" y2="7" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.8" />
      </g>

      {/* ================= 5. CENTRAL 3D GYROSCOPE SPHERE / BRAIN ================= */}
      {/* Radial Breathing Glow Aura */}
      <circle
        cx="210"
        cy="135"
        r="36"
        fill="url(#apii-core-glow)"
        className="apii-core-pulse"
      />

      {/* Outer Sphere White Equator Ring */}
      <circle
        cx="210"
        cy="135"
        r="30"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeOpacity="0.9"
        fill="none"
      />

      {/* Tilted Yellow Orbital Ellipse with Counter-Rotating Motion */}
      <g className="apii-orbit-vert">
        <ellipse
          cx="210"
          cy="135"
          rx="30"
          ry="14"
          transform="rotate(-40 210 135)"
          stroke="#FCE96A"
          strokeWidth="1.2"
          strokeOpacity="0.95"
          fill="none"
        />
        {/* Orbiting Yellow Electron Node */}
        <circle cx="225" cy="147" r="2.5" fill="#FEF08A" />
      </g>

      {/* Horizontal / Slight-Tilted Cyan Orbital Ellipse */}
      <g className="apii-orbit-horiz">
        <ellipse
          cx="210"
          cy="135"
          rx="30"
          ry="13"
          transform="rotate(18 210 135)"
          stroke="#67E8F9"
          strokeWidth="1.2"
          strokeOpacity="0.95"
          fill="none"
        />
        {/* Bright Glowing White Sparkle Photon on the Cyan Orbit */}
        <circle cx="188" cy="126" r="4" fill="#FFFFFF" filter="url(#apii-blur)" />
        <circle cx="188" cy="126" r="2.2" fill="#FFFFFF" />
      </g>

      {/* Central Sparkle Seed in the Core */}
      <circle cx="210" cy="135" r="2.2" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
};

export default AiPredictiveInferenceIllustration;
