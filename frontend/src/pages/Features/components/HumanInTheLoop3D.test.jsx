import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HumanInTheLoop3D from './HumanInTheLoop3D';

describe('HumanInTheLoop3D Component', () => {
  it('renders the 3 visual zones and core motto', () => {
    render(<HumanInTheLoop3D />);

    // Check core motto
    expect(screen.getByText('AI PROPOSES')).toBeInTheDocument();
    expect(screen.getByText('HUMAN DECIDES')).toBeInTheDocument();
    expect(screen.getByText('AGENT EXECUTES')).toBeInTheDocument();

    // Check 3 visual zones
    expect(screen.getByText('1. AI RECOMMENDATION')).toBeInTheDocument();
    expect(screen.getByText('2. APPROVAL GATE')).toBeInTheDocument();
    expect(screen.getByText('3. K8S AGENT')).toBeInTheDocument();
  });

  it('starts in locked/awaiting approval state', () => {
    render(<HumanInTheLoop3D />);

    expect(screen.getByText(/HUMAN APPROVAL REQUIRED/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phê duyệt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Từ chối/i })).toBeInTheDocument();
  });

  it('transitions to authorized state when approval is clicked', () => {
    render(<HumanInTheLoop3D />);

    const approveBtn = screen.getByRole('button', { name: /Phê duyệt/i });
    fireEvent.click(approveBtn);

    expect(screen.getByText(/AUTHORIZED \/\/ GATE OPEN/i)).toBeInTheDocument();
    expect(screen.getByText(/ĐANG CHUYỂN TIẾP LỆNH SANG KUBERNETES AGENT/i)).toBeInTheDocument();
  });

  it('transitions to rejected state when reject is clicked', () => {
    render(<HumanInTheLoop3D />);

    const rejectBtn = screen.getByRole('button', { name: /Từ chối/i });
    fireEvent.click(rejectBtn);

    expect(screen.getByText(/ACTION REJECTED \/\/ BLOCKED/i)).toBeInTheDocument();
    expect(screen.getByText(/ĐÃ HỦY THỰC THI ĐỀ XUẤT NÀY/i)).toBeInTheDocument();
  });
});
