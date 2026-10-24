import React, { useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';

export const CopyButton = ({ text, label = 'Copy', className = '', style = {}, disabled = false }) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    if (!text || disabled) return;
    try {
      if (navigator.clipboard && window.isSecureContext !== false) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!success) throw new Error('execCommand copy failed');
      }
      setCopied(true);
      setError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
      setCopied(false);
      setTimeout(() => setError(false), 2500);
    }
  };

  const isDisabled = disabled || !text;

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isDisabled}
      className={`onboarding-copy-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: error
          ? '#FEF2F2'
          : copied
          ? 'rgba(40, 233, 159, 0.15)'
          : isDisabled
          ? '#F1F5F9'
          : 'var(--color-surface)',
        color: error
          ? '#DC2626'
          : copied
          ? '#059669'
          : isDisabled
          ? '#94A3B8'
          : 'var(--color-primary)',
        border: error
          ? '1px solid #FECACA'
          : copied
          ? '1px solid var(--color-accent)'
          : '1px solid var(--border-default)',
        borderRadius: '0px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        fontWeight: 700,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        ...style,
      }}
      title={error ? 'Sao chép thất bại' : copied ? 'Đã sao chép vào bộ nhớ tạm' : 'Sao chép'}
    >
      {error ? (
        <>
          <AlertCircle size={14} color="#DC2626" />
          <span>Lỗi sao chép</span>
        </>
      ) : copied ? (
        <>
          <Check size={14} color="#059669" />
          <span>Đã sao chép!</span>
        </>
      ) : (
        <>
          <Copy size={14} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

export default CopyButton;
