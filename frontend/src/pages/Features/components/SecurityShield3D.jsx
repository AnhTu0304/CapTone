import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * SecurityShield3D (Three.js - Enterprise Security & RBAC Aegis Shield)
 * 
 * Sa bàn 3D mô phỏng Hệ Thống Phòng Thủ Bảo Mật Doanh Nghiệp & RBAC:
 * 1. Khẩu Súng Công Nghệ Cao Màu Trắng (White High-Tech Sentry Cannon):
 *    - Toàn bộ thân giáp bọc Trắng Sứ nguyên khối bóng bẩy (White Ceramic #FFFFFF).
 *    - Cụm nòng kép công nghệ cao với đầu nòng titanium và vòng gia tốc phát sáng Neon Cyan.
 *    - Hoạt ảnh giật lùi (Recoil Kickback) cơ học chân thực mỗi khi khai hỏa.
 * 2. Dòng Đạn Plasma Bắn Liên Tục (Continuous High-Velocity Plasma Stream):
 *    - Các viên đạn plasma động năng mang vệt sáng bay tốc độ cao từ nòng súng tới khiên.
 * 3. Khiên Năng Lượng Lực Từ RBAC (Aegis Forcefield Shield):
 *    - Lá chắn cong dạng mạng lưới lục giác tổ ong (Hexagonal Honeycomb) màu Mint #28E99F & Cyan #00F0FF.
 *    - Lõi huy hiệu bảo mật Zero-Trust RBAC tỏa sáng hào quang ở tâm khiên.
 *    - Sóng xung kích va chạm (Shockwave Ripple) lan tỏa khắp mặt khiên khi hấp thụ đạn.
 * 4. Hiệu Ứng Văng Đạn & Mảnh Lửa Nảy Bật (Kinetic Ricochet & Deflection Sparks):
 *    - Khi đạn chạm mặt khiên, 30+ hạt tia lửa và mảnh đạn văng dội ngược lại theo hình nón phản xạ,
 *      lóe sáng rực rỡ, giảm tốc và tan biến dần vào không gian.
 * 5. Bố cục:
 *    - Toàn bộ text HUD overlay đã được loại bỏ theo yêu cầu để giữ không gian 3D tinh gọn, thuần khiết.
 *    - Model được căn chỉnh hoàn hảo, nằm gọn hoàn toàn bên trong khung kỹ thuật 340px.
 */
export const SecurityShield3D = ({ className = '' }) => {
  const mountRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // WebGL Check
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

    const width = container.clientWidth || 580;
    const height = container.clientHeight || 340;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x161522, 0.08);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 5.2);
    camera.lookAt(0, -0.05, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x161522, 1);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0x00f0ff, 1.6, 20);
    keyLight.position.set(-2, 3, 3);
    scene.add(keyLight);

    const shieldLight = new THREE.PointLight(0x28e99f, 2.2, 15);
    shieldLight.position.set(1.8, 1.2, 2);
    scene.add(shieldLight);

    // Impact Flash PointLight (pulses when bullets hit shield)
    const impactLight = new THREE.PointLight(0x28e99f, 0, 8);
    impactLight.position.set(1.2, 0.1, 0);
    scene.add(impactLight);

    // Muzzle Flash PointLight (pulses when gun fires)
    const muzzleLight = new THREE.PointLight(0x00f0ff, 0, 6);
    muzzleLight.position.set(-0.7, 0.12, 0);
    scene.add(muzzleLight);

    // 3. Grid Floor & Laser Guide Line
    const grid = new THREE.GridHelper(16, 22, 0x28e99f, 0x242238);
    grid.position.set(0, -1.35, 0);
    if (grid.material) {
      grid.material.transparent = true;
      grid.material.opacity = 0.35;
    }
    scene.add(grid);

    // Guide Laser Line connecting Gun to Shield
    const guideGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.2, -1.34, 0),
      new THREE.Vector3(1.3, -1.34, 0),
    ]);
    const guideMat = new THREE.LineBasicMaterial({ color: 0x28e99f, transparent: true, opacity: 0.25 });
    const guideLine = new THREE.Line(guideGeo, guideMat);
    scene.add(guideLine);

    // =========================================================================
    // 4. MODEL 1: WHITE HIGH-TECH SENTRY GUN / CANNON (CÂY SÚNG MÀU TRẮNG)
    // =========================================================================
    const gunGroup = new THREE.Group();
    gunGroup.position.set(-1.85, -0.05, 0);
    gunGroup.scale.set(0.88, 0.88, 0.88);
    scene.add(gunGroup);

    // Materials
    const whiteCeramicMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0.12,
    });
    const whiteSecondaryMat = new THREE.MeshStandardMaterial({
      color: 0xf3f5f8,
      roughness: 0.26,
      metalness: 0.2,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1a1829,
      roughness: 0.5,
      metalness: 0.85,
    });
    const glowMintMat = new THREE.MeshBasicMaterial({ color: 0x28e99f });
    const glowCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // 4.1 Base Turret Platform (Bệ đỡ súng)
    const baseGeo = new THREE.CylinderGeometry(0.52, 0.68, 0.22, 8);
    const baseMesh = new THREE.Mesh(baseGeo, whiteCeramicMat);
    baseMesh.position.set(0, -1.15, 0);
    gunGroup.add(baseMesh);

    const baseRingGeo = new THREE.RingGeometry(0.55, 0.66, 8);
    const baseRing = new THREE.Mesh(baseRingGeo, glowMintMat);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(0, -1.03, 0);
    gunGroup.add(baseRing);

    // Turret Swivel Pylon (Cột xoay titan)
    const pylonGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.75, 16);
    const pylonMesh = new THREE.Mesh(pylonGeo, darkMetalMat);
    pylonMesh.position.set(0, -0.7, 0);
    gunGroup.add(pylonMesh);

    // Articulated Swivel Joint (Khớp cầu xoay)
    const jointGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const jointMesh = new THREE.Mesh(jointGeo, darkMetalMat);
    jointMesh.position.set(0, -0.25, 0);
    gunGroup.add(jointMesh);

    // 4.2 Gun Elevation Group (Bộ phận súng giật lùi & nòng súng)
    const gunRecoilGroup = new THREE.Group();
    gunRecoilGroup.position.set(0, -0.05, 0);
    gunGroup.add(gunRecoilGroup);

    // Gun Receiver / Chassis (Thân súng trắng bóng)
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.48, 0.52);
    const bodyMesh = new THREE.Mesh(bodyGeo, whiteCeramicMat);
    bodyMesh.position.set(-0.15, 0.3, 0);
    gunRecoilGroup.add(bodyMesh);

    // Top Chamfer Armor Plate (Tấm giáp trên dốc)
    const topPlateGeo = new THREE.BoxGeometry(0.9, 0.15, 0.4);
    const topPlate = new THREE.Mesh(topPlateGeo, whiteSecondaryMat);
    topPlate.position.set(-0.1, 0.58, 0);
    gunRecoilGroup.add(topPlate);

    // Targeting Sensor / Scope Pod (Kính ngắm laser công nghệ cao)
    const scopeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.65, 16);
    scopeGeo.rotateZ(Math.PI / 2);
    const scopeMesh = new THREE.Mesh(scopeGeo, darkMetalMat);
    scopeMesh.position.set(0.1, 0.72, 0);
    gunRecoilGroup.add(scopeMesh);

    const lensGeo = new THREE.CircleGeometry ? new THREE.CircleGeometry(0.075, 16) : new THREE.RingGeometry(0, 0.075, 16);
    const lensMesh = new THREE.Mesh(lensGeo, glowCyanMat);
    lensMesh.rotation.y = Math.PI / 2;
    lensMesh.position.set(0.44, 0.72, 0);
    gunRecoilGroup.add(lensMesh);

    // Energy Conduits / Heatsink Fins (Rãnh tản nhiệt năng lượng)
    for (let i = -1; i <= 1; i += 2) {
      const ventGeo = new THREE.BoxGeometry(0.65, 0.035, 0.02);
      const ventMesh = new THREE.Mesh(ventGeo, glowMintMat);
      ventMesh.position.set(-0.1, 0.3, i * 0.27);
      gunRecoilGroup.add(ventMesh);
    }

    // 4.3 Dual Plasma Barrels (Cụm nòng đôi)
    const barrelLength = 1.2;
    const barrelOffsets = [0.11, -0.11];
    barrelOffsets.forEach((yOffset) => {
      // Barrel Tube
      const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, barrelLength, 16);
      barrelGeo.rotateZ(Math.PI / 2);
      const barrelMesh = new THREE.Mesh(barrelGeo, darkMetalMat);
      barrelMesh.position.set(0.75, 0.3 + yOffset, 0);
      gunRecoilGroup.add(barrelMesh);

      // White Ceramic Heat Shield Shroud (Ống bọc giáp trắng ngoài)
      const shroudGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 16);
      shroudGeo.rotateZ(Math.PI / 2);
      const shroudMesh = new THREE.Mesh(shroudGeo, whiteCeramicMat);
      shroudMesh.position.set(0.5, 0.3 + yOffset, 0);
      gunRecoilGroup.add(shroudMesh);

      // Muzzle Accelerator Ring (Vòng gia tốc phát sáng ở đầu nòng)
      const ringGeo = new THREE.TorusGeometry ? new THREE.TorusGeometry(0.075, 0.016, 8, 20) : new THREE.RingGeometry(0.05, 0.08, 16);
      ringGeo.rotateY(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, glowCyanMat);
      ringMesh.position.set(1.36, 0.3 + yOffset, 0);
      gunRecoilGroup.add(ringMesh);
    });

    // Muzzle Flash Mesh (Chớp nòng lóe sáng khi bắn)
    const flashGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0 });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.set(1.42, 0.3, 0);
    gunRecoilGroup.add(flashMesh);

    // =========================================================================
    // 5. MODEL 2: DEFENSIVE ENERGY SHIELD / RBAC AEGIS BARRIER (CÁI KHIÊN)
    // =========================================================================
    const shieldGroup = new THREE.Group();
    shieldGroup.position.set(1.45, 0.05, 0);
    shieldGroup.scale.set(0.88, 0.88, 0.88);
    scene.add(shieldGroup);

    // 5.1 Shield Generator Pylon (Cột phát từ trường khiên)
    const generatorBaseGeo = new THREE.CylinderGeometry(0.32, 0.48, 0.3, 6);
    const generatorBase = new THREE.Mesh(generatorBaseGeo, whiteCeramicMat);
    generatorBase.position.set(0, -1.2, 0);
    shieldGroup.add(generatorBase);

    const emitterPillarGeo = new THREE.CylinderGeometry(0.055, 0.075, 1.05, 12);
    const emitterPillar = new THREE.Mesh(emitterPillarGeo, darkMetalMat);
    emitterPillar.position.set(0, -0.65, 0);
    shieldGroup.add(emitterPillar);

    const emitterGlowGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.95, 8);
    const emitterGlow = new THREE.Mesh(emitterGlowGeo, glowMintMat);
    emitterGlow.position.set(0, -0.65, 0);
    shieldGroup.add(emitterGlow);

    // 5.2 Curved Aegis Forcefield Shield Surface (Mặt khiên cong năng lượng)
    const shieldArcGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.2, 16, 2, true, Math.PI * 0.72, Math.PI * 0.56);
    shieldArcGeo.rotateY(Math.PI);

    const shieldTranslucentMat = new THREE.MeshStandardMaterial({
      color: 0x28e99f,
      emissive: 0x138858,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.42,
      roughness: 0.1,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    const shieldMesh = new THREE.Mesh(shieldArcGeo, shieldTranslucentMat);
    shieldMesh.position.set(-0.25, 0.15, 0);
    shieldGroup.add(shieldMesh);

    // Hexagonal Wireframe Honeycomb Grid Overlay on Shield
    const shieldWireGeo = new THREE.CylinderGeometry(1.51, 1.51, 2.22, 16, 8, true, Math.PI * 0.72, Math.PI * 0.56);
    shieldWireGeo.rotateY(Math.PI);
    const shieldWireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const shieldWireMesh = new THREE.Mesh(shieldWireGeo, shieldWireMat);
    shieldWireMesh.position.set(-0.25, 0.15, 0);
    shieldGroup.add(shieldWireMesh);

    // Shield Outer Energy Frame / Rim
    const rimUpperGeo = new THREE.RingGeometry(1.48, 1.56, 16, 1, Math.PI * 0.72, Math.PI * 0.56);
    rimUpperGeo.rotateX(Math.PI / 2);
    const rimUpper = new THREE.Mesh(rimUpperGeo, glowMintMat);
    rimUpper.position.set(-0.25, 1.25, 0);
    shieldGroup.add(rimUpper);

    const rimLower = rimUpper.clone();
    rimLower.position.set(-0.25, -0.95, 0);
    shieldGroup.add(rimLower);

    // 5.3 Central Zero-Trust RBAC Insignia Core (Lõi huy hiệu bảo mật tâm khiên)
    const insigniaGroup = new THREE.Group();
    insigniaGroup.position.set(-0.28, 0.18, 0);
    shieldGroup.add(insigniaGroup);

    const coreGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x28e99f,
      emissive: 0x28e99f,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    insigniaGroup.add(coreMesh);

    const hexSealGeo = new THREE.RingGeometry(0.22, 0.3, 6);
    const hexSealMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const hexSealMesh = new THREE.Mesh(hexSealGeo, hexSealMat);
    hexSealMesh.rotation.y = Math.PI / 2;
    insigniaGroup.add(hexSealMesh);

    // 5.4 Expanding Shockwave Ripple Rings (Vòng sóng xung kích khi trúng đạn)
    const shockwaves = [];
    const MAX_SHOCKWAVES = 3;
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const ringGeo = new THREE.RingGeometry(0.12, 0.22, 24);
      ringGeo.rotateY(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x28e99f,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const waveMesh = new THREE.Mesh(ringGeo, ringMat);
      waveMesh.position.set(-0.3, 0.18, 0);
      shieldGroup.add(waveMesh);
      shockwaves.push({ mesh: waveMesh, mat: ringMat, scale: 1, active: false });
    }

    const triggerShockwave = () => {
      const available = shockwaves.find((s) => !s.active);
      if (available) {
        available.active = true;
        available.scale = 0.4;
        available.mat.opacity = 0.95;
      }
    };

    // =========================================================================
    // 6. CONTINUOUS BULLET PROJECTILE SYSTEM (DÒNG ĐẠN BẮN LIÊN TỤC)
    // =========================================================================
    const MAX_BULLETS = 8;
    const bullets = [];
    const bulletSpeed = 9.2; // units per second
    const gunMuzzleX = -0.65;
    const shieldImpactX = 1.15;

    for (let i = 0; i < MAX_BULLETS; i++) {
      const bGroup = new THREE.Group();

      // Kinetic plasma bolt geometry (Capsule/Cylinder shape)
      const bGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8);
      bGeo.rotateZ(Math.PI / 2);
      const bMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bGroup.add(bMesh);

      // Trailing glow aura
      const auraGeo = new THREE.CylinderGeometry(0.06, 0.015, 0.42, 8);
      auraGeo.rotateZ(Math.PI / 2);
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0x28e99f,
        transparent: true,
        opacity: 0.6,
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      auraMesh.position.set(-0.05, 0, 0);
      bGroup.add(auraMesh);

      bGroup.visible = false;
      scene.add(bGroup);

      bullets.push({
        group: bGroup,
        active: false,
        x: gunMuzzleX,
        y: 0.18,
        z: 0,
      });
    }

    // =========================================================================
    // 7. RICOCHET & SPARK DEFLECTION SYSTEM (HIỆU ỨNG VĂNG ĐẠN & TIA LỬA NẢY BẬT)
    // =========================================================================
    const MAX_SPARKS = 50;
    const sparkGeometry = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(MAX_SPARKS * 3);
    const sparkVelocities = [];
    const sparkLifetimes = new Float32Array(MAX_SPARKS);

    for (let i = 0; i < MAX_SPARKS; i++) {
      sparkPositions[i * 3] = 0;
      sparkPositions[i * 3 + 1] = 0;
      sparkPositions[i * 3 + 2] = 0;
      sparkVelocities.push(new THREE.Vector3(0, 0, 0));
      sparkLifetimes[i] = 0;
    }

    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = new THREE.PointsMaterial({
      color: 0x00ffcc,
      size: 0.075,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparkPoints);

    // Spawn Ricochet Sparks upon Impact
    const spawnRicochetSparks = (impactY, impactZ, count = 22) => {
      let spawned = 0;
      for (let i = 0; i < MAX_SPARKS && spawned < count; i++) {
        if (sparkLifetimes[i] <= 0) {
          sparkPositions[i * 3] = shieldImpactX + (Math.random() - 0.5) * 0.05;
          sparkPositions[i * 3 + 1] = impactY + (Math.random() - 0.5) * 0.08;
          sparkPositions[i * 3 + 2] = impactZ + (Math.random() - 0.5) * 0.08;

          const angleCone = (Math.random() - 0.5) * Math.PI * 0.8;
          const speed = 4.0 + Math.random() * 5.5;
          sparkVelocities[i].set(
            -Math.abs(Math.cos(angleCone)) * speed - 2.2,
            (Math.random() - 0.5) * 6.0,
            (Math.random() - 0.5) * 5.5
          );

          sparkLifetimes[i] = 0.35 + Math.random() * 0.35;
          spawned++;
        }
      }
      if (sparkGeometry.attributes && sparkGeometry.attributes.position) {
        sparkGeometry.attributes.position.needsUpdate = true;
      }
    };

    // =========================================================================
    // 8. ANIMATION LOOP & WEAPON CYCLING
    // =========================================================================
    const clock = new THREE.Clock();
    let fireCooldown = 0;
    const FIRE_INTERVAL = 0.28;
    let activeBarrelIndex = 0;
    let recoilIntensity = 0;
    let impactIntensity = 0;
    let animFrameId;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // Idle Hover & subtle sway
      gunGroup.position.y = -0.05 + Math.sin(elapsedTime * 1.5) * 0.025;
      shieldGroup.position.y = 0.05 + Math.cos(elapsedTime * 1.8) * 0.035;

      // Rotate central RBAC hex seal
      hexSealMesh.rotation.z += delta * 1.4;

      // 8.1 Gun Firing Logic (Bắn liên tục)
      fireCooldown -= delta;
      if (fireCooldown <= 0) {
        fireCooldown = FIRE_INTERVAL;

        const freeBullet = bullets.find((b) => !b.active);
        if (freeBullet) {
          activeBarrelIndex = (activeBarrelIndex + 1) % 2;
          const yMuzzle = 0.18 + (activeBarrelIndex === 0 ? 0.09 : -0.09);

          freeBullet.active = true;
          freeBullet.x = gunMuzzleX;
          freeBullet.y = yMuzzle;
          freeBullet.z = (Math.random() - 0.5) * 0.05;
          freeBullet.group.position.set(freeBullet.x, freeBullet.y, freeBullet.z);
          freeBullet.group.visible = true;

          // Recoil kickback
          recoilIntensity = 1.0;
          flashMat.opacity = 0.95;
          muzzleLight.intensity = 2.4;
        }
      }

      // 8.2 Recoil Kickback & Recovery
      if (recoilIntensity > 0) {
        gunRecoilGroup.position.x = -recoilIntensity * 0.12;
        gunRecoilGroup.rotation.z = recoilIntensity * 0.035;
        recoilIntensity = Math.max(0, recoilIntensity - delta * 7.5);
        flashMat.opacity = Math.max(0, flashMat.opacity - delta * 8.0);
        muzzleLight.intensity = Math.max(0, muzzleLight.intensity - delta * 12.0);
      } else {
        gunRecoilGroup.position.x = 0;
        gunRecoilGroup.rotation.z = 0;
      }

      // 8.3 Bullet Trajectory & Collision with Shield
      bullets.forEach((bullet) => {
        if (!bullet.active) return;

        bullet.x += bulletSpeed * delta;
        bullet.group.position.x = bullet.x;

        // Check impact with shield barrier
        if (bullet.x >= shieldImpactX) {
          bullet.active = false;
          bullet.group.visible = false;

          // Trigger Ricochet Sparks
          spawnRicochetSparks(bullet.y, bullet.z, 24);

          // Trigger Shockwave ripple
          triggerShockwave();

          // Flash impact lights & shield reaction
          impactIntensity = 1.0;
          impactLight.intensity = 3.6;
          shieldTranslucentMat.emissiveIntensity = 1.6;
          shieldWireMat.opacity = 0.95;

          // Push shield back slightly (mechanical absorption)
          shieldGroup.position.x = 1.5;
        }
      });

      // 8.4 Shield Impact Decay & Recovery
      if (impactIntensity > 0) {
        impactIntensity = Math.max(0, impactIntensity - delta * 6.0);
        impactLight.intensity = Math.max(0, impactLight.intensity - delta * 14.0);
        shieldTranslucentMat.emissiveIntensity = 0.6 + impactIntensity * 0.9;
        shieldWireMat.opacity = 0.55 + impactIntensity * 0.4;
        if (shieldGroup.position) {
          shieldGroup.position.x = THREE.MathUtils.lerp(shieldGroup.position.x, 1.45, delta * 8.0);
        }
      }

      // 8.5 Shockwave Rings Expansion
      shockwaves.forEach((sw) => {
        if (!sw.active) return;
        sw.scale += delta * 3.4;
        sw.mesh.scale.set(sw.scale, sw.scale, sw.scale);
        sw.mat.opacity = Math.max(0, sw.mat.opacity - delta * 2.6);
        if (sw.mat.opacity <= 0) {
          sw.active = false;
        }
      });

      // 8.6 Ricochet Sparks Dynamics (Văng đạn & tan biến)
      let activeSparksCount = 0;
      for (let i = 0; i < MAX_SPARKS; i++) {
        if (sparkLifetimes[i] > 0) {
          sparkLifetimes[i] -= delta;
          activeSparksCount++;

          sparkPositions[i * 3] += sparkVelocities[i].x * delta;
          sparkPositions[i * 3 + 1] += sparkVelocities[i].y * delta;
          sparkPositions[i * 3 + 2] += sparkVelocities[i].z * delta;

          sparkVelocities[i].y -= delta * 4.2;
          sparkVelocities[i].x *= 0.94; // Drag

          if (sparkLifetimes[i] <= 0) {
            sparkPositions[i * 3] = 0;
            sparkPositions[i * 3 + 1] = -100;
            sparkPositions[i * 3 + 2] = 0;
          }
        }
      }
      if (activeSparksCount > 0 && sparkGeometry.attributes && sparkGeometry.attributes.position) {
        sparkGeometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

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

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();

      // Dispose Geometries & Materials
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
    };
  }, []);

  return (
    <div
      className={`security-shield-card-root ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '340px',
        height: '340px',
        backgroundColor: '#161522',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Corner crosshairs (+) */}
      <div style={{ position: 'absolute', top: '8px', left: '8px', color: '#4E4966', fontFamily: 'var(--font-mono)', fontSize: '11px', pointerEvents: 'none', zIndex: 5 }}>
        +
      </div>
      <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#4E4966', fontFamily: 'var(--font-mono)', fontSize: '11px', pointerEvents: 'none', zIndex: 5 }}>
        +
      </div>
      <div style={{ position: 'absolute', bottom: '8px', left: '8px', color: '#4E4966', fontFamily: 'var(--font-mono)', fontSize: '11px', pointerEvents: 'none', zIndex: 5 }}>
        +
      </div>
      <div style={{ position: 'absolute', bottom: '8px', right: '8px', color: '#4E4966', fontFamily: 'var(--font-mono)', fontSize: '11px', pointerEvents: 'none', zIndex: 5 }}>
        +
      </div>

      {/* Dedicated Three.js Canvas Container */}
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
          [3D Aegis Security Defense Simulation]
        </div>
      )}
    </div>
  );
};

export default SecurityShield3D;
