import React, { useState, useMemo } from 'react';
import { AlertOctagon, Filter, XCircle, Ban } from 'lucide-react';

/**
 * Biểu đồ 6: ActionFailureReasonsChart
 * Top nguyên nhân Action Thất bại (FAILED) và Bị hủy (CANCELLED) đã chuẩn hóa.
 */
export const ActionFailureReasonsChart = ({
  failureReasons = [],
  onSelectStatusReason = null,
  className = '',
}) => {
  const [tab, setTab] = useState('ALL'); // 'ALL' | 'FAILED' | 'CANCELLED'

  const filtered = useMemo(() => {
    const list = Array.isArray(failureReasons) ? failureReasons : [];
    if (tab === 'ALL') return list;
    return list.filter((item) => item.status === tab);
  }, [failureReasons, tab]);

  const maxCount = useMemo(() => {
    if (filtered.length === 0) return 1;
    return Math.max(...filtered.map((r) => Number(r.count) || 0), 1);
  }, [filtered]);

  const countsByStatus = useMemo(() => {
    const failed = (failureReasons || []).filter((r) => r.status === 'FAILED').reduce((s, r) => s + (r.count || 0), 0);
    const cancelled = (failureReasons || []).filter((r) => r.status === 'CANCELLED').reduce((s, r) => s + (r.count || 0), 0);
    return { failed, cancelled, total: failed + cancelled };
  }, [failureReasons]);

  return (
    <div
      className={`dash-card ${className}`}
      style={{
        padding: '22px 24px',
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={19} color="#DC2626" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Nguyên Nhân Action Thất Bại (FAILED) & Bị Hủy (CANCELLED)
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Phân tích nguyên nhân gốc khiến tác vụ tự phục hồi không thực thi được (404 Not Found, Agent Offline, 403 RBAC, HITL từ chối/quá hạn)
          </p>
        </div>

        {/* Status Tabs */}
        <div
          className="no-print"
          style={{
            display: 'inline-flex',
            backgroundColor: '#F1F5F9',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
          }}
        >
          {[
            { key: 'ALL', label: `Tất cả (${countsByStatus.total.toLocaleString('vi-VN')})` },
            { key: 'FAILED', label: `Thất bại (${countsByStatus.failed.toLocaleString('vi-VN')})` },
            { key: 'CANCELLED', label: `Bị hủy / HITL (${countsByStatus.cancelled.toLocaleString('vi-VN')})` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: '5px 10px',
                fontSize: '0.75rem',
                fontWeight: tab === t.key ? 700 : 500,
                backgroundColor: tab === t.key ? '#FFFFFF' : 'transparent',
                color: tab === t.key ? (t.key === 'FAILED' ? '#DC2626' : t.key === 'CANCELLED' ? '#D97706' : '#0F172A') : '#64748B',
                border: 'none',
                borderRadius: '6px',
                boxShadow: tab === t.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', backgroundColor: '#F0FDF4', borderRadius: '10px', color: '#065F46', fontSize: '0.8125rem', fontWeight: 600 }}>
          Không có bản ghi lỗi hoặc bị hủy nào thuộc nhóm đang chọn trong chu kỳ này.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((item, idx) => {
            const isFailed = item.status === 'FAILED';
            const barColor = isFailed ? '#EF4444' : '#F59E0B';
            const badgeBg = isFailed ? '#FEF2F2' : '#FFFBEB';
            const badgeBorder = isFailed ? '#FECACA' : '#FDE68A';
            const badgeText = isFailed ? '#DC2626' : '#B45309';
            const barPct = Math.max(5, ((Number(item.count) || 0) / maxCount) * 100);

            return (
              <div
                key={`${item.status}-${item.reasonCategory}-${idx}`}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        backgroundColor: badgeBg,
                        border: `1px solid ${badgeBorder}`,
                        color: badgeText,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {isFailed ? <XCircle size={11} /> : <Ban size={11} />}
                      <span>{item.status}</span>
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0F172A' }}>
                      {item.reasonCategory}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>
                      {Number(item.count).toLocaleString('vi-VN')} lần ({item.percentOfStatus}%)
                    </span>
                    {onSelectStatusReason && (
                      <button
                        type="button"
                        className="no-print"
                        onClick={() => onSelectStatusReason(item.status)}
                        title={`Lọc bảng truy vết theo trạng thái ${item.status}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: '#2563EB',
                          backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <Filter size={11} />
                        <span>Xem log</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${barPct}%`,
                      height: '100%',
                      backgroundColor: barColor,
                      borderRadius: '4px',
                      transition: 'width 0.35s ease',
                    }}
                  />
                </div>

                {item.sampleRawReason && (
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                    Mẫu chi tiết: {item.sampleRawReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionFailureReasonsChart;
