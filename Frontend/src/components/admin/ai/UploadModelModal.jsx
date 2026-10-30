import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  X,
  UploadCloud,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import { uploadModelCheckpoint } from '../../../services/aiModelRegistryService';

export const UploadModelModal = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [modelName, setModelName] = useState('');
  const [version, setVersion] = useState('');
  const [modelType, setModelType] = useState('Anomaly Detection');
  const [framework, setFramework] = useState('PyTorch');
  const [description, setDescription] = useState('');
  const [activateNow, setActivateNow] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(1); // 1: Select, 2: Uploading & Evaluating, 3: Completed
  const [evalResult, setEvalResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setErrorMessage('');
      if (!modelName) {
        // Auto-generate name from file
        const base = selected.name.replace(/\.[^/.]+$/, '');
        setModelName(base.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      }
      if (!version) {
        setVersion('v2.0.0');
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      setErrorMessage('');
      if (!modelName) {
        const base = dropped.name.replace(/\.[^/.]+$/, '');
        setModelName(base.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      }
      if (!version) {
        setVersion('v2.0.0');
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Vui lòng chọn hoặc kéo thả tệp mô hình (.pth, .pt, .onnx)');
      return;
    }

    setIsUploading(true);
    setUploadStep(2);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', modelName || file.name);
      formData.append('version', version || '1.0.0');
      formData.append('model_type', modelType);
      formData.append('framework', framework);
      formData.append('description', description);
      formData.append('activate_now', activateNow ? 'true' : 'false');

      const response = await uploadModelCheckpoint(formData);
      setEvalResult(response?.data?.evaluation_metrics || response?.evaluation_metrics || null);
      setUploadStep(3);
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMessage(err.message || 'Lỗi tải lên và kiểm định mô hình');
      setUploadStep(1);
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetAndClose = () => {
    setFile(null);
    setModelName('');
    setVersion('');
    setDescription('');
    setActivateNow(false);
    setUploadStep(1);
    setEvalResult(null);
    setErrorMessage('');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={handleResetAndClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--dash-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#1E293B' }}>
                Đăng Ký & Tải Lên Mô Hình AI Mới
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                Nạp tệp checkpoint PyTorch, tự động đo lường Accuracy & F1 trên tập kiểm thử
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--dash-text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#B91C1C',
                fontSize: '0.8125rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {uploadStep === 3 ? (
            /* Bước 3: Đã tải lên và kiểm định thành công */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'center' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.125rem', fontWeight: 800, color: '#065F46' }}>
                  Kiểm Định Mô Hình Thành Công!
                </h4>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--dash-text-muted)' }}>
                  Mô hình <strong>{modelName}</strong> ({version}) đã được nạp và đánh giá trên 3.000 mẫu holdout.
                </p>
              </div>

              {evalResult?.overall && (
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid var(--dash-border)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      Accuracy
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                      {evalResult.overall.accuracy}%
                    </div>
                  </div>

                  <div style={{ padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      F1-Score
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
                      {evalResult.overall.f1_score}
                    </div>
                  </div>

                  <div style={{ padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      Inference Latency
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>
                      {evalResult.overall.latency_ms} ms
                    </div>
                  </div>

                  <div style={{ padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      Precision
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#334155', marginTop: '4px' }}>
                      {evalResult.overall.precision}%
                    </div>
                  </div>

                  <div style={{ padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      Recall
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#334155', marginTop: '4px' }}>
                      {evalResult.overall.recall}%
                    </div>
                  </div>

                  <div style={{ padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      False Positive Rate
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                      {evalResult.overall.false_positive_rate}%
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleResetAndClose}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                Hoàn Tất & Xem Trong Kho Mô Hình
              </button>
            </div>
          ) : uploadStep === 2 ? (
            /* Bước 2: Đang tải lên & Chạy kiểm chuẩn */
            <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <RefreshCw size={36} style={{ color: '#059669', animation: 'spin 1.2s linear infinite' }} />
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>
                  Đang Xử Lý & Chạy Kiểm Định Mô Hình...
                </h4>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--dash-text-muted)' }}>
                  AI Backend đang nạp tensor, kiểm chuẩn 8 đặc trưng và suy luận trên 3.000 mẫu dữ liệu kiểm thử. Vui lòng đợi trong giây lát.
                </p>
              </div>
            </div>
          ) : (
            /* Bước 1: Form điền thông tin và chọn tệp */
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #CBD5E1',
                  borderRadius: '14px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  backgroundColor: file ? '#F0FDF4' : '#F8FAFC',
                  borderColor: file ? '#86EFAC' : '#CBD5E1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pth,.pt,.onnx,.pkl"
                  style={{ display: 'none' }}
                />
                {file ? (
                  <>
                    <FileCheck size={32} style={{ color: '#059669' }} />
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#065F46' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#059669' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Sẵn sàng tải lên
                    </div>
                  </>
                ) : (
                  <>
                    <UploadCloud size={32} style={{ color: '#94A3B8' }} />
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
                      Kéo thả tệp mô hình vào đây hoặc <span style={{ color: '#059669' }}>chọn từ máy tính</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                      Hỗ trợ định dạng checkpoint PyTorch (.pth, .pt) hoặc ONNX (.onnx)
                    </div>
                  </>
                )}
              </div>

              {/* Form Fields Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Tên Mô Hình *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: GRU Risk Classification v2"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.8125rem',
                      borderRadius: '8px',
                      border: '1px solid var(--dash-border)',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Phiên Bản (Version) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: v2.4.2-LTS"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.8125rem',
                      borderRadius: '8px',
                      border: '1px solid var(--dash-border)',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Phân Loại Mô Hình
                  </label>
                  <select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.8125rem',
                      borderRadius: '8px',
                      border: '1px solid var(--dash-border)',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Anomaly Detection">Anomaly Detection (Phát hiện dị thường)</option>
                    <option value="Failure Predictive">Failure Predictive (Dự báo sự cố)</option>
                    <option value="Capacity Forecasting">Capacity Forecasting (Dự báo tải)</option>
                    <option value="Causal Graph RCA">Causal Graph RCA (Đồ thị nhân quả)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Khung Công Nghệ (Framework)
                  </label>
                  <select
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.8125rem',
                      borderRadius: '8px',
                      border: '1px solid var(--dash-border)',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="PyTorch">PyTorch (.pth / .pt)</option>
                    <option value="ONNX Runtime">ONNX Runtime (.onnx)</option>
                    <option value="Scikit-learn">Scikit-learn (.pkl)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Mô Tả & Ghi Chú Đợt Huấn Luyện
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: Cập nhật trọng số sau đợt huấn luyện traffic spike round 4..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.8125rem',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Checkbox activate immediately */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid var(--dash-border)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={activateNow}
                  onChange={(e) => setActivateNow(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#059669' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1E293B' }}>
                    Kích hoạt mô hình ngay (Hot-Reload vào Production)
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                    Nếu bỏ chọn, mô hình sẽ được lưu vào kho ở trạng thái STAGING để Admin kiểm định trước
                  </div>
                </div>
              </label>

              {/* Actions Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={!file || isUploading}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: !file || isUploading ? '#94A3B8' : '#059669',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: !file || isUploading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <UploadCloud size={16} />
                  <span>Tải Lên & Chạy Kiểm Định</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

UploadModelModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default UploadModelModal;
