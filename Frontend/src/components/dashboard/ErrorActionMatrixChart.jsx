import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../i18n';
import { Grid, ShieldCheck } from 'lucide-react';

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
  const { t, i18n } = useTranslation('dashAdmin');
  const intlLocale = getIntlLocale(i18n.language);

  const { incidentTypes, actionCodes, lookup } = useMemo(() => {
    const incTotals = new Map();
    const actTotals = new Map();
    const cellMap = new Map();

    (matrix || []).forEach((item) => {
      const inc = item.incidentType || 'OTHER';
      const act = item.actionCode || 'UNKNOWN';
      const totalVal = Number(item.total) || 0;
      incTotals.set(inc, (incTotals.get(inc) || 0) + totalVal);
      actTotals.set(act, (actTotals.get(act) || 0) + totalVal);
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
              {t('charts.errorMatrix.title')}
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '4px 0 0 0' }}>
            {t('charts.errorMatrix.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.6875rem', fontWeight: 700 }}>
          <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>
            {t('charts.errorMatrix.legendHigh')}
          </span>
          <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>
            {t('charts.errorMatrix.legendMid')}
          </span>
          <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
            {t('charts.errorMatrix.legendLow')}
          </span>
        </div>
      </div>

      {incidentTypes.length === 0 || actionCodes.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '10px', color: '#64748B', fontSize: '0.8125rem' }}>
          {t('charts.errorMatrix.empty')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px', fontSize: '0.75rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569', fontWeight: 800, minWidth: '150px' }}>
                  {t('charts.errorMatrix.cornerHeader')}
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
                      {t(`charts.errorMatrix.actionCodes.${act}`, { defaultValue: act })}
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
                      {t(`charts.errorMatrix.incidentTypes.${inc}`, { defaultValue: inc })}
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
                              ? t('charts.errorMatrix.cellTooltip', {
                                  inc,
                                  act,
                                  ok: cell.succeeded,
                                  failed: cell.failed,
                                  cancelled: cell.cancelled,
                                })
                              : t('charts.errorMatrix.cellEmptyTooltip')
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
                                  {cell.total.toLocaleString(intlLocale)}
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
        <span>{t('charts.errorMatrix.footerLegend')}</span>
      </div>
    </div>
  );
};

export default ErrorActionMatrixChart;
