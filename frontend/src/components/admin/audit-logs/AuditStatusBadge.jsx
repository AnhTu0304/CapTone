import React from 'react';
import PropTypes from 'prop-types';
import { CheckCircle2, XCircle, Clock, ShieldAlert } from 'lucide-react';

/**
 * AuditStatusBadge Component
 * Hiển thị nhãn trạng thái kết quả của bản ghi kiểm toán:
 * - SUCCESS: Thành công
 * - FAILED: Thất bại
 * - PENDING_VERIFY: Đang kiểm chứng
 * - BLOCKED: Bị chặn (Vi phạm chính sách an toàn)
 */
export const AuditStatusBadge = ({ status }) => {
  switch (status) {
    case 'SUCCESS':
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
          <CheckCircle2 size={12} color="#059669" />
          <span>Thành công</span>
        </span>
      );
    case 'FAILED':
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
            backgroundColor: '#FEF2F2',
            color: '#991B1B',
            border: '1px solid #FECACA',
            whiteSpace: 'nowrap',
          }}
        >
          <XCircle size={12} color="#DC2626" />
          <span>Thất bại</span>
        </span>
      );
    case 'BLOCKED':
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
            backgroundColor: '#FFF1F2',
            color: '#BE123C',
            border: '1px solid #FECDD3',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldAlert size={12} color="#E11D48" />
          <span>Bị chặn (Blocked)</span>
        </span>
      );
    case 'PENDING_VERIFY':
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
            backgroundColor: '#FFFBEB',
            color: '#92400E',
            border: '1px solid #FDE68A',
            whiteSpace: 'nowrap',
          }}
        >
          <Clock size={12} color="#D97706" />
          <span>Đang xác thực</span>
        </span>
      );
  }
};

AuditStatusBadge.propTypes = {
  status: PropTypes.string,
};

export default AuditStatusBadge;
