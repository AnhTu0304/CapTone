import React from 'react';

/**
 * TelemetryStreamIllustration
 * SVG animation representing continuous Kubernetes eBPF telemetry,
 * pod metrics, and event streaming into the central SelfHeal machine.
 * Matching Greptile Cybernetic CAD blueprint architecture.
 */
export const TelemetryStreamIllustration = ({ className = '' }) => {
  return (
    <svg
      className={`telemetry-stream-svg ${className}`.trim()}
      viewBox="0 0 420 270"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Thu thập dữ liệu và eBPF telemetry liên tục truyền về máy chủ"
    >
      <defs>
        {/* Core Glowing Radials */}
        <radialGradient id="tsi-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#28E99F" stopOpacity="0.8" />
          <stop offset="45%" stopColor="#38BDF8" stopOpacity="0.45" />
          <stop offset="85%" stopColor="#2563EB" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="tsi-packet-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="70%" stopColor="#28E99F" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#28E99F" stopOpacity="0" />
        </radialGradient>

        {/* Soft Blur Filter for Glowing Photons */}
        <filter id="tsi-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>

        {/* Embedded CSS Keyframes for High Performance 60FPS */}
        <style>{`
          .tsi-orbit-group {
            transform-origin: 210px 135px;
            animation: tsi-spin 16s linear infinite;
          }
          .tsi-orbit-inner {
            transform-origin: 210px 135px;
            animation: tsi-spin-reverse 10s linear infinite;
          }
          .tsi-pulse-core {
            animation: tsi-breathe 2.8s ease-in-out infinite;
            transform-origin: 210px 135px;
          }
          .tsi-port-pulse {
            animation: tsi-blink 1.8s ease-in-out infinite alternate;
          }
          .tsi-stream-dash {
            stroke-dasharray: 6 18;
            animation: tsi-dash-flow 1.4s linear infinite;
          }
          .tsi-stream-dash-rev {
            stroke-dasharray: 6 18;
            animation: tsi-dash-flow-rev 1.4s linear infinite;
          }

          @keyframes tsi-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes tsi-spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes tsi-breathe {
            0%, 100% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.12); opacity: 1; }
          }
          @keyframes tsi-blink {
            0% { filter: brightness(1); }
            100% { filter: brightness(1.35) drop-shadow(0 0 3px #FF8BA7); }
          }
          @keyframes tsi-dash-flow {
            from { stroke-dashoffset: 48; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes tsi-dash-flow-rev {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: 48; }
          }
        `}</style>
      </defs>

      {/* ================= 1. CAD BACKGROUND CROSSHAIRS ================= */}
      <g stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="3 3">
        <line x1="20" y1="135" x2="400" y2="135" />
        <line x1="210" y1="15" x2="210" y2="255" />
      </g>

      {/* Subtle CAD Alignment Circles */}
      <circle cx="210" cy="135" r="95" stroke="rgba(40, 233, 159, 0.07)" strokeWidth="1" strokeDasharray="4 4" fill="none" />
      <circle cx="210" cy="135" r="145" stroke="rgba(59, 130, 246, 0.05)" strokeWidth="1" strokeDasharray="4 6" fill="none" />

      {/* ================= 2. TELEMETRY STREAM SPLINE PATHS ================= */}
      {/* LEFT INGESTION HIGHWAYS (Moving Left -> Center Machine) */}
      <g stroke="#9CE8C9" strokeWidth="1" fill="none" opacity="0.32">
        <path id="path-left-1" d="M 25 45 Q 120 75 160 105" />
        <path id="path-left-2" d="M 35 85 Q 115 105 160 120" />
        <path id="path-left-3" d="M 20 135 Q 105 135 160 135" />
        <path id="path-left-4" d="M 35 185 Q 115 165 160 150" />
        <path id="path-left-5" d="M 25 225 Q 120 195 160 165" />
      </g>

      {/* Animated Dash Highways for Left Flow */}
      <g stroke="#28E99F" strokeWidth="1.5" fill="none" opacity="0.65" className="tsi-stream-dash">
        <path d="M 25 45 Q 120 75 160 105" />
        <path d="M 35 85 Q 115 105 160 120" />
        <path d="M 20 135 Q 105 135 160 135" />
        <path d="M 35 185 Q 115 165 160 150" />
        <path d="M 25 225 Q 120 195 160 165" />
      </g>

      {/* RIGHT INGESTION HIGHWAYS (Moving Right -> Center Machine) */}
      <g stroke="#9CE8C9" strokeWidth="1" fill="none" opacity="0.32">
        <path id="path-right-1" d="M 395 45 Q 300 75 260 105" />
        <path id="path-right-2" d="M 385 85 Q 305 105 260 120" />
        <path id="path-right-3" d="M 400 135 Q 315 135 260 135" />
        <path id="path-right-4" d="M 385 185 Q 305 165 260 150" />
        <path id="path-right-5" d="M 395 225 Q 300 195 260 165" />
      </g>

      {/* Animated Dash Highways for Right Flow */}
      <g stroke="#28E99F" strokeWidth="1.5" fill="none" opacity="0.65" className="tsi-stream-dash-rev">
        <path d="M 395 45 Q 300 75 260 105" />
        <path d="M 385 85 Q 305 105 260 120" />
        <path d="M 400 135 Q 315 135 260 135" />
        <path d="M 385 185 Q 305 165 260 150" />
        <path d="M 395 225 Q 300 195 260 165" />
      </g>

      {/* ================= 3. CONTINUOUS DATA PACKETS STREAMING TO MACHINE ================= */}
      {/* Packets Streaming From Left */}
      <circle r="3" fill="#FF8BA7">
        <animateMotion dur="2.1s" repeatCount="indefinite" path="M 25 45 Q 120 75 160 105" />
      </circle>
      <circle r="2.5" fill="#ECFFA3">
        <animateMotion dur="1.7s" begin="0.4s" repeatCount="indefinite" path="M 35 85 Q 115 105 160 120" />
      </circle>
      <circle r="3.2" fill="#FFFFFF" filter="url(#tsi-blur)">
        <animateMotion dur="1.5s" begin="0.2s" repeatCount="indefinite" path="M 20 135 Q 105 135 160 135" />
      </circle>
      <circle r="2" fill="#FFFFFF">
        <animateMotion dur="1.5s" begin="0.2s" repeatCount="indefinite" path="M 20 135 Q 105 135 160 135" />
      </circle>
      <circle r="2.5" fill="#28E99F">
        <animateMotion dur="1.9s" begin="0.7s" repeatCount="indefinite" path="M 35 185 Q 115 165 160 150" />
      </circle>
      <circle r="3" fill="#FF8BA7">
        <animateMotion dur="2.3s" begin="0.1s" repeatCount="indefinite" path="M 25 225 Q 120 195 160 165" />
      </circle>

      {/* Staggered Secondary Wave From Left */}
      <circle r="2" fill="#ECFFA3">
        <animateMotion dur="2.1s" begin="1.1s" repeatCount="indefinite" path="M 25 45 Q 120 75 160 105" />
      </circle>
      <circle r="2.5" fill="#FF8BA7">
        <animateMotion dur="1.7s" begin="1.2s" repeatCount="indefinite" path="M 35 85 Q 115 105 160 120" />
      </circle>
      <circle r="2.5" fill="#28E99F">
        <animateMotion dur="1.5s" begin="0.9s" repeatCount="indefinite" path="M 20 135 Q 105 135 160 135" />
      </circle>

      {/* Packets Streaming From Right */}
      <circle r="3" fill="#ECFFA3">
        <animateMotion dur="2.2s" repeatCount="indefinite" path="M 395 45 Q 300 75 260 105" />
      </circle>
      <circle r="2.5" fill="#FF8BA7">
        <animateMotion dur="1.8s" begin="0.3s" repeatCount="indefinite" path="M 385 85 Q 305 105 260 120" />
      </circle>
      <circle r="3.2" fill="#FFFFFF" filter="url(#tsi-blur)">
        <animateMotion dur="1.4s" begin="0.5s" repeatCount="indefinite" path="M 400 135 Q 315 135 260 135" />
      </circle>
      <circle r="2" fill="#FFFFFF">
        <animateMotion dur="1.4s" begin="0.5s" repeatCount="indefinite" path="M 400 135 Q 315 135 260 135" />
      </circle>
      <circle r="2.5" fill="#28E99F">
        <animateMotion dur="2.0s" begin="0.6s" repeatCount="indefinite" path="M 385 185 Q 305 165 260 150" />
      </circle>
      <circle r="3" fill="#ECFFA3">
        <animateMotion dur="2.4s" begin="0.2s" repeatCount="indefinite" path="M 395 225 Q 300 195 260 165" />
      </circle>

      {/* Staggered Secondary Wave From Right */}
      <circle r="2" fill="#FF8BA7">
        <animateMotion dur="2.2s" begin="1.2s" repeatCount="indefinite" path="M 395 45 Q 300 75 260 105" />
      </circle>
      <circle r="2.5" fill="#28E99F">
        <animateMotion dur="1.8s" begin="1.0s" repeatCount="indefinite" path="M 385 85 Q 305 105 260 120" />
      </circle>
      <circle r="2" fill="#ECFFA3">
        <animateMotion dur="1.4s" begin="1.1s" repeatCount="indefinite" path="M 400 135 Q 315 135 260 135" />
      </circle>

      {/* ================= 4. CENTRAL TELEMETRY MACHINE (BLUE CORE) ================= */}
      {/* Royal Blue Solid Machine Body */}
      <rect
        x="160"
        y="85"
        width="100"
        height="100"
        fill="#2E5BF2"
        rx="2"
        stroke="#1E40AF"
        strokeWidth="1.5"
      />

      {/* Core Glowing Aura Ingesting Data */}
      <circle
        cx="210"
        cy="135"
        r="44"
        fill="url(#tsi-core-glow)"
        className="tsi-pulse-core"
      />

      {/* Rotating Geodesic Atomic Orbit Rings */}
      <g className="tsi-orbit-group">
        {/* Ring 1: Primary Equatorial Circle */}
        <circle cx="210" cy="135" r="35" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.85" fill="none" />
        
        {/* Ring 2: Tilted Ellipse A */}
        <ellipse
          cx="210"
          cy="135"
          rx="35"
          ry="15"
          transform="rotate(-35 210 135)"
          stroke="#9CE8C9"
          strokeWidth="1.2"
          strokeOpacity="0.9"
          fill="none"
        />

        {/* Ring 3: Tilted Ellipse B */}
        <ellipse
          cx="210"
          cy="135"
          rx="35"
          ry="15"
          transform="rotate(35 210 135)"
          stroke="#ECFFA3"
          strokeWidth="1.2"
          strokeOpacity="0.9"
          fill="none"
        />

        {/* Orbiting White Telemetry Photon Particle */}
        <circle cx="182" cy="148" r="4" fill="#FFFFFF" filter="url(#tsi-blur)" />
        <circle cx="182" cy="148" r="2.5" fill="#FFFFFF" />
      </g>

      {/* Inner Counter-Rotating Orbit Core */}
      <g className="tsi-orbit-inner">
        <circle cx="210" cy="135" r="16" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
        <circle cx="222" cy="125" r="2" fill="#ECFFA3" />
      </g>

      {/* ================= 5. HARDWARE DATA PORTS & CORNER PINS ================= */}
      {/* 4 Neon Yellow Corner Hardware Pins */}
      <g fill="#ECFFA3" stroke="#2B2938" strokeWidth="0.8">
        <rect x="156" y="81" width="8" height="8" rx="1" />
        <rect x="256" y="81" width="8" height="8" rx="1" />
        <rect x="156" y="181" width="8" height="8" rx="1" />
        <rect x="256" y="181" width="8" height="8" rx="1" />
      </g>

      {/* 6 Pink Telemetry Ingest Ports (Blinking as Packets Arrive) */}
      <g fill="#FF8BA7" stroke="#2B2938" strokeWidth="0.8" className="tsi-port-pulse">
        {/* Top Edge Ports */}
        <rect x="186" y="81" width="8" height="8" rx="1" />
        <rect x="226" y="81" width="8" height="8" rx="1" />

        {/* Bottom Edge Ports */}
        <rect x="186" y="181" width="8" height="8" rx="1" />
        <rect x="226" y="181" width="8" height="8" rx="1" />

        {/* Left & Right Edge Ports (Direct Ingest Nodes) */}
        <rect x="156" y="131" width="8" height="8" rx="1" />
        <rect x="256" y="131" width="8" height="8" rx="1" />
      </g>
    </svg>
  );
};

export default TelemetryStreamIllustration;
