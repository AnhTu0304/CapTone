import React, { useMemo } from 'react';
import { Grid, ShieldCheck } from 'lucide-react';

const INCIDENT_TYPE_LABELS = {
  CPU_OVERLOAD: 'Quá tải CPU',
  OOM: 'Tràn RAM (OOM)',
  HIGH_LATENCY: 'Độ trễ cao',
  HTTP_5XX_SPIKE: 'Lỗi HTTP 5XX',
  DISK_FULL: 'Đầy ổ đĩa (Disk)',
  TRAFFIC_OVERLOAD: 'Quá tải lưu lượng',
};

const ACTION_CODE_LABELS = {
  RESTART_POD: 'Khởi động lại Pod',
  REPLACE_POD: 'Thay thế Pod',
  SCALE_REPLICAS: 'Mở rộng Replicas',
  ROLLBACK_DEPLOYMENT: 'Rollback Phiên bản',
  CLEANUP_TEMP_FILES: 'Dọn File Tạm',
  BLOCK_IP_TEMP: 'Chặn IP Tạm Thời',
  DRAIN_NODE: 'Cô lập Node',
  NO_ACTION: 'Theo dõi (No Action)',
};

/**
 * Biểu đồ 5: ErrorActionMatrixChart
 * Ma trận Lỗi (Incident Type) x Loại Action Khắc Phục + Tỷ lệ Thành Công / Lỗi / Hủy.
 */
export const ErrorActionMatrixChart = ({
  matrix = [],
  selectedFilter = null,
  onSelectCell = null,
  className = '',
}) => {
  const { incidentTypes, actionCodes, lookup } = useMemo(() => {
    const incTotals = new Map();
    const actTotals = new Map();
    const cellMap = new Map();

    (matrix || []).forEach((item) => {
      const inc = item.incidentType || 'OTHER';
      const act = item.actionCode || 'UNKNOWN';
      const t = Number(item.total) || 0;
      incTotals.set(inc, (incTotals.get(inc) || 0) + t);
      actTotals.set(act, (actTotals.get(act) || 0) + t);
      cellMap.set(`${inc}::${act}`, item);
    });

    const sortedInc = Array.from(incTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    const sortedAct = Array.from(actTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);

    return { incidentTypes: sortedInc, actionCodes: sortedAct, lookup: cellMap };
  }, [matrix]);

  const getCellStyle = (cell) => {
    if (!cell || cell.total === 0) {
      return {
        bg: '#F8FAFC',
        border: '#E2E8F0',
        text: '#94A3B8',
        rateBg: '#F1F5F9',
        rateColor: '#94A3B8',
      };
    }
    const rate = Number(cell.successRate) || 0;
    if (rate >= 85) {
      return {
        bg: '#ECFDF5',
        border: '#A7F3D0',
        text: '#065F46',
        rateBg: '#10B981',
        rateColor: '#FFFFFF',
      };
    }
    if (rate >= 45) {
      return {
        bg: '#FFFBEB',
        border: '#FDE68A',
        text: '#92400E',
        rateBg: '#F59E0B',
        rateColor: '#FFFFFF',
      };
    }
    return {
      bg: '#FEF2F2',
      border: '#FECACA',
      text: '#991B1B',
      rateBg: '#EF4444',
      rateColor: '#FFFFFF',
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Grid size={19} color="#7C3AED" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Ma Trận Đối Chiếu Loại Sự Cố × Hành Động Khắc Phục
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Hiển thị sự cố nào được gắn với loại Action nào và tỷ lệ thực thi thành công của từng cặp (Nhấp vào ô để lọc bảng chi tiết)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.6875rem', fontWeight: 700 }}>
          <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>≥85% Đạt</span>
          <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>45–84%</span>
          <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>&lt;45% (Lỗi / Hủy nhiều)</span>
        </div>
      </div>

      {incidentTypes.length === 0 || actionCodes.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '10px', color: '#64748B', fontSize: '0.8125rem' }}>
          Chưa có dữ liệu ma trận Sự cố × Action trong chu kỳ hiện tại.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px', fontSize: '0.75rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569', fontWeight: 800, minWidth: '150px' }}>
                  Loại Lỗi \ Hành Động
                </th>
                {actionCodes.map((act) => (
                  <th
                    key={act}
                    style={{
                      textAlign: 'center',
                      padding: '8px 10px',
                      color: '#0F172A',
                      fontWeight: 700,
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      minWidth: '115px',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{act}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 500, marginTop: '2px' }}>
                      {ACTION_CODE_LABELS[act] || act}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidentTypes.map((inc) => (
                <tr key={inc}>
                  <td
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{inc}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 500 }}>
                      {INCIDENT_TYPE_LABELS[inc] || inc}
                    </div>
                  </td>

                  {actionCodes.map((act) => {
                    const cell = lookup.get(`${inc}::${act}`);
                    const st = getCellStyle(cell);
                    const isActive =
                      selectedFilter &&
                      selectedFilter.incidentType === inc &&
                      selectedFilter.actionCode === act;

                    return (
                      <td key={`${inc}-${act}`} style={{ padding: 0 }}>
                        <button
                          type="button"
                          className="print-keep-btn"
                          disabled={!cell || cell.total === 0}
                          onClick={() => {
                            if (cell && onSelectCell) {
                              onSelectCell(isActive ? { incidentType: 'ALL', actionCode: 'ALL' } : { incidentType: inc, actionCode: act });
                            }
                          }}
                          title={
                            cell
                              ? `${inc} -> ${act}: ${cell.succeeded} thành công, ${cell.failed} thất bại, ${cell.cancelled} hủy`
                              : 'Không phát sinh'
                          }
                          style={{
                            width: '100%',
                            minHeight: '58px',
                            padding: '8px',
                            borderRadius: '8px',
                            backgroundColor: st.bg,
                            border: isActive ? '2px solid #2563EB' : `1px solid ${st.border}`,
                            cursor: cell && cell.total > 0 && onSelectCell ? 'pointer' : 'default',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            transition: 'transform 0.12s ease',
                          }}
                        >
                          {!cell ? (
                            <span style={{ color: '#CBD5E1', fontWeight: 600 }}>—</span>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.875rem', color: st.text, fontFamily: 'var(--font-mono)' }}>
                                  {cell.total.toLocaleString('vi-VN')}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    backgroundColor: st.rateBg,
                                    color: st.rateColor,
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  {cell.successRate}%
                                </span>
                              </div>
                              <div style={{ fontSize: '0.625rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
                                {cell.succeeded}✓ {cell.failed > 0 ? `· ${cell.failed}✕` : ''}{' '}
                                {cell.cancelled > 0 ? `· ${cell.cancelled}⊘` : ''}
                              </div>
                            </>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: '#64748B' }}>
        <ShieldCheck size={13} color="#059669" />
        <span>Ký hiệu trong mỗi ô: Số tổng action · Tỷ lệ đạt (%) · Thành công (✓) / Thất bại (✕) / Bị hủy hoặc chờ HITL (⊘).</span>
      </div>
    </div>
  );
};

export default ErrorActionMatrixChart;
