import React, { useState } from 'react';
import { Sliders, ShieldCheck, Check, X } from 'lucide-react';
import ExecutionModeBadge from './ExecutionModeBadge';
import PolicyConfigModal from './PolicyConfigModal';

export const PoliciesTable = ({
  policies = [],
  isLoading = false,
  onToggleActive,
  onUpdateConfig,
}) => {
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenConfig = (policy) => {
    setSelectedPolicy(policy);
    setIsModalOpen(true);
  };

  const handleCloseConfig = () => {
    setIsModalOpen(false);
    setSelectedPolicy(null);
  };

  const handleSaveConfig = (id, newConfig) => {
    if (onUpdateConfig) {
      onUpdateConfig(id, newConfig);
    }
  };

  if (isLoading) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Đang tải danh sách chính sách tự phục hồi...
      </div>
    );
  }

  if (!policies || policies.length === 0) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px dashed var(--dash-border)',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Không tìm thấy chính sách nào.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Information Header Box */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={18} style={{ color: '#059669', flexShrink: 0 }} />
          <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5 }}>
            <strong>Quản Trị Cấu Hình Chính Sách:</strong> Quản trị viên chỉ cấu hình các ngưỡng giám sát, giới hạn số lần thử lại và thời gian hạ nhiệt. <strong>Tuyệt đối không thực thi các lệnh Kubernetes tùy ý từ giao diện này</strong>.
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div
        className="dash-table-container"
        style={{
          border: '1px solid var(--dash-border)',
          borderRadius: '14px',
          overflowX: 'auto',
          boxShadow: 'var(--dash-shadow-xs)',
          backgroundColor: '#FFFFFF',
        }}
      >
        <table className="dash-table" style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                background: 'linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 100%)',
                borderBottom: '1px solid #BBF7D0',
                color: '#166534',
                textAlign: 'left',
              }}
            >
              <th style={{ minWidth: '220px', padding: '12px 14px', fontWeight: 700 }}>Tên Chính Sách (Name)</th>
              <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 700 }}>Tín Hiệu Kích Hoạt (Trigger Type)</th>
              <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Phân Loại Rủi Ro (Risk Type)</th>
              <th style={{ minWidth: '150px', padding: '12px 14px', fontWeight: 700 }}>Chế Độ Thực Thi (Execution Mode)</th>
              <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Ngưỡng Tin Cậy (Confidence)</th>
              <th style={{ minWidth: '110px', padding: '12px 14px', fontWeight: 700 }}>Hạ Nhiệt (Cooldown)</th>
              <th style={{ minWidth: '110px', padding: '12px 14px', fontWeight: 700 }}>Thử Lại (Max Retries)</th>
              <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 700 }}>Quy Định Phê Duyệt (Approval Req)</th>
              <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700, textAlign: 'center' }}>Trạng Thái (Active)</th>
              <th style={{ minWidth: '110px', padding: '12px 14px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((pol, idx) => (
              <tr
                key={pol.id}
                style={{
                  borderBottom: '1px solid var(--dash-border)',
                  backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                  transition: 'background-color 0.15s ease',
                  opacity: pol.activeStatus ? 1 : 0.65,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
              >
                {/* 1. Name */}
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{pol.name}</div>
                  <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                    {pol.id}
                  </div>
                </td>

                {/* 2. Trigger Type */}
                <td style={{ padding: '12px 14px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                  {pol.triggerType}
                </td>

                {/* 3. Risk Type */}
                <td style={{ padding: '12px 14px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      backgroundColor:
                        pol.riskType === 'Non-Destructive'
                          ? '#ECFDF5'
                          : pol.riskType === 'State-Preserving'
                          ? '#FEF3C7'
                          : '#FEF2F2',
                      color:
                        pol.riskType === 'Non-Destructive'
                          ? '#065F46'
                          : pol.riskType === 'State-Preserving'
                          ? '#92400E'
                          : '#DC2626',
                      border: `1px solid ${
                        pol.riskType === 'Non-Destructive'
                          ? '#A7F3D0'
                          : pol.riskType === 'State-Preserving'
                          ? '#FDE68A'
                          : '#FECACA'
                      }`,
                    }}
                  >
                    {pol.riskType}
                  </span>
                </td>

                {/* 4. Execution Mode */}
                <td style={{ padding: '12px 14px' }}>
                  <ExecutionModeBadge mode={pol.executionMode} />
                </td>

                {/* 5. Confidence Threshold */}
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#059669', fontSize: '0.8125rem' }}>
                    &ge; {pol.confidenceThreshold}%
                  </span>
                </td>

                {/* 6. Cooldown */}
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-secondary)' }}>
                  {pol.cooldown}
                </td>

                {/* 7. Max Retries */}
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-secondary)' }}>
                  {pol.maxRetries} lần
                </td>

                {/* 8. Approval Requirement */}
                <td style={{ padding: '12px 14px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                  {pol.approvalRequirement}
                </td>

                {/* 9. Active Status */}
                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onToggleActive && onToggleActive(pol.id)}
                    aria-label={`Chuyển trạng thái chính sách ${pol.name}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      border: `1px solid ${pol.activeStatus ? '#A7F3D0' : '#E2E8F0'}`,
                      backgroundColor: pol.activeStatus ? '#ECFDF5' : '#F1F5F9',
                      color: pol.activeStatus ? '#065F46' : '#64748B',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {pol.activeStatus ? <Check size={11} /> : <X size={11} />}
                    <span>{pol.activeStatus ? 'Đang Bật' : 'Đã Tắt'}</span>
                  </button>
                </td>

                {/* Actions */}
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenConfig(pol)}
                    aria-label={`Cấu hình chính sách ${pol.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--dash-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--dash-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--dash-primary-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--dash-border)';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                  >
                    <Sliders size={12} />
                    <span>Cấu Hình</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Config Modal */}
      {selectedPolicy && (
        <PolicyConfigModal
          policy={selectedPolicy}
          isOpen={isModalOpen}
          onClose={handleCloseConfig}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  );
};

export default PoliciesTable;
