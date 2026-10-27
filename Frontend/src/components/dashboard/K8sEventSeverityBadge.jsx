import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

/**
 * Normalizes and categorizes raw Kubernetes event type into canonical severity
 * @param {string|null|undefined} rawType
 * @returns {'Warning' | 'Normal' | 'Unknown'}
 */
export function normalizeK8sEventType(rawType) {
  if (typeof rawType !== 'string') return 'Unknown';
  const trimmed = rawType.trim().toUpperCase();
  if (trimmed === 'WARNING' || trimmed === 'WARN') {
    return 'Warning';
  }
  if (trimmed === 'NORMAL' || trimmed === 'INFO') {
    return 'Normal';
  }
  return 'Unknown';
}

/**
 * Shared styling and metadata helper for K8s event severity
 */
export function getK8sSeverityConfig(rawType, options = {}) {
  const canonical = normalizeK8sEventType(rawType);
  const showFullLabel = options.showFullLabel ?? false;

  switch (canonical) {
    case 'Warning':
      return {
        canonical,
        label: showFullLabel ? 'Cảnh báo (Warning)' : 'Warning',
        ariaLabel: 'Mức độ Cảnh báo (Warning)',
        bg: '#FFF1F2',
        color: '#E11D48',
        border: '1px solid #FDA4AF',
        Icon: AlertTriangle,
      };
    case 'Normal':
      return {
        canonical,
        label: showFullLabel ? 'Bình thường (Normal)' : 'Normal',
        ariaLabel: 'Mức độ Bình thường (Normal)',
        bg: 'rgba(5, 150, 105, 0.1)',
        color: '#059669',
        border: '1px solid #34D399',
        Icon: CheckCircle2,
      };
    case 'Unknown':
    default: {
      const displayRaw = typeof rawType === 'string' && rawType.trim() ? rawType.trim() : 'N/A';
      return {
        canonical,
        label: showFullLabel ? `Không xác định (${displayRaw})` : displayRaw,
        ariaLabel: `Mức độ Không xác định: ${displayRaw}`,
        bg: '#F1F5F9',
        color: '#475569',
        border: '1px solid #CBD5E1',
        Icon: HelpCircle,
      };
    }
  }
}

/**
 * K8sEventSeverityBadge component
 * Shared between Events table list and Event Detail modal [S4][PB18] 4.3
 */
export const K8sEventSeverityBadge = ({
  type,
  showFullLabel = false,
  size = 'md',
  className = '',
  style = {},
}) => {
  const config = getK8sSeverityConfig(type, { showFullLabel });
  const { Icon, label, bg, color, border, ariaLabel } = config;
  const iconSize = size === 'sm' ? 11 : 13;

  return (
    <span
      data-testid="event-severity-badge"
      data-severity={config.canonical}
      aria-label={ariaLabel}
      className={`k8s-event-severity-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        borderRadius: '4px',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: size === 'sm' ? '0.625rem' : '0.6875rem',
        fontWeight: 700,
        backgroundColor: bg,
        color: color,
        border: border,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style,
      }}
    >
      <Icon size={iconSize} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export default K8sEventSeverityBadge;
