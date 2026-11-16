import React from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Component Phân Trang Chuẩn Đồng Bộ Cho Mọi Bảng Admin
 * Tuân thủ thiết kế:
 * - Trái: Bộ chọn pageSize [10, 20, 50 ...] + Text "Hiển thị X - Y trên tổng số Z [itemLabel]"
 * - Phải: Nút "< Trước", dãy số trang [1] [2] [3]... (trang hiện tại tô màu xanh brand var(--dash-primary)), nút "Tiếp >"
 */
export const AdminTablePagination = ({
  page = 1,
  pageSize = 10,
  total = 0,
  totalPages: propTotalPages,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'mục',
  pageSizeOptions = [10, 20, 50],
  isLoading = false,
  style = {},
}) => {
  const calculatedTotalPages = propTotalPages || Math.max(1, Math.ceil((total || 0) / pageSize));
  const fromIndex = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const toIndex = Math.min(page * pageSize, total);

  // Không hiển thị nếu không có dữ liệu
  if (total === 0 && page === 1) {
    return null;
  }

  return (
    <div
      style={{
        padding: '14px 20px',
        borderTop: '1px solid var(--dash-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#FAFAFA',
        fontSize: '0.8125rem',
        ...style,
      }}
    >
      {/* Phía trái: Chọn số lượng dòng & Thống kê vị trí */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--dash-text-muted)' }}>Hiển thị:</span>
        {onPageSizeChange && (
          <select
            aria-label={`Số ${itemLabel} mỗi trang`}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              outline: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} {itemLabel}
              </option>
            ))}
          </select>
        )}
        <span style={{ color: 'var(--dash-text-secondary)', marginLeft: '4px' }}>
          Hiển thị{' '}
          <strong style={{ color: 'var(--dash-text-primary)' }}>
            {fromIndex} - {toIndex}
          </strong>{' '}
          trên tổng số <strong style={{ color: 'var(--dash-text-primary)' }}>{total}</strong> {itemLabel}
        </span>
      </div>

      {/* Phía phải: Phân trang dạng số và nút điều hướng */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange && onPageChange(page - 1)}
          aria-label="Trang trước"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: 'var(--dash-radius-sm)',
            border: '1px solid var(--dash-border)',
            backgroundColor: page <= 1 || isLoading ? '#F1F5F9' : '#FFFFFF',
            color: page <= 1 || isLoading ? '#94A3B8' : 'var(--dash-text-primary)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: page <= 1 || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <ChevronLeft size={14} />
          <span>Trước</span>
        </button>

        {Array.from({ length: calculatedTotalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === calculatedTotalPages || Math.abs(p - page) <= 2)
          .map((p, idx, arr) => {
            const prev = arr[idx - 1];
            return (
              <React.Fragment key={p}>
                {prev && p - prev > 1 && (
                  <span style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.75rem' }}>...</span>
                )}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onPageChange && onPageChange(p)}
                  aria-label={`Trang ${p}`}
                  style={{
                    minWidth: '28px',
                    height: '28px',
                    padding: '0 6px',
                    borderRadius: 'var(--dash-radius-sm)',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: page === p ? 'var(--dash-primary)' : '#FFFFFF',
                    color: page === p ? '#FFFFFF' : 'var(--dash-text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {p}
                </button>
              </React.Fragment>
            );
          })}

        <button
          type="button"
          disabled={page >= calculatedTotalPages || isLoading}
          onClick={() => onPageChange && onPageChange(page + 1)}
          aria-label="Trang tiếp theo"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: 'var(--dash-radius-sm)',
            border: '1px solid var(--dash-border)',
            backgroundColor: page >= calculatedTotalPages || isLoading ? '#F1F5F9' : '#FFFFFF',
            color: page >= calculatedTotalPages || isLoading ? '#94A3B8' : 'var(--dash-text-primary)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: page >= calculatedTotalPages || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <span>Tiếp</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

AdminTablePagination.propTypes = {
  page: PropTypes.number,
  pageSize: PropTypes.number,
  total: PropTypes.number,
  totalPages: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func,
  itemLabel: PropTypes.string,
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
  isLoading: PropTypes.bool,
  style: PropTypes.object,
};

export default AdminTablePagination;
