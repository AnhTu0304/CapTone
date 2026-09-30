import React from 'react';
import { ShieldCheck, AlertCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

export const RiskBadge = ({ riskLevel = 'LOW' }) => {
  switch (riskLevel) {
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
          <ShieldAlert size={12} /> Nguy Cấp (Critical)
        </span>
      );
    case 'HIGH':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#FFEDD5',
            color: '#C2410C',
            border: '1px solid #FED7AA',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertTriangle size={12} /> Cao (High)
        </span>
      );
    case 'MEDIUM':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #FDE68A',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertCircle size={12} /> Trung Bình (Medium)
        </span>
      );
    case 'LOW':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#ECFDF5',
            color: '#065F46',
            border: '1px solid #A7F3D0',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldCheck size={12} /> Thấp (Low)
        </span>
      );
  }
};

export default RiskBadge;
