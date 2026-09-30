import React from 'react';
import { ServerOff } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = ServerOff,
  title = 'No records found',
  description = 'There is currently no information to display for this resource.',
  action,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`onboarding-empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '36px 24px',
        backgroundColor: 'var(--color-surface)',
        border: '1px dashed var(--border-default)',
        borderRadius: '0px',
        ...style,
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          backgroundColor: 'rgba(61, 59, 79, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
          border: '1px solid var(--border-default)',
        }}
      >
        <Icon size={20} color="var(--color-primary)" />
      </div>
      <h4
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.9375rem',
          fontWeight: 700,
          color: 'var(--color-ink)',
          marginBottom: '6px',
        }}
      >
        {title}
      </h4>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          maxWidth: '380px',
          lineHeight: 1.45,
          marginBottom: action ? '16px' : '0px',
        }}
      >
        {description}
      </p>
      {action}
    </div>
  );
};

export default EmptyState;
