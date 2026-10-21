import React, { useState } from 'react';
import {
  Scale,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Cpu,
  Info,
  ShieldCheck,
  Clock,
  ChevronDown,
  Activity,
} from 'lucide-react';

export const AIComparisonView = () => {
  const [selectedModelKey, setSelectedModelKey] = useState('ebpf-anom');
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [rollbackSuccess, setRollbackSuccess] = useState(false);

  const COMPARISON_MODELS = {
    'ebpf-anom': {
      title: 'Kernel Telemetry Anomaly Detector (GRU)',
      type: 'Phát hiện dị thường chuỗi thời gian',
      vCurrent: {
        version: 'v2.4.1-LTS (Hiện tại)',
        releaseDate: '30/09/2026',
        author: 'AI Research Team',
        status: 'Active Production',
        accuracy: '98.4%',
        f1: '0.980',
        fpr: '0.8%',
        latency: '1.2ms',
        mse: '0.008',
        modelSize: '14.2 MB',
      },
      vPrevious: {
        version: 'v2.3.0 (Trước đây)',
        releaseDate: '15/07/2026',
        author: 'AI Research Team',
        status: 'Archived Baseline',
        accuracy: '92.1%',
        f1: '0.912',
        fpr: '4.6%',
        latency: '3.8ms',
        mse: '0.034',
        modelSize: '28.6 MB',
      },
      metricsComparison: [
        {
          name: 'Độ chính xác (Accuracy)',
          before: '92.1%',
          after: '98.4%',
          diff: '+6.3%',
          positive: true,
          desc: 'Tăng khả năng bắt chính xác các đợt bùng nổ tràn bộ nhớ và CPU rò rỉ.',
        },
        {
          name: 'Tỷ lệ báo động sai (False Positive Rate)',
          before: '4.6%',
          after: '0.8%',
          diff: '-3.8%',
          positive: true,
          desc: 'Giảm 82% cảnh báo rác, giảm áp lực mệt mỏi cảnh báo (Alert Fatigue) cho kỹ sư.',
        },
        {
          name: 'Độ trễ suy luận (Inference Latency)',
          before: '3.8ms',
          after: '1.2ms',
          diff: '-2.6ms',
          positive: true,
          desc: 'Tối ưu hóa ONNX Runtime quantization, nhanh gấp hơn 3 lần.',
        },
        {
          name: 'F1-Score Cân Bằng',
          before: '0.912',
          after: '0.980',
          diff: '+0.068',
          positive: true,
          desc: 'Hài hòa giữa độ chính xác và độ nhạy bao phủ sự cố.',
        },
        {
          name: 'Sai số bình phương trung bình (MSE)',
          before: '0.034',
          after: '0.008',
          diff: '-0.026',
          positive: true,
          desc: 'Dự báo sát hơn đường xu hướng thực tế của tài nguyên cụm.',
        },
        {
          name: 'Dung lượng tệp mô hình',
          before: '28.6 MB',
          after: '14.2 MB',
          diff: '-50.3%',
          positive: true,
          desc: 'Thu nhỏ kích thước mô hình để tải nhanh vào bộ nhớ cache của Node.',
        },
      ],
      driftStatus: {
        score: 0.038,
        status: 'Safe',
        desc: 'Độ lệch phân phối dữ liệu telemetry thực địa so với tập huấn luyện ở mức 3.8% (Ngưỡng an toàn < 10%).',
      },
      historyLogs: [
        {
          date: '30/09/2026',
          version: 'v2.4.1-LTS',
          evaluator: 'Dr. Nguyen (Lead AI Engineer)',
          dataset: 'Kernel Telemetry Benchmark 2026 (4.2M mẫu)',
          action: 'Triển khai lên Production sau khi vượt qua bài test Stress Test 72h.',
        },
        {
          date: '15/07/2026',
          version: 'v2.3.0',
          evaluator: 'Tran Minh (MLOps)',
          dataset: 'Synthetic Anomaly Traces v2 (2.1M mẫu)',
          action: 'Đánh giá định kỳ quý 3, ghi nhận FPR còn cao ở các pod đa luồng.',
        },
        {
          date: '02/03/2026',
          version: 'v2.1.0',
          evaluator: 'Dr. Nguyen',
          dataset: 'Initial eBPF Pilot Data (800K mẫu)',
          action: 'Phiên bản ban đầu thay thế rule-based cũ.',
        },
      ],
    },
    'pod-crash': {
      title: 'Pod CrashLoop & OOM Failure Predictor (Scikit-Learn/RandomForest)',
      type: 'Dự báo hỏng hóc sớm (Predictive Failure)',
      vCurrent: {
        version: 'v1.9.4 (Hiện tại)',
        releaseDate: '25/09/2026',
        author: 'Reliability Team',
        status: 'Active Production',
        accuracy: '96.8%',
        f1: '0.961',
        fpr: '1.2%',
        latency: '0.8ms',
        mse: '0.012',
        modelSize: '8.4 MB',
      },
      vPrevious: {
        version: 'v1.8.0 (Trước đây)',
        releaseDate: '10/06/2026',
        author: 'Reliability Team',
        status: 'Archived Baseline',
        accuracy: '88.5%',
        f1: '0.874',
        fpr: '6.5%',
        latency: '2.1ms',
        mse: '0.048',
        modelSize: '16.8 MB',
      },
      metricsComparison: [
        {
          name: 'Độ chính xác (Accuracy)',
          before: '88.5%',
          after: '96.8%',
          diff: '+8.3%',
          positive: true,
          desc: 'Bắt trước các trường hợp OOMKilled trước 15 phút.',
        },
        {
          name: 'Tỷ lệ báo động sai (False Positive Rate)',
          before: '6.5%',
          after: '1.2%',
          diff: '-5.3%',
          positive: true,
          desc: 'Tránh khởi động lại nhầm các container đang chịu tải cao bình thường.',
        },
        {
          name: 'Độ trễ suy luận (Latency)',
          before: '2.1ms',
          after: '0.8ms',
          diff: '-1.3ms',
          positive: true,
          desc: 'Tối ưu hoá cây quyết định và tỉa bớt nhánh dư thừa.',
        },
      ],
      driftStatus: {
        score: 0.052,
        status: 'Safe',
        desc: 'Độ lệch dữ liệu đạt 5.2%, hoàn toàn nằm trong khung cho phép.',
      },
      historyLogs: [
        {
          date: '25/09/2026',
          version: 'v1.9.4',
          evaluator: 'Le Quang (Site Reliability Engineer)',
          dataset: 'cgroup Linux Container OOM Logs 2026 (850K events)',
          action: 'Được phê duyệt làm mô hình chính thức cho toàn bộ cụm SME.',
        },
        {
          date: '10/06/2026',
          version: 'v1.8.0',
          evaluator: 'Le Quang',
          dataset: 'CrashLoop Corpus 2025 (400K events)',
          action: 'Bản thử nghiệm đầu tiên đạt độ chính xác 88.5%.',
        },
      ],
    },
  };

  const currentData = COMPARISON_MODELS[selectedModelKey] || COMPARISON_MODELS['ebpf-anom'];

  const handleRollbackConfirm = () => {
    setIsRollbackModalOpen(false);
    setRollbackSuccess(true);
    setTimeout(() => {
      setRollbackSuccess(false);
    }, 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Top Selector Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Scale size={20} color="#059669" />
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
              Đánh Giá & So Sánh Mô Hình Trước / Sau (Model Version Comparison)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
              Đối chiếu trực tiếp chỉ số hiệu năng phiên bản cũ vs phiên bản mới và kiểm soát trôi dữ liệu
            </div>
          </div>
        </div>

        {/* Model Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
            Chọn mô hình:
          </span>
          <select
            value={selectedModelKey}
            onChange={(e) => setSelectedModelKey(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="ebpf-anom">Kernel Telemetry Anomaly Detector (v2.4.1 vs v2.3.0)</option>
            <option value="pod-crash">Pod CrashLoop & OOM Predictor (v1.9.4 vs v1.8.0)</option>
          </select>

          {/* Rollback Button */}
          <button
            type="button"
            onClick={() => setIsRollbackModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #FECACA',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            <span>Rollback Về Bản Cũ</span>
          </button>
        </div>
      </div>

      {/* Success Banner if Rollback executed */}
      {rollbackSuccess && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>
            Đã kích hoạt Rollback thành công! Hệ thống đã khôi phục phiên bản baseline an toàn trong vòng 1.2 giây.
          </span>
        </div>
      )}

      {/* 2. Head-to-Head Comparison Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Previous Version Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#F1F5F9',
                color: '#64748B',
              }}
            >
              Phiên Bản Trước (Before)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
              {currentData.vPrevious.releaseDate}
            </span>
          </div>

          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}>
            {currentData.vPrevious.version}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
            Tác giả: {currentData.vPrevious.author}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px dashed var(--dash-border)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Độ chính xác (Acc)</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                {currentData.vPrevious.accuracy}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Báo động nhầm (FPR)</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#DC2626' }}>
                {currentData.vPrevious.fpr}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Độ trễ suy luận</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                {currentData.vPrevious.latency}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Dung lượng tệp</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                {currentData.vPrevious.modelSize}
              </div>
            </div>
          </div>
        </div>

        {/* Current Version Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '2px solid #059669',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.08)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                color: '#059669',
                border: '1px solid rgba(5, 150, 105, 0.3)',
              }}
            >
              Phiên Bản Hiện Tại (After)
            </span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
              ĐANG HOẠT ĐỘNG
            </span>
          </div>

          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}>
            {currentData.vCurrent.version}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
            Phát hành: {currentData.vCurrent.releaseDate} • {currentData.vCurrent.author}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px dashed var(--dash-border)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Độ chính xác (Acc)</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                {currentData.vCurrent.accuracy}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Báo động nhầm (FPR)</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                {currentData.vCurrent.fpr}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Độ trễ suy luận</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                {currentData.vCurrent.latency}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Dung lượng tệp</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                {currentData.vCurrent.modelSize}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Detailed Metrics Comparison Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '12px',
          boxShadow: 'var(--dash-shadow-xs)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Bảng Đối Chiếu Chỉ Số Kiểm Chuẩn Chi Tiết (Head-to-Head Comparison)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
            Các số liệu đo lường thực tế trên tập kiểm định Benchmark độc lập
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>CHỈ SỐ ĐÁNH GIÁ</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>PHIÊN BẢN TRƯỚC</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>PHIÊN BẢN MỚI</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>MỨC CẢI THIỆN</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Ý NGHĨA KỸ THUẬT</th>
              </tr>
            </thead>
            <tbody>
              {currentData.metricsComparison.map((m, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    {m.name}
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-secondary)' }}>
                    {m.before}
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                    {m.after}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(5, 150, 105, 0.12)',
                        color: '#059669',
                      }}
                    >
                      {m.diff}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                    {m.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Model Drift & Evaluation History Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Model Drift Monitor */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Activity size={18} color="#059669" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Giám Sát Trôi Dữ Liệu (Model & Data Drift)
            </h3>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5 }}>
            {currentData.driftStatus.desc}
          </p>

          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Chỉ số lệch phân phối (Drift Score)</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>
                {(currentData.driftStatus.score * 100).toFixed(1)}% / Ngưỡng 10%
              </span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(currentData.driftStatus.score / 0.1) * 100}%`,
                  height: '100%',
                  backgroundColor: '#059669',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid rgba(5, 150, 105, 0.2)',
              fontSize: '0.75rem',
              color: '#065F46',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShieldCheck size={16} />
            <span>Trạng thái: An toàn. Chưa cần tái huấn luyện (Retrain) mô hình.</span>
          </div>
        </div>

        {/* Evaluation History Timeline */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <History size={18} color="var(--dash-text-secondary)" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Lịch Sử Đánh Giá & Kiểm Định Mô Hình
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentData.historyLogs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: 'var(--dash-bg-canvas)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                    {log.version}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {log.date}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                  Kiểm định bởi: {log.evaluator}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
                  {log.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rollback Confirmation Modal */}
      {isRollbackModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: 'var(--dash-shadow-dropdown)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>
                Xác Nhận Rollback Mô Hình AI
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: '14px 0 20px 0', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn chuyển đổi phiên bản mô hình từ <strong>{currentData.vCurrent.version}</strong> trở về phiên bản baseline <strong>{currentData.vPrevious.version}</strong> không?
              Thao tác này sẽ áp dụng ngay lập tức cho toàn bộ các lượt suy luận tiếp theo trên nền tảng.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsRollbackModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleRollbackConfirm}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Xác Nhận Rollback Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIComparisonView;
