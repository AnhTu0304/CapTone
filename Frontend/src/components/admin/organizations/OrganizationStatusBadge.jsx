import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Đang Hoạt Động',
    bgColor: '#ECFDF5',
    color: '#065F46',
    borderColor: '#A7F3D0',
    icon: CheckCircle2,
  },
  TRIAL: {
    label: 'Dùng Thử Nghiệm',
    bgColor: '#EFF6FF',
    color: '#1E40AF',
    borderColor: '#BFDBFE',
    icon: Clock,
  },
  SUSPENDED: {
    label: 'Đang Tạm Dừng',
    bgColor: '#FEF2F2',
    color: '#991B1B',
    borderColor: '#FECACA',
    icon: AlertTriangle,
  },
  INACTIVE: {
    label: 'Ngừng Hoạt Động',
    bgColor: '#F1F5F9',
    color: '#475569',
    borderColor: '#CBD5E1',
    icon: XCircle,
  },
};

export const OrganizationStatusBadge = ({ status = 'ACTIVE' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;
  const IconComponent = config.icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '9999px',
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <IconComponent size={11} color={config.color} />
      <span>{config.label}</span>
    </span>
  );
};

export default OrganizationStatusBadge;
