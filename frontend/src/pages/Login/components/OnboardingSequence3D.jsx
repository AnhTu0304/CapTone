import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  Building2, 
  Layers, 
  Server, 
  Key, 
  Terminal, 
  Activity,
  Play,
  Pause,
  Info
} from 'lucide-react';
import HexagonStepNode from './HexagonStepNode';
import ConnectingArrow from './ConnectingArrow';
import MiniDashboardBloom from './MiniDashboardBloom';
import StepDetailCard from './StepDetailCard';

/**
 * OnboardingSequence3D
 * 
 * Bộ điều phối chu trình 3D kỹ thuật cho cột bên trái (Login & Register):
 * 1. Chạy tuần tự 7 bước tiếp cận trong hình lục giác 3D với tín hiệu photon chuyển động.
 * 2. Tương tác chuột toàn diện: hover nổi khối Z, con trỏ pointer, click xem mô tả cơ chế hoạt động.
 * 3. Hộp thoại StepDetailCard với animation GSAP mượt mà và điều hướng 7 bước.
 * 4. Tự động tạm dừng khi tương tác và cho phép tiếp tục chu trình bất kỳ lúc nào.
 * 5. Gôm tụ về tâm (Convergence) và nở Dashboard 3D K8s thời gian thực (Dashboard Bloom).
 */
export const OnboardingSequence3D = () => {
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [currentStep, setCurrentStep] = useState(1);
  const [phase, setPhase] = useState('steps'); // 'steps' | 'converging' | 'dashboard'
  const [selectedStep, setSelectedStep] = useState(null); // 1-7 or null
  const [isPaused, setIsPaused] = useState(false);
  const [isHoveringNode, setIsHoveringNode] = useState(false);

  // Dữ liệu chi tiết 7 Bước Onboarding chuẩn hóa hệ thống Self-Healing K8s
  const steps = [
    {
      num: 1,
      title: 'Tạo tài khoản',
      category: 'IDENTITY & IAM',
      icon: UserPlus,
      x: -160,
      y: -150,
      summary: 'Khởi tạo danh tính quản trị viên hệ thống với giao thức xác thực bảo mật đa yếu tố SSO/MFA.',
      howItWorks: [
        'Xác thực qua Google Workspace SSO, GitHub hoặc Enterprise SAML 2.0.',
        'Kích hoạt bảo mật đa yếu tố (MFA / WebAuthn FIDO2) bảo vệ phiên làm việc.',
        'Cấp phát cặp khóa mã hóa ban đầu và thiết lập quyền IAM Role tối thiểu (Least Privilege).',
      ],
      techSpecs: ['OAuth2 / OIDC', 'RSA-4096 / Ed25519', 'Zero-Trust IAM', 'Session JWT'],
      benefit: 'Bảo vệ danh tính quản trị viên tuyệt đối trước nguy cơ tấn công chiếm quyền điều khiển hạ tầng.',
    },
    {
      num: 2,
      title: 'Tạo tổ chức',
      category: 'MULTI-TENANCY',
      icon: Building2,
      x: 0,
      y: -165,
      summary: 'Thiết lập Tenant độc lập, phân nhóm làm việc SRE/DevOps và định cấu hình hạn mức tài nguyên.',
      howItWorks: [
        'Khởi tạo Workspace cô lập hoàn toàn về mặt logic và dữ liệu (Multi-tenant Architecture).',
        'Mời thành viên đội ngũ kỹ thuật và gán vai trò RBAC chi tiết (Admin, SRE, Operator, Viewer).',
        'Cấu hình hạn mức tài nguyên (Resource Quotas) và tích hợp kênh cảnh báo Slack, Teams, PagerDuty.',
      ],
      techSpecs: ['Tenant Data Isolation', 'Granular RBAC', 'Immudb Audit Logs', 'Webhook Web-Bus'],
      benefit: 'Phân quyền rành mạch giữa các nhóm kỹ sư, tránh thao tác nhầm lẫn hoặc chồng chéo hạ tầng.',
    },
    {
      num: 3,
      title: 'Tạo môi trường',
      category: 'SCOPING & SLA',
      icon: Layers,
      x: 160,
      y: -150,
      summary: 'Phân tách logic giữa Production, Staging và Dev với chính sách tự phục hồi độc lập.',
      howItWorks: [
        'Tạo các không gian môi trường chuyên biệt để phân tách vòng đời ứng dụng.',
        'Gán chính sách tự phục hồi (Self-Healing SLA/SLO Profiles) phù hợp với mức độ quan trọng.',
        'Áp dụng quy tắc bảo vệ nghiêm ngặt cho Production (xác thực kép khi auto-scaling hay rollback).',
      ],
      techSpecs: ['K8s Namespaces', 'Network Policies Isolation', 'SLA Target 99.99%', 'ConfigMap Profiles'],
      benefit: 'Đảm bảo môi trường Production luôn đạt độ sẵn sàng tối đa trong khi Dev/Staging được tự do thử nghiệm.',
    },
    {
      num: 4,
      title: 'Đăng ký K8s',
      category: 'CLUSTER CONNECTIVITY',
      icon: Server,
      x: 135,
      y: 0,
      summary: 'Kết nối an toàn đến API Server của cụm Kubernetes (EKS, GKE, AKS, On-Premise bare-metal).',
      howItWorks: [
        'Thiết lập kênh kết nối mTLS an toàn tới Endpoint API Server của Kubernetes Cluster.',
        'Tự động quét phiên bản cluster (hỗ trợ v1.24 - v1.32+) và kiểm tra các CRDs cần thiết.',
        'Cấp quyền ServiceAccount dạng Scoped ClusterRole chỉ đọc telemetry và điều phối tự phục hồi.',
      ],
      techSpecs: ['Kubernetes API v1', 'mTLS 1.3 Encryption', 'ClusterRole Scoped', 'Hybrid Cloud Support'],
      benefit: 'Tương thích 100% với mọi nền tảng Kubernetes hiện đại mà không xâm lấn nhân hệ điều hành.',
    },
    {
      num: 5,
      title: 'Tạo Token Agent',
      category: 'AUTHENTICATION',
      icon: Key,
      x: -5,
      y: 10,
      summary: 'Sinh mã Token dùng một lần có mã hóa ký số để xác thực Agent khi liên kết với Control Plane.',
      howItWorks: [
        'Control Plane sinh cặp khóa phiên tạm thời (Ephemeral Keypair) và mã Token JWT mã hóa ký số.',
        'Mã Token được khóa chặt theo Cluster ID và Environment ID tương ứng.',
        'Token chỉ cấp quyền đẩy dữ liệu telemetry và nhận chỉ thị tự sửa lỗi, chặn đứng mọi giả mạo.',
      ],
      techSpecs: ['Ed25519 Signature', 'Short-lived JWT', 'One-time Provisioning', 'Zero-Secret Leakage'],
      benefit: 'Chống tấn công giả mạo nguồn dữ liệu và loại trừ hoàn toàn nguy cơ lộ mật khẩu cụm máy chủ.',
    },
    {
      num: 6,
      title: 'Cài đặt Agent',
      category: 'OPERATOR & DAEMONSET',
      icon: Terminal,
      x: -145,
      y: 15,
      summary: 'Triển khai SelfHeal Agent qua Helm Chart / DaemonSet nhẹ với công nghệ eBPF Probe.',
      howItWorks: [
        'Thực thi lệnh triển khai nhanh `helm install selfheal-agent` hoặc áp dụng DaemonSet manifest.',
        'Agent tự động gắn kết vào Kubelet, Container Runtime (CRI) và eBPF tracepoints ở mức nhân Linux.',
        'Bắt đầu thu thập số liệu CPU, Memory, I/O, Network drops và sự kiện pod với độ trễ micro-giây.',
      ],
      techSpecs: ['Helm 3 / DaemonSet', 'eBPF Kernel Probes', '<50MB RAM Footprint', '<0.8% CPU Overhead'],
      benefit: 'Vận hành siêu nhẹ, không tiêu hao tài nguyên máy chủ và không yêu cầu khởi động lại các Pod.',
    },
    {
      num: 7,
      title: 'Bắt đầu giám sát',
      category: 'AUTONOMIC MAPE-K',
      icon: Activity,
      x: 0,
      y: 165,
      summary: 'Kích hoạt vòng lặp MAPE-K AI Engine tự động phát hiện sự cố và chữa lành pod/node tức thì.',
      howItWorks: [
        'Monitor: Liên tục quét log, metric, trace từ mọi Pod và Node theo chu kỳ 10 giây.',
        'Analyze: AI Engine phân tích tương quan lỗi (CrashLoopBackOff, OOMKilled, Pod Eviction, Disk Pressure).',
        'Plan & Execute: Tự động kích hoạt kịch bản khắc phục (Restart pod, scale out, điều hướng traffic) trong <2s.',
        'Knowledge: Lưu trữ RCA (Root-Cause Analysis) vào bộ tri thức để chủ động ngăn chặn sự cố tái diễn.',
      ],
      techSpecs: ['MAPE-K Autonomic Loop', 'MTTR < 2 Seconds', 'Zero-Downtime Pod Healing', 'Automated RCA'],
      benefit: 'Giảm 90% thời gian MTTR, xóa bỏ gánh nặng trực ca đêm cho SRE và giữ hệ thống đạt 99.99% uptime.',
    },
  ];

  // Mouse parallax tracking
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
    setIsHoveringNode(false);
  };

  // State Machine Timer Loop (Auto-play)
  useEffect(() => {
    let timeoutId;

    // Do not auto-advance if paused, inspecting details, or hovering a node
    if (isPaused || selectedStep !== null || isHoveringNode) {
      return () => clearTimeout(timeoutId);
    }

    if (phase === 'steps') {
      if (currentStep < 7) {
        timeoutId = setTimeout(() => {
          setCurrentStep((prev) => prev + 1);
        }, 1100);
      } else {
        // After Step 7 holds for 1.5s, start converging
        timeoutId = setTimeout(() => {
          setPhase('converging');
        }, 1500);
      }
    } else if (phase === 'converging') {
      // Convergence animation takes 850ms, then bloom out dashboard
      timeoutId = setTimeout(() => {
        setPhase('dashboard');
      }, 850);
    } else if (phase === 'dashboard') {
      // Hold Dashboard for 6.5s, then reset back to step 1
      timeoutId = setTimeout(() => {
        setPhase('steps');
        setCurrentStep(1);
      }, 6500);
    }

    return () => clearTimeout(timeoutId);
  }, [phase, currentStep, isPaused, selectedStep, isHoveringNode]);

  // Click on a step node
  const handleStepClick = (stepNum) => {
    setSelectedStep(stepNum);
    setIsPaused(true);
    if (phase !== 'steps') {
      setPhase('steps');
    }
  };

  // Switch to next/previous step inside detail card
  const handleNextStep = () => {
    setSelectedStep((prev) => Math.min((prev || 1) + 1, 7));
  };

  const handlePrevStep = () => {
    setSelectedStep((prev) => Math.max((prev || 1) - 1, 1));
  };

  // Replay from Step 1
  const handleReplay = () => {
    setSelectedStep(null);
    setIsPaused(false);
    setPhase('steps');
    setCurrentStep(1);
  };

  // Toggle pause/play
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // 3D Tilt calculation (subtle when modal is open so text is perfectly readable)
  const tiltFactor = selectedStep !== null ? 0.25 : 1;
  const tiltX = -mousePos.y * 5 * tiltFactor;
  const tiltY = mousePos.x * 7 * tiltFactor;

  const currentSelectedStepData = steps.find((s) => s.num === selectedStep);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="onboarding-3d-root"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '520px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1200px',
        overflow: 'visible',
      }}
    >
      {/* Background Subtle Technical Grid & Crosshairs */}
      <div
        style={{
          position: 'absolute',
          inset: '16px',
          border: '1px dashed rgba(61, 59, 79, 0.16)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <span style={{ position: 'absolute', top: '-7px', left: '-6px', color: 'var(--color-accent, #28E99F)', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>+</span>
        <span style={{ position: 'absolute', top: '-7px', right: '-6px', color: 'var(--color-accent, #28E99F)', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>+</span>
        <span style={{ position: 'absolute', bottom: '-7px', left: '-6px', color: 'var(--color-accent, #28E99F)', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>+</span>
        <span style={{ position: 'absolute', bottom: '-7px', right: '-6px', color: 'var(--color-accent, #28E99F)', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>+</span>

        {/* Status Indicator Tag & Controls at Top-Right */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'auto',
          }}
        >
          {/* Pause / Play Toggle Button */}
          <button
            type="button"
            onClick={handleTogglePause}
            title={isPaused ? "Tiếp tục chạy tự động" : "Tạm dừng tự động"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 7px',
              backgroundColor: isPaused ? 'rgba(40, 233, 159, 0.2)' : 'var(--color-canvas, #F4F5F6)',
              border: '1px solid var(--border-default, #D1D5DB)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: isPaused ? '#059669' : 'var(--color-primary, #3D3B4F)',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            {isPaused ? <Play size={10} fill="#059669" /> : <Pause size={10} fill="currentColor" />}
            <span>{isPaused ? 'TẠM DỪNG' : 'TỰ ĐỘNG'}</span>
          </button>

          {/* Current Step Status Tag */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              backgroundColor: 'var(--color-canvas, #F4F5F6)',
              border: '1px solid var(--border-default, #D1D5DB)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--color-primary, #3D3B4F)',
              borderRadius: '2px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: selectedStep !== null
                  ? '#28E99F'
                  : phase === 'dashboard'
                    ? '#28E99F'
                    : '#3D3B4F',
                boxShadow: selectedStep !== null ? '0 0 6px #28E99F' : 'none',
              }}
            />
            {selectedStep !== null
              ? `CHI TIẾT: BƯỚC 0${selectedStep}/07`
              : phase === 'dashboard'
                ? 'GIAI ĐOẠN: DASHBOARD'
                : phase === 'converging'
                  ? 'ĐANG GÔM TỤ...'
                  : `BƯỚC 0${currentStep}/07`}
          </div>
        </div>

        {/* Bottom Left Hint: Interactive Mouse Prompt */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            color: 'var(--text-muted, #6B7280)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.625rem',
            letterSpacing: '0.02em',
            pointerEvents: 'none',
          }}
        >
          <Info size={11} color="#059669" />
          <span>Click vào bất kỳ bước nào để xem chi tiết cơ chế hoạt động</span>
        </div>
      </div>

      {/* 3D Tilt Stage Wrapper */}
      <div
        className="tilt-stage-wrapper"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.2s cubic-bezier(0.2, 0, 0.35, 1)',
          zIndex: 5,
        }}
      >
        {/* ================= 1. THE 7 HEXAGON NODES ================= */}
        {steps.map((step) => {
          const isSelected = selectedStep === step.num;
          const isActive = selectedStep === null && phase === 'steps' && currentStep === step.num;
          const isCompleted = selectedStep !== null 
            ? step.num < selectedStep 
            : (phase === 'steps' ? currentStep > step.num : true);

          return (
            <HexagonStepNode
              key={step.num}
              stepNum={step.num}
              title={step.title}
              icon={step.icon}
              isActive={isActive}
              isCompleted={isCompleted}
              isSelected={isSelected}
              isConverging={selectedStep === null && (phase === 'converging' || phase === 'dashboard')}
              x={step.x}
              y={step.y}
              onClick={() => handleStepClick(step.num)}
              onMouseEnter={() => setIsHoveringNode(true)}
              onMouseLeave={() => setIsHoveringNode(false)}
            />
          );
        })}

        {/* ================= 2. CONNECTING ARROWS ================= */}
        {steps.slice(0, 6).map((step, idx) => {
          const nextStep = steps[idx + 1];
          const isArrowActive = selectedStep !== null
            ? selectedStep === step.num + 1
            : (phase === 'steps' && currentStep === step.num + 1);
          const isArrowCompleted = selectedStep !== null
            ? step.num + 1 < selectedStep
            : (phase === 'steps' && currentStep > step.num + 1);

          return (
            <ConnectingArrow
              key={`arrow-${step.num}`}
              fromX={step.x}
              fromY={step.y}
              toX={nextStep.x}
              toY={nextStep.y}
              isActive={isArrowActive}
              isCompleted={isArrowCompleted}
              isConverging={selectedStep === null && (phase === 'converging' || phase === 'dashboard')}
            />
          );
        })}

        {/* ================= 3. MINI DASHBOARD BLOOM ================= */}
        {selectedStep === null && (
          <MiniDashboardBloom
            isVisible={phase === 'dashboard'}
            onReplay={handleReplay}
          />
        )}
      </div>

      {/* ================= 4. STEP DETAIL MODAL OVERLAY ================= */}
      {selectedStep !== null && (
        <>
          {/* Subtle click-outside backdrop */}
          <div
            onClick={() => setSelectedStep(null)}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(61, 59, 79, 0.2)',
              backdropFilter: 'blur(3px)',
              zIndex: 32,
              cursor: 'pointer',
            }}
          />

          {/* Animated Detail Card */}
          <StepDetailCard
            step={currentSelectedStepData}
            totalSteps={7}
            onClose={() => setSelectedStep(null)}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            onSelectStep={(num) => setSelectedStep(num)}
            onResumeAutoPlay={() => {
              setSelectedStep(null);
              setIsPaused(false);
            }}
          />
        </>
      )}

      <style>{`
        @keyframes hexPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 1; }
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bloomExpand {
          0% {
            opacity: 0;
            transform: scale(0.3) translateZ(-80px);
          }
          60% {
            opacity: 1;
            transform: scale(1.03) translateZ(30px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateZ(20px);
          }
        }
      `}</style>
    </div>
  );
};

export default OnboardingSequence3D;
