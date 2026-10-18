import React from 'react';
import { CheckCircle2, Clock, XCircle, RefreshCw, Undo2, ShieldCheck } from 'lucide-react';

export const ApprovalStatusBadge = ({ status = 'APPROVED' }) => {
  switch (status) {
    case 'APPROVED':
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
          <CheckCircle2 size={11} /> Đã Phê Duyệt
        </span>
      );
    case 'PRE_APPROVED_BY_POLICY':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#F0FDF4',
            color: '#15803D',
            border: '1px solid #BBF7D0',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldCheck size={11} /> Duyệt Trước Theo Chính Sách
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
    case 'REJECTED':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: '#FEF2F2',
            color: '#991B1B',
            border: '1px solid #FCA5A5',
            fontWeight: 700,
            fontSize: '0.6875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <XCircle size={11} /> Bị Từ Chối
        </span>
      );
  }
};

export const ExecutionStatusBadge = ({ status = 'SUCCEEDED' }) => {
  switch (status) {
    case 'SUCCEEDED':
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
          <CheckCircle2 size={11} /> Thành Công
        </span>
      );
    case 'EXECUTING':
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
          <RefreshCw size={11} className="spin-icon" /> Đang Thi Hành
        </span>
      );
    case 'ROLLED_BACK':
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
          <Undo2 size={11} /> Đã Hoàn Nguyên
        </span>
      );
    case 'FAILED':
    default:
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
          <XCircle size={11} /> Thất Bại
        </span>
      );
  }
};

const actionBadges = { ApprovalStatusBadge, ExecutionStatusBadge };
export default actionBadges;
