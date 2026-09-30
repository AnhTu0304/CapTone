import React from 'react';

export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'success' | 'warning' | 'danger'
  size = 'md',        // 'sm' | 'md' | 'lg'
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-canvas)',
          border: '1px solid var(--color-primary)',
          boxShadow: 'none',
        };
      case 'secondary':
      case 'accent':
        return {
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-ink)',
          border: '1px solid var(--color-accent)',
          boxShadow: 'none',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-primary)',
          border: '1px solid var(--color-hairline)',
        };
      case 'success':
        return {
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success-text)',
          border: '1px solid var(--success-border)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--warning-bg)',
          color: 'var(--warning-text)',
          border: '1px solid var(--warning-border)',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--error-bg)',
          color: 'var(--error-text)',
          border: '1px solid var(--error-border)',
        };
      default:
        return {};
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          padding: '6px 16px',
          fontSize: '0.8125rem',
          borderRadius: '0px',
          gap: '6px',
          minHeight: '34px',
        };
      case 'lg':
        return {
          padding: '14px 34px',
          fontSize: '1.0625rem',
          borderRadius: '0px',
          gap: '10px',
          minHeight: '52px',
        };
      case 'md':
      default:
        return {
          padding: '10px 26px',
          fontSize: '0.9375rem',
          borderRadius: '0px',
          gap: '8px',
          minHeight: '41px',
        };
    }
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`btn-custom btn-${variant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
        width: fullWidth ? '100%' : 'auto',
        lineHeight: 1.25,
        borderRadius: '0px',
        ...getVariantStyles(),
        ...getSizeStyles(),
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (variant === 'primary') {
          e.currentTarget.style.transform = 'translateX(-4px)';
          e.currentTarget.style.backgroundColor = '#2A2838';
        } else if (variant === 'secondary' || variant === 'accent') {
          e.currentTarget.style.transform = 'translateX(4px)';
          e.currentTarget.style.backgroundColor = '#1FE092';
        } else if (variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'rgba(61, 59, 79, 0.06)';
          e.currentTarget.style.borderColor = 'var(--color-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateX(0px)';
        if (variant === 'primary') {
          e.currentTarget.style.backgroundColor = 'var(--color-primary)';
        } else if (variant === 'secondary' || variant === 'accent') {
          e.currentTarget.style.backgroundColor = 'var(--color-accent)';
        } else if (variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = 'var(--color-hairline)';
        }
      }}
      {...props}
    >
      {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
      <span>{children}</span>
      {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
    </button>
  );
};

export default Button;
