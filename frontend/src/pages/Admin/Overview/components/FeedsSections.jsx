import React from 'react';
import { History, ArrowRight } from 'lucide-react';
import WidgetContainer from '../../../../components/admin/WidgetContainer';

/**
 * Section 11: Critical Incident Feed
 */
export const CriticalIncidentFeedSection = ({ incidents, status, errorMessage, onRetry, onNavigate }) => {
  return (
    <WidgetContainer
      title="Bảng Theo Dõi Sự Cố Nghiêm Trọng (Critical Incident Feed)"
      subtitle="Danh sách các biến cố ảnh hưởng dịch vụ đang được điều tra hoặc vừa tự khắc phục"
      status={status}
      emptyMessage="Không có sự cố nghiêm trọng nào được ghi nhận trong phạm vi này."
      errorMessage={errorMessage}
      onRetry={onRetry}
      action={
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('/admin/incidents')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--dash-primary)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>Xem tất cả sự cố</span>
          <ArrowRight size={13} />
        </button>
      }
    >
      {incidents && incidents.length > 0 && (
        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table className="dash-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Mã Sự Cố</th>
                <th style={{ width: '150px' }}>Dịch Vụ / Cụm</th>
                <th style={{ width: '100px' }}>Mức Độ</th>
                <th>Tiêu Đề & Nguyên Nhân Tóm Tắt</th>
                <th style={{ width: '100px' }}>Thời Gian</th>
                <th style={{ width: '160px', textAlign: 'right' }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{inc.id}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{inc.service}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>{inc.cluster}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        backgroundColor: inc.severity === 'CRITICAL' ? '#FEF2F2' : '#FFFBEB',
                        color: inc.severity === 'CRITICAL' ? '#DC2626' : '#D97706',
                      }}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td style={{ color: 'var(--dash-text-secondary)', lineHeight: 1.4 }}>{inc.title}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>
                    {inc.duration}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        backgroundColor: inc.statusColor === '#059669' ? '#ECFDF5' : '#FEF2F2',
                        color: inc.statusColor,
                        border: `1px solid ${inc.statusColor}33`,
                      }}
                    >
                      {inc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetContainer>
  );
};

/**
 * Section 12: Recent Activity
 */
export const RecentActivitySection = ({ activities, status, errorMessage, onRetry, onNavigate }) => {
  return (
    <WidgetContainer
      title="Dòng Hoạt Động & Kiểm Toán Gần Nhất (Recent Activity & Audit Stream)"
      subtitle="Nhật ký các thao tác tự phục hồi, phê duyệt của quản trị viên và đối soát chữ ký băm"
      status={status}
      emptyMessage="Không có hoạt động nào được ghi nhận gần đây."
      errorMessage={errorMessage}
      onRetry={onRetry}
      action={
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('/admin/audit-logs')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--dash-primary)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>Xem sổ cái kiểm toán</span>
          <ArrowRight size={13} />
        </button>
      }
    >
      {activities && activities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activities.map((act) => (
            <div
              key={act.id}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: 'var(--dash-shadow-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: act.status === 'SUCCESS' ? '#ECFDF5' : '#EFF6FF',
                    color: act.status === 'SUCCESS' ? '#059669' : '#0284C7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <History size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    {act.action}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                    Thực hiện bởi: <strong style={{ color: 'var(--dash-text-primary)' }}>{act.actor}</strong> &bull; Mục tiêu: <span style={{ fontFamily: 'var(--font-mono)' }}>{act.target}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                  }}
                >
                  {act.hash}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {act.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetContainer>
  );
};
