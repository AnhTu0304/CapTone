import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Check, X, Sparkles, Cpu, Lock, Unlock } from 'lucide-react';

/**
 * HumanInTheLoop3D (Three.js - AI Proposes. Human Decides. Agent Executes.)
 * 
 * Sa bàn 3D thể hiện cơ chế bảo mật tối cao Human-In-The-Loop:
 * 1. Phân vùng Trái (AI RECOMMENDATION - Cyan/Teal):
 *    - Các thẻ đề xuất hành động AI: ROLLBACK DEPLOYMENT, RESTART POD, SCALE REPLICAS.
 *    - Thẻ di chuyển lướt về phía cổng kiểm soát và bị chặn lại.
 * 2. Phân vùng Giữa (HUMAN APPROVAL GATE - Trắng ấm / Hổ phách):
 *    - Cổng bảo mật trừu tượng với các vành đai đồng tâm đa tốc độ.
 *    - Lõi thẩm quyền con người (Silhouette đầu & vai người tối giản hình học).
 *    - Trạng thái ban đầu: LOCKED (Khóa chặt).
 * 3. Phân vùng Phải (KUBERNETES AGENT - Violet/Cyan):
 *    - Node trung tâm K8s Agent (Bát diện Octahedron) và cụm Pods vệ tinh với nhịp đập pulse.
 * 4. Tương tác Phê duyệt & Từ chối:
 *    - Click duyệt: Cổng mở cơ học, luồng photon phóng xuyên qua, thẻ lướt sang K8s Agent thực thi.
 */

// AI Recommendation Cards Data
const RECOMMENDATIONS = [
  {
    id: 'rollback',
    title: 'ROLLBACK DEPLOYMENT',
    risk: 'HIGH RISK',
    riskColor: '#F59E0B',
    detail: 'v2.4.1 → v2.3.9 • DB Migration Revert',
    target: 'prod-checkout-service',
  },
  {
    id: 'restart',
    title: 'RESTART CRASH POD',
    risk: 'LOW RISK',
    riskColor: '#28E99F',
    detail: 'OOMKilled Pod • Memory Limit +256Mi',
    target: 'auth-gateway-7f9b',
  },
  {
    id: 'scale',
    title: 'SCALE NODE REPLICAS',
    risk: 'MEDIUM RISK',
    riskColor: '#00F2FE',
    detail: 'Traffic Surge +180% • Scale 2 → 5',
    target: 'worker-pool-standard',
  },
];

export const HumanInTheLoop3D = ({ className = '' }) => {
  const mountRef = useRef(null);
  const [webGLSupported, setWebGLSupported] = useState(true);

  // States: 'awaiting' | 'approved' | 'rejected'
  const [gateState, setGateState] = useState('awaiting');
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isHoveringGate, setIsHoveringGate] = useState(false);

  // Ref to trigger state machine transitions from React buttons into Three.js render loop
  const actionTriggerRef = useRef(null);

  // Callback to approve
  const handleApprove = useCallback(() => {
    if (gateState !== 'awaiting') return;
    setGateState('approved');
    if (actionTriggerRef.current) {
      actionTriggerRef.current.triggerApprove();
    }
  }, [gateState]);

  const handleApproveRef = useRef(handleApprove);
  useEffect(() => {
    handleApproveRef.current = handleApprove;
  }, [handleApprove]);

  // Callback to reject
  const handleReject = useCallback(() => {
    if (gateState !== 'awaiting') return;
    setGateState('rejected');
    if (actionTriggerRef.current) {
      actionTriggerRef.current.triggerReject();
    }
  }, [gateState]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // WebGL Capability Check
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGLSupported(false);
        return;
      }
    } catch {
      setWebGLSupported(false);
      return;
    }

    const width = container.clientWidth || 580;
    const height = container.clientHeight || 340;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x131222, 0.065);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 6.4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x131222, 1);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Warm key light for central gate
    const gateKeyLight = new THREE.PointLight(0xfef08a, 1.8, 12);
    gateKeyLight.position.set(0, 1.5, 3.5);
    scene.add(gateKeyLight);

    // Cyan key light for left AI zone
    const aiLight = new THREE.PointLight(0x00f2fe, 1.4, 10);
    aiLight.position.set(-2.5, 0.5, 2.5);
    scene.add(aiLight);

    // Violet light for right K8s agent zone
    const agentLight = new THREE.PointLight(0x8b5cf6, 1.6, 10);
    agentLight.position.set(2.4, 0.5, 2.5);
    scene.add(agentLight);

    // Floor Grid
    const floorGrid = new THREE.GridHelper(16, 20, 0x28e99f, 0x222036);
    floorGrid.position.set(0, -1.65, 0);
    if (floorGrid.material) {
      floorGrid.material.transparent = true;
      floorGrid.material.opacity = 0.20;
    }
    scene.add(floorGrid);

    // Raycaster for 3D clicks on the gate
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    // =========================================================================
    // 3. ZONE 1: AI RECOMMENDATION CARD (LEFT ZONE)
    // =========================================================================
    const aiCardGroup = new THREE.Group();
    aiCardGroup.position.set(-2.0, 0.05, 0);
    scene.add(aiCardGroup);

    // Helper: generate crisp 2D canvas texture for holographic action card
    const createCardCanvasTexture = (rec) => {
      const cvs = document.createElement('canvas');
      cvs.width = 300;
      cvs.height = 175;
      const ctx = cvs.getContext('2d');
      if (!ctx) return null;

      // Dark card surface
      ctx.fillStyle = '#141326';
      ctx.fillRect(0, 0, 300, 175);

      // Cyan tech border
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 296, 171);

      // Corner technical crosshairs
      ctx.fillStyle = '#6E6B82';
      ctx.font = '13px monospace';
      ctx.fillText('+', 8, 16);
      ctx.fillText('+', 284, 16);

      // Header Tag: [AI RECOMMENDATION]
      ctx.fillStyle = '#00f2fe';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('[AI RECOMMENDATION]', 16, 28);

      // Risk Badge (Amber/Mint/Cyan)
      ctx.fillStyle = rec.riskColor;
      ctx.fillRect(16, 42, 8, 8);
      ctx.font = 'bold 12px monospace';
      ctx.fillText(rec.risk, 30, 50);

      // Action Title
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(rec.title, 16, 82);

      // Detail subtitle
      ctx.font = '13px monospace';
      ctx.fillStyle = '#A4A0B8';
      ctx.fillText(rec.detail, 16, 108);

      // Target pod
      ctx.font = '12px monospace';
      ctx.fillStyle = '#6E6B82';
      ctx.fillText(`Target: ${rec.target}`, 16, 128);

      // Status Bar: PAUSED AT GATE
      ctx.fillStyle = '#222038';
      ctx.fillRect(16, 142, 268, 2);

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#F59E0B';
      ctx.fillText('• PAUSED AT GATE // AWAITING HUMAN', 16, 162);

      return new THREE.CanvasTexture(cvs);
    };

    const cardTextures = RECOMMENDATIONS.map((r) => createCardCanvasTexture(r));
    const cardMeshMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: cardTextures[0],
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 1,
    });

    const cardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.72, 0.02),
      cardMeshMaterial
    );
    aiCardGroup.add(cardMesh);

    // Card glowing rim
    const cardWire = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.73, 0.024),
      new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
      })
    );
    aiCardGroup.add(cardWire);

    // Laser trail connecting Card to Gate
    const trailCurve = new THREE.LineCurve3(
      new THREE.Vector3(0.65, 0, 0),
      new THREE.Vector3(1.35, 0, 0)
    );
    const trailPoints = trailCurve.getPoints(12);
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPoints);
    const trailMat = new THREE.LineDashedMaterial({
      color: 0x00f2fe,
      dashSize: 0.12,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.6,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    trailLine.computeLineDistances();
    aiCardGroup.add(trailLine);

    // =========================================================================
    // 4. ZONE 2: HUMAN APPROVAL GATE (CENTER FOCAL POINT)
    // =========================================================================
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0.05, 0);
    scene.add(gateGroup);

    // 4.1 Outer Concentric Segmented Ring (Warm White / Amber)
    const outerRingGroup = new THREE.Group();
    gateGroup.add(outerRingGroup);

    const outerRingGeo = new THREE.TorusGeometry(1.28, 0.022, 16, 64);
    const outerRingMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.7,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRingGroup.add(outerRing);

    // 8 Small Tick Nodes along the outer ring
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const nodeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      nodeMesh.position.set(Math.cos(angle) * 1.28, Math.sin(angle) * 1.28, 0);
      outerRingGroup.add(nodeMesh);
    }

    // 4.2 Middle Concentric Hexagonal Reticle Ring
    const middleRingGroup = new THREE.Group();
    gateGroup.add(middleRingGroup);

    const midRingGeo = new THREE.TorusGeometry(0.96, 0.018, 16, 48);
    const midRingMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      metalness: 0.6,
    });
    const midRing = new THREE.Mesh(midRingGeo, midRingMat);
    middleRingGroup.add(midRing);

    // Hexagonal Wireframe Bracket
    const hexCircleGeo = new THREE.CircleGeometry(0.94, 6);
    const hexWireGeo = new THREE.WireframeGeometry(hexCircleGeo);
    const hexWire = new THREE.LineSegments(
      hexWireGeo,
      new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.35 })
    );
    middleRingGroup.add(hexWire);

    // 4.3 Inner Aperture Iris Blades (Expand open when approved)
    const irisGroup = new THREE.Group();
    gateGroup.add(irisGroup);

    const irisBlades = [];
    for (let b = 0; b < 6; b++) {
      const bladeAngle = (b / 6) * Math.PI * 2;
      const bladeGeo = new THREE.RingGeometry(0.60, 0.76, 12, 1, bladeAngle, Math.PI / 3.8);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x3d3b4f,
        emissive: 0x1e1b2e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, 0, 0.02);
      irisGroup.add(blade);
      irisBlades.push({ mesh: blade, baseAngle: bladeAngle });
    }

    // 4.4 Central Human Authorization Core (Abstract Human Silhouette)
    const humanCoreGroup = new THREE.Group();
    humanCoreGroup.position.set(0, 0, 0.04);
    gateGroup.add(humanCoreGroup);

    // Halo ring around the human silhouette
    const humanHaloMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });
    const humanHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.018, 16, 36),
      humanHaloMat
    );
    humanCoreGroup.add(humanHalo);

    // Head: Geometric sphere
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.4,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), headMat);
    head.position.set(0, 0.10, 0);
    humanCoreGroup.add(head);

    // Shoulders & Chest: Sculpted trapezoidal prism
    const chestGeo = new THREE.CylinderGeometry(0.14, 0.28, 0.22, 16);
    const chestMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.5,
    });
    const chest = new THREE.Mesh(chestGeo, chestMat);
    chest.position.set(0, -0.10, 0);
    humanCoreGroup.add(chest);

    // Hit-testing invisible sphere for Gate click
    const gateHitSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    gateGroup.add(gateHitSphere);

    // Energy Pulse Beam from Gate to K8s Agent (fires upon approval)
    const beamCurve = new THREE.LineCurve3(
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(2.0, 0.05, 0)
    );
    const beamGeo = new THREE.BufferGeometry().setFromPoints(beamCurve.getPoints(20));
    const beamMat = new THREE.LineBasicMaterial({
      color: 0x28e99f,
      transparent: true,
      opacity: 0,
      linewidth: 3,
    });
    const beamLine = new THREE.Line(beamGeo, beamMat);
    scene.add(beamLine);

    // Traveling Energy Photon Particle
    const photonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x28e99f })
    );
    photonMesh.visible = false;
    scene.add(photonMesh);

    // =========================================================================
    // 5. ZONE 3: KUBERNETES AGENT (RIGHT ZONE)
    // =========================================================================
    const k8sAgentGroup = new THREE.Group();
    k8sAgentGroup.position.set(2.05, 0.05, 0);
    scene.add(k8sAgentGroup);

    // Central Agent Node: Faceted Octahedron
    const agentNodeMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x6d28d9,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.7,
    });
    const agentNode = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38, 0),
      agentNodeMat
    );
    k8sAgentGroup.add(agentNode);

    // Agent Wireframe Cage
    const agentWire = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.85 })
    );
    k8sAgentGroup.add(agentWire);

    // Surrounding 4 Pod Nodes
    const podOffsets = [
      new THREE.Vector3(-0.45, 0.52, 0.1),
      new THREE.Vector3(0.52, 0.48, -0.15),
      new THREE.Vector3(0.55, -0.45, 0.1),
      new THREE.Vector3(-0.48, -0.48, -0.1),
    ];

    const podMeshes = podOffsets.map((pos, i) => {
      const pod = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.18),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.5,
          roughness: 0.3,
        })
      );
      pod.position.copy(pos);
      k8sAgentGroup.add(pod);

      // Connecting trace line from agent to pod
      const pLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        pos,
      ]);
      const pLine = new THREE.Line(
        pLineGeo,
        new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.45 })
      );
      k8sAgentGroup.add(pLine);

      return pod;
    });

    // =========================================================================
    // 6. ANIMATION & STATE MACHINE CONTROLLER
    // =========================================================================
    let animPhase = 'idle'; // 'idle' | 'approving' | 'rejecting'
    let phaseTime = 0;
    let nextCardIndex = 0;

    // Register trigger callback for React UI buttons
    actionTriggerRef.current = {
      triggerApprove: () => {
        if (animPhase !== 'idle') return;
        animPhase = 'approving';
        phaseTime = 0;
      },
      triggerReject: () => {
        if (animPhase !== 'idle') return;
        animPhase = 'rejecting';
        phaseTime = 0;
      },
    };

    // Parallax tracking
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    const handlePointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetParallaxX = x * 0.12;
      targetParallaxY = -y * 0.10;

      // Raycast test on the gate hit sphere for hover feedback
      mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObject(gateHitSphere);
      setIsHoveringGate(intersects.length > 0);
    };

    const handleCanvasClick = (e) => {
      const rect = container.getBoundingClientRect();
      mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObject(gateHitSphere);
      if (intersects.length > 0) {
        handleApproveRef.current();
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handleCanvasClick);

    const clock = new THREE.Clock();
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Camera parallax
      camera.position.x += (targetParallaxX - camera.position.x) * 0.06;
      camera.position.y += (0.25 + targetParallaxY - camera.position.y) * 0.06;
      camera.lookAt(0, 0, 0);

      // 6.1 Idle Rotations & Pulses
      const ringSpeedMult = isHoveringGate ? 1.8 : 1.0;
      outerRingGroup.rotation.z += 0.4 * delta * ringSpeedMult;
      middleRingGroup.rotation.z -= 0.6 * delta * ringSpeedMult;

      // K8s Agent pulse and rotation
      agentNode.rotation.y += 1.2 * delta;
      agentNode.rotation.x += 0.6 * delta;
      agentWire.rotation.y -= 0.9 * delta;

      // Subtle heartbeat pulse on pods
      const podPulse = 1 + Math.sin(elapsed * 4) * 0.08;
      podMeshes.forEach((pod, idx) => {
        pod.scale.set(podPulse, podPulse, podPulse);
      });

      // AI Card floating motion
      const floatY = Math.sin(elapsed * 1.6) * 0.04;
      aiCardGroup.position.y = 0.05 + floatY;

      // 6.2 Phase Transitions
      if (animPhase === 'idle') {
        // Human core color: warm amber/white
        headMat.color.setHex(0xfef08a);
        headMat.emissive.setHex(0xf59e0b);
        headMat.emissiveIntensity = isHoveringGate ? 0.9 : 0.4;

        chestMat.color.setHex(0xfef08a);
        chestMat.emissive.setHex(0xd97706);
        chestMat.emissiveIntensity = isHoveringGate ? 0.8 : 0.3;

        humanHaloMat.color.setHex(isHoveringGate ? 0xfffbeb : 0xfef08a);
        outerRingMat.emissive.setHex(isHoveringGate ? 0xf59e0b : 0xd97706);

        // Iris blades closed
        irisBlades.forEach((b) => {
          b.mesh.position.set(0, 0, 0.02);
          b.mesh.scale.set(1, 1, 1);
        });

        // Beam & photon hidden
        beamMat.opacity = 0;
        photonMesh.visible = false;

        // Card resting position
        aiCardGroup.position.x = -2.0;
        aiCardGroup.scale.set(1, 1, 1);
        cardMeshMaterial.opacity = 1;
      } 
      else if (animPhase === 'approving') {
        phaseTime += delta;

        // Turn Core to Vibrant Mint Green (#28E99F)
        headMat.color.setHex(0x28e99f);
        headMat.emissive.setHex(0x10b981);
        headMat.emissiveIntensity = 1.2;

        chestMat.color.setHex(0x28e99f);
        chestMat.emissive.setHex(0x059669);
        chestMat.emissiveIntensity = 1.0;

        humanHaloMat.color.setHex(0x28e99f);
        outerRingMat.emissive.setHex(0x10b981);

        // Stage A: Iris Aperture Opens Geometrically (0s - 0.7s)
        const openT = THREE.MathUtils.clamp(phaseTime / 0.6, 0, 1);
        irisBlades.forEach((b, i) => {
          const pushX = Math.cos(b.baseAngle) * openT * 0.35;
          const pushY = Math.sin(b.baseAngle) * openT * 0.35;
          b.mesh.position.set(pushX, pushY, 0.02);
          b.mesh.scale.set(1 - openT * 0.3, 1 - openT * 0.3, 1);
        });

        // Stage B: Energy Beam & Photon Surge (0.4s - 1.6s)
        if (phaseTime > 0.3 && phaseTime < 1.8) {
          beamMat.opacity = Math.sin((phaseTime - 0.3) / 1.5 * Math.PI) * 0.9;
          photonMesh.visible = true;
          const photonProgress = THREE.MathUtils.clamp((phaseTime - 0.3) / 1.3, 0, 1);
          photonMesh.position.set(photonProgress * 2.05, 0.05, 0);
        } else {
          beamMat.opacity = 0;
          photonMesh.visible = false;
        }

        // Stage C: AI Card glides through gate into Agent (0.5s - 1.8s)
        if (phaseTime > 0.4) {
          const cardMoveT = THREE.MathUtils.clamp((phaseTime - 0.4) / 1.3, 0, 1);
          // Ease in-out
          const easeT = cardMoveT < 0.5 ? 2 * cardMoveT * cardMoveT : -1 + (4 - 2 * cardMoveT) * cardMoveT;
          aiCardGroup.position.x = -2.0 + easeT * 4.05; // moves from -2.0 to +2.05
          
          if (cardMoveT > 0.7) {
            const shrinkT = (cardMoveT - 0.7) / 0.3;
            aiCardGroup.scale.set(1 - shrinkT * 0.8, 1 - shrinkT * 0.8, 1 - shrinkT * 0.8);
            cardMeshMaterial.opacity = 1 - shrinkT;
          }
        }

        // Stage D: Agent Flash upon absorption (1.6s - 2.2s)
        if (phaseTime > 1.5) {
          agentNodeMat.emissive.setHex(0x28e99f);
          agentNodeMat.emissiveIntensity = 1.8;
        }

        // Reset to next card after 2.4s
        if (phaseTime >= 2.4) {
          animPhase = 'idle';
          phaseTime = 0;
          agentNodeMat.emissive.setHex(0x6d28d9);
          agentNodeMat.emissiveIntensity = 0.7;

          // Advance to next recommendation card
          nextCardIndex = (nextCardIndex + 1) % RECOMMENDATIONS.length;
          setActiveCardIndex(nextCardIndex);
          setGateState('awaiting');

          // Update card texture from pre-cached textures
          cardMeshMaterial.map = cardTextures[nextCardIndex];
          cardMeshMaterial.needsUpdate = true;
        }
      } 
      else if (animPhase === 'rejecting') {
        phaseTime += delta;

        // Gate turns muted red/amber warning
        headMat.color.setHex(0xef4444);
        headMat.emissive.setHex(0x991b1b);
        headMat.emissiveIntensity = 1.0;
        outerRingMat.emissive.setHex(0xef4444);

        // Card pushes backward and fades out
        aiCardGroup.position.x = -2.0 - (phaseTime / 1.5) * 0.8;
        cardMeshMaterial.opacity = Math.max(0, 1 - phaseTime / 1.2);

        // Reset after 1.8s
        if (phaseTime >= 1.8) {
          animPhase = 'idle';
          phaseTime = 0;
          nextCardIndex = (nextCardIndex + 1) % RECOMMENDATIONS.length;
          setActiveCardIndex(nextCardIndex);
          setGateState('awaiting');

          cardMeshMaterial.map = cardTextures[nextCardIndex];
          cardMeshMaterial.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 580;
      const newH = container.clientHeight || 340;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup WebGL resources on unmount
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handleCanvasClick);

      if (container && renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();

      // Dispose all materials & geometries
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      cardTextures.forEach((t) => t?.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`human-in-the-loop-card-root ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '340px',
        height: '340px',
        backgroundColor: '#131222',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Corner crosshairs (+) matching technical blueprint */}
      <div style={{ position: 'absolute', top: '8px', left: '8px', color: '#4E4966', fontFamily: 'var(--font-mono)', fontSize: '11px', pointerEvents: 'none', zIndex: 5 }}>+</div>
      <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#4E4966', fontFamily: 'var(--font-mono)', fontSize: '11px', pointerEvents: 'none', zIndex: 5 }}>+</div>
      <div style={{ position: 'absolute', bottom: '8px', left: '8px', color: '#4E4966', fontFamily: 'var(--font-mono)', fontSize: '11px', pointerEvents: 'none', zIndex: 5 }}>+</div>
      <div style={{ position: 'absolute', bottom: '8px', right: '8px', color: '#4E4966', fontFamily: 'var(--font-mono)', fontSize: '11px', pointerEvents: 'none', zIndex: 5 }}>+</div>

      {/* Top Left: Core Concept Motto */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: '#9CA3AF',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: '#00F2FE' }}>AI PROPOSES</span>
        <span style={{ fontSize: '0.625rem', color: '#00F2FE', opacity: 0.85 }}>[{activeCardIndex + 1}/3]</span>
        <span>→</span>
        <span style={{ color: '#FDE68A' }}>HUMAN DECIDES</span>
        <span>→</span>
        <span style={{ color: '#8B5CF6' }}>AGENT EXECUTES</span>
      </div>

      {/* Top Right: Gate Status Indicator Badge */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: gateState === 'approved' 
            ? 'rgba(40, 233, 159, 0.18)' 
            : gateState === 'rejected' 
              ? 'rgba(239, 68, 68, 0.18)' 
              : 'rgba(245, 158, 11, 0.12)',
          border: `1px solid ${
            gateState === 'approved' ? '#28E99F' : gateState === 'rejected' ? '#EF4444' : '#F59E0B'
          }`,
          borderRadius: '3px',
          zIndex: 10,
          backdropFilter: 'blur(6px)',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: gateState === 'approved' ? '#28E99F' : gateState === 'rejected' ? '#EF4444' : '#FDE68A',
        }}
      >
        {gateState === 'approved' ? (
          <>
            <Unlock size={12} color="#28E99F" />
            <span>AUTHORIZED // GATE OPEN</span>
          </>
        ) : gateState === 'rejected' ? (
          <>
            <Lock size={12} color="#EF4444" />
            <span>ACTION REJECTED // BLOCKED</span>
          </>
        ) : (
          <>
            <Lock size={12} color="#FDE68A" />
            <span>HUMAN APPROVAL REQUIRED</span>
          </>
        )}
      </div>

      {/* Three Zones Subtitle Labels (Bottom of Scene) */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 24px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.625rem',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
          zIndex: 8,
        }}
      >
        <div style={{ color: '#00F2FE', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles size={11} />
          <span>1. AI RECOMMENDATION</span>
        </div>
        <div style={{ color: '#FDE68A', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>2. APPROVAL GATE</span>
        </div>
        <div style={{ color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Cpu size={11} />
          <span>3. K8S AGENT</span>
        </div>
      </div>

      {/* Interactive Floating Decision Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 15,
        }}
      >
        {gateState === 'awaiting' ? (
          <>
            <button
              type="button"
              onClick={handleApprove}
              title="Phê duyệt lệnh hạ tầng"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: 'var(--color-accent, #28E99F)',
                color: '#000000',
                border: 'none',
                borderRadius: '4px',
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(40, 233, 159, 0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1FE092';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-accent, #28E99F)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Check size={13} strokeWidth={2.6} />
              <span>Phê duyệt (Approve)</span>
            </button>

            <button
              type="button"
              onClick={handleReject}
              title="Từ chối đề xuất này"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                backgroundColor: 'rgba(30, 28, 48, 0.85)',
                color: '#E5E7EB',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '4px',
                fontFamily: 'var(--font-body, sans-serif)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.borderColor = '#EF4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(30, 28, 48, 0.85)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
            >
              <X size={13} />
              <span>Từ chối</span>
            </button>
          </>
        ) : (
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.6875rem',
              color: gateState === 'approved' ? '#28E99F' : '#EF4444',
              backgroundColor: 'rgba(19, 18, 34, 0.9)',
              padding: '4px 12px',
              border: `1px dashed ${gateState === 'approved' ? '#28E99F' : '#EF4444'}`,
              borderRadius: '4px',
              letterSpacing: '0.04em',
            }}
          >
            {gateState === 'approved'
              ? 'ĐANG CHUYỂN TIẾP LỆNH SANG KUBERNETES AGENT...'
              : 'ĐÃ HỦY THỰC THI ĐỀ XUẤT NÀY.'}
          </div>
        )}
      </div>

      {/* Hover Hint on the Gate */}
      {isHoveringGate && gateState === 'awaiting' && (
        <div
          style={{
            position: 'absolute',
            top: '46%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 12,
            backgroundColor: 'rgba(19, 18, 34, 0.92)',
            border: '1px solid #FDE68A',
            padding: '3px 8px',
            borderRadius: '2px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.625rem',
            color: '#FDE68A',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          CLICK ĐỂ MỞ CỔNG PHÊ DUYỆT
        </div>
      )}

      {/* Three.js Dedicated Canvas Container */}
      <div
        ref={mountRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: isHoveringGate && gateState === 'awaiting' ? 'pointer' : 'default',
        }}
      />

      {/* WebGL Fallback */}
      {!webGLSupported && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#131222',
            zIndex: 1,
          }}
        >
          [3D Human-In-The-Loop Control Simulation]
        </div>
      )}
    </div>
  );
};

export default HumanInTheLoop3D;
