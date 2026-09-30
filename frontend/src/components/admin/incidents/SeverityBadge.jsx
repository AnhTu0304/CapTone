import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

export const SeverityBadge = ({ severity = 'INFO' }) => {
  switch (severity) {
    case 'CRITICAL':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
            border: '1px solid #FECACA',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertCircle size={11} /> Nghiêm Trọng (P1)
        </span>
      );
    case 'MAJOR':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#FFFBEB',
            color: '#D97706',
            border: '1px solid #FDE68A',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertTriangle size={11} /> Đáng Kể (P2)
        </span>
      );
    case 'MINOR':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#EFF6FF',
            color: '#2563EB',
            border: '1px solid #BFDBFE',
            fontWeight: 600,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Info size={11} /> Nhỏ (P3)
        </span>
      );
    case 'INFO':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#F1F5F9',
            color: '#475569',
            border: '1px solid #E2E8F0',
            fontWeight: 600,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Info size={11} /> Thông Tin
        </span>
      );
  }
};

export default SeverityBadge;
