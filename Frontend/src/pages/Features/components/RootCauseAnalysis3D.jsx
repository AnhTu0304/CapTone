import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AlertCircle, CheckCircle2, Zap, Server, Database, Network, Cpu, HardDrive } from 'lucide-react';

/**
 * RootCauseAnalysis3D (Three.js)
 * 
 * Mạng lưới Quan hệ Nhân quả 3D (3D Causal Graph Network):
 * 1. Nút SỰ CỐ (Incident Node) ở đỉnh: "API Gateway 502 / HTTP 5xx" (Màu Đỏ/Cam cảnh báo, xung nhịp).
 * 2. Nút NGUYÊN NHÂN GỐC RỄ (Root Cause Node) ở tầng nguồn:
 *    "Memory Leak in auth-service (RSS > 2Gi)" phát quang rực rỡ Mint #28E99F,
 *    lồng đa diện xoay kép, vòng hào quang Hologram, bụi hạt lượng tử bay quanh,
 *    và bảng Holographic HUD: "ROOT CAUSE IDENTIFIED // 94.6% Confidence".
 * 3. Các Nút Triệu chứng & Hạ tầng liên kết xung quanh ở các độ sâu Z khác nhau:
 *    - Pod Crash (Pod CrashLoopBackOff - Nút trung gian then chốt)
 *    - Độ trễ DB (Database Latency Spike)
 *    - Lỗi mạng (TCP Retransmit Error)
 *    - Lưu lượng bất thường (Traffic Ingress Spike)
 *    - Mức sử dụng ổ đĩa (Disk I/O)
 *    - CPU Saturation
 * 4. Luồng nhân quả với các đường line phát quang và hạt photon chạy dọc theo đường dây.
 * 5. Khi hover: Chuỗi nhân quả chính bừng sáng, các nút phụ mờ dần, camera nhẹ nhàng zoom focus vào Root Cause.
 * 6. Chiều cao chuẩn hóa 340px, căn thẳng hàng hoàn hảo với các Card khác.
 */
export const RootCauseAnalysis3D = ({ className = '' }) => {
  const mountRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState(true);

  // Nodes definition
  const nodes = [
    {
      id: 'incident',
      name: 'SỰ CỐ: HTTP 5xx',
      sub: 'API Gateway 502 Outage',
      type: 'incident',
      color: 0xef4444,
      pos: new THREE.Vector3(0, 1.25, 0.3),
      size: 0.28,
      icon: AlertCircle,
    },
    {
      id: 'pod_crash',
      name: 'Sập Pod (CrashLoop)',
      sub: 'Exit Code 137 (OOM)',
      type: 'causal_link',
      color: 0xf59e0b,
      pos: new THREE.Vector3(-0.5, 0.35, 0.45),
      size: 0.2,
      icon: Server,
    },
    {
      id: 'root_cause',
      name: 'NGUYÊN NHÂN GỐC RỄ',
      sub: 'Memory Leak (RSS > 2Gi)',
      type: 'root_cause',
      color: 0x28e99f,
      pos: new THREE.Vector3(-0.7, -0.85, 0.6),
      size: 0.32,
      icon: CheckCircle2,
    },
    {
      id: 'db_latency',
      name: 'Độ trễ Database',
      sub: 'Connection Pool Timeout',
      type: 'symptom',
      color: 0x38bdf8,
      pos: new THREE.Vector3(2.4, 0.8, -0.2),
      size: 0.18,
      icon: Database,
    },
    {
      id: 'network_err',
      name: 'Lỗi Mạng (TCP)',
      sub: 'Socket Retransmit 4.2%',
      type: 'symptom',
      color: 0x818cf8,
      pos: new THREE.Vector3(-2.4, 0.65, -0.25),
      size: 0.18,
      icon: Network,
    },
    {
      id: 'traffic_spike',
      name: 'Lưu lượng Ingress',
      sub: 'Flash Crowd +180%',
      type: 'symptom',
      color: 0x60a5fa,
      pos: new THREE.Vector3(2.3, -0.5, 0.25),
      size: 0.18,
      icon: Zap,
    },
    {
      id: 'cpu_sat',
      name: 'CPU Throttling',
      sub: 'CFS Quota 88%',
      type: 'symptom',
      color: 0xa78bfa,
      pos: new THREE.Vector3(-2.2, -0.65, 0.2),
      size: 0.18,
      icon: Cpu,
    },
    {
      id: 'disk_io',
      name: 'Mức dùng Ổ đĩa',
      sub: 'WAL Journal Flush Wait',
      type: 'symptom',
      color: 0x94a3b8,
      pos: new THREE.Vector3(1.6, -1.15, -0.35),
      size: 0.18,
      icon: HardDrive,
    },
  ];

  // Connections (Edges) between nodes
  const edges = [
    // PRIMARY CAUSAL CHAIN: Root Cause -> Pod Crash -> Incident
    { from: 'root_cause', to: 'pod_crash', isPrimary: true, color: 0x28e99f },
    { from: 'pod_crash', to: 'incident', isPrimary: true, color: 0xf59e0b },

    // SECONDARY / CORRELATION LINKS
    { from: 'db_latency', to: 'incident', isPrimary: false, color: 0x3d3b4f },
    { from: 'network_err', to: 'pod_crash', isPrimary: false, color: 0x3d3b4f },
    { from: 'traffic_spike', to: 'incident', isPrimary: false, color: 0x3d3b4f },
    { from: 'cpu_sat', to: 'root_cause', isPrimary: false, color: 0x3d3b4f },
    { from: 'disk_io', to: 'db_latency', isPrimary: false, color: 0x3d3b4f },
    { from: 'traffic_spike', to: 'db_latency', isPrimary: false, color: 0x3d3b4f },
  ];

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

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
    const height = container.clientHeight || 340;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x161522, 0.08);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x161522, 1);
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const pointLightRoot = new THREE.PointLight(0x28e99f, 3.8, 10);
    pointLightRoot.position.set(-0.7, -0.85, 1.2);
    scene.add(pointLightRoot);

    const pointLightIncident = new THREE.PointLight(0xef4444, 2.5, 8);
    pointLightIncident.position.set(0, 1.25, 0.8);
    scene.add(pointLightIncident);

    // 3. Depth Grid Helper
    const gridHelper = new THREE.GridHelper(14, 18, 0x28e99f, 0x282637);
    gridHelper.position.set(0, -1.7, 0);
    if (gridHelper.material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.35;
    }
    scene.add(gridHelper);

    // 4. Ambient Data Particles
    const dustCount = 180;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 12;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x3d3b4f, size: 0.035, transparent: true, opacity: 0.65 });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // ==========================================
    // 5. 3D NODES MESHES
    // ==========================================
    const nodeMeshes = {};
    let rootCauseGroup = null;
    let incidentGroup = null;

    nodes.forEach((n) => {
      const nGroup = new THREE.Group();
      nGroup.position.copy(n.pos);
      scene.add(nGroup);

      if (n.type === 'root_cause') {
        rootCauseGroup = nGroup;

        // Glowing Core Sphere
        const coreGeo = new THREE.SphereGeometry(n.size * 0.7, 24, 24);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x28e99f });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        nGroup.add(coreMesh);

        // Rotating Inner Icosahedron Lattice
        const innerGeo = new THREE.IcosahedronGeometry(n.size * 1.05, 0);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.85 });
        const innerMesh = new THREE.Mesh(innerGeo, innerMat);
        nGroup.add(innerMesh);

        // Outer Dodecahedron Shield
        const outerGeo = new THREE.DodecahedronGeometry(n.size * 1.35, 0);
        const outerMat = new THREE.MeshBasicMaterial({ color: 0x28e99f, wireframe: true, transparent: true, opacity: 0.45 });
        const outerMesh = new THREE.Mesh(outerGeo, outerMat);
        nGroup.add(outerMesh);

        // Holographic Halo Ring
        const haloGeo = new THREE.RingGeometry(n.size * 1.5, n.size * 1.62, 32);
        const haloMat = new THREE.MeshBasicMaterial({ color: 0x28e99f, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        nGroup.add(haloMesh);

        // Swarm particles around Root Cause
        const swarmCount = 45;
        const swarmGeo = new THREE.BufferGeometry();
        const swarmPos = new Float32Array(swarmCount * 3);
        for (let i = 0; i < swarmCount; i++) {
          const theta = (i / swarmCount) * Math.PI * 2;
          const r = n.size * 1.6 + Math.random() * 0.2;
          swarmPos[i * 3] = Math.cos(theta) * r;
          swarmPos[i * 3 + 1] = Math.sin(theta) * r;
          swarmPos[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
        }
        swarmGeo.setAttribute('position', new THREE.BufferAttribute(swarmPos, 3));
        const swarmMat = new THREE.PointsMaterial({ color: 0xa7f3d0, size: 0.045, transparent: true, opacity: 0.9 });
        const swarmPoints = new THREE.Points(swarmGeo, swarmMat);
        nGroup.add(swarmPoints);

        nodeMeshes[n.id] = { group: nGroup, core: coreMesh, inner: innerMesh, outer: outerMesh, halo: haloMesh, swarm: swarmPoints };
      } else if (n.type === 'incident') {
        incidentGroup = nGroup;

        // Octahedron Warning Node
        const incGeo = new THREE.OctahedronGeometry(n.size * 0.8, 0);
        const incMat = new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: false });
        const incMesh = new THREE.Mesh(incGeo, incMat);
        nGroup.add(incMesh);

        // Outer Pulse Ring
        const incRingGeo = new THREE.RingGeometry(n.size * 1.15, n.size * 1.25, 24);
        const incRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
        const incRingMesh = new THREE.Mesh(incRingGeo, incRingMat);
        nGroup.add(incRingMesh);

        nodeMeshes[n.id] = { group: nGroup, core: incMesh, ring: incRingMesh };
      } else {
        // Standard Symptom Node
        const sGeo = new THREE.OctahedronGeometry(n.size * 0.7, 0);
        const sMat = new THREE.MeshBasicMaterial({ color: n.color, wireframe: true, transparent: true, opacity: 0.75 });
        const sMesh = new THREE.Mesh(sGeo, sMat);
        nGroup.add(sMesh);

        const sCoreGeo = new THREE.SphereGeometry(n.size * 0.35, 12, 12);
        const sCoreMat = new THREE.MeshBasicMaterial({ color: n.color });
        const sCoreMesh = new THREE.Mesh(sCoreGeo, sCoreMat);
        nGroup.add(sCoreMesh);

        nodeMeshes[n.id] = { group: nGroup, core: sCoreMesh, cage: sMesh };
      }
    });

    // ==========================================
    // 6. CAUSAL CONNECTION EDGES & MOVING PHOTONS
    // ==========================================
    const edgeObjects = [];

    edges.forEach((edge) => {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) return;

      // Line
      const points = [fromNode.pos, toNode.pos];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: edge.isPrimary ? edge.color : 0x3d3b4f,
        transparent: true,
        opacity: edge.isPrimary ? 0.85 : 0.35,
        linewidth: edge.isPrimary ? 2 : 1,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      // Moving Photons along connection line
      const photonCount = edge.isPrimary ? 16 : 6;
      const photonGeo = new THREE.BufferGeometry();
      const photonPos = new Float32Array(photonCount * 3);
      const photonOffsets = new Float32Array(photonCount);

      for (let i = 0; i < photonCount; i++) {
        photonOffsets[i] = i / photonCount;
        const pt = new THREE.Vector3().lerpVectors(fromNode.pos, toNode.pos, photonOffsets[i]);
        photonPos[i * 3] = pt.x;
        photonPos[i * 3 + 1] = pt.y;
        photonPos[i * 3 + 2] = pt.z;
      }

      photonGeo.setAttribute('position', new THREE.BufferAttribute(photonPos, 3));
      const photonMat = new THREE.PointsMaterial({
        color: edge.isPrimary ? edge.color : 0x818cf8,
        size: edge.isPrimary ? 0.055 : 0.035,
        transparent: true,
        opacity: edge.isPrimary ? 0.95 : 0.45,
      });
      const photonPoints = new THREE.Points(photonGeo, photonMat);
      scene.add(photonPoints);

      edgeObjects.push({
        line,
        lineMat,
        photonPoints,
        photonGeo,
        photonOffsets,
        photonCount,
        fromPos: fromNode.pos,
        toPos: toNode.pos,
        isPrimary: edge.isPrimary,
        baseColor: edge.color,
      });
    });

    // ==========================================
    // 7. ANIMATION LOOP & PARALLAX
    // ==========================================
    let mouseX = 0;
    let mouseY = 0;
    let targetCamX = 0;
    let targetCamY = 0.4;
    let targetCamZ = 7.2;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetCamX = mouseX * 0.65;
      targetCamY = 0.4 + mouseY * 0.45;
    };

    container.addEventListener('mousemove', handleMouseMove);

    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Camera Lerp
      camera.position.x += (targetCamX - camera.position.x) * 0.05;
      camera.position.y += (targetCamY - camera.position.y) * 0.05;
      camera.position.z += (targetCamZ - camera.position.z) * 0.05;
      camera.lookAt(0, 0.2, 0);

      // Rotate Root Cause Node Geometry
      if (rootCauseGroup && nodeMeshes.root_cause) {
        nodeMeshes.root_cause.inner.rotation.y += 0.015;
        nodeMeshes.root_cause.inner.rotation.x += 0.008;

        nodeMeshes.root_cause.outer.rotation.y -= 0.007;
        nodeMeshes.root_cause.outer.rotation.z += 0.005;

        nodeMeshes.root_cause.halo.rotation.z -= 0.012;

        const rootPulse = 1.0 + Math.sin(elapsed * 4) * 0.15;
        nodeMeshes.root_cause.core.scale.set(rootPulse, rootPulse, rootPulse);
        pointLightRoot.intensity = 3.2 + Math.sin(elapsed * 4) * 1.0;
      }

      // Rotate Incident Node
      if (incidentGroup && nodeMeshes.incident) {
        nodeMeshes.incident.core.rotation.y += 0.02;
        nodeMeshes.incident.core.rotation.z += 0.015;

        const incPulse = 1.0 + Math.sin(elapsed * 6) * 0.3;
        nodeMeshes.incident.ring.scale.set(incPulse, incPulse, 1);
        pointLightIncident.intensity = 2.0 + Math.sin(elapsed * 6) * 0.8;
      }

      // Rotate Symptom Nodes
      nodes.forEach((n) => {
        if (n.type === 'symptom' && nodeMeshes[n.id]) {
          nodeMeshes[n.id].cage.rotation.y += 0.01;
          nodeMeshes[n.id].cage.rotation.x += 0.006;
        }
      });

      // Advance Photons along Causal Edges
      edgeObjects.forEach((eObj) => {
        const pPositions = eObj.photonGeo.attributes.position.array;
        const speed = eObj.isPrimary ? 0.008 : 0.004;

        for (let i = 0; i < eObj.photonCount; i++) {
          eObj.photonOffsets[i] = (eObj.photonOffsets[i] + speed) % 1.0;
          const pt = new THREE.Vector3().lerpVectors(eObj.fromPos, eObj.toPos, eObj.photonOffsets[i]);
          pPositions[i * 3] = pt.x;
          pPositions[i * 3 + 1] = pt.y;
          pPositions[i * 3 + 2] = pt.z;
        }
        eObj.photonGeo.attributes.position.needsUpdate = true;
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 600;
      const newH = container.clientHeight || 340;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);

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
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => {
        setIsFocused(false);
        setHoveredNode(null);
      }}
      className={`root-cause-analysis-3d-root ${className}`}
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
        <Zap size={11} className="animate-pulse" />
        <span>CAUSAL GRAPH INFERENCE: ROOT CAUSE LOCATED</span>
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
        CORRELATION ENGINE // eBPF &amp; K8s EVENTS
      </div>

      {/* Three.js Canvas Container */}
      <div
        ref={mountRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Fallback for environments without WebGL */}
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
          [3D WebGL Visualization: Causal Graph Inference Initialized]
        </div>
      )}

      {/* ================= HOLOGRAPHIC ROOT CAUSE HUD PANEL ================= */}
      <div
        onMouseEnter={() => setHoveredNode('root_cause')}
        onMouseLeave={() => setHoveredNode(null)}
        style={{
          position: 'absolute',
          bottom: '36px',
          left: '16px',
          width: '210px',
          padding: '10px 12px',
          backgroundColor: 'rgba(23, 21, 33, 0.94)',
          border: '1px solid var(--color-accent)',
          borderRadius: '0px',
          boxShadow: '0 0 24px rgba(40, 233, 159, 0.4)',
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
              color: 'var(--color-accent)',
              backgroundColor: 'rgba(40, 233, 159, 0.15)',
              padding: '1px 5px',
            }}
          >
            <CheckCircle2 size={10} /> ROOT CAUSE IDENTIFIED
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: 'var(--color-accent)', fontWeight: 700 }}>
            94.6%
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25, marginTop: '4px' }}>
          Memory Leak in auth-service
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#8B8999' }}>
            CORRELATION
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#A7F3D0' }}>
            Pod Crash &larr; RSS &gt; 2Gi
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: 'var(--color-accent)', marginTop: '2px' }}>
          Triage: 1.4s &bull; Commit #8f2a1 diff verified
        </div>
      </div>

      {/* ================= INCIDENT BADGE (TOP CENTER) ================= */}
      <div
        style={{
          position: 'absolute',
          top: '38px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: 'rgba(38, 24, 32, 0.92)',
          border: '1px solid #EF4444',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.625rem',
          fontWeight: 700,
          color: '#F87171',
          zIndex: 11,
          boxShadow: '0 0 16px rgba(239, 68, 68, 0.4)',
        }}
      >
        <AlertCircle size={11} className="animate-pulse" />
        <span>SỰ CỐ: HTTP 5xx (API Gateway 502)</span>
      </div>

      {/* ================= SYMPTOM NODES CHIPS (INTERACTIVE RIGHT HUD) ================= */}
      <div
        style={{
          position: 'absolute',
          top: '40px',
          right: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          zIndex: 10,
        }}
      >
        {[
          { label: 'Sập Pod (Exit 137)', color: '#F59E0B', isPrimary: true },
          { label: 'Độ trễ DB (Timeout)', color: '#38BDF8', isPrimary: false },
          { label: 'Lỗi mạng TCP (4.2%)', color: '#818CF8', isPrimary: false },
          { label: 'Lưu lượng (+180%)', color: '#60A5FA', isPrimary: false },
        ].map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              backgroundColor: item.isPrimary ? 'rgba(40, 32, 24, 0.85)' : 'rgba(23, 21, 33, 0.75)',
              border: item.isPrimary ? `1px solid ${item.color}` : '1px solid rgba(61, 59, 79, 0.6)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.5625rem',
              color: item.isPrimary ? '#FFFFFF' : '#8B8999',
            }}
          >
            <span style={{ width: '6px', height: '6px', backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ================= BOTTOM CAUSAL PATHWAY BAR (CANH BẰNG CARD 1 & 2) ================= */}
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
          <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>MEMORY LEAK</span>
          <span style={{ color: '#4B4958' }}>&rarr;</span>
          <span style={{ color: '#F59E0B' }}>POD CRASH</span>
          <span style={{ color: '#4B4958' }}>&rarr;</span>
          <span style={{ color: '#EF4444', fontWeight: 700 }}>HTTP 5xx</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--color-accent)' }}>Confidence: 94.6%</span>
          <span style={{ color: '#8B8999' }}>Isolated in 1.4s</span>
          <span style={{ color: isFocused ? 'var(--color-accent)' : '#8B8999' }}>
            {isFocused ? 'CAUSAL FOCUS: ACTIVE' : 'LIVE GRAPH'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RootCauseAnalysis3D;
