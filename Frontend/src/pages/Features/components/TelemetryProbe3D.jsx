import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Radio, Terminal, Activity, ShieldAlert, Cpu } from 'lucide-react';

/**
 * TelemetryProbe3D (Three.js - White Ceramic Interceptor with Dynamic Target-Surge)
 * 
 * Sa bàn 3D cao cấp mô phỏng Tàu viễn thám Telemetry chiến thuật (Recon Interceptor):
 * 1. Phi thuyền tiêm kích Trắng Sứ Công Nghệ Cao (White Ceramic Stealth Fighter):
 *    - Toàn bộ thân vỏ và cánh xuôi phủ màu Trắng sứ sáng bóng (White Ceramic #FFFFFF).
 *    - Viền gân kỹ thuật đan xen Mint #28E99F và mép cánh titan tối màu #262436.
 *    - Buồng lái pha lê dạ quang Mint #28E99F phát sáng rực rỡ ở sống lưng.
 *    - Ống phóng pháo laser đầu cánh và mũi máy bay mạ titan tối với đầu nòng dạ quang.
 * 2. Động Học Bay Lướt Tới Mục Tiêu Khi Bắn Laser (Dynamic Target-Surge):
 *    - Đầu máy bay xoay hướng ngắm chính xác về thẻ telemetry mục tiêu.
 *    - Khi tia laser khai hỏa, máy bay tăng tốc LAO LƯỚT TỚI PHÍA TRƯỚC áp sát mục tiêu,
 *      đuôi phản lực phụt lửa plasma to gấp đôi.
 *    - Khi thẻ phân giải tan biến, máy bay hãm tốc và lùi êm ái về vị trí cân bằng trung tâm.
 * 3. 4 Trạm/Thẻ Logs & Metrics lơ lửng:
 *    1. CPU Saturation 88% (Metric)
 *    2. socket_connect() eBPF (Log)
 *    3. Socket Pool Healthy (TCP Net)
 *    4. Pod Eviction Prevented (K8s Triage)
 * 4. Khi tia laser bắn trúng: Bừng sáng viền neon, nổ chùm hạt lượng tử (Particle Disintegration),
 *    thẻ tan biến (Dissolve) và tái sinh tuần hoàn.
 * 5. Chiều cao chuẩn hóa 340px, căn thẳng hàng hoàn hảo với các Card khác.
 */
export const TelemetryProbe3D = ({ className = '' }) => {
  const mountRef = useRef(null);
  const [activeTargetIdx, setActiveTargetIdx] = useState(0);
  const [isStriking, setIsStriking] = useState(false);
  const [isDissolved, setIsDissolved] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState(true);

  // Targets configuration
  const targets = [
    {
      id: 0,
      name: 'CPU Saturation 88%',
      subtitle: 'auto-throttle \u2192 42%',
      tag: 'METRIC',
      meta: '1.2ms P99',
      color: '#28E99F',
      icon: Cpu,
      pos3D: new THREE.Vector3(2.6, 1.2, 0.2),
      screenClass: 'target-card-top-right',
    },
    {
      id: 1,
      name: 'socket_connect()',
      subtitle: 'loss: 0 pkts / 0.00%',
      tag: 'LOG TRACE',
      meta: 'eBPF',
      color: '#38BDF8',
      icon: Terminal,
      pos3D: new THREE.Vector3(2.6, -1.0, 0.2),
      screenClass: 'target-card-bottom-right',
    },
    {
      id: 2,
      name: 'Socket Pool Healthy',
      subtitle: '120/120 active conns',
      tag: 'TCP SOCKET',
      meta: 'NET-IO',
      color: '#F59E0B',
      icon: Activity,
      pos3D: new THREE.Vector3(-2.6, -1.0, 0.2),
      screenClass: 'target-card-bottom-left',
    },
    {
      id: 3,
      name: 'Pod Eviction Prevented',
      subtitle: 'graceful re-route OK',
      tag: 'K8S EVENT',
      meta: 'TRIAGE',
      color: '#EC4899',
      icon: ShieldAlert,
      pos3D: new THREE.Vector3(-2.6, 1.2, 0.2),
      screenClass: 'target-card-top-left',
    },
  ];

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability gracefully
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
    camera.position.set(0, 0.8, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x161522, 1);
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const pointLightShip = new THREE.PointLight(0x28e99f, 3.5, 10);
    pointLightShip.position.set(0, 0.2, 1.2);
    scene.add(pointLightShip);

    const pointLightLaser = new THREE.PointLight(0x28e99f, 0, 8);
    scene.add(pointLightLaser);

    // 3. Depth Grid (Matching all other feature cards)
    const gridHelper = new THREE.GridHelper(14, 18, 0x28e99f, 0x282637);
    gridHelper.position.set(0, -1.7, 0);
    if (gridHelper.material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.35;
    }
    scene.add(gridHelper);

    // 4. Ambient Telemetry Dust Particles
    const dustCount = 180;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 12;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x3d3b4f, size: 0.035, transparent: true, opacity: 0.6 });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // ==========================================
    // 5. 3D WHITE RECON FIGHTER (PHI THUYỀN TIÊM KÍCH TRẮNG SỨ)
    // ==========================================
    const shipGroup = new THREE.Group();
    shipGroup.position.set(0, 0.1, 0);
    scene.add(shipGroup);

    // White Ceramic Armor Material & Dark Titanium Accents
    const whiteCeramicMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0.12,
    });
    const darkTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x242233,
      metalness: 0.85,
      roughness: 0.25,
    });

    // 5a. Main Stealth Hull (Fuselage in White Ceramic)
    const hullGeo = new THREE.ConeGeometry(0.55, 1.6, 5);
    hullGeo.rotateX(Math.PI / 2);
    const hullMesh = new THREE.Mesh(hullGeo, whiteCeramicMat);
    shipGroup.add(hullMesh);

    // Hull Mint Wireframe Trim
    const hullWireGeo = new THREE.ConeGeometry(0.57, 1.62, 5);
    hullWireGeo.rotateX(Math.PI / 2);
    const hullWireMat = new THREE.MeshBasicMaterial({
      color: 0x28e99f,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const hullWire = new THREE.Mesh(hullWireGeo, hullWireMat);
    shipGroup.add(hullWire);

    // 5b. Forward-Swept Swept Wings (White Ceramic + Dark Bevel)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(-1.3, -0.6);
    wingShape.lineTo(-1.1, -1.0);
    wingShape.lineTo(0, -0.5);
    wingShape.closePath();

    const wingExtrudeSettings = { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);

    const leftWing = new THREE.Mesh(wingGeo, whiteCeramicMat);
    leftWing.rotation.x = Math.PI / 2;
    leftWing.position.set(0, 0, 0.2);
    shipGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, whiteCeramicMat);
    rightWing.rotation.x = Math.PI / 2;
    rightWing.scale.set(-1, 1, 1);
    rightWing.position.set(0, 0, 0.2);
    shipGroup.add(rightWing);

    // 5c. Wing Laser Emitter Pods (Dark Titanium + Mint Tip)
    const cannonGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8);
    cannonGeo.rotateX(Math.PI / 2);

    const leftCannon = new THREE.Mesh(cannonGeo, darkTitaniumMat);
    leftCannon.position.set(-1.25, 0, -0.6);
    shipGroup.add(leftCannon);

    const rightCannon = new THREE.Mesh(cannonGeo, darkTitaniumMat);
    rightCannon.position.set(1.25, 0, -0.6);
    shipGroup.add(rightCannon);

    // 5d. Crystalline Glowing Cockpit Canopy (Mint Glow)
    const cockpitGeo = new THREE.ConeGeometry(0.2, 0.7, 4);
    cockpitGeo.rotateX(Math.PI / 2);
    const cockpitMat = new THREE.MeshBasicMaterial({ color: 0x28e99f });
    const cockpitMesh = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpitMesh.position.set(0, 0.18, 0.2);
    shipGroup.add(cockpitMesh);

    // 5e. Rear Thruster Plasma Plume
    const thrusterGeo = new THREE.ConeGeometry(0.18, 0.6, 8);
    thrusterGeo.rotateX(-Math.PI / 2);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
    });
    const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterMesh.position.set(0, 0, -0.9);
    shipGroup.add(thrusterMesh);

    // ==========================================
    // 6. 3D TARGET BEACONS (AT THE 4 STATIONS)
    // ==========================================
    const beaconMeshes = [];

    targets.forEach((tgt) => {
      const bGroup = new THREE.Group();
      bGroup.position.copy(tgt.pos3D);
      scene.add(bGroup);

      // Rotating Octahedron Beacon Cage
      const bGeo = new THREE.OctahedronGeometry(0.3, 0);
      const bMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(tgt.color),
        wireframe: true,
        transparent: true,
        opacity: 0.65,
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bGroup.add(bMesh);

      // Central core node
      const bCoreGeo = new THREE.SphereGeometry(0.09, 12, 12);
      const bCoreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tgt.color) });
      const bCoreMesh = new THREE.Mesh(bCoreGeo, bCoreMat);
      bGroup.add(bCoreMesh);

      // Target Crosshair Ring
      const bRingGeo = new THREE.RingGeometry(0.35, 0.38, 24);
      const bRingMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(tgt.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      });
      const bRingMesh = new THREE.Mesh(bRingGeo, bRingMat);
      bGroup.add(bRingMesh);

      beaconMeshes.push({ group: bGroup, cage: bMesh, core: bCoreMesh, ring: bRingMesh, pos: tgt.pos3D });
    });

    // ==========================================
    // 7. HIGH-POWER LASER BEAM (FROM SHIP TO TARGET)
    // ==========================================
    const laserLinePositions = new Float32Array(6); // 2 points x 3 coords
    const laserLineGeo = new THREE.BufferGeometry();
    laserLineGeo.setAttribute('position', new THREE.BufferAttribute(laserLinePositions, 3));
    const laserLineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 3,
      transparent: true,
      opacity: 0,
    });
    const laserLine = new THREE.Line(laserLineGeo, laserLineMat);
    scene.add(laserLine);

    // Glowing Laser Cylinder Aura
    const laserCylGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true);
    const laserCylMat = new THREE.MeshBasicMaterial({
      color: 0x28e99f,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const laserCyl = new THREE.Mesh(laserCylGeo, laserCylMat);
    scene.add(laserCyl);

    // ==========================================
    // 8. PARTICLE DISINTEGRATION EXPLOSION (DISSOLVE PARTICLES)
    // ==========================================
    const sparkCount = 100;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVels = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = 0;
      sparkPos[i * 3 + 1] = 0;
      sparkPos[i * 3 + 2] = 0;

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const spd = 0.02 + Math.random() * 0.05;

      sparkVels[i * 3] = Math.cos(theta) * Math.cos(phi) * spd;
      sparkVels[i * 3 + 1] = Math.sin(phi) * spd;
      sparkVels[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * spd;
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0x28e99f,
      size: 0.065,
      transparent: true,
      opacity: 0,
    });
    const sparkSystem = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkSystem);

    // ==========================================
    // 9. ANIMATION LOOP WITH TARGET-SURGE FLIGHT
    // ==========================================
    let mouseX = 0;
    let mouseY = 0;
    let targetCamX = 0;
    let targetCamY = 0.8;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetCamX = mouseX * 0.6;
      targetCamY = 0.8 + mouseY * 0.4;
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
      camera.lookAt(0, 0, 0);

      // Rotate beacon cages
      beaconMeshes.forEach((bm) => {
        bm.cage.rotation.y += 0.015;
        bm.cage.rotation.x += 0.01;
        bm.ring.rotation.z -= 0.008;
      });

      // 12-second master cycle: 3s per target
      const cycleTime = elapsed % 12;
      const targetIndex = Math.floor(cycleTime / 3);
      const phaseTime = cycleTime % 3; // 0.0 to 3.0 seconds

      setActiveTargetIdx(targetIndex);

      const currentTgt = targets[targetIndex];
      const targetPos = currentTgt.pos3D;

      // Base central origin
      const baseOrigin = new THREE.Vector3(0, 0.1, 0);

      // Unit vector from center towards target
      const dirToTarget = targetPos.clone().sub(baseOrigin).normalize();

      // Target angle for nose heading
      const dx = targetPos.x - baseOrigin.x;
      const dy = targetPos.y - baseOrigin.y;
      const targetAngleZ = Math.atan2(dy, dx) - Math.PI / 2;

      // Smooth heading orientation
      shipGroup.rotation.z += (targetAngleZ - shipGroup.rotation.z) * 0.09;
      shipGroup.rotation.x = 0.2 + Math.sin(elapsed * 2) * 0.06;

      // Laser Timings:
      // 0.0s - 0.7s: Aiming, nose centers
      // 0.7s - 1.9s: Laser firing! Ship surges forward towards target!
      // 1.9s - 2.6s: Target dissolves, ship dampens and pulls back
      // 2.6s - 3.0s: Reset
      const isFiring = phaseTime >= 0.7 && phaseTime <= 2.1;
      const isDissolving = phaseTime >= 1.5 && phaseTime <= 2.7;

      setIsStriking(isFiring);
      setIsDissolved(isDissolving);

      // DYNAMIC TARGET-SURGE MOTION ("khi bắn lazer thì đầu máy bay sẽ hướng tới di chuyển"):
      let surgeAmount = 0;
      if (phaseTime >= 0.7 && phaseTime <= 2.2) {
        // Bell-curve surge forward towards target
        const surgeT = (phaseTime - 0.7) / 1.5; // 0 to 1
        surgeAmount = Math.sin(surgeT * Math.PI) * 0.75; // Surges up to 0.75 units towards target
      }

      const desiredShipPos = baseOrigin.clone().add(dirToTarget.clone().multiplyScalar(surgeAmount));
      shipGroup.position.lerp(desiredShipPos, 0.1);

      // Thruster flame pulse (intensifies during laser surge)
      const surgeThrusterBoost = isFiring ? 1.8 : 1.0;
      const thPulse = (0.85 + Math.sin(elapsed * 14) * 0.25) * surgeThrusterBoost;
      thrusterMesh.scale.set(thPulse, thPulse, thPulse * 1.4);

      // Laser Beam updates
      if (isFiring) {
        const nosePos = new THREE.Vector3(0, 0, 0.8).applyMatrix4(shipGroup.matrixWorld);

        // Update Line
        const positions = laserLine.geometry.attributes.position.array;
        positions[0] = nosePos.x;
        positions[1] = nosePos.y;
        positions[2] = nosePos.z;
        positions[3] = targetPos.x;
        positions[4] = targetPos.y;
        positions[5] = targetPos.z;
        laserLine.geometry.attributes.position.needsUpdate = true;
        laserLineMat.opacity = 1;

        // Position cylinder between nose and target
        const distance = nosePos.distanceTo(targetPos);
        laserCyl.scale.set(1, distance, 1);
        laserCyl.position.copy(nosePos).lerp(targetPos, 0.5);
        laserCyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetPos.clone().sub(nosePos).normalize());
        laserCylMat.opacity = 0.85 + Math.sin(elapsed * 30) * 0.15;

        pointLightLaser.position.copy(targetPos);
        pointLightLaser.intensity = 4.2;

        // Pulse active beacon
        beaconMeshes[targetIndex].core.scale.set(1.6, 1.6, 1.6);
        beaconMeshes[targetIndex].cage.scale.set(1.4, 1.4, 1.4);
      } else {
        laserLineMat.opacity = 0;
        laserCylMat.opacity = 0;
        pointLightLaser.intensity = 0;
        beaconMeshes[targetIndex].core.scale.set(1, 1, 1);
        beaconMeshes[targetIndex].cage.scale.set(1, 1, 1);
      }

      // Particle Disintegration explosion
      if (phaseTime >= 1.5 && phaseTime <= 2.7) {
        sparkSystem.position.copy(targetPos);
        sparkMat.opacity = Math.max(0, 1 - (phaseTime - 1.5) / 1.2);

        const sPosArr = sparkGeo.attributes.position.array;
        for (let i = 0; i < sparkCount; i++) {
          sPosArr[i * 3] += sparkVels[i * 3];
          sPosArr[i * 3 + 1] += sparkVels[i * 3 + 1];
          sPosArr[i * 3 + 2] += sparkVels[i * 3 + 2];
        }
        sparkGeo.attributes.position.needsUpdate = true;
      } else {
        sparkMat.opacity = 0;
        // Reset sparks to center
        const sPosArr = sparkGeo.attributes.position.array;
        for (let i = 0; i < sparkCount; i++) {
          sPosArr[i * 3] = 0;
          sPosArr[i * 3 + 1] = 0;
          sPosArr[i * 3 + 2] = 0;
        }
        sparkGeo.attributes.position.needsUpdate = true;
      }

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
      className={`telemetry-probe-3d-root ${className}`}
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
        <Radio size={11} className="animate-pulse" />
        <span>TARGET: LASER SCANNING ACTIVE</span>
      </div>

      {/* Top Right Frequency Scope */}
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
        eBPF PROBE // 10Hz // AUTO-TRIAGE
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
          [3D WebGL Visualization: Telemetry Recon Laser Interceptor Initialized]
        </div>
      )}

      {/* ================= 4 HOLOGRAPHIC TELEMETRY CARDS OVERLAY ================= */}
      {targets.map((tgt, idx) => {
        const Icon = tgt.icon;
        const isActive = activeTargetIdx === idx;
        const isLaserStriking = isActive && isStriking;
        const isCardDissolving = isActive && isDissolved;

        const isTop = idx === 0 || idx === 3;
        const isRight = idx === 0 || idx === 1;

        return (
          <div
            key={tgt.id}
            style={{
              position: 'absolute',
              top: isTop ? '40px' : 'auto',
              bottom: !isTop ? '36px' : 'auto',
              right: isRight ? '16px' : 'auto',
              left: !isRight ? '16px' : 'auto',
              width: '172px',
              padding: '8px 10px',
              backgroundColor: isLaserStriking ? 'rgba(38, 36, 54, 0.95)' : 'rgba(23, 21, 33, 0.88)',
              border: isLaserStriking ? `1px solid ${tgt.color}` : '1px solid rgba(61, 59, 79, 0.65)',
              borderRadius: '0px',
              boxShadow: isLaserStriking ? `0 0 20px ${tgt.color}70` : '0 6px 18px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(6px)',
              zIndex: 12,
              opacity: isCardDissolving ? 0.15 : 1,
              transform: isCardDissolving ? 'scale(1.08) translateY(-4px)' : (isLaserStriking ? 'scale(1.03)' : 'scale(1)'),
              filter: isCardDissolving ? 'blur(4px)' : 'none',
              transition: 'all 0.25s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.5625rem',
                  color: tgt.color,
                  backgroundColor: `${tgt.color}18`,
                  padding: '1px 5px',
                  fontWeight: 700,
                }}
              >
                <Icon size={10} /> {tgt.tag}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#8B8999' }}>
                {tgt.meta}
              </span>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>
              {tgt.name}
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: tgt.color, marginTop: '2px' }}>
              {tgt.subtitle}
            </div>
          </div>
        );
      })}

      {/* ================= BOTTOM HUD STATUS BAR ================= */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>WHITE RECON INTERCEPTOR</span>
          <span style={{ color: '#4B4958' }}>&bull;</span>
          <span style={{ color: '#D6D6D6' }}>TARGET-SURGE ACTIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--color-accent)' }}>&lt; 1.2ms Latency</span>
          <span style={{ color: '#8B8999' }}>0% Loss</span>
          <span style={{ color: isStriking ? 'var(--color-accent)' : '#8B8999', fontWeight: isStriking ? 700 : 400 }}>
            {isStriking ? 'LASER PULSE ACTIVE' : 'PATROL MODE'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TelemetryProbe3D;
