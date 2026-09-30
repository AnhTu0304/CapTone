import React from 'react';

/**
 * HeroAmbientDecor
 * 
 * Renders the 3D ambient decorative elements matching the reference image:
 * 1. Glowing 3D Kubernetes Isometric Emblem with Orbital Halo Ring (bottom-right of dashboard)
 * 2. Translucent 3D Isometric Data Cubes floating in space (mid-gap and bottom-right)
 * 3. Soft ambient cyan/mint diffuse lighting blooms
 */
export const HeroAmbientDecor = ({ className = '' }) => {
  return (
    <div
      className={`hero-ambient-decor ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 5,
      }}
    >
      {/* ================= 1. GLOWING 3D KUBERNETES EMBLEM & ORBITAL HALO (Bottom-Right) ================= */}
      <div
        className="k8s-halo-wrapper"
        style={{
          position: 'absolute',
          bottom: '-15px',
          right: '-75px',
          width: '160px',
          height: '160px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'k8sHaloFloat 6s ease-in-out infinite',
        }}
      >
        {/* Outer Orbital Glowing Elliptical Halo */}
        <div
          style={{
            position: 'absolute',
            width: '190px',
            height: '80px',
            borderRadius: '50%',
            border: '2px solid rgba(56, 189, 248, 0.65)',
            boxShadow: '0 0 25px rgba(56, 189, 248, 0.45), inset 0 0 15px rgba(16, 185, 129, 0.3)',
            transform: 'rotateX(65deg) rotateZ(-25deg)',
            pointerEvents: 'none',
          }}
        />

        {/* 3D Isometric Kubernetes Hexagonal Emblem */}
        <div
          style={{
            position: 'relative',
            width: '88px',
            height: '98px',
            filter: 'drop-shadow(0 15px 25px rgba(37, 99, 235, 0.35))',
          }}
        >
          <svg
            viewBox="0 0 100 115"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              {/* Top Face Gradient */}
              <linearGradient id="k8sTopGrad" x1="0" y1="0" x2="100" y2="50" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
              {/* Left Face Gradient */}
              <linearGradient id="k8sLeftGrad" x1="0" y1="30" x2="50" y2="115" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              {/* Right Face Gradient */}
              <linearGradient id="k8sRightGrad" x1="50" y1="30" x2="100" y2="115" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1E40AF" />
              </linearGradient>
            </defs>

            {/* 3D Hexagonal Prism Faces */}
            {/* Top Face */}
            <path d="M50 2 L95 28 L50 55 L5 28 Z" fill="url(#k8sTopGrad)" stroke="#93C5FD" strokeWidth="1.5" />
            {/* Left Face */}
            <path d="M5 28 L50 55 L50 110 L5 83 Z" fill="url(#k8sLeftGrad)" stroke="#60A5FA" strokeWidth="1.5" />
            {/* Right Face */}
            <path d="M50 55 L95 28 L95 83 L50 110 Z" fill="url(#k8sRightGrad)" stroke="#60A5FA" strokeWidth="1.5" />

            {/* Kubernetes Steering Wheel Icon embossed in center */}
            <circle cx="50" cy="55" r="16" fill="none" stroke="#FFFFFF" strokeWidth="3.5" />
            <circle cx="50" cy="55" r="5" fill="#FFFFFF" />
            {/* Spokes */}
            <line x1="50" y1="39" x2="50" y2="29" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <line x1="50" y1="71" x2="50" y2="81" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <line x1="36" y1="47" x2="27" y2="42" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <line x1="64" y1="63" x2="73" y2="68" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <line x1="36" y1="63" x2="27" y2="68" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <line x1="64" y1="47" x2="73" y2="42" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ================= 2. FLOATING ISOMETRIC DATA CUBES ================= */}
      
      {/* Cube 1: Beneath the Kubernetes emblem (Far Right / Bottom) */}
      <div
        style={{
          position: 'absolute',
          bottom: '-35px',
          right: '50px',
          width: '32px',
          height: '36px',
          animation: 'cubeFloat1 5s ease-in-out infinite',
        }}
      >
        <svg viewBox="0 0 40 46" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <path d="M20 2 L38 12 L20 22 L2 12 Z" fill="#93C5FD" fillOpacity="0.85" stroke="#60A5FA" strokeWidth="1" />
          <path d="M2 12 L20 22 L20 44 L2 34 Z" fill="#3B82F6" fillOpacity="0.85" stroke="#2563EB" strokeWidth="1" />
          <path d="M20 22 L38 12 L38 34 L20 44 Z" fill="#60A5FA" fillOpacity="0.85" stroke="#3B82F6" strokeWidth="1" />
        </svg>
      </div>

      {/* Cube 2: Small micro-cube floating slightly higher */}
      <div
        style={{
          position: 'absolute',
          bottom: '70px',
          right: '-55px',
          width: '20px',
          height: '24px',
          animation: 'cubeFloat2 6.5s ease-in-out infinite',
        }}
      >
        <svg viewBox="0 0 40 46" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <path d="M20 2 L38 12 L20 22 L2 12 Z" fill="#A7F3D0" fillOpacity="0.85" stroke="#6EE7B7" strokeWidth="1" />
          <path d="M2 12 L20 22 L20 44 L2 34 Z" fill="#10B981" fillOpacity="0.85" stroke="#059669" strokeWidth="1" />
          <path d="M20 22 L38 12 L38 34 L20 44 Z" fill="#34D399" fillOpacity="0.85" stroke="#10B981" strokeWidth="1" />
        </svg>
      </div>

      {/* Cube 3: Floating in the mid-gap between Left Column and Dashboard */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '-40px',
          width: '28px',
          height: '32px',
          animation: 'cubeFloatMid 7s ease-in-out infinite',
        }}
      >
        <svg viewBox="0 0 40 46" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <path d="M20 2 L38 12 L20 22 L2 12 Z" fill="#BAE6FD" fillOpacity="0.75" stroke="#7DD3FC" strokeWidth="1" />
          <path d="M2 12 L20 22 L20 44 L2 34 Z" fill="#38BDF8" fillOpacity="0.75" stroke="#0284C7" strokeWidth="1" />
          <path d="M20 22 L38 12 L38 34 L20 44 Z" fill="#7DD3FC" fillOpacity="0.75" stroke="#38BDF8" strokeWidth="1" />
        </svg>
      </div>

      {/* Cube 4: Small glass shard cube near the top mid-left */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: '-15px',
          width: '18px',
          height: '21px',
          animation: 'cubeFloatMid 5.5s ease-in-out infinite',
          animationDelay: '1.5s',
        }}
      >
        <svg viewBox="0 0 40 46" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          <path d="M20 2 L38 12 L20 22 L2 12 Z" fill="#D1FAE5" fillOpacity="0.8" stroke="#A7F3D0" strokeWidth="1" />
          <path d="M2 12 L20 22 L20 44 L2 34 Z" fill="#059669" fillOpacity="0.8" stroke="#047857" strokeWidth="1" />
          <path d="M20 22 L38 12 L38 34 L20 44 Z" fill="#34D399" fillOpacity="0.8" stroke="#10B981" strokeWidth="1" />
        </svg>
      </div>

      <style>{`
        @keyframes k8sHaloFloat {
          0%, 100% {
            transform: translateY(0) rotateZ(0deg);
          }
          50% {
            transform: translateY(-8px) rotateZ(2deg);
          }
        }

        @keyframes cubeFloat1 {
          0%, 100% {
            transform: translateY(0) rotateZ(0deg);
          }
          50% {
            transform: translateY(-6px) rotateZ(3deg);
          }
        }

        @keyframes cubeFloat2 {
          0%, 100% {
            transform: translateY(0) rotateZ(0deg);
          }
          50% {
            transform: translateY(-9px) rotateZ(-4deg);
          }
        }

        @keyframes cubeFloatMid {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-7px) scale(1.05);
          }
        }

        @media (max-width: 1180px) {
          .k8s-halo-wrapper {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HeroAmbientDecor;
