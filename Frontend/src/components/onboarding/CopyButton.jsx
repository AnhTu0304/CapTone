import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const CopyButton = ({ text, label = 'Copy', className = '', style = {} }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`onboarding-copy-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: copied ? 'rgba(40, 233, 159, 0.15)' : 'var(--color-surface)',
        color: copied ? '#059669' : 'var(--color-primary)',
        border: copied ? '1px solid var(--color-accent)' : '1px solid var(--border-default)',
        borderRadius: '0px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        ...style,
      }}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={14} color="#059669" />
          <span>Copied!</span>
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
