import React, { useState } from 'react';
import { Box, Filter, Search, RotateCcw, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import AIEmptyState from './AIEmptyState';

export const AIModelsTable = ({
  models = [],
  isLoading = false,
  onResetFilters,
}) => {
  const [search, setSearch] = useState('');
  const [modelTypeFilter, setModelTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
        Đang tải danh sách mô hình học máy AI...
      </div>
    );
  }

  // Filter models
  const filteredModels = models.filter((m) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.framework.toLowerCase().includes(q) ||
      m.dataset.toLowerCase().includes(q);

    const matchType = modelTypeFilter === 'ALL' || m.modelType === modelTypeFilter;
    const matchStatus = statusFilter === 'ALL' || m.status === statusFilter;

    return matchSearch && matchType && matchStatus;
  });

  const handleReset = () => {
    setSearch('');
    setModelTypeFilter('ALL');
    setStatusFilter('ALL');
    if (onResetFilters) onResetFilters();
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              fontWeight: 700,
              fontSize: '0.6875rem',
              whiteSpace: 'nowrap',
            }}
          >
            <CheckCircle2 size={11} /> Đang Hoạt Động (Active)
          </span>
        );
      case 'TRAINING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              fontWeight: 700,
              fontSize: '0.6875rem',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={11} className="spin-icon" /> Đang Huấn Luyện (Training)
          </span>
        );
      case 'DEPRECATED':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#F1F5F9',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              fontWeight: 600,
              fontSize: '0.6875rem',
              whiteSpace: 'nowrap',
            }}
          >
            <XCircle size={11} /> Ngừng Sử Dụng
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filter Bar */}
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
            placeholder="Tìm tên mô hình, framework, dataset..."
            aria-label="Tìm kiếm mô hình AI"
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
          {/* Model Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} style={{ color: 'var(--dash-text-muted)' }} />
            <select
              aria-label="Lọc theo loại mô hình"
              value={modelTypeFilter}
              onChange={(e) => setModelTypeFilter(e.target.value)}
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
              <option value="ALL">Tất cả loại mô hình</option>
              <option value="Anomaly Detection">Anomaly Detection (Phát hiện dị thường)</option>
              <option value="Causal Graph RCA">Causal Graph RCA (Đồ thị nhân quả)</option>
              <option value="Failure Predictive">Failure Predictive (Dự báo lỗi)</option>
              <option value="Capacity Forecasting">Capacity Forecasting (Dự báo tải)</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            aria-label="Lọc theo trạng thái mô hình"
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
            <option value="ACTIVE">Đang Hoạt Động (Active)</option>
            <option value="TRAINING">Đang Huấn Luyện (Training)</option>
            <option value="DEPRECATED">Ngừng Sử Dụng</option>
          </select>

          {(search || modelTypeFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Đặt lại bộ lọc mô hình"
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
      {filteredModels.length === 0 ? (
        <AIEmptyState
          title="Không Tìm Thấy Mô Hình Nào"
          description="Không có mô hình học máy nào phù hợp với bộ lọc hiện tại hoặc backend chưa triển khai mô hình thuộc danh mục này."
          onAction={handleReset}
          actionText="Xóa bộ lọc tìm kiếm"
        />
      ) : (
        /* Main Table with 7 requested fields */
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
                <th style={{ minWidth: '220px', padding: '12px 14px', fontWeight: 700 }}>Tên Mô Hình (Model Name)</th>
                <th style={{ minWidth: '160px', padding: '12px 14px', fontWeight: 700 }}>Phân Loại (Model Type)</th>
                <th style={{ minWidth: '110px', padding: '12px 14px', fontWeight: 700 }}>Phiên Bản (Version)</th>
                <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Khung Công Nghệ (Framework)</th>
                <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Trạng Thái (Status)</th>
                <th style={{ minWidth: '240px', padding: '12px 14px', fontWeight: 700 }}>Tập Dữ Liệu (Dataset)</th>
                <th style={{ minWidth: '260px', padding: '12px 14px', fontWeight: 700 }}>Chỉ Số Đánh Giá (Evaluation Metrics)</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((m, idx) => (
                <tr
                  key={m.id}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                >
                  {/* 1. Model Name */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Box size={14} style={{ color: '#059669', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{m.name}</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                      {m.id}
                    </div>
                  </td>

                  {/* 2. Model Type */}
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: '#F1F5F9',
                        color: '#0F172A',
                      }}
                    >
                      {m.modelType}
                    </span>
                  </td>

                  {/* 3. Version */}
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
                    {m.version}
                  </td>

                  {/* 4. Framework */}
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        backgroundColor:
                          m.framework === 'ONNX Runtime'
                            ? '#EFF6FF'
                            : m.framework === 'PyTorch'
                            ? '#FEF2F2'
                            : '#F5F3FF',
                        color:
                          m.framework === 'ONNX Runtime'
                            ? '#1D4ED8'
                            : m.framework === 'PyTorch'
                            ? '#DC2626'
                            : '#7C3AED',
                        border: `1px solid ${
                          m.framework === 'ONNX Runtime'
                            ? '#BFDBFE'
                            : m.framework === 'PyTorch'
                            ? '#FECACA'
                            : '#DDD6FE'
                        }`,
                      }}
                    >
                      {m.framework}
                    </span>
                  </td>

                  {/* 5. Status */}
                  <td style={{ padding: '12px 14px' }}>
                    {renderStatusBadge(m.status)}
                  </td>

                  {/* 6. Dataset */}
                  <td style={{ padding: '12px 14px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                    {m.dataset}
                  </td>

                  {/* 7. Evaluation Metrics */}
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#065F46', fontWeight: 600 }}>
                    {m.evaluationMetrics}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AIModelsTable;
