import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BlueprintWireframeCard from './BlueprintWireframeCard';

describe('BlueprintWireframeCard Component', () => {
  beforeAll(() => {
    window.matchMedia = window.matchMedia || function () {
      return {
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      };
    };
  });

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      ellipse: jest.fn(),
      arc: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn(),
      setLineDash: jest.fn(),
      stroke: jest.fn(),
      clearRect: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      setTransform: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders wireframe card with floating card and avatar', () => {
    render(
      <BlueprintWireframeCard
        avatarColor="#F97316"
        username="meleon101"
        message="try not to put database query logic in the controller"
        nodeColor="#F472B6"
        testId="sample-card"
      />
    );

    const frame = screen.getByTestId('sample-card');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveClass('blueprint-wireframe-frame');

    expect(screen.getByText('meleon101')).toBeInTheDocument();
    expect(screen.getByText('try not to put database query logic in the controller')).toBeInTheDocument();

    const avatar = screen.getByTestId('sample-card-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveStyle({ backgroundColor: '#F97316' });
  });

  it('handles pointer move and leave interactions for parallax tilt', () => {
    render(
      <BlueprintWireframeCard
        username="test.agent"
        message="Running health checks"
        testId="interactive-card"
      />
    );

    const frame = screen.getByTestId('interactive-card');
    fireEvent.pointerMove(frame, { clientX: 100, clientY: 150 });
    fireEvent.pointerLeave(frame);

    expect(screen.getByTestId('interactive-card-floating-card')).toBeInTheDocument();
  });

  it('renders custom avatarImage, live indicator dot, and radarSweep mode', () => {
    render(
      <BlueprintWireframeCard
        avatarImage="telemetry-radar-avatar.png"
        username="telemetry.probe // ebpf-kernel"
        messages={[
          'Quét radar độ trễ 0.8ms: 100% Pods/Nodes sẵn sàng',
          'eBPF Kernel Probe: Đang thu thập 14,820 metrics/giây',
        ]}
        radarSweep={true}
        testId="radar-card"
      />
    );

    expect(screen.getByTestId('radar-card-avatar-img')).toBeInTheDocument();
    expect(screen.getByTestId('radar-card-live-dot')).toBeInTheDocument();
    expect(screen.getByText(/Quét radar độ trễ 0\.8ms/i)).toBeInTheDocument();
  });

  it('hides floating card when showCard is false', () => {
    render(
      <BlueprintWireframeCard
        username="telemetry.probe // ebpf-kernel"
        radarSweep={true}
        showCard={false}
        testId="no-card-probe"
      />
    );

    expect(screen.getByTestId('no-card-probe')).toBeInTheDocument();
    expect(screen.queryByTestId('no-card-probe-floating-card')).not.toBeInTheDocument();
  });

  it('renders timeseries meshVariant and progressive alertStack cards', () => {
    render(
      <BlueprintWireframeCard
        meshVariant="timeseries"
        alertStack={[
          {
            id: 'warn-10m',
            badgeText: 'T+10m // WARN',
            username: 'gru.forecaster // memory-drift',
            message: 'Phát hiện xu hướng rò rỉ bộ nhớ: +18MB/phút',
          },
          {
            id: 'crit-15m',
            avatarImage: 'gru-forecaster-avatar.png',
            username: 'gru.forecaster // time-series',
            message: 'Dự báo suy giảm tài nguyên: Nguy cơ OOMKilled',
          },
        ]}
        testId="ts-card"
      />
    );

    expect(screen.getByTestId('ts-card-floating-stack')).toBeInTheDocument();
    expect(screen.getByTestId('ts-card-stack-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('ts-card-floating-card')).toBeInTheDocument();
    expect(screen.getByTestId('ts-card-avatar-img')).toBeInTheDocument();
  });

  it('renders causal-dag meshVariant without floating card when showCard is false', () => {
    render(
      <BlueprintWireframeCard
        meshVariant="causal-dag"
        avatarImage="rca-diagnostic-core.png"
        showCard={false}
        testId="dag-card"
      />
    );

    expect(screen.getByTestId('dag-card')).toBeInTheDocument();
    expect(screen.queryByTestId('dag-card-floating-card')).not.toBeInTheDocument();
  });

  it('renders yaml-diff-gate meshVariant without floating card when showCard is false', () => {
    render(
      <BlueprintWireframeCard
        meshVariant="yaml-diff-gate"
        avatarImage="hitl-approval-seal.png"
        showCard={false}
        testId="yaml-diff-card"
      />
    );

    expect(screen.getByTestId('yaml-diff-card')).toBeInTheDocument();
    expect(screen.queryByTestId('yaml-diff-card-floating-card')).not.toBeInTheDocument();
  });

  it('renders rolling-switchboard meshVariant without floating card when showCard is false', () => {
    render(
      <BlueprintWireframeCard
        meshVariant="rolling-switchboard"
        avatarImage="k8s-rolling-agent.png"
        showCard={false}
        testId="rolling-card"
      />
    );

    expect(screen.getByTestId('rolling-card')).toBeInTheDocument();
    expect(screen.queryByTestId('rolling-card-floating-card')).not.toBeInTheDocument();
  });

  it('renders audit-ledger meshVariant without floating card when showCard is false', () => {
    render(
      <BlueprintWireframeCard
        meshVariant="audit-ledger"
        avatarImage="audit-vault-core.png"
        showCard={false}
        testId="audit-card"
      />
    );

    expect(screen.getByTestId('audit-card')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-card-floating-card')).not.toBeInTheDocument();
  });
});
