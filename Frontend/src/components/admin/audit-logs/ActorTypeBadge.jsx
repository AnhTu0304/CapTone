import React from 'react';
import PropTypes from 'prop-types';
import { User, BrainCircuit, Activity, Key } from 'lucide-react';

/**
 * ActorTypeBadge Component
 * Hiển thị nhãn phân loại tác nhân thực hiện hành động:
 * - USER: Người dùng / Quản trị viên
 * - SYSTEM_AI: Động cơ MAPE-K / AI Engine
 * - EBPF_AGENT: Cảm biến nhân Linux CO-RE
 * - API_KEY: Khóa API tích hợp bên ngoài
 */
export const ActorTypeBadge = ({ actorType }) => {
  switch (actorType) {
    case 'SYSTEM':
    case 'SYSTEM_AI':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            backgroundColor: '#ECFDF5',
            color: '#065F46',
            border: '1px solid #A7F3D0',
            whiteSpace: 'nowrap',
          }}
        >
          <BrainCircuit size={12} color="#059669" />
          <span>SYSTEM_AI</span>
        </span>
      );
    case 'AGENT':
    case 'EBPF_AGENT':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            backgroundColor: '#F5F3FF',
            color: '#6D28D9',
            border: '1px solid #DDD6FE',
            whiteSpace: 'nowrap',
          }}
        >
          <Activity size={12} color="#7C3AED" />
          <span>EBPF_AGENT</span>
        </span>
      );
    case 'API_KEY':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            backgroundColor: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #FDE68A',
            whiteSpace: 'nowrap',
          }}
        >
          <Key size={12} color="#D97706" />
          <span>API_KEY</span>
        </span>
      );
    case 'USER':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            backgroundColor: '#EFF6FF',
            color: '#1E40AF',
            border: '1px solid #BFDBFE',
            whiteSpace: 'nowrap',
          }}
        >
          <User size={12} color="#2563EB" />
          <span>USER</span>
        </span>
      );
  }
};

ActorTypeBadge.propTypes = {
  actorType: PropTypes.string,
};

export default ActorTypeBadge;
