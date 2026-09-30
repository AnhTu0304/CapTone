import React from 'react';
import { Filter, Layers, Clock, Globe, Shield } from 'lucide-react';
import { SCOPE_OPTIONS } from '../../../../services/adminOverviewService';

export const GlobalScopeSelector = ({ scope, onChange, isRefreshing }) => {
  const handleChange = (key, value) => {
    if (onChange) {
      onChange({ ...scope, [key]: value });
    }
  };

  return (
    <div
      className="dash-card"
      style={{
        padding: '16px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
      }}
    >
      {/* Scope Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--dash-primary)',
          }}
        >
          <Filter size={15} />
        </div>
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
            Phạm Vi Giám Sát Toàn Cục
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
            Lọc viễn trắc theo tổ chức, môi trường và cụm máy chủ
          </div>
        </div>
      </div>

      {/* Selector Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          opacity: isRefreshing ? 0.7 : 1,
          transition: 'opacity 0.15s ease',
        }}
      >
        {/* 1. Organization Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={14} color="#64748B" />
          <select
            aria-label="Chọn tổ chức"
            value={scope.orgId}
            onChange={(e) => handleChange('orgId', e.target.value)}
            disabled={isRefreshing}
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: 'var(--dash-bg-canvas)',
              color: 'var(--dash-text-primary)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SCOPE_OPTIONS.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Environment Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={14} color="#64748B" />
          <select
            aria-label="Chọn môi trường"
            value={scope.env}
            onChange={(e) => handleChange('env', e.target.value)}
            disabled={isRefreshing}
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: 'var(--dash-bg-canvas)',
              color: 'var(--dash-text-primary)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SCOPE_OPTIONS.environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Cluster Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} color="#64748B" />
          <select
            aria-label="Chọn cụm máy chủ"
            value={scope.clusterId}
            onChange={(e) => handleChange('clusterId', e.target.value)}
            disabled={isRefreshing}
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: 'var(--dash-bg-canvas)',
              color: 'var(--dash-text-primary)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SCOPE_OPTIONS.clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Time Range Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} color="#64748B" />
          <select
            aria-label="Chọn khung thời gian"
            value={scope.timeRange}
            onChange={(e) => handleChange('timeRange', e.target.value)}
            disabled={isRefreshing}
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: 'var(--dash-bg-canvas)',
              color: 'var(--dash-text-primary)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SCOPE_OPTIONS.timeRanges.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default GlobalScopeSelector;
