import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Info, 
  Database, 
  Search,
  RefreshCw 
} from 'lucide-react';
import AIEmptyState from './AIEmptyState';

/**
 * AIPerformanceView Component
 * Bảng tổng hợp các chỉ số kiểm thử hiệu năng thuật toán AI:
 * - accuracy
 * - precision
 * - recall
 * - F1
 * - MAE/RMSE where applicable
 * - false positive rate
 * 
 * Cam kết kỹ thuật: Không tự ý bịa đặt chỉ số hiệu năng; mọi số liệu đều tham chiếu từ test dataset thẩm định thực tế.
 * Không sử dụng Tailwind thô, đồng bộ với hệ thống Slate/Mint dashboard.
 */
const AIPerformanceView = ({ metrics = [], loading = false, isLoading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const isBusy = isLoading !== undefined ? isLoading : loading;

  const filteredMetrics = metrics.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.modelName || item.name || '').toLowerCase().includes(term) ||
      (item.modelType || '').toLowerCase().includes(term) ||
      (item.dataset || '').toLowerCase().includes(term)
    );
  });

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
          Đang tổng hợp ma trận chỉ số kiểm thử mô hình...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Integrity & Compliance Disclaimer Banner */}
      <div
        style={{
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(37, 99, 235, 0.05)',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#DBEAFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1D4ED8',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Info size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h4
            style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 800,
              color: '#1E3A8A',
            }}
          >
            Nguyên tắc minh bạch & Xác thực mô hình (Model Verification Policy)
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              lineHeight: 1.6,
              color: '#1D4ED8',
            }}
          >
            Các chỉ số hiệu năng (Accuracy, Precision, Recall, F1, MAE/RMSE, False Positive Rate) được tính toán trực tiếp từ các tập kiểm thử kiểm chuẩn (holdout test splits) và telemetry thực địa. Hệ thống nghiêm cấm việc tự suy đoán hoặc nâng khống chỉ số hiệu năng (No fabricated claims).
          </p>
        </div>
      </div>

      {/* 2. Filter and Summary Bar */}
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
            placeholder="Tìm theo tên mô hình, phân loại, tập dữ liệu..."
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
            Số mô hình kiểm chuẩn: <strong style={{ color: 'var(--dash-text-primary)' }}>{filteredMetrics.length}</strong>
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
              <span>Tải lại</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Table or Empty State */}
      {filteredMetrics.length === 0 ? (
        <AIEmptyState
          title="Không có dữ liệu hiệu năng mô hình"
          description="Chưa có bản ghi đánh giá hoặc kiểm chuẩn nào khớp với điều kiện tìm kiếm hiện tại."
          onAction={searchTerm ? () => setSearchTerm('') : onRefresh}
          actionLabel={searchTerm ? 'Xóa bộ lọc tìm kiếm' : 'Tải lại dữ liệu'}
        />
      ) : (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid var(--dash-border)',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--dash-text-muted)',
                  }}
                >
                  <th style={{ padding: '14px 18px' }}>Mô hình AI</th>
                  <th style={{ padding: '14px 16px' }}>Tập dữ liệu kiểm chuẩn</th>
                  <th style={{ padding: '14px 14px', textAlign: 'right' }}>Accuracy</th>
                  <th style={{ padding: '14px 14px', textAlign: 'right' }}>Precision</th>
                  <th style={{ padding: '14px 14px', textAlign: 'right' }}>Recall</th>
                  <th style={{ padding: '14px 14px', textAlign: 'right' }}>F1 Score</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>MAE / RMSE</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>False Positive (FPR)</th>
                </tr>
              </thead>
              <tbody>
                {filteredMetrics.map((item, idx) => {
                  const displayName = item.modelName || item.name;
                  const isRegression = item.mae && !item.mae.includes('N/A');

                  return (
                    <tr
                      key={item.modelId || idx}
                      style={{
                        borderBottom: idx === filteredMetrics.length - 1 ? 'none' : '1px solid #F1F5F9',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }}
                    >
                      {/* Mô hình */}
                      <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', fontSize: '0.875rem' }}>
                          {displayName}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--dash-text-muted)',
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{item.modelType}</span>
                          <span>•</span>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '0.6875rem',
                              color: '#64748B',
                              backgroundColor: '#F1F5F9',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {item.modelId}
                          </span>
                        </div>
                      </td>

                      {/* Dataset */}
                      <td style={{ padding: '16px 16px', maxWidth: '240px', verticalAlign: 'middle' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.75rem',
                            color: 'var(--dash-text-secondary)',
                          }}
                        >
                          <Database size={13} style={{ color: '#6366F1', flexShrink: 0 }} />
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={item.dataset}
                          >
                            {item.dataset}
                          </span>
                        </div>
                      </td>

                      {/* Accuracy */}
                      <td style={{ padding: '16px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#ECFDF5',
                            color: '#059669',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            border: '1px solid #A7F3D0',
                          }}
                        >
                          {item.accuracy}
                        </span>
                      </td>

                      {/* Precision */}
                      <td
                        style={{
                          padding: '16px 14px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: 'var(--dash-text-primary)',
                          fontFamily: 'var(--font-mono, monospace)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {item.precision}
                      </td>

                      {/* Recall */}
                      <td
                        style={{
                          padding: '16px 14px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: 'var(--dash-text-primary)',
                          fontFamily: 'var(--font-mono, monospace)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {item.recall}
                      </td>

                      {/* F1 */}
                      <td
                        style={{
                          padding: '16px 14px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: '#059669',
                          fontFamily: 'var(--font-mono, monospace)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {item.f1}
                      </td>

                      {/* MAE/RMSE */}
                      <td style={{ padding: '16px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                        {isRegression ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-primary)', fontWeight: 600 }}>
                              MAE: <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{item.mae}</span>
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                              RMSE: <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{item.rmse}</span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontStyle: 'italic' }}>
                            {item.mae || 'N/A'}
                          </span>
                        )}
                      </td>

                      {/* False Positive Rate */}
                      <td style={{ padding: '16px 18px', textAlign: 'right', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono, monospace)',
                            backgroundColor: '#F0FDF4',
                            color: '#166534',
                            border: '1px solid #BBF7D0',
                          }}
                        >
                          {item.falsePositiveRate}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

AIPerformanceView.propTypes = {
  metrics: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  isLoading: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default AIPerformanceView;
