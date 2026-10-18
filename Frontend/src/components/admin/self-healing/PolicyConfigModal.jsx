import React, { useState, useEffect } from 'react';
import { X, Sliders, ShieldCheck, Save } from 'lucide-react';

export const PolicyConfigModal = ({ policy, isOpen, onClose, onSave }) => {
  const [confidenceThreshold, setConfidenceThreshold] = useState(95);
  const [cooldown, setCooldown] = useState('15m');
  const [maxRetries, setMaxRetries] = useState(3);
  const [executionMode, setExecutionMode] = useState('Fully Autonomous');
  const [activeStatus, setActiveStatus] = useState(true);

  useEffect(() => {
    if (policy) {
      setConfidenceThreshold(policy.confidenceThreshold || 95);
      setCooldown(policy.cooldown || '15m');
      setMaxRetries(policy.maxRetries || 3);
      setExecutionMode(policy.executionMode || 'Fully Autonomous');
      setActiveStatus(policy.activeStatus !== undefined ? policy.activeStatus : true);
    }
  }, [policy]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !policy) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      onSave(policy.id, {
        confidenceThreshold: Number(confidenceThreshold),
        cooldown,
        maxRetries: Number(maxRetries),
        executionMode,
        activeStatus,
      });
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-config-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="dash-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="#A7F3D0" />
            <h3 id="policy-config-title" style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>
              Cấu Hình Chính Sách Tự Lành
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ cấu hình"
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)' }}>
              {policy.id}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
              {policy.name}
            </div>
          </div>

          {/* Safety Notice */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              fontSize: '0.75rem',
              color: 'var(--dash-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShieldCheck size={16} style={{ color: '#059669', flexShrink: 0 }} />
            <span>Chỉ điều chỉnh tham số kiểm soát chính sách. Không cho phép thực thi lệnh K8s tùy ý.</span>
          </div>

          {/* Confidence Threshold */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="confidence-input" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                Ngưỡng Tin Cậy AI Tối Thiểu (Confidence Threshold)
              </label>
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                {confidenceThreshold}%
              </span>
            </div>
            <input
              id="confidence-input"
              type="range"
              min="80"
              max="99"
              step="1"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(e.target.value)}
              style={{ width: '100%', accentColor: '#059669', cursor: 'pointer' }}
            />
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
              Mô hình chỉ được phép tự trị khi điểm suy diễn vượt qua ngưỡng này.
            </div>
          </div>

          {/* Cooldown & Max Retries */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label htmlFor="cooldown-select" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', display: 'block', marginBottom: '6px' }}>
                Thời Gian Hạ Nhiệt (Cooldown)
              </label>
              <select
                id="cooldown-select"
                value={cooldown}
                onChange={(e) => setCooldown(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              >
                <option value="5m">5 phút</option>
                <option value="10m">10 phút</option>
                <option value="15m">15 phút</option>
                <option value="30m">30 phút</option>
                <option value="60m">60 phút</option>
              </select>
            </div>

            <div>
              <label htmlFor="retries-input" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', display: 'block', marginBottom: '6px' }}>
                Thử Lại Tối Đa (Max Retries)
              </label>
              <input
                id="retries-input"
                type="number"
                min="1"
                max="5"
                value={maxRetries}
                onChange={(e) => setMaxRetries(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Execution Mode */}
          <div>
            <label htmlFor="mode-select" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', display: 'block', marginBottom: '6px' }}>
              Chế Độ Thực Thi (Execution Mode)
            </label>
            <select
              id="mode-select"
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            >
              <option value="Fully Autonomous">Fully Autonomous (Tự Trị Hoàn Toàn)</option>
              <option value="HITL Approval Required">HITL Approval Required (Bắt Buộc Duyệt)</option>
              <option value="Dry-Run Only">Dry-Run Only (Chạy Thử Nghiệm)</option>
            </select>
          </div>

          {/* Active Status Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input
              id="active-checkbox"
              type="checkbox"
              checked={activeStatus}
              onChange={(e) => setActiveStatus(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' }}
            />
            <label htmlFor="active-checkbox" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', cursor: 'pointer' }}>
              Kích hoạt chính sách này trên toàn nền tảng (Active)
            </label>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--dash-shadow-xs)',
              }}
            >
              <Save size={14} />
              <span>Lưu Cấu Hình</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PolicyConfigModal;
