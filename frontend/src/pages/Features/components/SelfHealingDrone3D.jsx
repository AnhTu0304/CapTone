import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Wrench, ShieldCheck, RefreshCw, Cpu, Activity } from 'lucide-react';

/**
 * SelfHealingDrone3D (Three.js - White Ceramic Robot with Legs Edition)
 * 
 * Sa bàn 3D mô phỏng Robot Tự Phục Hồi Sự Cố (Autonomous Self-Repair Cyber-Bot):
 * 1. Robot Trắng Sứ Công Nghệ Cao (High-Tech White Ceramic Robot):
 *    - Toàn bộ giáp thân, đầu, tay và chân phủ màu Trắng sứ sáng bóng (White Ceramic #FFFFFF).
 *    - Khung xương và khớp cơ khí bằng hợp kim titan tối màu #242233 tạo tương phản sắc sảo.
 *    - Lõi hồ quang hạt nhân Arc-Reactor màu Mint #28E99F phát sáng rực rỡ ở ngực.
 *    - Đầu vòm trắng sứ với dải mắt cảm biến Visor LED Mint quét ngang.
 * 2. Cặp Chân Cơ Khí Khớp Động (Articulated Bipedal Mechanical Legs):
 *    - Đầy đủ đùi bọc giáp trắng, khớp gối trục xoay titan, cẳng chân khí nén và bàn chân ổn định.
 *    - Đứng vững vàng, thể thao trên mặt lưới không gian 3D, có nhịp thở cơ học tự nhiên.
 * 3. Dụng Cụ Hàn & Sửa Chữa Tự Thân:
 *    - Cánh tay phải cầm mỏ hàn lượng tử (Quantum Welder) đang tự hàn gắn vi mạch trên ngực,
 *      phát ra tia hồ quang plasma xanh lấp lánh (PointLight nhấp nháy) và tia lửa nano (Nanite Sparks).
 *    - Cánh tay trái cầm bộ cữ quét chẩn đoán (Diagnostic Scanner Tool).
 * 4. Hệ Thống Dấu "+" Healthy Màu Xanh Nổi Lên & Tan Biến (Floating Healing Crosses):
 *    - 42+ biểu tượng dấu cộng "+" 3D màu xanh Mint phát quang liên tục sinh ra từ ngực,
 *      bay bổng lên trên xung quanh robot trắng, to dần, xoay nhẹ rồi mờ dần và tan biến (Dissolve).
 * 5. Bảng Holographic HUD: "AUTONOMOUS SELF-HEAL // 99.98% HEALTHY // RECOVERED IN 1.8s".
 * 6. Chiều cao chuẩn hóa 340px, căn thẳng hàng hoàn hảo với các Card khác.
 */
export const SelfHealingDrone3D = ({ className = '' }) => {
  const mountRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState(true);

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
    camera.position.set(0, 0.4, 6.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x161522, 1);
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const pointLightChest = new THREE.PointLight(0x28e99f, 3.5, 8);
    pointLightChest.position.set(0, 0.2, 1.0);
    scene.add(pointLightChest);

    // Welding Arc Light (Flickering plasma torch light)
    const arcLight = new THREE.PointLight(0x00f0ff, 4.0, 6);
    arcLight.position.set(0.2, 0.35, 0.85);
    scene.add(arcLight);

    // 3. Depth Grid (Matching all previous feature cards)
    const gridHelper = new THREE.GridHelper(14, 18, 0x28e99f, 0x282637);
    gridHelper.position.set(0, -1.5, 0);
    if (gridHelper.material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.35;
    }
    scene.add(gridHelper);

    // 4. Ambient Dust Particles
    const dustCount = 160;
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
    // 5. 3D WHITE ROBOT MODEL WITH MECHANICAL LEGS
    // ==========================================
    const botRoot = new THREE.Group();
    botRoot.position.set(0, -0.15, 0);
    scene.add(botRoot);

    // Materials: White Ceramic Armor & Dark Titanium Joints
    const whiteArmorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0.12,
    });
    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x262436,
      metalness: 0.85,
      roughness: 0.25,
    });
    const accentMintMat = new THREE.MeshBasicMaterial({ color: 0x28e99f });

    // 5a. Torso (Hexagonal White Ceramic Chassis)
    const torsoGeo = new THREE.CylinderGeometry(0.55, 0.45, 0.85, 6);
    const torsoMesh = new THREE.Mesh(torsoGeo, whiteArmorMat);
    torsoMesh.position.set(0, 0.35, 0);
    botRoot.add(torsoMesh);

    // Torso Dark Mechanical Lining & Wireframe Trim
    const torsoWireGeo = new THREE.CylinderGeometry(0.56, 0.46, 0.86, 6);
    const torsoWireMat = new THREE.MeshBasicMaterial({
      color: 0x28e99f,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const torsoWire = new THREE.Mesh(torsoWireGeo, torsoWireMat);
    torsoWire.position.set(0, 0.35, 0);
    botRoot.add(torsoWire);

    // 5b. Chest Arc-Reactor Core (Glowing Mint Node)
    const reactorGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const reactorMesh = new THREE.Mesh(reactorGeo, accentMintMat);
    reactorMesh.position.set(0, 0.45, 0.45);
    botRoot.add(reactorMesh);

    // Reactor Outer Ring
    const reactorRingGeo = new THREE.RingGeometry(0.24, 0.28, 24);
    const reactorRingMat = new THREE.MeshBasicMaterial({ color: 0x28e99f, side: THREE.DoubleSide });
    const reactorRing = new THREE.Mesh(reactorRingGeo, reactorRingMat);
    reactorRing.position.set(0, 0.45, 0.46);
    botRoot.add(reactorRing);

    // 5c. Head & Visor Sensor (White Ceramic Dome)
    const headGeo = new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const headMesh = new THREE.Mesh(headGeo, whiteArmorMat);
    headMesh.position.set(0, 0.95, 0);
    botRoot.add(headMesh);

    // Visor LED (Mint scanning strip)
    const visorGeo = new THREE.BoxGeometry(0.42, 0.08, 0.15);
    const visorMesh = new THREE.Mesh(visorGeo, accentMintMat);
    visorMesh.position.set(0, 0.93, 0.32);
    botRoot.add(visorMesh);

    // Micro Antenna
    const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6);
    const antMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
    const antMesh = new THREE.Mesh(antGeo, antMat);
    antMesh.position.set(-0.2, 1.25, 0);
    antMesh.rotation.z = -0.2;
    botRoot.add(antMesh);

    // 5d. Right Mechanical Arm (White Armor + Welder directed at Chest)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.58, 0.5, 0);
    botRoot.add(rightArmGroup);

    // Shoulder joint (Dark Titanium)
    const shoulderGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const rightShoulder = new THREE.Mesh(shoulderGeo, darkJointMat);
    rightArmGroup.add(rightShoulder);

    // Upper arm (White Ceramic)
    const upperArmGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.45, 8);
    const upperArm = new THREE.Mesh(upperArmGeo, whiteArmorMat);
    upperArm.position.set(0.12, -0.2, 0.1);
    upperArm.rotation.z = -0.6;
    rightArmGroup.add(upperArm);

    // Forearm angled inward to chest (White Ceramic)
    const forearmGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.45, 8);
    const forearm = new THREE.Mesh(forearmGeo, whiteArmorMat);
    forearm.position.set(-0.15, -0.38, 0.3);
    forearm.rotation.z = 1.2;
    forearm.rotation.y = 0.5;
    rightArmGroup.add(forearm);

    // Welder Tool Torch (Cyan / Dark Blue Tool)
    const torchGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.25, 8);
    const torchMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const torch = new THREE.Mesh(torchGeo, torchMat);
    torch.position.set(-0.35, -0.32, 0.42);
    torch.rotation.z = 1.57;
    rightArmGroup.add(torch);

    // Torch Welding Tip (Glowing Cyan/White)
    const tipGeo = new THREE.SphereGeometry(0.055, 12, 12);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.set(-0.48, -0.32, 0.42);
    rightArmGroup.add(tipMesh);

    // 5e. Left Arm (White Armor + Diagnostic Scanner)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.58, 0.5, 0);
    botRoot.add(leftArmGroup);

    const leftShoulder = new THREE.Mesh(shoulderGeo, darkJointMat);
    leftArmGroup.add(leftShoulder);

    const leftLimb = new THREE.Mesh(upperArmGeo, whiteArmorMat);
    leftLimb.position.set(-0.12, -0.2, 0.05);
    leftLimb.rotation.z = 0.5;
    leftArmGroup.add(leftLimb);

    // Scanner tool head
    const scannerGeo = new THREE.BoxGeometry(0.18, 0.1, 0.12);
    const scannerMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
    const scanner = new THREE.Mesh(scannerGeo, scannerMat);
    scanner.position.set(-0.25, -0.38, 0.2);
    leftArmGroup.add(scanner);

    // ==========================================
    // 5f. MECHANICAL LEGS (HAI CHÂN CƠ KHÍ BỌC GIÁP TRẮNG)
    // ==========================================
    // Pelvis Block (Khung Hông Titan Đậm)
    const pelvisGeo = new THREE.BoxGeometry(0.65, 0.18, 0.4);
    const pelvis = new THREE.Mesh(pelvisGeo, darkJointMat);
    pelvis.position.set(0, -0.15, 0);
    botRoot.add(pelvis);

    // Function to create a leg assembly
    const createLeg = (isRight = false) => {
      const legGroup = new THREE.Group();
      const xOffset = isRight ? 0.24 : -0.24;
      legGroup.position.set(xOffset, -0.22, 0);

      // Hip ball joint
      const hipJoint = new THREE.Mesh(shoulderGeo, darkJointMat);
      legGroup.add(hipJoint);

      // Thigh (White Ceramic Strut)
      const thighGeo = new THREE.BoxGeometry(0.13, 0.48, 0.14);
      const thigh = new THREE.Mesh(thighGeo, whiteArmorMat);
      thigh.position.set(0, -0.24, -0.05);
      thigh.rotation.x = -0.18; // Slight backward angle
      thigh.rotation.z = isRight ? -0.08 : 0.08;
      legGroup.add(thigh);

      // Knee Joint (Dark Titanium Cylinder)
      const kneeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.15, 8);
      kneeGeo.rotateZ(Math.PI / 2);
      const knee = new THREE.Mesh(kneeGeo, darkJointMat);
      knee.position.set(0, -0.48, 0.02);
      legGroup.add(knee);

      // Shin / Calf (White Ceramic Strut angled forward)
      const shinGeo = new THREE.BoxGeometry(0.12, 0.52, 0.13);
      const shin = new THREE.Mesh(shinGeo, whiteArmorMat);
      shin.position.set(0, -0.74, -0.02);
      shin.rotation.x = 0.18;
      legGroup.add(shin);

      // Ankle & Foot Pad (Dark Titanium Sole + White Plate)
      const footGeo = new THREE.BoxGeometry(0.18, 0.08, 0.32);
      const foot = new THREE.Mesh(footGeo, darkJointMat);
      foot.position.set(0, -1.02, 0.08);

      const footPlateGeo = new THREE.BoxGeometry(0.16, 0.03, 0.22);
      const footPlate = new THREE.Mesh(footPlateGeo, whiteArmorMat);
      footPlate.position.set(0, 0.05, 0.02);
      foot.add(footPlate);

      legGroup.add(foot);

      return { legGroup, knee, shin, foot };
    };

    const leftLeg = createLeg(false);
    const rightLeg = createLeg(true);
    botRoot.add(leftLeg.legGroup);
    botRoot.add(rightLeg.legGroup);

    // ==========================================
    // 6. NANITE WELDING SPARKS (FROM TORCH TIP)
    // ==========================================
    const sparkCount = 40;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVels = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = 0.05;
      sparkPos[i * 3 + 1] = 0.5;
      sparkPos[i * 3 + 2] = 0.5;

      const angle = Math.random() * Math.PI * 2;
      const spd = 0.015 + Math.random() * 0.035;
      sparkVels[i * 3] = Math.cos(angle) * spd;
      sparkVels[i * 3 + 1] = (Math.random() - 0.2) * spd * 1.5;
      sparkVels[i * 3 + 2] = Math.sin(angle) * spd;
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.05,
      transparent: true,
      opacity: 0.9,
    });
    const sparkSystem = new THREE.Points(sparkGeo, sparkMat);
    botRoot.add(sparkSystem);

    // ==========================================
    // 7. 3D FLOATING HEALTHY "+" CROSSES (DẤU CỘNG HEALTHY)
    // ==========================================
    const crossCount = 42;
    const crossGroup = new THREE.Group();
    scene.add(crossGroup);

    const crosses = [];

    // Create custom Cross Geometry (2 intersecting rectangles)
    const crossShape = new THREE.Shape();
    const w = 0.035;
    const l = 0.12;
    crossShape.moveTo(-w, l);
    crossShape.lineTo(w, l);
    crossShape.lineTo(w, w);
    crossShape.lineTo(l, w);
    crossShape.lineTo(l, -w);
    crossShape.lineTo(w, -w);
    crossShape.lineTo(w, -l);
    crossShape.lineTo(-w, -l);
    crossShape.lineTo(-w, -w);
    crossShape.lineTo(-l, -w);
    crossShape.lineTo(-l, w);
    crossShape.lineTo(-w, w);
    crossShape.closePath();

    const crossGeo = new THREE.ShapeGeometry(crossShape);

    for (let i = 0; i < crossCount; i++) {
      const crossMat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xa7f3d0 : 0x28e99f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      });
      const crossMesh = new THREE.Mesh(crossGeo, crossMat);

      // Stagger initial progress
      const progress = (i / crossCount) * 1.0;
      const angle = (i / crossCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 0.45 + Math.random() * 1.25;

      crosses.push({
        mesh: crossMesh,
        mat: crossMat,
        progress,
        speed: 0.005 + Math.random() * 0.006,
        baseAngle: angle,
        radius,
        rotSpeed: (Math.random() - 0.5) * 0.04,
      });

      crossGroup.add(crossMesh);
    }

    // ==========================================
    // 8. ANIMATION LOOP & PARALLAX
    // ==========================================
    let mouseX = 0;
    let mouseY = 0;
    let targetCamX = 0;
    let targetCamY = 0.4;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetCamX = mouseX * 0.6;
      targetCamY = 0.4 + mouseY * 0.4;
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
      camera.lookAt(0, 0.1, 0);

      // Stance subtle breathing / weight shift
      const breath = Math.sin(elapsed * 2.0) * 0.015;
      botRoot.position.y = -0.15 + breath;
      torsoMesh.rotation.y = Math.sin(elapsed * 0.8) * 0.06;

      // Mechanical Right Arm Welding Micro-motions
      const weldJitter = Math.sin(elapsed * 22) * 0.018;
      rightArmGroup.rotation.z = weldJitter;
      rightArmGroup.rotation.x = Math.sin(elapsed * 1.5) * 0.05;

      // Welding Arc Light Flicker
      const isWeldingFlash = Math.sin(elapsed * 25) > -0.2;
      arcLight.intensity = isWeldingFlash ? 4.5 + Math.random() * 2.0 : 0.8;
      tipMesh.scale.setScalar(isWeldingFlash ? 1.4 : 0.9);

      // Chest Reactor Pulse
      const rPulse = 1.0 + Math.sin(elapsed * 3.5) * 0.12;
      reactorMesh.scale.set(rPulse, rPulse, rPulse);
      reactorRing.rotation.z += 0.02;

      // Nanite Welding Sparks Emitter
      const sparkPosArr = sparkGeo.attributes.position.array;
      for (let i = 0; i < sparkCount; i++) {
        sparkPosArr[i * 3] += sparkVels[i * 3];
        sparkPosArr[i * 3 + 1] += sparkVels[i * 3 + 1];
        sparkPosArr[i * 3 + 2] += sparkVels[i * 3 + 2];

        // Reset spark when it flies too far
        const dist = Math.hypot(sparkPosArr[i * 3] - 0.05, sparkPosArr[i * 3 + 1] - 0.5, sparkPosArr[i * 3 + 2] - 0.5);
        if (dist > 0.45 || Math.random() < 0.04) {
          sparkPosArr[i * 3] = 0.05;
          sparkPosArr[i * 3 + 1] = 0.5;
          sparkPosArr[i * 3 + 2] = 0.5;
        }
      }
      sparkGeo.attributes.position.needsUpdate = true;

      // Update 3D Floating Healthy Crosses (+)
      crosses.forEach((cr) => {
        cr.progress = (cr.progress + cr.speed) % 1.0;
        const p = cr.progress; // 0.0 (birth at chest) to 1.0 (vanish in air)

        // Float up: y moves from 0.4 to 2.4
        const posX = Math.cos(cr.baseAngle) * cr.radius * (0.4 + p * 0.6);
        const posY = 0.35 + p * 2.0 + Math.sin(p * Math.PI) * 0.1;
        const posZ = Math.sin(cr.baseAngle) * cr.radius * (0.4 + p * 0.6) + 0.3;

        cr.mesh.position.set(posX, posY, posZ);

        // Scale & Opacity curve: emerge -> grow -> dissolve
        let opacity = 0;
        let scale = 1;
        if (p < 0.2) {
          opacity = p / 0.2;
          scale = 0.5 + (p / 0.2) * 0.5;
        } else if (p < 0.7) {
          opacity = 0.95;
          scale = 1.0 + ((p - 0.2) / 0.5) * 0.25;
        } else {
          opacity = Math.max(0, 1 - (p - 0.7) / 0.3);
          scale = 1.25 + ((p - 0.7) / 0.3) * 0.35; // Expand as it dissolves
        }

        cr.mat.opacity = opacity;
        cr.mesh.scale.set(scale, scale, scale);
        cr.mesh.rotation.z += cr.rotSpeed;
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`self-healing-drone-3d-root ${className}`}
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
        <Wrench size={11} className="animate-pulse" />
        <span>HEALING ENGINE: AUTONOMOUS REPAIR ACTIVE</span>
      </div>

      {/* Top Right Policy Loop Meta */}
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
        CLOSED-LOOP MAPE-K // SLA GUARD
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
          [3D WebGL Visualization: Autonomous Self-Repair Drone Initialized]
        </div>
      )}

      {/* ================= HOLOGRAPHIC REPAIR STATUS HUD (TOP RIGHT) ================= */}
      <div
        style={{
          position: 'absolute',
          top: '40px',
          right: '16px',
          width: '195px',
          padding: '10px 12px',
          backgroundColor: 'rgba(23, 21, 33, 0.94)',
          border: '1px solid var(--color-accent)',
          borderRadius: '0px',
          boxShadow: isHovered ? '0 0 24px rgba(40, 233, 159, 0.45)' : '0 8px 20px rgba(0,0,0,0.5)',
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
            <ShieldCheck size={10} /> SELF-HEAL LEVEL 4
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: 'var(--color-accent)', fontWeight: 700 }}>
            1.8s
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25, marginTop: '4px' }}>
          Rolling Patch Applied
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#8B8999' }}>
            CLUSTER HEALTH
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-accent)', fontWeight: 700 }}>
            99.98% HEALTHY
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: '#A7F3D0', marginTop: '2px' }}>
          Workload: replica-set-v1.4 &rarr; 0 downtime
        </div>
      </div>

      {/* ================= HEALING TELEMETRY CHIPS (LEFT OVERLAY) ================= */}
      <div
        style={{
          position: 'absolute',
          top: '42px',
          left: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          zIndex: 10,
        }}
      >
        {[
          { label: 'Tự Khắc Phục: Pod Eviction', icon: RefreshCw, color: '#28E99F' },
          { label: 'Nanite Patch: 0 Disruption', icon: Wrench, color: '#38BDF8' },
          { label: 'SLA Guard: 100% Protected', icon: Activity, color: '#A78BFA' },
        ].map((chip, idx) => {
          const Icon = chip.icon;
          return (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                backgroundColor: 'rgba(23, 21, 33, 0.85)',
                border: '1px solid rgba(61, 59, 79, 0.65)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.5625rem',
                color: '#D6D6D6',
              }}
            >
              <Icon size={10} style={{ color: chip.color }} />
              <span>{chip.label}</span>
            </div>
          );
        })}
      </div>

      {/* ================= BOTTOM TIMELINE BAR ================= */}
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
          <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>MAPE-K CLOSED-LOOP</span>
          <span style={{ color: '#4B4958' }}>&bull;</span>
          <span style={{ color: '#38BDF8' }}>NANITE SELF-REPAIR</span>
          <span style={{ color: '#4B4958' }}>&bull;</span>
          <span style={{ color: '#A7F3D0' }}>+ HEALTHY DISSOLVE ACTIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--color-accent)' }}>Recovered: 1.8s</span>
          <span style={{ color: '#8B8999' }}>Zero Human Touch</span>
          <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>100% HEALTHY</span>
        </div>
      </div>
    </div>
  );
};

export default SelfHealingDrone3D;
