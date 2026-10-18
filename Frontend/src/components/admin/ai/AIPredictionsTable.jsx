import React, { useState } from 'react';
import { Sparkles, Terminal, AlertTriangle, CheckCircle2, RotateCcw, Search, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import AIEmptyState from './AIEmptyState';

export const AIPredictionsTable = ({
  predictions = [],
  isLoading = false,
  onResetFilters,
}) => {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);

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
        Đang tải nhật ký dự báo dị thường AI...
      </div>
    );
  }

  const filteredPredictions = predictions.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.id.toLowerCase().includes(q) ||
      p.targetResource.toLowerCase().includes(q) ||
      p.predictionType.toLowerCase().includes(q) ||
      p.modelName.toLowerCase().includes(q);

    const matchRisk = riskFilter === 'ALL' || p.riskLevel === riskFilter;
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchSearch && matchRisk && matchStatus;
  });

  const handleReset = () => {
    setSearch('');
    setRiskFilter('ALL');
    setStatusFilter('ALL');
    if (onResetFilters) onResetFilters();
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderRiskBadge = (level) => {
    const isCritical = level === 'CRITICAL';
    const isHigh = level === 'HIGH';
    const isMed = level === 'MEDIUM';

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontWeight: 700,
          fontSize: '0.6875rem',
          backgroundColor: isCritical || isHigh ? '#FEF2F2' : isMed ? '#FFFBEB' : '#ECFDF5',
          color: isCritical || isHigh ? '#DC2626' : isMed ? '#D97706' : '#065F46',
          border: `1px solid ${isCritical || isHigh ? '#FECACA' : isMed ? '#FDE68A' : '#A7F3D0'}`,
        }}
      >
        {isCritical || isHigh ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
        {level}
      </span>
    );
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'TRIGGERED':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            Đã Kích Hoạt (Triggered)
          </span>
        );
      case 'VERIFIED':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            Đã Kiểm Chứng (Verified)
          </span>
        );
      case 'FALSE_ALARM':
      default:
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#F1F5F9',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              fontWeight: 600,
              fontSize: '0.6875rem',
            }}
          >
            Báo Động Sai (False Alarm)
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Search and Filters */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <input
            type="text"
            placeholder="Tìm tài nguyên K8s, loại dự báo, mô hình..."
            aria-label="Tìm kiếm dự báo dị thường"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              fontSize: '0.8125rem',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              outline: 'none',
            }}
          />
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--dash-text-muted)',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            aria-label="Lọc theo mức độ rủi ro dự báo"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Tất cả mức rủi ro</option>
            <option value="HIGH">HIGH (Rủi ro cao)</option>
            <option value="MEDIUM">MEDIUM (Trung bình)</option>
            <option value="LOW">LOW (Thấp)</option>
          </select>

          <select
            aria-label="Lọc theo trạng thái dự báo"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="TRIGGERED">Đã Kích Hoạt</option>
            <option value="VERIFIED">Đã Kiểm Chứng</option>
            <option value="FALSE_ALARM">Báo Động Sai</option>
          </select>

          {(search || riskFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Đặt lại bộ lọc dự báo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredPredictions.length === 0 ? (
        <AIEmptyState
          title="Không Có Dự Báo Dị Thường Phù Hợp"
          description="Hiện tại không có sự kiện suy luận dự báo nào khớp với tiêu chí tìm kiếm hoặc toàn bộ cụm K8s đang vận hành ổn định trong baseline."
          onAction={handleReset}
          actionText="Xóa bộ lọc"
        />
      ) : (
        /* Table of Predictions */
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
                <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Mã Dự Báo (ID)</th>
                <th style={{ minWidth: '220px', padding: '12px 14px', fontWeight: 700 }}>Tài Nguyên Đích (Target)</th>
                <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 700 }}>Nguy Cơ Dự Báo (Type)</th>
                <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 700 }}>Mô Hình Thực Thi (Model)</th>
                <th style={{ minWidth: '120px', padding: '12px 14px', fontWeight: 700 }}>Độ Tin Cậy</th>
                <th style={{ minWidth: '110px', padding: '12px 14px', fontWeight: 700 }}>Mức Rủi Ro</th>
                <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Trạng Thái</th>
                <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Khung Thời Gian</th>
                <th style={{ minWidth: '90px', padding: '12px 14px', fontWeight: 700, textAlign: 'right' }}>Chi Tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredPredictions.map((pred, idx) => {
                const isExpanded = expandedId === pred.id;

                return (
                  <React.Fragment key={pred.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--dash-border)',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                    >
                      {/* ID */}
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={13} style={{ color: '#059669' }} />
                          <span>{pred.id}</span>
                        </div>
                      </td>

                      {/* Target */}
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Terminal size={13} style={{ color: 'var(--dash-text-muted)' }} />
                          <span>{pred.targetResource}</span>
                        </div>
                      </td>

                      {/* Prediction Type */}
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#991B1B' }}>
                        {pred.predictionType}
                      </td>

                      {/* Model */}
                      <td style={{ padding: '12px 14px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                        {pred.modelName}
                      </td>

                      {/* Confidence */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#059669' }}>
                          {(pred.confidenceScore * 100).toFixed(1)}%
                        </span>
                      </td>

                      {/* Risk */}
                      <td style={{ padding: '12px 14px' }}>
                        {renderRiskBadge(pred.riskLevel)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        {renderStatusBadge(pred.status)}
                      </td>

                      {/* Horizon */}
                      <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                        {pred.predictedTimeHorizon}
                      </td>

                      {/* Expand Button */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(pred.id)}
                          aria-label={`Xem vector đặc trưng ${pred.id}`}
                          style={{
                            background: 'none',
                            border: '1px solid var(--dash-border)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: 'var(--dash-text-secondary)',
                          }}
                        >
                          <span>{isExpanded ? 'Thu gọn' : 'Đặc trưng'}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Drawer: Prediction Inputs Vector (prediction_inputs) */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: '#F8FAFC' }}>
                        <td colSpan={9} style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>Vector Đặc Trưng Suy Diễn (prediction_inputs):</span>
                            </div>

                            {/* Inputs Table */}
                            {pred.inputs && pred.inputs.length > 0 ? (
                              <div style={{ border: '1px solid var(--dash-border)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-secondary)' }}>
                                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tên Đặc Trưng (Feature Name)</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Giá Trị Ghi Nhận</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tiêu Chuẩn (Baseline)</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Trọng Số Dị Thường</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pred.inputs.map((inp) => (
                                      <tr key={inp.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                                          {inp.featureName}
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#DC2626' }}>
                                          {inp.featureValue}
                                        </td>
                                        <td style={{ padding: '8px 12px', color: 'var(--dash-text-muted)' }}>
                                          {inp.baselineValue}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                                          {(inp.anomalyWeight * 100).toFixed(0)}%
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                                Không có chi tiết vector đầu vào cho dự báo này.
                              </div>
                            )}

                            {/* Recommendations if present */}
                            {pred.recommendations && pred.recommendations.length > 0 && (
                              <div style={{ marginTop: '4px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Zap size={13} /> Khuyến Nghị Tự Lành Đề Xuất (ai_recommendations):
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {pred.recommendations.map((rec) => (
                                    <div
                                      key={rec.id}
                                      style={{
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        backgroundColor: '#ECFDF5',
                                        border: '1px solid #A7F3D0',
                                        fontSize: '0.75rem',
                                        color: '#065F46',
                                      }}
                                    >
                                      <strong>{rec.actionType}:</strong> {rec.suggestedParameters} ({rec.safetyTier})
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AIPredictionsTable;
