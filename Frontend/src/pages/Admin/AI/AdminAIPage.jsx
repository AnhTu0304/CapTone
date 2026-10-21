import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  BrainCircuit, 
  Cpu, 
  Activity, 
  GitFork, 
  BarChart2, 
  RefreshCw,
  Sparkles,
  Scale
} from 'lucide-react';
import {
  getAIOverviewKPIs,
  getAIModels,
  getAIPredictions,
  getAIRCAAnalyses,
  getAIPerformanceMetrics,
} from '../../../services/adminAIService';

import AINavTabs from '../../../components/admin/ai/AINavTabs';
import AIOverviewSection from '../../../components/admin/ai/AIOverviewSection';
import AIModelsTable from '../../../components/admin/ai/AIModelsTable';
import AIPredictionsTable from '../../../components/admin/ai/AIPredictionsTable';
import AIRCASection from '../../../components/admin/ai/AIRCASection';
import AIPerformanceView from '../../../components/admin/ai/AIPerformanceView';
import AIComparisonView from '../../../components/admin/ai/AIComparisonView';

/**
 * AdminAIPage Component
 * Trang Quản Trị Trung Tâm Động Cơ Trí Tuệ Nhân Tạo & RCA:
 * Quản lý 5 phân hệ: overview, models, predictions, rca, performance.
 * 
 * Khớp 7 khái niệm CSDL nền tảng:
 * ai_models, ai_model_metrics, ai_predictions, prediction_inputs,
 * rca_analyses, rca_evidences, ai_recommendations.
 */
export const AdminAIPage = ({ currentSection = 'overview', onNavigate }) => {
  const [kpis, setKpis] = useState(null);
  const [models, setModels] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [rcaAnalyses, setRcaAnalyses] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (currentSection === 'overview') {
        const [kpiRes, modRes] = await Promise.all([
          getAIOverviewKPIs(),
          getAIModels(),
        ]);
        setKpis(kpiRes);
        setModels(modRes);
      } else if (currentSection === 'models') {
        const data = await getAIModels();
        setModels(data);
      } else if (currentSection === 'predictions') {
        const data = await getAIPredictions();
        setPredictions(data);
      } else if (currentSection === 'rca') {
        const data = await getAIRCAAnalyses();
        setRcaAnalyses(data);
      } else if (currentSection === 'performance') {
        const data = await getAIPerformanceMetrics();
        setPerformanceMetrics(data);
      }
    } catch (err) {
      console.error('Lỗi nạp dữ liệu phân hệ AI Platform:', err);
      setError('Không thể tải dữ liệu từ máy chủ. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTabChange = (tabId) => {
    if (onNavigate) {
      onNavigate(`/admin/ai/${tabId}`);
    }
  };

  const getSectionMetadata = () => {
    switch (currentSection) {
      case 'models':
        return {
          title: 'Kho Mô Hình Học Máy (AI Model Registry)',
          desc: 'Quản lý phiên bản, khuôn khổ huấn luyện, trạng thái hoạt động và nguồn gốc dữ liệu của các mô hình AI/ML.',
          icon: Cpu,
        };
      case 'comparison':
        return {
          title: 'Đánh Giá & So Sánh Mô Hình Trước / Sau (Model Version Comparison)',
          desc: 'Đối chiếu trực tiếp chỉ số hiệu năng phiên bản cũ vs phiên bản mới, kiểm soát trôi dữ liệu và lịch sử đánh giá.',
          icon: Scale,
        };
      case 'predictions':
        return {
          title: 'Suy Luận & Dự Báo Dị Thường (AI Predictions)',
          desc: 'Nhật ký các suy luận thời gian thực, vector đặc trưng đầu vào (prediction_inputs) và khuyến nghị hành động phục hồi.',
          icon: Activity,
        };
      case 'rca':
        return {
          title: 'Đồ Thị Nhân Quả & Phân Tích Sự Cố (Root Cause Analysis - RCA)',
          desc: 'Khám phá chuỗi lan truyền sự cố, bằng chứng telemetry eBPF đa tầng và khuyến nghị hành động tương ứng.',
          icon: GitFork,
        };
      case 'performance':
        return {
          title: 'Chỉ Số Hiệu Năng & Kiểm Chuẩn (Model Performance Matrix)',
          desc: 'Ma trận đo lường định lượng trên tập kiểm thử (Accuracy, Precision, Recall, F1, MAE/RMSE, False Positive Rate). Không suy đoán số liệu.',
          icon: BarChart2,
        };
      case 'overview':
      default:
        return {
          title: 'Tổng Quan Động Cơ AI & Tự Động Hóa (AI Platform Overview)',
          desc: 'Giám sát nhịp đập hoạt động của toàn bộ động cơ trí tuệ nhân tạo, lưu lượng suy luận và khối lượng phân tích RCA.',
          icon: BrainCircuit,
        };
    }
  };

  const meta = getSectionMetadata();
  const IconComponent = meta.icon;

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                {meta.title}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                <Sparkles className="w-3 h-3 text-amber-500" />
                eBPF + AI Engine
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {meta.desc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <AINavTabs currentSection={currentSection} onNavigate={onNavigate} onTabChange={handleTabChange} />

      {/* Error Banner if any */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Dynamic Content View based on currentSection */}
      <div className="min-h-[400px]">
        {currentSection === 'overview' && (
          <AIOverviewSection
            kpis={kpis}
            models={models}
            onNavigate={onNavigate}
          />
        )}

        {currentSection === 'models' && (
          <AIModelsTable
            models={models}
            loading={isLoading}
            onRefresh={loadData}
          />
        )}

        {currentSection === 'comparison' && (
          <AIComparisonView />
        )}

        {currentSection === 'predictions' && (
          <AIPredictionsTable
            predictions={predictions}
            loading={isLoading}
            onRefresh={loadData}
          />
        )}

        {currentSection === 'rca' && (
          <AIRCASection
            analyses={rcaAnalyses}
            loading={isLoading}
            onRefresh={loadData}
          />
        )}

        {currentSection === 'performance' && (
          <AIPerformanceView
            metrics={performanceMetrics}
            loading={isLoading}
            onRefresh={loadData}
          />
        )}
      </div>
    </div>
  );
};

AdminAIPage.propTypes = {
  currentSection: PropTypes.oneOf(['overview', 'models', 'comparison', 'predictions', 'rca', 'performance']),
  onNavigate: PropTypes.func,
};

export default AdminAIPage;
