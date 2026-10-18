import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Info, 
  Database, 
  Search 
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
 */
const AIPerformanceView = ({ metrics = [], loading = false, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMetrics = metrics.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.modelName || item.name || '').toLowerCase().includes(term) ||
      item.modelType.toLowerCase().includes(term) ||
      item.dataset.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3"></div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Đang tổng hợp ma trận chỉ số kiểm thử mô hình...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Integrity & Compliance Disclaimer Banner */}
      <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-blue-900 dark:text-blue-200">
            Nguyên tắc minh bạch & Xác thực mô hình (Model Verification Policy)
          </h4>
          <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
            Các chỉ số hiệu năng (Accuracy, Precision, Recall, F1, MAE/RMSE, False Positive Rate) được tính toán trực tiếp từ các tập kiểm thử kiểm chuẩn (holdout test splits) và telemetry thực địa. Hệ thống nghiêm cấm việc tự suy đoán hoặc nâng khống chỉ số hiệu năng (No fabricated claims).
          </p>
        </div>
      </div>

      {/* Filter and Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên mô hình, phân loại, tập dữ liệu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Số mô hình kiểm chuẩn: <strong>{filteredMetrics.length}</strong>
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition"
            >
              Tải lại
            </button>
          )}
        </div>
      </div>

      {/* Table or Empty State */}
      {filteredMetrics.length === 0 ? (
        <AIEmptyState
          title="Không có dữ liệu hiệu năng mô hình"
          description="Chưa có bản ghi đánh giá hoặc kiểm chuẩn nào khớp với điều kiện tìm kiếm hiện tại."
          onAction={searchTerm ? () => setSearchTerm('') : onRefresh}
          actionLabel={searchTerm ? 'Xóa bộ lọc tìm kiếm' : 'Tải lại dữ liệu'}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Mô hình AI</th>
                  <th scope="col" className="px-4 py-3.5">Tập dữ liệu kiểm chuẩn</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Accuracy</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Precision</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Recall</th>
                  <th scope="col" className="px-3 py-3.5 text-right">F1 Score</th>
                  <th scope="col" className="px-4 py-3.5 text-right">MAE / RMSE</th>
                  <th scope="col" className="px-4 py-3.5 text-right">False Positive (FPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                {filteredMetrics.map((item) => {
                  const displayName = item.modelName || item.name;
                  const isRegression = item.mae && !item.mae.includes('N/A');

                  return (
                    <tr
                      key={item.modelId}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Mô hình */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {displayName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.modelType} • <span className="font-mono text-[11px]">{item.modelId}</span>
                        </div>
                      </td>

                      {/* Dataset */}
                      <td className="px-4 py-4 max-w-xs">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate" title={item.dataset}>
                            {item.dataset}
                          </span>
                        </div>
                      </td>

                      {/* Accuracy */}
                      <td className="px-3 py-4 text-right font-semibold text-slate-900 dark:text-white">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs">
                          {item.accuracy}
                        </span>
                      </td>

                      {/* Precision */}
                      <td className="px-3 py-4 text-right font-medium text-slate-800 dark:text-slate-200">
                        {item.precision}
                      </td>

                      {/* Recall */}
                      <td className="px-3 py-4 text-right font-medium text-slate-800 dark:text-slate-200">
                        {item.recall}
                      </td>

                      {/* F1 */}
                      <td className="px-3 py-4 text-right font-bold text-primary-600 dark:text-primary-400">
                        {item.f1}
                      </td>

                      {/* MAE/RMSE */}
                      <td className="px-4 py-4 text-right">
                        {isRegression ? (
                          <div className="text-xs space-y-0.5">
                            <div className="text-slate-900 dark:text-white font-medium">
                              MAE: <span className="font-mono">{item.mae}</span>
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                              RMSE: <span className="font-mono">{item.rmse}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {item.mae || 'N/A'}
                          </span>
                        )}
                      </td>

                      {/* False Positive Rate */}
                      <td className="px-4 py-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
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
  onRefresh: PropTypes.func,
};

export default AIPerformanceView;
