import React, { useState } from 'react';
import { Code, TestTube2, Check } from 'lucide-react';
import FormField from './FormField';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import ErrorAlert from './ErrorAlert';

export const EnvironmentForm = ({ initialData, onSave, onBack }) => {
  const [name, setName] = useState(initialData?.name || 'Staging');
  const [type, setType] = useState(initialData?.type || 'staging');
  const [description, setDescription] = useState(initialData?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Tên môi trường là bắt buộc';
    } else if (name.trim().length < 2) {
      errors.name = 'Tên môi trường phải có ít nhất 2 ký tự';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) {
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSave({
        name: name.trim(),
        type,
        description: description.trim(),
      });
    }, 450);
  };

  const envOptions = [
    {
      id: 'development',
      title: 'Môi trường Phát triển',
      icon: Code,
      badge: 'DEV',
      tagline: 'Lặp nhanh & cụm phát triển kỹ sư cục bộ',
      explanation:
        'Chính sách tự phục hồi linh hoạt, lấy mẫu đường cơ sở AI tần suất cao và chế độ tự khởi động lại sandbox.',
    },
    {
      id: 'staging',
      title: 'Môi trường Thử nghiệm',
      icon: TestTube2,
      badge: 'STAGING',
      tagline: 'Kiểm thử tiền phát hành & kiểm tra độ phục hồi',
      explanation:
        'Phân loại sự cố nghiêm ngặt, mô phỏng vòng lặp tự phục hồi MAPE-K đầy đủ và kiểm tra RBAC tương đương production.',
    },
  ];

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      {error && <ErrorAlert message={error} onRetry={() => setError('')} />}

      <FormField
        label="Tên Môi Trường"
        required
        htmlFor="env-name"
        description="Nhãn định danh cho phân vùng hạ tầng này (ví dụ: Staging, Dev-Vietnam, Test-QA)."
        error={validationErrors.name}
      >
        <input
          id="env-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (validationErrors.name) setValidationErrors((prev) => ({ ...prev, name: '' }));
          }}
          placeholder="ví dụ: Staging"
          style={{
            width: '100%',
            height: '44px',
            padding: '0 14px',
            backgroundColor: 'var(--color-surface)',
            border: validationErrors.name ? '1px solid #E11D48' : '1px solid var(--border-default)',
            borderRadius: '0px',
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            color: 'var(--color-ink)',
            outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={(e) => (e.target.style.borderColor = validationErrors.name ? '#E11D48' : 'var(--border-default)')}
        />
      </FormField>

      {/* Environment Type Selection Cards */}
      <div style={{ marginBottom: '22px' }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'var(--color-ink)',
            marginBottom: '6px',
          }}
        >
          Loại Môi Trường <span style={{ color: '#E11D48', fontWeight: 800 }}>*</span>
        </label>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            marginBottom: '12px',
          }}
        >
          Lựa chọn giữa phân vùng Phát triển hoặc Thử nghiệm (Môi trường Production mở sau khi kiểm thử).
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          {envOptions.map((opt) => {
            const isSelected = type === opt.id;
            const Icon = opt.icon;

            return (
              <div
                key={opt.id}
                onClick={() => setType(opt.id)}
                style={{
                  padding: '16px',
                  backgroundColor: isSelected ? 'var(--color-surface)' : 'rgba(255, 255, 255, 0.6)',
                  border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-default)',
                  borderRadius: '0px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Selected Checkmark Badge */}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '20px',
                      height: '20px',
                      backgroundColor: 'var(--color-accent)',
                      color: '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: isSelected ? 'var(--color-primary)' : 'rgba(61, 59, 79, 0.08)',
                      color: isSelected ? '#FFFFFF' : 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={16} />
                  </div>

                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        color: 'var(--color-ink)',
                        lineHeight: 1.1,
                      }}
                    >
                      {opt.title}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {opt.badge}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    marginBottom: '4px',
                  }}
                >
                  {opt.tagline}
                </div>

                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                    margin: 0,
                  }}
                >
                  {opt.explanation}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <FormField
        label="Mô Tả / Ghi Chú"
        htmlFor="env-desc"
        description="Ghi chú vận hành bổ sung (ví dụ: vị trí cụm máy chủ, nhà cung cấp đám mây, mục tiêu SLA)."
      >
        <textarea
          id="env-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="ví dụ: Cụm EKS Staging phục vụ kiểm thử tích hợp liên tục CI/CD"
          rows={3}
          style={{
            width: '100%',
            padding: '10px 14px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '0px',
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            color: 'var(--color-ink)',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.45,
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
        />
      </FormField>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px dashed var(--border-default)',
        }}
      >
        <SecondaryButton onClick={onBack}>Quay lại Tổ chức</SecondaryButton>
        <PrimaryButton type="submit" loading={loading}>
          Tiếp tục sang Kubernetes
        </PrimaryButton>
      </div>
    </form>
  );
};

export default EnvironmentForm;
