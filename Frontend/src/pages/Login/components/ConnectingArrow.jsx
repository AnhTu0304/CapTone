import React from 'react';

/**
 * ConnectingArrow
 * 
 * Đường truyền tín hiệu / mũi tên kết nối giữa 2 bước lục giác liền kề:
 * - Khi active: sáng màu Mint #28E99F với xung năng lượng chạy dọc
 * - Khi completed: nét đứt mảnh Navy
 * - Khi pending: nét đứt xám rất mờ
 */
export const ConnectingArrow = ({
  fromX,
  fromY,
  toX,
  toY,
  isActive,
  isCompleted,
  isConverging,
}) => {
  // Center is (0, 0), so convert relative coordinates for canvas
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const length = Math.sqrt(dx * dx + dy * dy);

  // Shorten line slightly so it doesn't overlap the hexagons
  const offset = 46; 

  if (isConverging) return null;

  const strokeColor = isActive 
    ? 'var(--color-accent)' 
    : isCompleted 
      ? 'var(--color-primary)' 
      : 'rgba(61, 59, 79, 0.2)';

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(${fromX}px, ${fromY}px) rotate(${angle}deg)`,
        transformOrigin: '0 0',
        width: `${length}px`,
        height: '24px',
        marginTop: '-12px',
        pointerEvents: 'none',
        zIndex: isActive ? 6 : 2,
        opacity: isConverging ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <svg
        width={length}
        height="24"
        viewBox={`0 0 ${length} 24`}
        fill="none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <marker
            id={`arrow-${fromX}-${toX}`}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill={strokeColor} />
          </marker>
        </defs>

        {/* Base Connection Path */}
        <line
          x1={offset * 0.8}
          y1="12"
          x2={length - offset * 0.8}
          y2="12"
          stroke={strokeColor}
          strokeWidth={isActive ? '2' : '1.5'}
          strokeDasharray={isActive ? 'none' : '4 4'}
          markerEnd={`url(#arrow-${fromX}-${toX})`}
          style={{ transition: 'stroke 0.3s ease' }}
        />

        {/* Animated Traveling Pulse Photon when Active */}
        {isActive && (
          <circle
            r="3.5"
            fill="var(--color-accent)"
            filter="drop-shadow(0 0 4px #28E99F)"
          >
            <animateMotion
              path={`M ${offset * 0.8} 12 L ${length - offset * 0.8} 12`}
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>
    </div>
  );
};

export default ConnectingArrow;
