import React, { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';

export const CopyButton = ({ text, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Đã sao chép!' : 'Sao chép vào clipboard'}
      aria-label="Sao chép mã"
      className={`copy-button ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-mono)',
        borderRadius: '0px',
        border: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-secondary)',
        color: copied ? 'var(--color-accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        e.currentTarget.style.color = copied ? 'var(--color-accent)' : 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        e.currentTarget.style.color = copied ? 'var(--color-accent)' : 'var(--text-secondary)';
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
    </button>
  );
};

export const CodeBlock = ({
  code,
  language = 'bash',
  title = '',
  showLineNumbers = false,
  className = '',
}) => {
  const lines = code.trim().split('\n');

  return (
    <div
      className={`code-block-container ${className}`}
      style={{
        margin: '16px 0',
        borderRadius: '0px',
        border: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-secondary)',
        overflow: 'hidden',
        fontSize: '0.8125rem',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-canvas)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} color="var(--color-accent)" />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            {title || language.toUpperCase()}
          </span>
        </div>
        <CopyButton text={code} />
      </div>

      {/* Code Area */}
      <div
        style={{
          padding: '14px 18px',
          overflowX: 'auto',
          backgroundColor: '#2A2A2A', /* Greptile Neutral-1 dark terminal */
          color: '#F7F7F8',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.6,
        }}
      >
        <pre style={{ margin: 0 }}>
          <code>
            {lines.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                {showLineNumbers && (
                  <span
                    style={{
                      userSelect: 'none',
                      color: '#475569',
                      textAlign: 'right',
                      minWidth: '20px',
                      fontSize: '0.75rem',
                    }}
                  >
                    {idx + 1}
                  </span>
                )}
                <span style={{ flex: 1 }}>{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

export default CodeBlock;
