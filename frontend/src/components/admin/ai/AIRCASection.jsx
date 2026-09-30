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
  Search
} from 'lucide-react';
import AIEmptyState from './AIEmptyState';

/**
 * AIRCASection Component
 * Hiển thị các bản phân tích nguyên nhân gốc rễ (rca_analyses)
 * kết hợp bằng chứng telemetry (rca_evidences) và hành động khắc phục đề xuất (ai_recommendations)
 */
const AIRCASection = ({ analyses = [], loading = false, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRcaId, setExpandedRcaId] = useState(analyses[0]?.id || null);

  const filteredAnalyses = analyses.filter((rca) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      rca.id.toLowerCase().includes(term) ||
      rca.incidentId?.toLowerCase().includes(term) ||
      rca.rootCauseSummary.toLowerCase().includes(term)
    );
  });

  const toggleExpand = (id) => {
    setExpandedRcaId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3"></div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Đang truy xuất đồ thị nhân quả và bằng chứng RCA...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã RCA, mã sự cố, nguyên nhân..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Số lượng RCA: <strong>{filteredAnalyses.length}</strong>
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition"
            >
              Làm mới
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredAnalyses.length === 0 ? (
        <AIEmptyState
          title="Không tìm thấy bản ghi phân tích RCA"
          description="Hiện tại không có bản ghi phân tích nguyên nhân gốc rễ nào thỏa mãn tiêu chí tìm kiếm hoặc chưa có sự cố kích hoạt suy luận."
          onAction={searchTerm ? () => setSearchTerm('') : onRefresh}
          actionLabel={searchTerm ? 'Xóa bộ lọc tìm kiếm' : 'Tải lại dữ liệu'}
        />
      ) : (
        <div className="space-y-4">
          {filteredAnalyses.map((rca) => {
            const isExpanded = expandedRcaId === rca.id;
            return (
              <div
                key={rca.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                {/* RCA Main Card Header */}
                <div
                  className="p-5 cursor-pointer select-none bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  onClick={() => toggleExpand(rca.id)}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">
                        {rca.id}
                      </span>
                      {rca.incidentId && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Gốc sự cố: {rca.incidentId}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Độ tin cậy: {rca.confidence}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {rca.analyzedAt}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                      {rca.rootCauseSummary}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Graph metadata */}
                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5" title="Số lượng nút đồ thị nhân quả">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <span className="font-semibold">{rca.causalGraphNodesCount} nodes</span>
                      </div>
                      <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                      <div className="flex items-center gap-1.5" title="Số lượng cạnh phụ thuộc quan sát">
                        <GitFork className="w-4 h-4 text-primary-500" />
                        <span className="font-semibold">{rca.causalGraphEdgesCount} edges</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: rca_evidences & ai_recommendations */}
                {isExpanded && (
                  <div className="p-5 space-y-6">
                    {/* Bằng chứng nhân quả (rca_evidences) */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Bằng chứng quan sát eBPF / Logs / Metrics (rca_evidences)
                        </h4>
                      </div>

                      {rca.evidences && rca.evidences.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                          {rca.evidences.map((ev) => (
                            <div
                              key={ev.id}
                              className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs space-y-1.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                                    {ev.evidenceType}
                                  </span>
                                  <span>Nguồn: {ev.evidenceSource}</span>
                                </div>
                                <span className="text-slate-500 dark:text-slate-400">
                                  Đóng góp trọng số: <strong className="text-slate-800 dark:text-slate-200">{ev.confidenceContribution}</strong>
                                </span>
                              </div>
                              <div className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[11px] overflow-x-auto border border-slate-800 shadow-inner">
                                {ev.snippet}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Chưa có trích xuất bằng chứng chi tiết.</p>
                      )}
                    </div>

                    {/* Khuyến nghị tự khắc phục (ai_recommendations) */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Khuyến nghị tự phục hồi tự động đề xuất (ai_recommendations)
                        </h4>
                      </div>

                      {rca.recommendations && rca.recommendations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {rca.recommendations.map((rec) => (
                            <div
                              key={rec.id}
                              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2 shadow-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                  {rec.actionType}
                                </span>
                                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                  Tác động: {rec.impactScore}/100
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-800/80 p-2 rounded">
                                {rec.suggestedParameters}
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <span className="flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5 text-primary-500" />
                                  Cấp độ: {rec.safetyTier}
                                </span>
                                <span className="font-semibold text-primary-600 dark:text-primary-400">
                                  {rec.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Không có hành động khuyến nghị đính kèm.</p>
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
  onRefresh: PropTypes.func,
};

export default AIRCASection;
