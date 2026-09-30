import React, { useState } from 'react';
import { Key, RefreshCw, Eye, EyeOff } from 'lucide-react';
import CopyButton from './CopyButton';

export const AgentTokenCard = ({
  token,
  onRegenerate,
  tokenGeneratedAt,
  className = '',
}) => {
  const [showToken, setShowToken] = useState(false);

  const displayToken = showToken
    ? token
    : token.slice(0, 14) + '••••••••••••••••••••' + token.slice(-4);

  return (
    <div
      className={`onboarding-agent-token-card ${className}`}
      style={{
        padding: '20px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            2
          </div>
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Khởi tạo Token Tác tử
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                margin: 0,
              }}
            >
              Chứng chỉ xác thực phạm vi hẹp dành riêng cho tác tử pod cụm máy chủ đẩy dữ liệu viễn trắc.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRegenerate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: '0px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--color-primary)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} />
          <span>Tạo lại Token</span>
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          backgroundColor: 'rgba(61, 59, 79, 0.04)',
          border: '1px solid var(--border-default)',
          borderRadius: '0px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <Key size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              color: 'var(--color-ink)',
              wordBreak: 'break-all',
            }}
          >
            {displayToken}
          </code>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              background: 'none',
              border: '1px solid var(--border-default)',
              borderRadius: '0px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
            title={showToken ? 'Ẩn token' : 'Hiển thị đầy đủ token'}
          >
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <CopyButton text={token} label="Sao chép Token" />
        </div>
      </div>

      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>Phạm vi: Viễn trắc cụm máy chủ & Thực thi hành động khắc phục</span>
        <span>Hiệu lực trong 30 ngày</span>
      </div>
    </div>
  );
};

export default AgentTokenCard;
