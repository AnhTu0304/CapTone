import React, { useState, useEffect } from 'react';
import FormField from './FormField';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import ErrorAlert from './ErrorAlert';
import SuccessAlert from './SuccessAlert';
import { onboardingService } from '../../services/onboardingService';

export const OrganizationForm = ({ initialData, onSave, onBack }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(Boolean(initialData?.slug));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // 'available' | 'taken' | null

  // Tự động sinh slug từ tên tổ chức nếu chưa chỉnh sửa thủ công
  useEffect(() => {
    if (!isSlugManuallyEdited && name.trim()) {
      const generatedSlug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generatedSlug);
    }
  }, [name, isSlugManuallyEdited]);

  // Kiểm tra ràng buộc tồn tại của Slug thời gian thực (Real-time conflict check)
  useEffect(() => {
    if (!slug.trim() || slug.length < 2) {
      setSlugStatus(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSlugChecking(true);
      const res = await onboardingService.checkSlugAvailable(slug);
      setSlugChecking(false);

      if (res && res.exists) {
        setSlugStatus('taken');
        setValidationErrors((prev) => ({
          ...prev,
          slug: `Định danh slug '${slug}' đã tồn tại, vui lòng chọn một slug khác`,
        }));
      } else {
        setSlugStatus('available');
        setValidationErrors((prev) => {
          const next = { ...prev };
          if (next.slug && next.slug.includes('đã tồn tại')) {
            delete next.slug;
          }
          return next;
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [slug]);

  const validate = () => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Tên tổ chức là bắt buộc';
    } else if (name.trim().length < 2) {
      errors.name = 'Tên tổ chức phải có ít nhất 2 ký tự';
    } else if (name.trim().length > 150) {
      errors.name = 'Tên tổ chức không được vượt quá 150 ký tự';
    }

    if (slugStatus === 'taken') {
      errors.slug = `Định danh slug '${slug}' đã tồn tại, vui lòng chọn một slug khác`;
    }

    if (!slug.trim()) {
      errors.slug = 'Định danh slug tổ chức là bắt buộc';
    } else if (slug.trim().length < 2) {
      errors.slug = 'Slug phải có ít nhất 2 ký tự';
    } else if (slug.trim().length > 150) {
      errors.slug = 'Slug không được vượt quá 150 ký tự';
    } else if (slug.startsWith('-') || slug.endsWith('-')) {
      errors.slug = 'Slug không được bắt đầu hoặc kết thúc bằng dấu gạch ngang';
    } else if (slug.includes('--')) {
      errors.slug = 'Slug không được chứa hai dấu gạch ngang liên tiếp';
    } else if (!/^[a-z0-9-]+$/.test(slug)) {
      errors.slug = 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) {
      return;
    }

    // Lưu thông tin tạm vào Context (chưa gọi Database để tránh lỗi khi quay lại bước)
    // Nếu tên hoặc slug thay đổi so với initialData, reset id về null để tránh dùng nhầm ID cũ không tồn tại
    const isSameIdentity =
      initialData?.id &&
      initialData?.name?.trim() === name.trim() &&
      initialData?.slug?.trim() === slug.trim();

    onSave({
      id: isSameIdentity ? initialData.id : null,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      {error && <ErrorAlert message={error} onRetry={() => setError('')} />}
      {success && <SuccessAlert message={success} />}

      <FormField
        label="Tên Tổ Chức"
        required
        htmlFor="org-name"
        description="Tên hiển thị của công ty, doanh nghiệp hoặc nhóm kỹ thuật của bạn."
        error={validationErrors.name}
      >
        <input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (validationErrors.name) setValidationErrors((prev) => ({ ...prev, name: '' }));
          }}
          placeholder="Ví dụ: Công ty TNHH Giải pháp Đám mây Acme"
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

      <FormField
        label="Định Danh Slug Tổ Chức (URL Key)"
        required
        htmlFor="org-slug"
        description="Mã định danh duy nhất sử dụng trong API tokens, không gian viễn trắc và tham số CLI."
        error={validationErrors.slug}
      >
        <div style={{ position: 'relative' }}>
          <input
            id="org-slug"
            type="text"
            value={slug}
            onChange={(e) => {
              setIsSlugManuallyEdited(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              if (validationErrors.slug) setValidationErrors((prev) => ({ ...prev, slug: '' }));
            }}
            placeholder="acme-cloud-corp"
            style={{
              width: '100%',
              height: '44px',
              padding: '0 100px 0 14px',
              backgroundColor: 'var(--color-surface)',
              border: validationErrors.slug ? '1px solid #E11D48' : '1px solid var(--border-default)',
              borderRadius: '0px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              color: 'var(--color-ink)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) => (e.target.style.borderColor = validationErrors.slug ? '#E11D48' : 'var(--border-default)')}
          />
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              color: slug && !validationErrors.slug ? '#059669' : 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            {slug && !validationErrors.slug ? (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }} />
                <span>KHẢ DỤNG</span>
              </>
            ) : (
              <span>dạng-kebab</span>
            )}
          </div>
        </div>
      </FormField>

      <FormField
        label="Mô Tả Doanh Nghiệp"
        htmlFor="org-desc"
        description="Tóm tắt ngắn về phạm vi hạ tầng hoặc dịch vụ chính của tổ chức (không bắt buộc)."
      >
        <textarea
          id="org-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ví dụ: Hạ tầng microservices bán lẻ thương mại điện tử trên AWS EKS"
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
        {onBack ? (
          <SecondaryButton onClick={onBack}>Quay lại</SecondaryButton>
        ) : (
          <span />
        )}
        <PrimaryButton type="submit">
          Tiếp tục sang Môi trường
        </PrimaryButton>
      </div>
    </form>
  );
};

export default OrganizationForm;
