import React from 'react';
import { Zap, CheckCircle2, User } from 'lucide-react';

export const ExecutionModeBadge = ({ mode = 'AUTONOMOUS' }) => {
  switch (mode) {
    case 'AUTONOMOUS':
    case 'Fully Autonomous':
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
          <Zap size={11} /> Tự Trị AI (Autonomous)
        </span>
      );
    case 'HITL_GATE':
    case 'HITL Approval Required':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8',
            border: '1px solid #BFDBFE',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <CheckCircle2 size={11} /> Cổng Duyệt HITL
        </span>
      );
    case 'Dry-Run Only':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#F5F3FF',
            color: '#7C3AED',
            border: '1px solid #DDD6FE',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          Chạy Thử Nghiệm (Dry-Run)
        </span>
      );
    case 'MANUAL':
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
          <User size={11} /> Thủ Công (Manual)
        </span>
      );
  }
};

export default ExecutionModeBadge;
