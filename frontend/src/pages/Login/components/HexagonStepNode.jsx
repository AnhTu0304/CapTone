import React, { useState } from 'react';

/**
 * HexagonStepNode
 * 
 * Khối lục giác 3D kỹ thuật đại diện cho từng bước tiếp cận hạ tầng:
 * - Hình dạng: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)
 * - Tương tác chuột: hover scale, nâng trục Z, con trỏ pointer, click chọn bước
 * - Trạng thái: isSelected (đang xem chi tiết), isActive (bước chu trình hiện tại), isCompleted, pending
 */
export const HexagonStepNode = ({
  stepNum,
  title,
  icon: Icon,
  isActive,
  isCompleted,
  isSelected,
  isConverging,
  x,
  y,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = (e) => {
    setIsHovered(true);
    if (onMouseEnter) onMouseEnter(e);
  };

  const handleMouseLeave = (e) => {
    setIsHovered(false);
    if (onMouseLeave) onMouseLeave(e);
  };

  const getBorderColor = () => {
    if (isSelected) return 'var(--color-accent, #28E99F)';
    if (isHovered) return 'var(--color-accent, #28E99F)';
    if (isActive) return 'var(--color-accent, #28E99F)';
    if (isCompleted) return 'var(--color-primary, #3D3B4F)';
    return 'rgba(61, 59, 79, 0.22)';
  };

  const getBgColor = () => {
    if (isSelected) return 'rgba(40, 233, 159, 0.32)';
    if (isHovered) return 'rgba(40, 233, 159, 0.22)';
    if (isActive) return 'rgba(40, 233, 159, 0.16)';
    if (isCompleted) return 'rgba(61, 59, 79, 0.09)';
    return 'rgba(255, 255, 255, 0.7)';
  };

  const getIconColor = () => {
    if (isSelected || isHovered || isActive || isCompleted) {
      return 'var(--color-primary, #3D3B4F)';
    }
    return 'var(--text-muted, #6B7280)';
  };

  const getBoxShadow = () => {
    if (isSelected) return '0 0 24px rgba(40, 233, 159, 0.7), 0 0 8px #28E99F';
    if (isHovered) return '0 0 18px rgba(40, 233, 159, 0.5)';
    if (isActive) return '0 0 16px rgba(40, 233, 159, 0.4)';
    return 'none';
  };

  // 3D elevation and scale
  const zElevation = isSelected ? 40 : isHovered ? 30 : isActive ? 22 : 0;
  const scale = isSelected ? 1.15 : isHovered ? 1.1 : isActive ? 1.06 : 1;

  const styleTransform = isConverging
    ? 'translate3d(0, 0, -100px) scale(0)'
    : `translate3d(${x}px, ${y}px, ${zElevation}px) scale(${scale})`;

  return (
    <div
      className={`hex-step-node ${isActive ? 'hex-active' : ''} ${isCompleted ? 'hex-completed' : ''} ${isSelected ? 'hex-selected' : ''}`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      aria-label={`Bước ${stepNum}: ${title}. Nhấn để xem cách hoạt động.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onClick) onClick();
        }
      }}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginLeft: '-44px',
        marginTop: '-50px',
        width: '88px',
        height: '100px',
        transform: styleTransform,
        opacity: isConverging ? 0 : 1,
        transition: isConverging 
          ? 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)' 
          : 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        transformStyle: 'preserve-3d',
        zIndex: isSelected ? 30 : isHovered ? 25 : isActive ? 12 : 5,
        cursor: 'pointer',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {/* Outer Hexagon Shell */}
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: getBorderColor(),
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isSelected ? '3px' : '2px',
          boxShadow: getBoxShadow(),
          transition: 'all 0.3s ease',
        }}
      >
        {/* Inner Hexagon Core */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: getBgColor(),
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            transition: 'background-color 0.25s ease',
          }}
        >
          {/* Step Number Monospace Tag */}
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.625rem',
              fontWeight: 700,
              color: isSelected || isActive ? 'var(--color-ink, #111827)' : 'var(--text-muted, #6B7280)',
              lineHeight: 1,
              marginBottom: '3px',
              letterSpacing: '0.05em',
            }}
          >
            0{stepNum}
          </span>

          {/* Lucide Step Icon */}
          <Icon size={20} color={getIconColor()} strokeWidth={isSelected || isActive ? 2.5 : 2.0} />

          {/* Pulse Dot when Active or Selected */}
          {(isActive || isSelected) && (
            <span
              style={{
                display: 'block',
                width: isSelected ? '5px' : '4px',
                height: isSelected ? '5px' : '4px',
                backgroundColor: 'var(--color-accent, #28E99F)',
                borderRadius: '50%',
                marginTop: '4px',
                animation: isSelected ? 'none' : 'hexPulse 1.2s ease-in-out infinite',
                boxShadow: isSelected ? '0 0 6px #28E99F' : 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Floating Step Title Under Hexagon */}
      <div
        style={{
          position: 'absolute',
          top: '106px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '130px',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display, sans-serif)',
            fontSize: '0.75rem',
            fontWeight: isSelected || isActive || isHovered ? 700 : 600,
            color: isSelected || isActive || isHovered
              ? 'var(--color-ink, #111827)' 
              : isCompleted 
                ? 'var(--color-primary, #3D3B4F)' 
                : 'var(--text-muted, #6B7280)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            backgroundColor: isSelected 
              ? '#FFFFFF' 
              : isHovered || isActive 
                ? 'rgba(244, 245, 246, 0.95)' 
                : 'transparent',
            padding: isSelected || isHovered || isActive ? '3px 8px' : '0',
            border: isSelected 
              ? '1px solid var(--color-accent, #28E99F)' 
              : isHovered 
                ? '1px dashed var(--color-accent, #28E99F)' 
                : isActive 
                  ? '1px solid rgba(40, 233, 159, 0.6)' 
                  : 'none',
            borderRadius: '4px',
            boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
            transition: 'all 0.25s ease',
          }}
        >
          {title}
        </div>

        {/* Micro Hint when Hovered */}
        {isHovered && !isSelected && (
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.5625rem',
              color: '#059669',
              fontWeight: 700,
              marginTop: '2px',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              animation: 'fadeIn 0.2s ease forwards',
            }}
          >
            Click xem cách hoạt động
          </div>
        )}
      </div>
    </div>
  );
};

export default HexagonStepNode;
