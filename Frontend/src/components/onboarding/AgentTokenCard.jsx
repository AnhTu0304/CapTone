import React, { useState } from 'react';
import { Key, RefreshCw, Eye, EyeOff, ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';
import CopyButton from './CopyButton';

export const AgentTokenCard = ({
  token,
  tokenPrefix,
  onRegenerate,
  tokenGeneratedAt,
  isGenerating = false,
  className = '',
}) => {
  const [showToken, setShowToken] = useState(false);

  // Token raw hiển thị đầy đủ hoặc che giấu
  const hasRawToken = Boolean(token && typeof token === 'string' && token.length > 20);
  const prefix = tokenPrefix || (hasRawToken ? token.slice(0, 16) : '');

  const displayToken = hasRawToken
    ? (showToken
        ? token
        : `${token.slice(0, 14)}••••••••••••••••••••${token.slice(-4)}`)
    : (prefix
        ? `${prefix}••••••••••••••••`
        : 'Chưa khởi tạo Token');

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
              Mã Token Tác tử (Agent Registration Token)
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                margin: 0,
              }}
            >
              Chứng chỉ xác thực phạm vi hẹp dành riêng cho tác tử pod cụm máy chủ kết nối và đẩy viễn trắc.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRegenerate}
          disabled={isGenerating}
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
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            opacity: isGenerating ? 0.7 : 1,
          }}
        >
          {isGenerating ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
          <span>{isGenerating ? 'Đang cấp lại...' : (hasRawToken ? 'Tạo lại Token' : 'Cấp Token mới')}</span>
        </button>
      </div>

      {/* Cảnh báo nhạy cảm một lần */}
      {hasRawToken && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            marginBottom: '10px',
            fontSize: '0.75rem',
            color: '#92400E',
          }}
        >
          <ShieldAlert size={14} color="#D97706" style={{ flexShrink: 0 }} />
          <span>
            <strong>Lưu ý bảo mật:</strong> Token gốc chỉ hiển thị <strong>1 lần duy nhất</strong>. Backend lưu mã băm SHA-256 một chiều và không thể hiển thị lại. Vui lòng sao chép và lưu trữ an toàn ngay bây giờ.
          </span>
        </div>
      )}

      {!hasRawToken && prefix && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            marginBottom: '10px',
            fontSize: '0.75rem',
            color: '#475569',
          }}
        >
          <AlertCircle size={14} color="#64748B" style={{ flexShrink: 0 }} />
          <span>
            Token đã được mã hóa bảo mật. Nếu bạn chưa lưu Token hoặc cần cấp lại, bấm <strong>"Cấp Token mới"</strong> ở góc phải.
          </span>
        </div>
      )}

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
              userSelect: hasRawToken ? 'all' : 'none',
            }}
          >
            {displayToken}
          </code>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {hasRawToken && (
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
          )}
          <CopyButton
            text={hasRawToken ? token : ''}
            disabled={!hasRawToken}
            label="Sao chép Token"
          />
        </div>
      </div>

      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>Phạm vi: Gửi viễn trắc Pod/Node K8s & Nhận tín hiệu điều khiển Self-Healing</span>
        <span>
          {tokenGeneratedAt
            ? `Cấp lúc: ${new Date(tokenGeneratedAt).toLocaleDateString()} (Hiệu lực: 90 ngày)`
            : 'Hiệu lực: 90 ngày'}
        </span>
      </div>
    </div>
  );
};

export default AgentTokenCard;
