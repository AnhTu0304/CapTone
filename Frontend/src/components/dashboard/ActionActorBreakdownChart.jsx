import React, { useMemo } from 'react';
import { Users, Cpu, UserCheck, Clock, CheckCircle2, XCircle, Ban } from 'lucide-react';

/**
 * Biểu đồ 4: ActionActorBreakdownChart
 * Biểu đồ thanh ngang xếp chồng (Horizontal Stacked Bar) thống kê kết quả Action
 * theo từng đối tượng thực hiện / phê duyệt: AI MAPE-K vs Con người (Admin/DevOps) vs HITL Queue.
 */
export const ActionActorBreakdownChart = ({
  byActor = [],
  selectedActor = 'ALL',
  onSelectActor = null,
  className = '',
}) => {
  const maxTotal = useMemo(() => {
    if (!Array.isArray(byActor) || byActor.length === 0) return 1;
    return Math.max(...byActor.map((a) => Number(a.total) || 0), 1);
  }, [byActor]);

  const totals = useMemo(() => {
    return (byActor || []).reduce(
      (acc, item) => ({
        total: acc.total + (item.total || 0),
        succeeded: acc.succeeded + (item.succeeded || 0),
        failed: acc.failed + (item.failed || 0),
        cancelled: acc.cancelled + (item.cancelled || 0),
      }),
      { total: 0, succeeded: 0, failed: 0, cancelled: 0 }
    );
  }, [byActor]);

  const getActorBadge = (actorType, executionMode) => {
    if (actorType === 'AI') {
      return {
        label: 'AI Tự Trị (AUTO)',
        bg: '#EFF6FF',
        color: '#1D4ED8',
        border: '#BFDBFE',
        Icon: Cpu,
      };
    }
    if (actorType === 'HUMAN') {
      return {
        label: executionMode === 'MIXED' ? 'Con Người (Thủ công & HITL)' : 'Con Người (HITL / Manual)',
        bg: '#ECFDF5',
        color: '#047857',
        border: '#A7F3D0',
        Icon: UserCheck,
      };
    }
    return {
      label: 'Hàng Chờ HITL / Chưa Gán',
      bg: '#FFFBEB',
      color: '#B45309',
      border: '#FDE68A',
      Icon: Clock,
    };
  };

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={19} color="#2563EB" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Hiệu Suất Action Theo Đối Tượng Thực Thi (AI / Người Vận Hành)
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
            So sánh khối lượng xử lý, tỷ lệ thành công và thời lượng trung bình giữa AI MAPE-K và từng thành viên phê duyệt/thực thi (Nhấp vào dòng để lọc bảng truy vết)
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#047857', fontWeight: 600 }}>
            <CheckCircle2 size={13} color="#10B981" /> Thành công ({totals.succeeded.toLocaleString('vi-VN')})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#B91C1C', fontWeight: 600 }}>
            <XCircle size={13} color="#EF4444" /> Thất bại ({totals.failed.toLocaleString('vi-VN')})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#B45309', fontWeight: 600 }}>
            <Ban size={13} color="#F59E0B" /> Hủy / HITL ({totals.cancelled.toLocaleString('vi-VN')})
          </span>
        </div>
      </div>

      {/* Horizontal Stacked Bars */}
      {(!byActor || byActor.length === 0) ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '10px', color: '#64748B', fontSize: '0.8125rem' }}>
          Chưa ghi nhận hành động phục hồi nào trong chu kỳ đang chọn.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {byActor.map((actor) => {
            const total = Number(actor.total) || 0;
            const ok = Number(actor.succeeded) || 0;
            const fail = Number(actor.failed) || 0;
            const cancel = Number(actor.cancelled) || 0;
            const pending = Number(actor.pending) || 0;

            const scalePct = Math.max(4, (total / maxTotal) * 100);
            const okW = total > 0 ? (ok / total) * 100 : 0;
            const failW = total > 0 ? (fail / total) * 100 : 0;
            const cancelW = total > 0 ? (cancel / total) * 100 : 0;
            const pendingW = total > 0 ? (pending / total) * 100 : 0;

            const badge = getActorBadge(actor.actorType, actor.executionMode);
            const BadgeIcon = badge.Icon;
            const isSelected = selectedActor === actor.actorKey;

            return (
              <div
                key={actor.actorKey}
                onClick={() => onSelectActor && onSelectActor(isSelected ? 'ALL' : actor.actorKey)}
                role={onSelectActor ? 'button' : undefined}
                tabIndex={onSelectActor ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onSelectActor && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelectActor(isSelected ? 'ALL' : actor.actorKey);
                  }
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: isSelected ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                  backgroundColor: isSelected ? '#F0F9FF' : '#FFFFFF',
                  cursor: onSelectActor ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>
                      {actor.actorName}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        borderRadius: '999px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      <BadgeIcon size={11} />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                    <span style={{ color: '#047857', fontWeight: 700 }}>{ok.toLocaleString('vi-VN')} OK</span>
                    {fail > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>{fail.toLocaleString('vi-VN')} Lỗi</span>}
                    {cancel > 0 && <span style={{ color: '#D97706', fontWeight: 700 }}>{cancel.toLocaleString('vi-VN')} Hủy</span>}
                    <span style={{ color: '#475569' }}>| Tổng: <strong>{total.toLocaleString('vi-VN')}</strong></span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '6px',
                        backgroundColor: actor.successRate >= 85 ? '#ECFDF5' : actor.successRate >= 40 ? '#FEF3C7' : '#FEF2F2',
                        color: actor.successRate >= 85 ? '#059669' : actor.successRate >= 40 ? '#B45309' : '#DC2626',
                        fontWeight: 800,
                      }}
                    >
                      {actor.successRate}% đạt
                    </span>
                    {actor.avgDurationSeconds > 0 && (
                      <span style={{ color: '#64748B' }}>TB {actor.avgDurationSeconds}s</span>
                    )}
                  </div>
                </div>

                {/* Bar track */}
                <div style={{ width: '100%', height: '14px', backgroundColor: '#F1F5F9', borderRadius: '7px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${scalePct}%`,
                      height: '100%',
                      display: 'flex',
                      borderRadius: '7px',
                      overflow: 'hidden',
                      transition: 'width 0.35s ease',
                    }}
                  >
                    {okW > 0 && (
                      <div
                        title={`Thành công: ${ok.toLocaleString('vi-VN')}`}
                        style={{ width: `${okW}%`, height: '100%', backgroundColor: '#10B981' }}
                      />
                    )}
                    {failW > 0 && (
                      <div
                        title={`Thất bại: ${fail.toLocaleString('vi-VN')}`}
                        style={{ width: `${failW}%`, height: '100%', backgroundColor: '#EF4444' }}
                      />
                    )}
                    {cancelW > 0 && (
                      <div
                        title={`Hủy / Từ chối HITL: ${cancel.toLocaleString('vi-VN')}`}
                        style={{ width: `${cancelW}%`, height: '100%', backgroundColor: '#F59E0B' }}
                      />
                    )}
                    {pendingW > 0 && (
                      <div
                        title={`Đang chờ: ${pending.toLocaleString('vi-VN')}`}
                        style={{ width: `${pendingW}%`, height: '100%', backgroundColor: '#64748B' }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionActorBreakdownChart;
