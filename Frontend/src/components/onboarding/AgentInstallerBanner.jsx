import React from 'react';
import PropTypes from 'prop-types';
import agentChickenImg from '../../assets/agentchicken.png';
import './AgentInstallerBanner.css';

/**
 * AgentInstallerBanner
 * Displays the chicken mascot graphic alongside "Self-Healing Kubernetes Agent"
 * branding and deployment metadata whenever the user installs or configures the agent.
 */
export const AgentInstallerBanner = ({
  title = 'Self-Healing Kubernetes Agent',
  subtitle = 'AI-Driven Proactive Self-Healing Infrastructure for SMEs',
  description = 'Tự động giám sát viễn trắc eBPF, dự đoán sự cố tiềm ẩn và chủ động kích hoạt quy trình tự phục hồi k8s.',
  clusterName,
  badgeText = '[ K8S AGENT INSTALLATION ]',
  statusText = 'SẴN SÀNG KẾT NỐI',
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`agent-installer-banner ${compact ? 'aib-compact' : ''} ${className}`.trim()}
      data-testid="agent-installer-banner"
      role="region"
      aria-label="Self-Healing Kubernetes Agent Installation Banner"
    >
      {/* Decorative CAD scanning corner markers */}
      <span className="aib-corner aib-corner-tl" aria-hidden="true" />
      <span className="aib-corner aib-corner-tr" aria-hidden="true" />
      <span className="aib-corner aib-corner-bl" aria-hidden="true" />
      <span className="aib-corner aib-corner-br" aria-hidden="true" />

      {/* Left Column: Mascot Graphic Frame */}
      <div className="aib-mascot-col">
        <div className="aib-mascot-frame">
          <img
            src={agentChickenImg}
            alt="Self-Healing Kubernetes Agent Rooster Mascot"
            className="aib-mascot-img"
            width="104"
            height="156"
            loading="lazy"
            decoding="async"
          />
          <div className="aib-mascot-halo" aria-hidden="true" />
        </div>
      </div>

      {/* Right Column: Title, Subtitle, and Deployment Context */}
      <div className="aib-content-col">
        <div className="aib-header-row">
          <span className="aib-badge-tag">{badgeText}</span>
          <span className="aib-status-pill">
            <span className="aib-status-pulse" aria-hidden="true" />
            <span className="aib-status-text">{statusText}</span>
          </span>
        </div>

        <h3 className="aib-title">{title}</h3>
        <p className="aib-subtitle">{subtitle}</p>
        
        {description && <p className="aib-desc">{description}</p>}

        {clusterName && (
          <div className="aib-meta-row">
            <span className="aib-meta-label">TARGET CLUSTER:</span>
            <code className="aib-meta-cluster">{clusterName}</code>
          </div>
        )}
      </div>
    </div>
  );
};

AgentInstallerBanner.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  description: PropTypes.string,
  clusterName: PropTypes.string,
  badgeText: PropTypes.string,
  statusText: PropTypes.string,
  compact: PropTypes.bool,
  className: PropTypes.string,
};

export default AgentInstallerBanner;
