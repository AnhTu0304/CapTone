import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Cpu, Database, Network, Clock, AlertTriangle, Activity } from 'lucide-react';

/**
 * AIPredictionCore3D
 * 
 * Linh kiện 3D Three.js cao cấp trực quan hóa cơ chế "Dự báo bằng AI":
 * 1. AI Prediction Core: Lõi đa diện lơ lửng, gồm nhiều tầng hình học xoay ngược chiều (Octahedron, Icosahedron, Dodecahedron)
 *    và mạng nơ-ron phát quang Cyan/Teal #28E99F / #00F0FF.
 * 2. 4 Luồng Telemetry: CPU, MEMORY, NETWORK, LATENCY trôi hạt theo đường cong 3D hội tụ vào tâm Core.
 * 3. 3 Quỹ đạo Tương lai (Future Trajectories) rẽ nhánh sang phải:
 *    - Ổn định (Healthy - Xanh Mint)
 *    - Suy giảm (Degraded - Xanh lam)
 *    - Nguy cơ cao (High-risk - Hổ phách -> Đỏ)
 * 4. Điểm Bất Thường (Anomaly Marker) & Thẻ Holographic HUD:
 *    "AI PREDICTION" / "Memory Exhaustion" / "87% confidence" / "~18 min".
 * 5. Trục Thời Gian Kỹ Thuật (Time Axis): NOW -> +10m -> +20m -> +30m.
 * 6. Tương tác Chuột Parallax & Hover Highlight từng luồng dữ liệu.
 */
export const AIPredictionCore3D = ({ className = '' }) => {
  const mountRef = useRef(null);
  const [selectedStream, setSelectedStream] = useState(null);
  const [hoveredAnomaly, setHoveredAnomaly] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState(true);

  // Metric metadata
  const streamInfo = {
    CPU: { label: 'CPU utilization', stat: '78.4% (Spike +14%)', color: '#38BDF8', icon: Cpu },
    MEMORY: { label: 'Memory utilization', stat: '91.8% (Leaking ~2.4MB/s)', color: '#28E99F', icon: Database },
    NETWORK: { label: 'Network traffic', stat: '14.2k req/s (Stable)', color: '#818CF8', icon: Network },
    LATENCY: { label: 'Request latency', stat: '1.2ms (P99 < 3.5ms)', color: '#F59E0B', icon: Clock },
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability (fallback gracefully in jsdom test environments)
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGLSupported(false);
        return;
      }
    } catch {
      setWebGLSupported(false);
      return;
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 320;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x161522, 0.08);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0.2, 0.8, 7.2);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x161522, 1);
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLightCore = new THREE.PointLight(0x28e99f, 3.5, 12);
    pointLightCore.position.set(-1.4, 0.2, 1.0);
    scene.add(pointLightCore);

    const pointLightAnomaly = new THREE.PointLight(0xef4444, 2.5, 8);
    pointLightAnomaly.position.set(2.2, 1.35, 0.5);
    scene.add(pointLightAnomaly);

    // 4. Subtle Temporal Ground Grid
    const gridHelper = new THREE.GridHelper(14, 18, 0x28e99f, 0x282637);
    gridHelper.position.set(0, -1.7, 0);
    if (gridHelper.material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.35;
    }
    scene.add(gridHelper);

    // ==========================================
    // 5. AI PREDICTION CORE (Multi-layer Polyhedron)
    // ==========================================
    const coreGroup = new THREE.Group();
    coreGroup.position.set(-1.4, 0.2, 0);
    scene.add(coreGroup);

    // 5a. Central Glowing Node
    const centerNodeGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const centerNodeMat = new THREE.MeshBasicMaterial({ color: 0x28e99f, wireframe: false });
    const centerNode = new THREE.Mesh(centerNodeGeo, centerNodeMat);
    coreGroup.add(centerNode);

    // 5b. Inner Rotating Polyhedron (Octahedron)
    const innerOctaGeo = new THREE.OctahedronGeometry(0.55, 0);
    const innerOctaMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const innerOcta = new THREE.Mesh(innerOctaGeo, innerOctaMat);
    coreGroup.add(innerOcta);

    // 5c. Neural Lattice (Icosahedron)
    const neuralLatticeGeo = new THREE.IcosahedronGeometry(0.85, 1);
    const neuralLatticeMat = new THREE.MeshBasicMaterial({
      color: 0x28e99f,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const neuralLattice = new THREE.Mesh(neuralLatticeGeo, neuralLatticeMat);
    coreGroup.add(neuralLattice);

    // 5d. Outer Geometric Shield (Dodecahedron)
    const outerDodecaGeo = new THREE.DodecahedronGeometry(1.2, 0);
    const outerDodecaMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const outerDodeca = new THREE.Mesh(outerDodecaGeo, outerDodecaMat);
    coreGroup.add(outerDodeca);

    // 5e. Orbiting Core Swarm Particles
    const coreParticleCount = 240;
    const coreParticleGeo = new THREE.BufferGeometry();
    const coreParticlePositions = new Float32Array(coreParticleCount * 3);
    const coreParticleAngles = new Float32Array(coreParticleCount);
    const coreParticleRadii = new Float32Array(coreParticleCount);
    const coreParticleSpeeds = new Float32Array(coreParticleCount);

    for (let i = 0; i < coreParticleCount; i++) {
      coreParticleAngles[i] = Math.random() * Math.PI * 2;
      coreParticleRadii[i] = 1.0 + Math.random() * 0.7;
      coreParticleSpeeds[i] = 0.01 + Math.random() * 0.02;

      const x = Math.cos(coreParticleAngles[i]) * coreParticleRadii[i];
      const y = (Math.random() - 0.5) * 0.8;
      const z = Math.sin(coreParticleAngles[i]) * coreParticleRadii[i];

      coreParticlePositions[i * 3] = x;
      coreParticlePositions[i * 3 + 1] = y;
      coreParticlePositions[i * 3 + 2] = z;
    }

    coreParticleGeo.setAttribute('position', new THREE.BufferAttribute(coreParticlePositions, 3));
    const coreParticleMat = new THREE.PointsMaterial({
      color: 0x28e99f,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
    });
    const coreParticleSystem = new THREE.Points(coreParticleGeo, coreParticleMat);
    coreGroup.add(coreParticleSystem);

    // ==========================================
    // 6. TELEMETRY STREAMS (4 Inflowing Curves & Particles)
    // ==========================================
    const streamConfigs = [
      {
        name: 'CPU',
        color: 0x38bdf8,
        points: [
          new THREE.Vector3(-4.4, 1.8, -0.6),
          new THREE.Vector3(-3.2, 1.4, -0.3),
          new THREE.Vector3(-2.2, 0.8, -0.1),
          new THREE.Vector3(-1.4, 0.2, 0),
        ],
      },
      {
        name: 'MEMORY',
        color: 0x28e99f,
        points: [
          new THREE.Vector3(-4.6, 0.4, 0.9),
          new THREE.Vector3(-3.4, 0.5, 0.6),
          new THREE.Vector3(-2.3, 0.35, 0.3),
          new THREE.Vector3(-1.4, 0.2, 0),
        ],
      },
      {
        name: 'NETWORK',
        color: 0x818cf8,
        points: [
          new THREE.Vector3(-4.2, -1.1, 0.5),
          new THREE.Vector3(-3.1, -0.7, 0.35),
          new THREE.Vector3(-2.1, -0.2, 0.15),
          new THREE.Vector3(-1.4, 0.2, 0),
        ],
      },
      {
        name: 'LATENCY',
        color: 0xf59e0b,
        points: [
          new THREE.Vector3(-3.8, -1.8, -0.5),
          new THREE.Vector3(-2.9, -1.2, -0.3),
          new THREE.Vector3(-2.0, -0.5, -0.1),
          new THREE.Vector3(-1.4, 0.2, 0),
        ],
      },
    ];

    const telemetryStreams = [];

    streamConfigs.forEach((cfg) => {
      const curve = new THREE.CatmullRomCurve3(cfg.points);
      const pointsCount = 60;
      const curvePoints = curve.getPoints(pointsCount);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.35,
        linewidth: 1,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      // Inflowing Particles along Curve
      const pCount = 50;
      const pGeo = new THREE.BufferGeometry();
      const pPos = new Float32Array(pCount * 3);
      const pOffsets = new Float32Array(pCount);

      for (let i = 0; i < pCount; i++) {
        pOffsets[i] = i / pCount;
        const pt = curve.getPointAt(pOffsets[i]);
        pPos[i * 3] = pt.x;
        pPos[i * 3 + 1] = pt.y;
        pPos[i * 3 + 2] = pt.z;
      }

      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({
        color: cfg.color,
        size: 0.055,
        transparent: true,
        opacity: 0.9,
      });
      const pSystem = new THREE.Points(pGeo, pMat);
      scene.add(pSystem);

      telemetryStreams.push({
        name: cfg.name,
        curve,
        pGeo,
        pOffsets,
        pCount,
        lineMat,
        pMat,
        baseColor: cfg.color,
      });
    });

    // ==========================================
    // 7. PREDICTION TRAJECTORIES (Branching to the Right)
    // ==========================================
    const trajectoryConfigs = [
      {
        name: 'HEALTHY',
        color: 0x28e99f,
        points: [
          new THREE.Vector3(-1.4, 0.2, 0),
          new THREE.Vector3(0.0, 0.22, 0.1),
          new THREE.Vector3(1.6, 0.24, 0.2),
          new THREE.Vector3(3.2, 0.18, 0.0),
          new THREE.Vector3(4.2, 0.15, -0.2),
        ],
        particleCount: 50,
      },
      {
        name: 'DEGRADED',
        color: 0x60a5fa,
        points: [
          new THREE.Vector3(-1.4, 0.2, 0),
          new THREE.Vector3(0.1, 0.1, 0.3),
          new THREE.Vector3(1.7, -0.25, 0.4),
          new THREE.Vector3(3.0, -0.65, 0.2),
          new THREE.Vector3(4.2, -0.95, 0.1),
        ],
        particleCount: 45,
      },
      {
        name: 'HIGH_RISK',
        color: 0xf59e0b,
        points: [
          new THREE.Vector3(-1.4, 0.2, 0),
          new THREE.Vector3(0.2, 0.45, 0.25),
          new THREE.Vector3(1.4, 0.95, 0.35),
          new THREE.Vector3(2.2, 1.35, 0.3), // Anomaly Point
          new THREE.Vector3(3.4, 1.85, 0.1),
          new THREE.Vector3(4.2, 2.15, -0.1),
        ],
        particleCount: 75,
      },
    ];

    const trajectories = [];

    trajectoryConfigs.forEach((tCfg) => {
      const curve = new THREE.CatmullRomCurve3(tCfg.points);
      const pointsCount = 70;
      const curvePoints = curve.getPoints(pointsCount);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: tCfg.color,
        transparent: true,
        opacity: tCfg.name === 'HIGH_RISK' ? 0.75 : 0.45,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      // Trajectory Particles
      const pGeo = new THREE.BufferGeometry();
      const pPos = new Float32Array(tCfg.particleCount * 3);
      const pOffsets = new Float32Array(tCfg.particleCount);

      for (let i = 0; i < tCfg.particleCount; i++) {
        pOffsets[i] = i / tCfg.particleCount;
        const pt = curve.getPointAt(pOffsets[i]);
        pPos[i * 3] = pt.x;
        pPos[i * 3 + 1] = pt.y;
        pPos[i * 3 + 2] = pt.z;
      }

      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({
        color: tCfg.name === 'HIGH_RISK' ? 0xef4444 : tCfg.color,
        size: tCfg.name === 'HIGH_RISK' ? 0.065 : 0.045,
        transparent: true,
        opacity: 0.95,
      });
      const pSystem = new THREE.Points(pGeo, pMat);
      scene.add(pSystem);

      trajectories.push({
        curve,
        pGeo,
        pOffsets,
        pCount: tCfg.particleCount,
      });
    });

    // ==========================================
    // 8. ANOMALY BEACON (High-risk Point Marker)
    // ==========================================
    const anomalyGroup = new THREE.Group();
    anomalyGroup.position.set(2.2, 1.35, 0.3);
    scene.add(anomalyGroup);

    // Glowing core
    const anomalyCoreGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const anomalyCoreMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const anomalyCoreMesh = new THREE.Mesh(anomalyCoreGeo, anomalyCoreMat);
    anomalyGroup.add(anomalyCoreMesh);

    // Outer warning pulse ring
    const anomalyRingGeo = new THREE.RingGeometry(0.2, 0.25, 32);
    const anomalyRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const anomalyRingMesh = new THREE.Mesh(anomalyRingGeo, anomalyRingMat);
    anomalyGroup.add(anomalyRingMesh);

    // Agitated particle halo
    const haloCount = 35;
    const haloGeo = new THREE.BufferGeometry();
    const haloPos = new Float32Array(haloCount * 3);
    for (let i = 0; i < haloCount; i++) {
      const angle = (i / haloCount) * Math.PI * 2;
      const r = 0.32 + Math.random() * 0.18;
      haloPos[i * 3] = Math.cos(angle) * r;
      haloPos[i * 3 + 1] = Math.sin(angle) * r;
      haloPos[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
    const haloMat = new THREE.PointsMaterial({ color: 0xfca5a5, size: 0.04, transparent: true, opacity: 0.8 });
    const haloPoints = new THREE.Points(haloGeo, haloMat);
    anomalyGroup.add(haloPoints);

    // ==========================================
    // 9. ANIMATION & PARALLAX RENDER LOOP
    // ==========================================
    let mouseX = 0;
    let mouseY = 0;
    let targetCameraX = 0.2;
    let targetCameraY = 0.8;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetCameraX = 0.2 + mouseX * 0.6;
      targetCameraY = 0.8 + mouseY * 0.4;
    };

    container.addEventListener('mousemove', handleMouseMove);

    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth Camera Parallax Lerp
      camera.position.x += (targetCameraX - camera.position.x) * 0.05;
      camera.position.y += (targetCameraY - camera.position.y) * 0.05;
      camera.lookAt(0.3, 0.2, 0);

      // Rotate AI Core Layers
      innerOcta.rotation.y += 0.015;
      innerOcta.rotation.x += 0.008;

      neuralLattice.rotation.y -= 0.009;
      neuralLattice.rotation.z += 0.006;

      outerDodeca.rotation.y += 0.004;
      outerDodeca.rotation.z -= 0.003;

      // Pulse Core Center Light
      const pulse = 1.0 + Math.sin(elapsed * 4) * 0.18;
      centerNode.scale.set(pulse, pulse, pulse);
      pointLightCore.intensity = 2.8 + Math.sin(elapsed * 4) * 0.8;

      // Orbit Core Swarm Particles
      const posAttr = coreParticleGeo.attributes.position;
      for (let i = 0; i < coreParticleCount; i++) {
        coreParticleAngles[i] += coreParticleSpeeds[i];
        const r = coreParticleRadii[i];
        posAttr.setX(i, Math.cos(coreParticleAngles[i]) * r);
        posAttr.setZ(i, Math.sin(coreParticleAngles[i]) * r);
      }
      posAttr.needsUpdate = true;

      // Flow Telemetry Particles along Curves
      telemetryStreams.forEach((s) => {
        const pPositions = s.pGeo.attributes.position;
        for (let i = 0; i < s.pCount; i++) {
          s.pOffsets[i] = (s.pOffsets[i] + 0.006) % 1.0;
          const pt = s.curve.getPointAt(s.pOffsets[i]);
          pPositions.setXYZ(i, pt.x, pt.y, pt.z);
        }
        pPositions.needsUpdate = true;
      });

      // Flow Trajectory Particles forward
      trajectories.forEach((t) => {
        const tPositions = t.pGeo.attributes.position;
        for (let i = 0; i < t.pCount; i++) {
          t.pOffsets[i] = (t.pOffsets[i] + 0.005) % 1.0;
          const pt = t.curve.getPointAt(t.pOffsets[i]);
          tPositions.setXYZ(i, pt.x, pt.y, pt.z);
        }
        tPositions.needsUpdate = true;
      });

      // Anomaly Marker Warning Pulse
      const anomalyScale = 1.0 + Math.sin(elapsed * 6) * 0.35;
      anomalyRingMesh.scale.set(anomalyScale, anomalyScale, 1);
      anomalyRingMesh.rotation.z += 0.02;
      haloPoints.rotation.z -= 0.015;

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || 600;
      const newHeight = container.clientHeight || 320;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // ==========================================
    // 10. CLEANUP ON UNMOUNT (Proper Disposal)
    // ==========================================
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);

      // Dispose Three.js objects
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

      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className={`ai-prediction-core-3d-root ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '340px',
        backgroundColor: '#161522',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        overflow: 'hidden',
        userSelect: 'none',
        marginBottom: '20px',
      }}
    >
      {/* Blueprint Grid Texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }}
      />

      {/* Blueprint Corner Crosshairs (+) */}
      <span style={{ position: 'absolute', top: '6px', left: '8px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, zIndex: 10 }}>+</span>
      <span style={{ position: 'absolute', top: '6px', right: '8px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, zIndex: 10 }}>+</span>
      <span style={{ position: 'absolute', bottom: '6px', left: '8px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, zIndex: 10 }}>+</span>
      <span style={{ position: 'absolute', bottom: '6px', right: '8px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, zIndex: 10 }}>+</span>

      {/* Top Left Status Tag */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          backgroundColor: 'rgba(40, 233, 159, 0.12)',
          border: '1px solid var(--color-accent)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.625rem',
          fontWeight: 700,
          color: 'var(--color-accent)',
          zIndex: 10,
        }}
      >
        <Activity size={11} className="animate-pulse" />
        <span>AI PREDICTION CORE: INFERENCE ACTIVE</span>
      </div>

      {/* Top Right Inference Pipeline Meta */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.625rem',
          color: '#8B8999',
          zIndex: 10,
        }}
      >
        TRANSFORMER DECODER // T-AHEAD: 30 MIN
      </div>

      {/* WebGL Canvas Container */}
      <div
        ref={mountRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Fallback for environments where WebGL is unsupported (e.g. Jest test DOM) */}
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
            backgroundColor: '#161522',
            zIndex: 1,
          }}
        >
          [3D WebGL Visualization: AI Prediction Core Simulation Initialized]
        </div>
      )}

      {/* ================= TELEMETRY STREAM LABELS (LEFT OVERLAY) ================= */}
      <div
        style={{
          position: 'absolute',
          top: '42px',
          left: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 10,
        }}
      >
        {Object.entries(streamInfo).map(([name, info]) => {
          const Icon = info.icon;
          const isHovered = selectedStream === name;
          return (
            <div
              key={name}
              onMouseEnter={() => setSelectedStream(name)}
              onMouseLeave={() => setSelectedStream(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                backgroundColor: isHovered ? 'rgba(61, 59, 79, 0.95)' : 'rgba(23, 21, 33, 0.75)',
                border: `1px solid ${isHovered ? info.color : 'rgba(61, 59, 79, 0.6)'}`,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.625rem',
                color: isHovered ? '#FFFFFF' : '#D6D6D6',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isHovered ? `0 0 10px ${info.color}40` : 'none',
              }}
            >
              <Icon size={10} style={{ color: info.color }} />
              <span style={{ fontWeight: 700 }}>{name}</span>
              {isHovered && (
                <span style={{ color: info.color, marginLeft: '4px', fontSize: '0.5625rem' }}>
                  &rarr; {info.label} ({info.stat})
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ================= HOLOGRAPHIC ANOMALY PREDICTION HUD PANEL ================= */}
      <div
        onMouseEnter={() => setHoveredAnomaly(true)}
        onMouseLeave={() => setHoveredAnomaly(false)}
        style={{
          position: 'absolute',
          top: '40px',
          right: '16px',
          width: '185px',
          padding: '10px 12px',
          backgroundColor: 'rgba(23, 21, 33, 0.92)',
          border: hoveredAnomaly ? '1px solid #EF4444' : '1px solid rgba(239, 68, 68, 0.6)',
          borderRadius: '0px',
          boxShadow: hoveredAnomaly ? '0 0 24px rgba(239, 68, 68, 0.45)' : '0 8px 24px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 12,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.625rem',
              fontWeight: 700,
              color: '#EF4444',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              padding: '1px 5px',
            }}
          >
            <AlertTriangle size={10} /> AI PREDICTION
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#EF4444', fontWeight: 700 }}>
            ~18 min
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25, marginTop: '4px' }}>
          Memory Exhaustion
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '5px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#8B8999' }}>
            CONFIDENCE
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-accent)', fontWeight: 700 }}>
            87% confidence
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#F87171', marginTop: '3px' }}>
          Risk: OOMKilled &bull; Workload pre-drain
        </div>
      </div>

      {/* ================= TIME AXIS PROGRESSION BAR (BOTTOM) ================= */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '14px',
          right: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          backgroundColor: 'rgba(23, 21, 33, 0.85)',
          borderTop: '1px dashed rgba(61, 59, 79, 0.7)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.625rem',
          color: '#8B8999',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>NOW</span>
          <span style={{ color: '#4B4958' }}>&rarr;</span>
          <span style={{ color: '#D6D6D6' }}>+10m</span>
          <span style={{ color: '#4B4958' }}>&rarr;</span>
          <span style={{ color: '#F59E0B' }}>+20m</span>
          <span style={{ color: '#4B4958' }}>&rarr;</span>
          <span style={{ color: '#EF4444', fontWeight: 700 }}>+30m</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#28E99F' }}>
            <span style={{ width: '6px', height: '6px', backgroundColor: '#28E99F' }} /> Stable
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#60A5FA' }}>
            <span style={{ width: '6px', height: '6px', backgroundColor: '#60A5FA' }} /> Degraded
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#EF4444' }}>
            <span style={{ width: '6px', height: '6px', backgroundColor: '#EF4444' }} /> High-risk Anomaly
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIPredictionCore3D;
