import React from 'react';
import { render, screen } from '@testing-library/react';
import AgentInstallerBanner from './AgentInstallerBanner';

describe('AgentInstallerBanner (Rooster Mascot Installer Branding)', () => {
  it('renders default title, subtitle, and mascot image', () => {
    render(<AgentInstallerBanner />);

    // Title & Subtitle
    expect(screen.getByRole('heading', { level: 3, name: /Self-Healing Kubernetes Agent/i })).toBeInTheDocument();
    expect(screen.getByText(/AI-Driven Proactive Self-Healing Infrastructure for SMEs/i)).toBeInTheDocument();

    // Mascot Image
    const mascotImg = screen.getByAltText(/Self-Healing Kubernetes Agent Rooster Mascot/i);
    expect(mascotImg).toBeInTheDocument();
    expect(mascotImg).toHaveAttribute('src');
    expect(mascotImg.getAttribute('src')).toMatch(/agentchicken/i);
  });

  it('renders custom title, badge, and target cluster name when provided', () => {
    render(
      <AgentInstallerBanner
        title="Custom Cluster Agent"
        clusterName="k8s-production-sg-01"
        badgeText="[ CUSTOM INSTALL ]"
        statusText="READY FOR KUBECTL"
      />
    );

    expect(screen.getByText(/Custom Cluster Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/k8s-production-sg-01/i)).toBeInTheDocument();
    expect(screen.getByText(/\[ CUSTOM INSTALL \]/i)).toBeInTheDocument();
    expect(screen.getByText(/READY FOR KUBECTL/i)).toBeInTheDocument();
  });

  it('supports compact prop for space-constrained modals', () => {
    const { container } = render(<AgentInstallerBanner compact={true} />);
    expect(container.querySelector('.aib-compact')).toBeInTheDocument();
  });
});
