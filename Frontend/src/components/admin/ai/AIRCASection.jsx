import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  GitFork, 
  Layers, 
  ShieldCheck, 
  FileText, 
  Sparkles, 
  Clock, 
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw
} from 'lucide-react';
import AIEmptyState from './AIEmptyState';

/**
 * AIRCASection Component
 * Hiển thị các bản phân tích nguyên nhân gốc rễ (rca_analyses)
 * kết hợp bằng chứng telemetry eBPF (rca_evidences) và hành động tự phục hồi đề xuất (ai_recommendations)
 * Tuân thủ hệ màu chuẩn Slate/Mint/Emerald dashboard và không dùng Tailwind thô.
 */
const AIRCASection = ({ analyses = [], loading = false, isLoading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRcaId, setExpandedRcaId] = useState(analyses[0]?.id || null);

  const isBusy = isLoading !== undefined ? isLoading : loading;

  const filteredAnalyses = analyses.filter((rca) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (rca.id || '').toLowerCase().includes(term) ||
      (rca.incidentId || '').toLowerCase().includes(term) ||
      (rca.rootCauseSummary || '').toLowerCase().includes(term)
    );
  });

  const toggleExpand = (id) => {
    setExpandedRcaId((prev) => (prev === id ? null : id));
  };

  if (isBusy) {
    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '16px',
          padding: '60px 24px',
          textAlign: 'center',
          boxShadow: 'var(--dash-shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <RefreshCw size={28} style={{ color: '#059669', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dash-text-secondary)', margin: 0 }}>
          Đang truy xuất đồ thị nhân quả và bằng chứng viễn trắc RCA...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Header & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          padding: '14px 18px',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: '460px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--dash-text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Tìm theo mã RCA, mã sự cố, nguyên nhân..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              fontSize: '0.8125rem',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#F8FAFC',
              color: 'var(--dash-text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#059669';
              e.target.style.backgroundColor = '#FFFFFF';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--dash-border)';
              e.target.style.backgroundColor = '#F8FAFC';
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--dash-text-secondary)',
              backgroundColor: '#F1F5F9',
              padding: '4px 10px',
              borderRadius: '6px',
            }}
          >
            Số lượng RCA: <strong style={{ color: 'var(--dash-text-primary)' }}>{filteredAnalyses.length}</strong>
          </span>

          {onRefresh && (
            <button
              onClick={onRefresh}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
            >
              <RefreshCw size={13} style={{ color: '#059669' }} />
              <span>Làm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Empty State or RCA Cards */}
      {filteredAnalyses.length === 0 ? (
        <AIEmptyState
          title="Không tìm thấy bản ghi phân tích RCA"
          description="Hiện tại không có bản ghi phân tích nguyên nhân gốc rễ nào thỏa mãn tiêu chí tìm kiếm hoặc chưa có sự cố kích hoạt suy luận."
          onAction={searchTerm ? () => setSearchTerm('') : onRefresh}
          actionLabel={searchTerm ? 'Xóa bộ lọc tìm kiếm' : 'Tải lại dữ liệu'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredAnalyses.map((rca) => {
            const isExpanded = expandedRcaId === rca.id;

            return (
              <div
                key={rca.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: isExpanded ? '1px solid #10B981' : '1px solid var(--dash-border)',
                  borderRadius: '14px',
                  boxShadow: isExpanded ? '0 4px 14px rgba(5, 150, 105, 0.08)' : 'var(--dash-shadow-xs)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* RCA Main Card Header */}
                <div
                  onClick={() => toggleExpand(rca.id)}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: isExpanded ? '#F8FAFC' : '#FFFFFF',
                    borderBottom: isExpanded ? '1px solid var(--dash-border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Badge Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '0.8125rem',
                          fontWeight: 800,
                          color: '#059669',
                          backgroundColor: '#ECFDF5',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #A7F3D0',
                        }}
                      >
                        {rca.id}
                      </span>

                      {rca.incidentId && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            color: '#B45309',
                            backgroundColor: '#FEF3C7',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #FDE68A',
                          }}
                        >
                          Gốc sự cố: {rca.incidentId}
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: '#065F46',
                          backgroundColor: '#D1FAE5',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #A7F3D0',
                        }}
                      >
                        Độ tin cậy: {rca.confidence}
                      </span>

                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--dash-text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Clock size={12} />
                        {rca.analyzedAt}
                      </span>
                    </div>

                    {/* Summary Title */}
                    <h3
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        color: 'var(--dash-text-primary)',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {rca.rootCauseSummary}
                    </h3>
                  </div>

                  {/* Right metadata badge & Chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.75rem',
                        color: 'var(--dash-text-secondary)',
                        backgroundColor: '#FFFFFF',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--dash-border)',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                        title="Số lượng nút đồ thị nhân quả"
                      >
                        <Layers size={14} style={{ color: '#6366F1' }} />
                        <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                          {rca.causalGraphNodesCount} nút (nodes)
                        </span>
                      </div>
                      <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--dash-border)' }} />
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                        title="Số lượng cạnh phụ thuộc quan sát"
                      >
                        <GitFork size={14} style={{ color: '#059669' }} />
                        <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                          {rca.causalGraphEdgesCount} cạnh (edges)
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: isExpanded ? '#E2E8F0' : '#F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--dash-text-secondary)',
                      }}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details: rca_evidences & ai_recommendations */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      backgroundColor: '#FAFAFA',
                    }}
                  >
                    {/* Bằng chứng nhân quả (rca_evidences) */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px',
                        }}
                      >
                        <FileText size={16} style={{ color: '#059669' }} />
                        <h4
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--dash-text-primary)',
                            margin: 0,
                          }}
                        >
                          Bằng chứng quan sát eBPF / Logs / Metrics (rca_evidences)
                        </h4>
                      </div>

                      {rca.evidences && rca.evidences.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {rca.evidences.map((ev) => (
                            <div
                              key={ev.id}
                              style={{
                                padding: '14px',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '10px',
                                border: '1px solid var(--dash-border)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '8px',
                                  marginBottom: '8px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: '#EFF6FF',
                                      color: '#1D4ED8',
                                      fontWeight: 700,
                                      fontSize: '0.6875rem',
                                      border: '1px solid #BFDBFE',
                                    }}
                                  >
                                    {ev.evidenceType}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '0.8125rem',
                                      fontWeight: 600,
                                      color: 'var(--dash-text-primary)',
                                    }}
                                  >
                                    Nguồn: {ev.evidenceSource}
                                  </span>
                                </div>

                                <span
                                  style={{
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    color: '#065F46',
                                    backgroundColor: '#ECFDF5',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #A7F3D0',
                                  }}
                                >
                                  Đóng góp trọng số: {ev.confidenceContribution}
                                </span>
                              </div>

                              <div
                                style={{
                                  backgroundColor: '#0F172A',
                                  color: '#E2E8F0',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  fontFamily: 'var(--font-mono, monospace)',
                                  fontSize: '0.75rem',
                                  lineHeight: 1.5,
                                  overflowX: 'auto',
                                  border: '1px solid #1E293B',
                                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
                                }}
                              >
                                {ev.snippet}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontStyle: 'italic', margin: 0 }}>
                          Chưa có trích xuất bằng chứng chi tiết.
                        </p>
                      )}
                    </div>

                    {/* Khuyến nghị tự khắc phục (ai_recommendations) */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px',
                        }}
                      >
                        <Sparkles size={16} style={{ color: '#D97706' }} />
                        <h4
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--dash-text-primary)',
                            margin: 0,
                          }}
                        >
                          Khuyến nghị tự phục hồi tự động đề xuất (ai_recommendations)
                        </h4>
                      </div>

                      {rca.recommendations && rca.recommendations.length > 0 ? (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                            gap: '12px',
                          }}
                        >
                          {rca.recommendations.map((rec) => (
                            <div
                              key={rec.id}
                              style={{
                                padding: '14px',
                                borderRadius: '12px',
                                border: '1px solid var(--dash-border)',
                                backgroundColor: '#FFFFFF',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                                  {rec.actionType}
                                </span>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    borderRadius: '9999px',
                                    backgroundColor: '#ECFDF5',
                                    color: '#059669',
                                    border: '1px solid #A7F3D0',
                                  }}
                                >
                                  Tác động: {rec.impactScore}/100
                                </span>
                              </div>

                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--dash-text-secondary)',
                                  fontFamily: 'var(--font-mono, monospace)',
                                  backgroundColor: '#F8FAFC',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #E2E8F0',
                                }}
                              >
                                {rec.suggestedParameters}
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.6875rem',
                                  color: 'var(--dash-text-muted)',
                                  paddingTop: '6px',
                                  borderTop: '1px solid #F1F5F9',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <ShieldCheck size={14} style={{ color: '#059669' }} />
                                  Cấp độ: {rec.safetyTier}
                                </span>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: rec.status === 'APPLIED' ? '#059669' : '#2563EB',
                                    backgroundColor: rec.status === 'APPLIED' ? '#ECFDF5' : '#EFF6FF',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {rec.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontStyle: 'italic', margin: 0 }}>
                          Không có hành động khuyến nghị đính kèm.
                        </p>
                      )}
                    </div>
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

AIRCASection.propTypes = {
  analyses: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  isLoading: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default AIRCASection;
