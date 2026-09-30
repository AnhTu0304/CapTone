import React from 'react';
import { CheckCircle2, RefreshCw, Clock, Search, ShieldCheck } from 'lucide-react';

export const IncidentStatusBadge = ({ status = 'INVESTIGATING' }) => {
  switch (status) {
    case 'RESOLVED':
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
          <CheckCircle2 size={11} /> Đã Khắc Phục
        </span>
      );
    case 'HEALING':
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
          <RefreshCw size={11} className="spin-icon" /> Đang Tự Phục Hồi
        </span>
      );
    case 'AWAITING_APPROVAL':
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
          <Clock size={11} /> Chờ Duyệt HITL
        </span>
      );
    case 'RCA_COMPLETED':
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
          <Search size={11} /> Đã Có RCA
        </span>
      );
    case 'VERIFYING':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#ECFEFF',
            color: '#0891B2',
            border: '1px solid #A5F3FC',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldCheck size={11} /> Đang Kiểm Chứng
        </span>
      );
    case 'INVESTIGATING':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#FFFBEB',
            color: '#92400E',
            border: '1px solid #FDE68A',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Search size={11} /> Đang Điều Tra
        </span>
      );
  }
};

export default IncidentStatusBadge;
