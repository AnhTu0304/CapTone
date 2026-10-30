import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  BrainCircuit,
  Sparkles, 
  Cpu, 
  RefreshCw,
  Scale
} from 'lucide-react';
import {
  getAIOverviewKPIs,
} from '../../../services/adminAIService';
import { getRegisteredModels } from '../../../services/aiModelRegistryService';

import AINavTabs from '../../../components/admin/ai/AINavTabs';
import AIOverviewSection from '../../../components/admin/ai/AIOverviewSection';
import AIModelsTable from '../../../components/admin/ai/AIModelsTable';
import AIComparisonView from '../../../components/admin/ai/AIComparisonView';

/**
 * AdminAIPage Component
 * Trang Quản Trị Trung Tâm Động Cơ Trí Tuệ Nhân Tạo & RCA
 */
export const AdminAIPage = ({ currentSection = 'overview', onNavigate }) => {
  const [kpis, setKpis] = useState(null);
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (currentSection === 'overview') {
        const [kpiRes, modRes] = await Promise.all([
          getAIOverviewKPIs(),
          getRegisteredModels(),
        ]);
        setKpis(kpiRes);
        setModels(modRes);
      } else if (currentSection === 'models') {
        const data = await getRegisteredModels();
        setModels(data);
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingTop: '6px',
        paddingBottom: '40px',
      }}
    >
      {/* 1. Top Page Header Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '16px',
          padding: '20px 24px',
          boxShadow: 'var(--dash-shadow-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)',
              flexShrink: 0,
            }}
          >
            <IconComponent size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '1.375rem',
                  fontWeight: 800,
                  color: 'var(--dash-text-primary)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {meta.title}
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: '1px solid #A7F3D0',
                }}
              >
                <Sparkles size={12} color="#059669" />
                eBPF + AI Engine
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: '1px solid #BFDBFE',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
                Độ trễ: 1.2ms
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              {meta.desc}
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--dash-shadow-xs)',
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <AINavTabs currentSection={currentSection} onNavigate={onNavigate} onTabChange={handleTabChange} />

      {/* 3. Error Banner if any */}
      {error && (
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            fontSize: '0.8125rem',
          }}
        >
          {error}
        </div>
      )}

      {/* 4. Dynamic Content View */}
      <div style={{ minHeight: '400px' }}>
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
            isLoading={isLoading}
            onRefresh={loadData}
          />
        )}

        {currentSection === 'comparison' && (
          <AIComparisonView />
        )}
      </div>
    </div>
  );
};

AdminAIPage.propTypes = {
  currentSection: PropTypes.oneOf(['overview', 'models', 'comparison']),
  onNavigate: PropTypes.func,
};

export default AdminAIPage;
