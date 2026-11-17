import React from 'react';
import { render, screen } from '@testing-library/react';
import InstallationCodeBlock from './InstallationCodeBlock';

describe('InstallationCodeBlock (SelfHeal Agent Mascot Integration)', () => {
  it('renders AgentInstallerBanner with chicken mascot and Self-Healing Kubernetes Agent title', () => {
    render(<InstallationCodeBlock clusterName="k8s-sg-cluster-01" />);

    // Mascot Banner
    expect(screen.getByRole('heading', { level: 3, name: /Self-Healing Kubernetes Agent/i })).toBeInTheDocument();
    expect(screen.getByAltText(/Self-Healing Kubernetes Agent Rooster Mascot/i)).toBeInTheDocument();
    expect(screen.getByText(/k8s-sg-cluster-01/i)).toBeInTheDocument();

    // PowerShell command snippet
    expect(screen.getByText(/irm/i)).toBeInTheDocument();
    expect(screen.getByText(/install\.ps1/i)).toBeInTheDocument();
  });
});
