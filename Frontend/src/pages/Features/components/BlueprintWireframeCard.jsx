import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import './BlueprintWireframeCard.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export const BlueprintWireframeCard = ({
  avatarColor = '#F97316',
  avatarIcon,
  avatarImage,
  username = 'agent.sre // k8s-prod-01',
  message = 'Automated remediation protocol standby',
  messages = [],
  alertStack = [],
  meshVariant = 'vortex',
  nodeColor = '#F472B6',
  nodeLabels = ['pod: auth-gw', 'node: worker-01', 'rtt: 0.8ms'],
  radarSweep = false,
  showCard = true,
  className = '',
  style = {},
  testId = 'blueprint-wireframe-card',
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const floatingCardRef = useRef(null);
  const avatarRef = useRef(null);
  const messageRef = useRef(null);
  const liveDotRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const quickToRef = useRef({ x: null, y: null, rx: null, ry: null });

  const messageList = messages && messages.length > 0 ? messages : [message];
  const [activeMessage, setActiveMessage] = useState(messageList[0]);

  useEffect(() => {
    setActiveMessage(messages && messages.length > 0 ? messages[0] : message);
  }, [message, messages]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let tick = 0;

    const packets = [
      { latIdx: 0, progress: 0.12, speed: 0.0045, dir: 1 },
      { latIdx: 1, progress: 0.85, speed: 0.0052, dir: -1 },
      { latIdx: 2, progress: 0.35, speed: 0.006, dir: 1 },
      { latIdx: 3, progress: 0.68, speed: 0.0048, dir: -1 },
      { latIdx: 4, progress: 0.22, speed: 0.0055, dir: 1 },
      { latIdx: 5, progress: 0.9, speed: 0.0042, dir: -1 },
    ];

    const nodes = [
      { bx: 0.25, by: -0.24, rot: 0.06, ping: 0 },
      { bx: -0.32, by: 0.22, rot: -0.08, ping: 0 },
      { bx: -0.1, by: 0.28, rot: 0.12, ping: 0 },
    ];

    let coreImg = null;
    if (avatarImage && typeof window !== 'undefined' && typeof window.Image !== 'undefined') {
      coreImg = new window.Image();
      coreImg.src = avatarImage;
    }

    const tsNodes = [
      { t: 0.58, layer: 2, rot: -0.05, ping: 0 },
      { t: 0.74, layer: 1, rot: 0.08, ping: 0 },
      { t: 0.89, layer: 0, rot: -0.06, ping: 0 },
    ];

    const dagPulses = [
      { edgeIdx: 0, t: 0.08, speed: 0.0085 },
      { edgeIdx: 1, t: 0.42, speed: 0.0075 },
      { edgeIdx: 2, t: 0.74, speed: 0.009 },
      { edgeIdx: 3, t: 0.18, speed: 0.011 },
      { edgeIdx: 3, t: 0.68, speed: 0.011 },
    ];

    const render = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const shiftX = pointerRef.current.x * 22;
      const shiftY = pointerRef.current.y * 15;
      const cx = width * 0.5 + shiftX;
      const cy = height * 0.5 + shiftY;

      if (meshVariant === 'audit-ledger') {
        const shieldR = Math.min(width, height) * 0.33;
        const vortexRings = 14;
        const rotBase = tick * 0.014;

        ctx.save();
        for (let i = 0; i < vortexRings; i++) {
          const angle = (i / vortexRings) * Math.PI * 2 + rotBase;
          const orbitR = shieldR * 0.28;
          const ox = cx + Math.cos(angle) * orbitR;
          const oy = cy + Math.sin(angle) * orbitR;
          const rx = shieldR * 0.72;
          const ry = shieldR * 0.46;

          ctx.beginPath();
          if (typeof ctx.ellipse === 'function') {
            ctx.ellipse(ox, oy, rx, ry, angle, 0, Math.PI * 2);
          } else {
            ctx.arc(ox, oy, rx * 0.7, 0, Math.PI * 2);
          }
          ctx.strokeStyle =
            i % 2 === 0 ? 'rgba(13, 148, 136, 0.34)' : 'rgba(99, 102, 241, 0.32)';
          ctx.lineWidth = 1.05;
          ctx.stroke();
        }

        [0.45, 0.68, 0.86, 1.0].forEach((ratio, idx) => {
          ctx.beginPath();
          ctx.arc(cx, cy, shieldR * ratio, 0, Math.PI * 2);
          ctx.strokeStyle =
            idx === 3 ? 'rgba(13, 148, 136, 0.68)' : 'rgba(99, 102, 241, 0.22)';
          ctx.lineWidth = idx === 3 ? 1.8 : 0.9;
          ctx.stroke();
        });
        ctx.restore();

        const rays = [
          {
            inAngle: -2.55,
            outAngle: -1.75,
            speed: 0.011,
            offset: 0.0,
            tag: 'BLOCKED // CLUSTER-ADMIN',
          },
          {
            inAngle: -0.52,
            outAngle: -1.28,
            speed: 0.01,
            offset: 0.26,
            tag: 'DEFLECTED // TAMPER ATTEMPT',
          },
          {
            inAngle: 2.48,
            outAngle: 1.72,
            speed: 0.0115,
            offset: 0.52,
            tag: 'DENIED // INVALID TOKEN',
          },
          {
            inAngle: 0.58,
            outAngle: 1.35,
            speed: 0.0105,
            offset: 0.77,
            tag: 'REJECTED // SHA-256 MISMATCH',
          },
        ];

        rays.forEach((ray) => {
          const phase = (tick * ray.speed + ray.offset) % 1;
          const hitPhase = 0.44;
          const hitX = cx + Math.cos(ray.inAngle) * shieldR;
          const hitY = cy + Math.sin(ray.inAngle) * shieldR;
          const startDist = shieldR + Math.max(width, height) * 0.28;
          const startX = cx + Math.cos(ray.inAngle) * startDist;
          const startY = cy + Math.sin(ray.inAngle) * startDist;
          const outDist = shieldR + Math.max(width, height) * 0.26;
          const outX = hitX + Math.cos(ray.outAngle) * (outDist - shieldR);
          const outY = hitY + Math.sin(ray.outAngle) * (outDist - shieldR);

          ctx.save();
          if (typeof ctx.setLineDash === 'function') {
            ctx.setLineDash([3, 4]);
          }
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(hitX, hitY);
          ctx.lineTo(outX, outY);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
          ctx.restore();

          if (phase <= hitPhase) {
            const t = phase / hitPhase;
            const headX = startX + (hitX - startX) * t;
            const headY = startY + (hitY - startY) * t;
            const tailT = Math.max(0, t - 0.28);
            const tailX = startX + (hitX - startX) * tailT;
            const tailY = startY + (hitY - startY) * tailT;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(headX, headY);
            ctx.strokeStyle = '#EF4444';
            ctx.shadowColor = '#EF4444';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 2.4;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(headX, headY, 3.6, 0, Math.PI * 2);
            ctx.fillStyle = '#FCA5A5';
            ctx.fill();
            ctx.restore();
          } else {
            const t = (phase - hitPhase) / (1 - hitPhase);
            const headX = hitX + (outX - hitX) * t;
            const headY = hitY + (outY - hitY) * t;
            const tailT = Math.max(0, t - 0.32);
            const tailX = hitX + (outX - hitX) * tailT;
            const tailY = hitY + (outY - hitY) * tailT;
            const alpha = Math.max(0, 1 - t * 0.85);

            const rippleR = 6 + t * 28;
            ctx.save();
            ctx.beginPath();
            ctx.arc(hitX, hitY, rippleR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(20, 184, 166, ${(1 - t) * 0.85})`;
            ctx.lineWidth = 1.8;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(hitX, hitY, 4.5 * (1 - t * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(16, 185, 129, ${(1 - t) * 0.9})`;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(headX, headY);
            ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
            ctx.shadowColor = '#F59E0B';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 2.1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(headX, headY, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
            ctx.fill();

            if (t < 0.72 && typeof ctx.fillText === 'function') {
              ctx.font = '700 8px "JetBrains Mono", monospace';
              ctx.fillStyle = `rgba(15, 118, 110, ${1 - t})`;
              const labelX = hitX < cx ? hitX - 115 : hitX + 12;
              const labelY = hitY < cy ? hitY - 10 : hitY + 16;
              ctx.fillText(ray.tag, labelX, labelY);
            }
            ctx.restore();
          }
        });

        ctx.save();
        const vaultR = 23;
        ctx.beginPath();
        ctx.arc(cx, cy, vaultR + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#0D9488';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        if (
          coreImg &&
          coreImg.complete &&
          coreImg.naturalWidth > 0 &&
          typeof ctx.drawImage === 'function'
        ) {
          ctx.beginPath();
          ctx.arc(cx, cy, vaultR, 0, Math.PI * 2);
          if (typeof ctx.clip === 'function') ctx.clip();
          ctx.drawImage(coreImg, cx - vaultR, cy - vaultR, vaultR * 2, vaultR * 2);
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, vaultR, 0, Math.PI * 2);
          ctx.fillStyle = '#042F2E';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#14B8A6';
          ctx.fill();
        }
        ctx.restore();

        if (typeof ctx.fillText === 'function') {
          ctx.save();
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#0F766E';
          ctx.fillText('ZERO-TRUST VORTEX SHIELD // SHA-256', cx - shieldR * 0.95, cy - shieldR - 14);
          ctx.font = '600 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#115E59';
          ctx.fillText('LEAST PRIVILEGE // INTRUSION DEFLECTED', cx - shieldR * 0.85, cy + shieldR + 22);
          ctx.restore();
        }
      } else if (meshVariant === 'rolling-switchboard') {
        const ingressX = width * 0.16 + shiftX * 0.55;
        const agentX = width * 0.46 + shiftX * 0.85;
        const slotX = width * 0.78 + shiftX * 1.15;
        const cycle = (tick * 0.0065) % 1;
        const isSwitched = cycle > 0.35;

        ctx.save();
        const gwW = 34;
        const gwH = 44;
        ctx.beginPath();
        ctx.moveTo(ingressX - gwW, cy - gwH + 8);
        ctx.lineTo(ingressX + gwW, cy - gwH - 8);
        ctx.lineTo(ingressX + gwW, cy + gwH - 8);
        ctx.lineTo(ingressX - gwW, cy + gwH + 8);
        ctx.closePath();
        ctx.fillStyle = 'rgba(2, 132, 199, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.translate(ingressX, cy);
        ctx.fillStyle = '#0284C7';
        ctx.shadowColor = '#00F2FE';
        ctx.shadowBlur = 8;
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();

        if (typeof ctx.fillText === 'function') {
          ctx.save();
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#0369A1';
          ctx.fillText('INGRESS // ROUTER', ingressX - 42, cy - gwH - 14);
          ctx.font = '600 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#047857';
          ctx.fillText('0% PACKET LOSS', ingressX - 38, cy + gwH + 18);
          ctx.restore();
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(ingressX + gwW, cy);
        ctx.lineTo(agentX - 28, cy);
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.55)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < 2; i++) {
          const inT = (tick * 0.016 + i * 0.5) % 1;
          const px = ingressX + gwW + (agentX - 28 - (ingressX + gwW)) * inT;
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, cy, 3.4, 0, Math.PI * 2);
          ctx.fillStyle = '#0284C7';
          ctx.shadowColor = '#00F2FE';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }

        const podSlots = [
          {
            y: cy - height * 0.25,
            name: 'pod-checkout-7f9',
            status: 'ACTIVE // HEALTHY',
            mode: 'active',
          },
          {
            y: cy,
            name: 'pod-checkout-8b2',
            status: isSwitched ? 'READY // SERVING' : 'SPAWNING REPLICA...',
            mode: 'new',
          },
          {
            y: cy + height * 0.25,
            name: 'pod-checkout-old',
            status: isSwitched ? 'DRAINED // CLEANUP' : 'OOM // DRAINING',
            mode: 'draining',
          },
        ];

        const slotW = width * 0.14;
        const slotH = 22;

        podSlots.forEach((slot, idx) => {
          const isRouteActive =
            slot.mode === 'active' ||
            (slot.mode === 'new' && isSwitched) ||
            (slot.mode === 'draining' && !isSwitched);

          ctx.save();
          ctx.beginPath();
          const startX = agentX + 28;
          const endX = slotX - slotW;
          const midX = (startX + endX) * 0.5;
          const steps = 18;
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const inv = 1 - t;
            const bx = inv * inv * startX + 2 * inv * t * midX + t * t * endX;
            const by = inv * inv * cy + 2 * inv * t * slot.y + t * t * slot.y;
            if (s === 0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
          }
          if (!isRouteActive && typeof ctx.setLineDash === 'function') {
            ctx.setLineDash([4, 4]);
          }
          ctx.strokeStyle =
            slot.mode === 'draining'
              ? isSwitched
                ? 'rgba(148, 163, 184, 0.32)'
                : 'rgba(245, 158, 11, 0.55)'
              : isRouteActive
              ? 'rgba(16, 185, 129, 0.68)'
              : 'rgba(2, 132, 199, 0.35)';
          ctx.lineWidth = isRouteActive ? 1.75 : 1.05;
          ctx.stroke();
          ctx.restore();

          if (isRouteActive) {
            const pT = (tick * 0.015 + idx * 0.33) % 1;
            const inv = 1 - pT;
            const startX = agentX + 28;
            const endX = slotX - slotW;
            const midX = (startX + endX) * 0.5;
            const bx = inv * inv * startX + 2 * inv * pT * midX + pT * pT * endX;
            const by = inv * inv * cy + 2 * inv * pT * slot.y + pT * pT * slot.y;
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
            ctx.fillStyle = slot.mode === 'draining' ? '#F59E0B' : '#10B981';
            ctx.shadowColor = slot.mode === 'draining' ? '#F59E0B' : '#10B981';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.restore();
          }

          ctx.save();
          const skew = -6;
          ctx.beginPath();
          ctx.moveTo(slotX - slotW, slot.y - slotH - skew);
          ctx.lineTo(slotX + slotW, slot.y - slotH + skew);
          ctx.lineTo(slotX + slotW, slot.y + slotH + skew);
          ctx.lineTo(slotX - slotW, slot.y + slotH - skew);
          ctx.closePath();

          if (slot.mode === 'draining' && isSwitched && typeof ctx.setLineDash === 'function') {
            ctx.setLineDash([4, 4]);
          }

          ctx.fillStyle =
            slot.mode === 'draining'
              ? isSwitched
                ? 'rgba(148, 163, 184, 0.04)'
                : 'rgba(245, 158, 11, 0.08)'
              : 'rgba(16, 185, 129, 0.065)';
          ctx.fill();
          ctx.strokeStyle =
            slot.mode === 'draining'
              ? isSwitched
                ? 'rgba(148, 163, 184, 0.45)'
                : 'rgba(245, 158, 11, 0.65)'
              : isRouteActive
              ? 'rgba(16, 185, 129, 0.65)'
              : 'rgba(2, 132, 199, 0.45)';
          ctx.lineWidth = 1.25;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(slotX - slotW + 14, slot.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle =
            slot.mode === 'draining'
              ? isSwitched
                ? '#94A3B8'
                : '#F59E0B'
              : isRouteActive
              ? '#10B981'
              : '#0284C7';
          ctx.fill();

          if (typeof ctx.fillText === 'function') {
            ctx.font = '700 8.5px "JetBrains Mono", monospace';
            ctx.fillStyle =
              slot.mode === 'draining' && isSwitched ? '#64748B' : '#0F172A';
            ctx.fillText(slot.name, slotX - slotW + 26, slot.y - 3);
            ctx.font = '600 8px "JetBrains Mono", monospace';
            ctx.fillStyle =
              slot.mode === 'draining'
                ? isSwitched
                  ? '#64748B'
                  : '#D97706'
                : '#047857';
            ctx.fillText(slot.status, slotX - slotW + 26, slot.y + 10);
          }
          ctx.restore();
        });

        ctx.save();
        const agentR = 25;
        const pulseWave = (tick * 0.022) % 1;
        ctx.beginPath();
        ctx.arc(agentX, cy, agentR + 6 + pulseWave * 16, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(2, 132, 199, ${(1 - pulseWave) * 0.65})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.save();
        ctx.translate(agentX, cy);
        ctx.rotate(tick * 0.024);
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([6, 4]);
        }
        ctx.beginPath();
        ctx.arc(0, 0, agentR + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();

        if (
          coreImg &&
          coreImg.complete &&
          coreImg.naturalWidth > 0 &&
          typeof ctx.drawImage === 'function'
        ) {
          ctx.beginPath();
          ctx.arc(agentX, cy, agentR, 0, Math.PI * 2);
          if (typeof ctx.clip === 'function') ctx.clip();
          ctx.drawImage(coreImg, agentX - agentR, cy - agentR, agentR * 2, agentR * 2);
        } else {
          ctx.beginPath();
          ctx.arc(agentX, cy, agentR, 0, Math.PI * 2);
          ctx.fillStyle = '#0F172A';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(agentX, cy, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#00F2FE';
          ctx.fill();
        }
        ctx.restore();

        if (typeof ctx.fillText === 'function') {
          ctx.save();
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#0369A1';
          ctx.fillText('RECOVERY: 1.8s // ZERO DOWNTIME', agentX - 82, cy - agentR - 18);
          ctx.font = '600 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#047857';
          ctx.fillText('K8S.AGENT // ROLLING UPDATE', agentX - 72, cy + agentR + 22);
          ctx.restore();
        }
      } else if (meshVariant === 'yaml-diff-gate') {
        const leftX = width * 0.22 + shiftX * 0.6;
        const gateX = width * 0.5 + shiftX * 0.9;
        const rightX = width * 0.78 + shiftX * 1.2;
        const panelW = width * 0.175;
        const panelH = height * 0.34;
        const scanProgress = (tick * 0.0075) % 1;
        const isApprovedPhase = scanProgress > 0.42;

        const drawYamlPanel = (px, title, isAfter) => {
          const skew = isAfter ? -10 : 10;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(px - panelW, cy - panelH - skew);
          ctx.lineTo(px + panelW, cy - panelH + skew);
          ctx.lineTo(px + panelW, cy + panelH + skew);
          ctx.lineTo(px - panelW, cy + panelH - skew);
          ctx.closePath();
          ctx.fillStyle = isAfter
            ? 'rgba(16, 185, 129, 0.045)'
            : 'rgba(99, 102, 241, 0.04)';
          ctx.fill();
          ctx.strokeStyle = isAfter
            ? 'rgba(16, 185, 129, 0.38)'
            : 'rgba(99, 102, 241, 0.32)';
          ctx.lineWidth = 1.15;
          ctx.stroke();

          if (typeof ctx.fillText === 'function') {
            ctx.font = '700 8.5px "JetBrains Mono", monospace';
            ctx.fillStyle = isAfter ? '#047857' : '#4338CA';
            ctx.fillText(title, px - panelW + 6, cy - panelH - Math.abs(skew) - 8);
          }

          const rows = isAfter
            ? [
                { text: 'kind: Deployment', type: 'ctx' },
                { text: 'name: checkout-svc', type: 'ctx' },
                { text: '+ replicas: 4', type: 'add' },
                { text: '+ memory: 512Mi', type: 'add' },
                { text: '  cpu: 500m', type: 'ctx' },
              ]
            : [
                { text: 'kind: Deployment', type: 'ctx' },
                { text: 'name: checkout-svc', type: 'ctx' },
                { text: '- replicas: 2', type: 'del' },
                { text: '- memory: 256Mi', type: 'del' },
                { text: '  cpu: 500m', type: 'ctx' },
              ];

          rows.forEach((row, rIdx) => {
            const ry = cy - panelH * 0.66 + rIdx * (panelH * 0.32);
            if (row.type !== 'ctx') {
              ctx.fillStyle =
                row.type === 'add'
                  ? 'rgba(16, 185, 129, 0.16)'
                  : 'rgba(239, 68, 68, 0.15)';
              ctx.fillRect(px - panelW + 8, ry - 10, panelW * 2 - 16, 15);
            }
            if (typeof ctx.fillText === 'function') {
              ctx.font =
                row.type === 'ctx'
                  ? '500 8.5px "JetBrains Mono", monospace'
                  : '700 8.5px "JetBrains Mono", monospace';
              ctx.fillStyle =
                row.type === 'add'
                  ? '#047857'
                  : row.type === 'del'
                  ? '#B91C1C'
                  : 'rgba(51, 65, 85, 0.78)';
              ctx.fillText(row.text, px - panelW + 12, ry + 1);
            }
          });

          const scanY = cy - panelH + scanProgress * (panelH * 2);
          ctx.beginPath();
          ctx.moveTo(px - panelW + 4, scanY);
          ctx.lineTo(px + panelW - 4, scanY);
          ctx.strokeStyle = isAfter
            ? 'rgba(16, 185, 129, 0.65)'
            : 'rgba(99, 102, 241, 0.55)';
          ctx.lineWidth = 1.4;
          ctx.stroke();

          ctx.restore();
        };

        drawYamlPanel(leftX, 'BEFORE // v1.14 SPEC', false);
        drawYamlPanel(rightX, 'AFTER // PATCHED SPEC', true);

        const diffRowOffsets = [-panelH * 0.02, panelH * 0.3];
        diffRowOffsets.forEach((rowOffset, idx) => {
          const sy = cy + rowOffset;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(leftX + panelW, sy);
          ctx.lineTo(gateX - 28, cy + (idx === 0 ? -6 : 6));
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
          ctx.lineWidth = 1.3;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(gateX + 28, cy + (idx === 0 ? -6 : 6));
          ctx.lineTo(rightX - panelW, sy);
          if (!isApprovedPhase && typeof ctx.setLineDash === 'function') {
            ctx.setLineDash([4, 4]);
          }
          ctx.strokeStyle = isApprovedPhase
            ? 'rgba(16, 185, 129, 0.72)'
            : 'rgba(168, 85, 247, 0.42)';
          ctx.lineWidth = isApprovedPhase ? 1.8 : 1.2;
          ctx.stroke();
          ctx.restore();

          const pktT = (tick * 0.012 + idx * 0.35) % 1;
          const pktX =
            pktT < 0.5
              ? leftX + panelW + (gateX - 28 - (leftX + panelW)) * (pktT * 2)
              : gateX + 28 + (rightX - panelW - (gateX + 28)) * ((pktT - 0.5) * 2);
          const pktY =
            pktT < 0.5
              ? sy + (cy - sy) * (pktT * 2)
              : cy + (sy - cy) * ((pktT - 0.5) * 2);

          ctx.save();
          ctx.beginPath();
          ctx.arc(pktX, pktY, 3.4, 0, Math.PI * 2);
          ctx.fillStyle = pktT < 0.5 ? '#6366F1' : '#10B981';
          ctx.shadowColor = pktT < 0.5 ? '#6366F1' : '#10B981';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        });

        ctx.save();
        const gateR = 25;
        const ringPulse = (tick * 0.02) % 1;
        ctx.beginPath();
        ctx.arc(gateX, cy, gateR + 6 + ringPulse * 14, 0, Math.PI * 2);
        ctx.strokeStyle = isApprovedPhase
          ? `rgba(16, 185, 129, ${(1 - ringPulse) * 0.65})`
          : `rgba(99, 102, 241, ${(1 - ringPulse) * 0.6})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.save();
        ctx.translate(gateX, cy);
        ctx.rotate(-tick * 0.018);
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([6, 4]);
        }
        ctx.beginPath();
        ctx.arc(0, 0, gateR + 5, 0, Math.PI * 2);
        ctx.strokeStyle = isApprovedPhase ? '#10B981' : '#6366F1';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();

        if (
          coreImg &&
          coreImg.complete &&
          coreImg.naturalWidth > 0 &&
          typeof ctx.drawImage === 'function'
        ) {
          ctx.beginPath();
          ctx.arc(gateX, cy, gateR, 0, Math.PI * 2);
          if (typeof ctx.clip === 'function') ctx.clip();
          ctx.drawImage(coreImg, gateX - gateR, cy - gateR, gateR * 2, gateR * 2);
        } else {
          ctx.beginPath();
          ctx.arc(gateX, cy, gateR, 0, Math.PI * 2);
          ctx.fillStyle = '#1E1B4B';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(gateX, cy, 9, 0, Math.PI * 2);
          ctx.fillStyle = isApprovedPhase ? '#10B981' : '#6366F1';
          ctx.fill();
        }
        ctx.restore();

        if (typeof ctx.fillText === 'function') {
          ctx.save();
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#047857';
          ctx.fillText('OP-01: VERIFIED', gateX - 42, cy - gateR - 24);
          ctx.fillStyle = isApprovedPhase ? '#047857' : '#6366F1';
          ctx.fillText(
            isApprovedPhase ? 'OP-02: APPROVED' : 'OP-02: SIGNING...',
            gateX - 42,
            cy - gateR - 12
          );
          ctx.font = '600 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#4338CA';
          ctx.fillText('HITL GATE // DUAL SIGN-OFF', gateX - 66, cy + gateR + 20);
          ctx.fillStyle = 'rgba(51, 65, 85, 0.8)';
          ctx.fillText('BLAST RADIUS: LOW (1 POD)', gateX - 64, cy + gateR + 33);
          ctx.restore();
        }
      } else if (meshVariant === 'causal-dag') {
        const planeCenters = [
          { x: width * 0.2 + shiftX * 0.55, y: cy, title: 'LAYER 01 // SYMPTOMS' },
          { x: width * 0.5 + shiftX * 0.85, y: cy, title: 'LAYER 02 // RCA MATRIX' },
          { x: width * 0.8 + shiftX * 1.15, y: cy, title: 'LAYER 03 // ROOT NODE' },
        ];

        planeCenters.forEach((pl, idx) => {
          const pw = width * 0.11;
          const ph = height * 0.34;
          const skewY = -18;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pl.x - pw, pl.y - ph - skewY);
          ctx.lineTo(pl.x + pw, pl.y - ph + skewY);
          ctx.lineTo(pl.x + pw, pl.y + ph + skewY);
          ctx.lineTo(pl.x - pw, pl.y + ph - skewY);
          ctx.closePath();
          ctx.fillStyle =
            idx === 2 ? 'rgba(239, 68, 68, 0.045)' : 'rgba(99, 102, 241, 0.035)';
          ctx.fill();
          ctx.strokeStyle =
            idx === 2 ? 'rgba(239, 68, 68, 0.32)' : 'rgba(99, 102, 241, 0.28)';
          ctx.lineWidth = 1;
          ctx.stroke();

          for (let g = 1; g <= 3; g++) {
            const gy = pl.y - ph + (ph * 2 * g) / 4;
            ctx.beginPath();
            ctx.moveTo(pl.x - pw, gy - skewY);
            ctx.lineTo(pl.x + pw, gy + skewY);
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }

          if (typeof ctx.fillText === 'function') {
            ctx.font = '600 8.5px "JetBrains Mono", monospace';
            ctx.fillStyle = idx === 2 ? 'rgba(220, 38, 38, 0.78)' : 'rgba(79, 70, 229, 0.68)';
            ctx.fillText(pl.title, pl.x - pw + 4, pl.y - ph - skewY - 8);
          }
          ctx.restore();
        });

        const symptomNodes = [
          { x: planeCenters[0].x - 8, y: cy - height * 0.24, label: 'api-gw // 502', color: '#F59E0B' },
          { x: planeCenters[0].x + 6, y: cy + 2, label: 'order-svc // timeout', color: '#F59E0B' },
          { x: planeCenters[0].x - 6, y: cy + height * 0.25, label: 'coredns // nxdomain', color: '#6366F1' },
        ];

        const coreNode = {
          x: planeCenters[1].x,
          y: cy,
          label: 'rca.engine // correlation',
        };

        const targetNodes = [
          { x: planeCenters[2].x + 4, y: cy - height * 0.25, label: 'auth-db // OK', isRoot: false },
          { x: planeCenters[2].x - 4, y: cy + 2, label: 'checkout-svc', sub: 'ExitCode 137 (OOM)', isRoot: true },
          { x: planeCenters[2].x + 6, y: cy + height * 0.25, label: 'redis-cache // OK', isRoot: false },
        ];

        const edges = [
          { from: symptomNodes[0], to: coreNode, active: true },
          { from: symptomNodes[1], to: coreNode, active: true },
          { from: symptomNodes[2], to: coreNode, active: true },
          { from: coreNode, to: targetNodes[1], active: true, critical: true },
          { from: coreNode, to: targetNodes[0], active: false },
          { from: coreNode, to: targetNodes[2], active: false },
        ];

        const getEdgePoint = (edge, t) => {
          const mx = (edge.from.x + edge.to.x) * 0.5;
          const my = (edge.from.y + edge.to.y) * 0.5 - (edge.critical ? 14 : 8);
          const inv = 1 - t;
          return {
            x: inv * inv * edge.from.x + 2 * inv * t * mx + t * t * edge.to.x,
            y: inv * inv * edge.from.y + 2 * inv * t * my + t * t * edge.to.y,
          };
        };

        edges.forEach((edge) => {
          ctx.save();
          ctx.beginPath();
          const steps = 20;
          for (let s = 0; s <= steps; s++) {
            const pt = getEdgePoint(edge, s / steps);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          if (!edge.active && typeof ctx.setLineDash === 'function') {
            ctx.setLineDash([3, 4]);
          }
          ctx.strokeStyle = edge.critical
            ? 'rgba(220, 38, 38, 0.78)'
            : edge.active
            ? 'rgba(99, 102, 241, 0.48)'
            : 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = edge.critical ? 2.1 : 1.15;
          ctx.stroke();
          ctx.restore();
        });

        dagPulses.forEach((p) => {
          p.t = (p.t + p.speed) % 1;
          const edge = edges[p.edgeIdx];
          const pt = getEdgePoint(edge, p.t);
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, edge.critical ? 4.2 : 3.1, 0, Math.PI * 2);
          ctx.fillStyle = edge.critical ? '#EF4444' : '#6366F1';
          ctx.shadowColor = edge.critical ? '#EF4444' : '#6366F1';
          ctx.shadowBlur = 9;
          ctx.fill();
          ctx.restore();
        });

        symptomNodes.forEach((sn, idx) => {
          const pulseR = 6 + Math.sin(tick * 0.06 + idx) * 2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(sn.x, sn.y, pulseR + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.32)';
          ctx.lineWidth = 1.1;
          ctx.stroke();

          ctx.translate(sn.x, sn.y);
          ctx.rotate(0.08);
          ctx.fillStyle = sn.color;
          ctx.fillRect(-5.5, -5.5, 11, 11);
          ctx.restore();

          if (typeof ctx.fillText === 'function') {
            ctx.save();
            ctx.font = '600 9px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(51, 65, 85, 0.85)';
            ctx.fillText(sn.label, sn.x - 42, sn.y + 18);
            ctx.restore();
          }
        });

        ctx.save();
        const coreR = 23;
        ctx.beginPath();
        ctx.arc(coreNode.x, coreNode.y, coreR + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (
          coreImg &&
          coreImg.complete &&
          coreImg.naturalWidth > 0 &&
          typeof ctx.drawImage === 'function'
        ) {
          ctx.beginPath();
          ctx.arc(coreNode.x, coreNode.y, coreR, 0, Math.PI * 2);
          if (typeof ctx.clip === 'function') ctx.clip();
          ctx.drawImage(coreImg, coreNode.x - coreR, coreNode.y - coreR, coreR * 2, coreR * 2);
        } else {
          ctx.beginPath();
          ctx.arc(coreNode.x, coreNode.y, coreR, 0, Math.PI * 2);
          ctx.fillStyle = '#1E1B4B';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(coreNode.x, coreNode.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#EF4444';
          ctx.fill();
        }
        ctx.restore();

        if (typeof ctx.fillText === 'function') {
          ctx.save();
          ctx.font = '600 9px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(79, 70, 229, 0.88)';
          ctx.fillText('K8s Event + Stderr + GitOps', coreNode.x - 68, coreNode.y + coreR + 18);
          ctx.restore();
        }

        targetNodes.forEach((tn) => {
          if (tn.isRoot) {
            const lockWave = (tick * 0.025) % 1;
            const waveR = 14 + lockWave * 24;
            ctx.save();
            ctx.beginPath();
            ctx.arc(tn.x, tn.y, waveR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${(1 - lockWave) * 0.75})`;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            ctx.translate(tn.x, tn.y);
            ctx.rotate(tick * 0.02);
            if (typeof ctx.setLineDash === 'function') {
              ctx.setLineDash([5, 4]);
            }
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.strokeStyle = '#DC2626';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.translate(tn.x, tn.y);
            ctx.fillStyle = '#DC2626';
            ctx.shadowColor = '#EF4444';
            ctx.shadowBlur = 12;
            ctx.fillRect(-7.5, -7.5, 15, 15);
            ctx.restore();

            if (typeof ctx.fillText === 'function') {
              ctx.save();
              ctx.font = '700 9.5px "JetBrains Mono", monospace';
              ctx.fillStyle = '#B91C1C';
              ctx.fillText('ROOT CAUSE // 98.4%', tn.x - 52, tn.y - 24);
              ctx.font = '600 9px "JetBrains Mono", monospace';
              ctx.fillStyle = '#1E293B';
              ctx.fillText(tn.label, tn.x - 36, tn.y + 28);
              ctx.fillStyle = '#DC2626';
              ctx.fillText(tn.sub, tn.x - 48, tn.y + 40);
              ctx.restore();
            }
          } else {
            ctx.save();
            ctx.translate(tn.x, tn.y);
            ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
            ctx.fillRect(-4.5, -4.5, 9, 9);
            ctx.restore();

            if (typeof ctx.fillText === 'function') {
              ctx.save();
              ctx.font = '600 8.5px "JetBrains Mono", monospace';
              ctx.fillStyle = 'rgba(100, 116, 139, 0.75)';
              ctx.fillText(tn.label, tn.x - 34, tn.y + 17);
              ctx.restore();
            }
          }
        });
      } else if (meshVariant === 'timeseries') {
        const startX = width * 0.06 + shiftX * 0.5;
        const endX = width * 0.94 + shiftX * 0.5;
        const spanX = endX - startX;
        const layers = 8;
        const steps = 28;
        const t0Ratio = 0.46;
        const t0X = startX + spanX * t0Ratio;
        const threshY = height * 0.2 + shiftY * 0.4;

        const getWavePoint = (layerIdx, t) => {
          const depth = layerIdx / (layers - 1);
          const x = startX + t * spanX + (depth - 0.5) * 26;
          const baseWave =
            Math.sin(t * 7.5 - tick * 0.035 + layerIdx * 0.45) * 10 +
            Math.cos(t * 3.8 + tick * 0.02) * 6;
          const forecastRise =
            t > t0Ratio ? Math.pow((t - t0Ratio) / (1 - t0Ratio), 1.65) * (height * 0.36) : 0;
          const spreadY = (depth - 0.5) * (height * 0.38);
          const y = cy + height * 0.14 + spreadY * (1 - t * 0.22) + baseWave - forecastRise;
          return { x, y };
        };

        ctx.save();
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([4, 4]);
        }
        ctx.beginPath();
        ctx.moveTo(startX, threshY);
        ctx.lineTo(endX, threshY);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(t0X, height * 0.1);
        ctx.lineTo(t0X, height * 0.9);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.32)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        if (typeof ctx.fillText === 'function') {
          ctx.save();
          ctx.font = '600 9.5px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(225, 29, 72, 0.78)';
          ctx.fillText('CRITICAL THRESHOLD // 85% OOM RISK', startX + 4, threshY - 6);
          ctx.fillStyle = 'rgba(99, 102, 241, 0.72)';
          ctx.fillText('PAST // T0', t0X - 64, height * 0.91);
          ctx.fillStyle = 'rgba(217, 119, 6, 0.85)';
          ctx.fillText('GRU FORECAST (+15m..+30m)', t0X + 8, height * 0.91);
          ctx.restore();
        }

        for (let s = 0; s <= steps; s += 2) {
          const t = s / steps;
          ctx.beginPath();
          for (let l = 0; l < layers; l++) {
            const pt = getWavePoint(l, t);
            if (l === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle =
            t > t0Ratio ? 'rgba(245, 158, 11, 0.24)' : 'rgba(99, 102, 241, 0.22)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }

        for (let l = 0; l < layers; l++) {
          ctx.beginPath();
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const pt = getWavePoint(l, t);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle =
            l <= 2 ? 'rgba(244, 63, 94, 0.46)' : 'rgba(99, 102, 241, 0.38)';
          ctx.lineWidth = l === 1 ? 1.6 : 1.05;
          ctx.stroke();
        }

        const pulseT = (tick * 0.0055) % 1;
        const pulsePt = getWavePoint(1, pulseT);
        ctx.save();
        ctx.beginPath();
        ctx.arc(pulsePt.x, pulsePt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = pulseT > t0Ratio ? '#F43F5E' : '#F59E0B';
        ctx.shadowColor = pulseT > t0Ratio ? '#F43F5E' : '#F59E0B';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();

        tsNodes.forEach((nd, idx) => {
          const pt = getWavePoint(nd.layer, nd.t);
          if (Math.abs(pulseT - nd.t) < 0.03 && nd.ping <= 0.05) {
            nd.ping = 1.0;
          }
          if (nd.ping > 0) {
            const rippleR = 9 + (1 - nd.ping) * 20;
            ctx.save();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, rippleR, 0, Math.PI * 2);
            ctx.strokeStyle = nodeColor;
            ctx.globalAlpha = nd.ping * 0.8;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
            nd.ping = Math.max(0, nd.ping - 0.02);
          }

          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(nd.rot);
          ctx.fillStyle = idx === 0 ? '#F59E0B' : nodeColor;
          ctx.shadowColor = idx === 0 ? '#F59E0B' : nodeColor;
          ctx.shadowBlur = 8;
          ctx.fillRect(-6, -6, 12, 12);
          ctx.restore();

          if (!showCard && typeof ctx.fillText === 'function') {
            const tsLabels = [
              'T+10m // +18MB/m DRIFT',
              'T+15m // OOM RISK 94.6%',
              'T+20m // +2 REPLICAS PLAN',
            ];
            ctx.save();
            ctx.font = '700 8.5px "JetBrains Mono", monospace';
            ctx.fillStyle = idx === 0 ? '#D97706' : '#E11D48';
            ctx.fillText(tsLabels[idx], pt.x - 54, pt.y - 12);
            ctx.restore();
          }
        });
      } else {
        const lobeSpan = width * 0.22;
        const rings = 12;

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.42)';
        ctx.lineWidth = 1.1;

        for (let i = 1; i <= rings; i++) {
          const ratio = i / rings;
          const rx = ratio * (width * 0.25);
          const ry = ratio * (height * 0.4) + 8;

          const leftOffset = lobeSpan * (1 - ratio * 0.85);
          const rightOffset = lobeSpan * (1 - ratio * 0.85);

          const wobbleL = Math.sin(tick * 0.02 + i * 0.3) * 2;
          const wobbleR = Math.cos(tick * 0.02 + i * 0.3) * 2;

          ctx.beginPath();
          if (typeof ctx.ellipse === 'function') {
            ctx.ellipse(cx - leftOffset, cy + wobbleL, rx, ry, 0, 0, Math.PI * 2);
          } else {
            ctx.arc(cx - leftOffset, cy + wobbleL, rx, 0, Math.PI * 2);
          }
          ctx.stroke();

          ctx.beginPath();
          if (typeof ctx.ellipse === 'function') {
            ctx.ellipse(cx + rightOffset, cy + wobbleR, rx, ry, 0, 0, Math.PI * 2);
          } else {
            ctx.arc(cx + rightOffset, cy + wobbleR, rx, 0, Math.PI * 2);
          }
          ctx.stroke();
        }

        const lats = [-3.2, -2.1, -1.0, 1.0, 2.1, 3.2];
        const startX = cx - width * 0.44;
        const endX = cx + width * 0.44;

        const getLatPoint = (lat, t) => {
          const baseY = cy + lat * (height * 0.115);
          const sx = startX + t * (endX - startX);
          const distToCenter = Math.abs(sx - cx) / (width * 0.26);
          const pinch = Math.exp(-Math.pow(distToCenter, 2)) * 0.48;
          const sy = cy + (baseY - cy) * (1 - pinch);
          return { x: sx, y: sy };
        };

        lats.forEach((lat) => {
          ctx.beginPath();
          const steps = 30;
          for (let s = 0; s <= steps; s++) {
            const pt = getLatPoint(lat, s / steps);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        });

        const sweepAngle = (tick * 0.028) % (Math.PI * 2);

        if (radarSweep) {
          const radarRadius = Math.min(width, height) * 0.44;
          ctx.save();

          [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
            ctx.beginPath();
            ctx.arc(cx, cy, radarRadius * ratio, 0, Math.PI * 2);
            ctx.strokeStyle = ratio === 1.0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.16)';
            ctx.lineWidth = ratio === 1.0 ? 1.2 : 0.8;
            ctx.stroke();
          });

          ctx.beginPath();
          ctx.moveTo(cx - 16, cy);
          ctx.lineTo(cx + 16, cy);
          ctx.moveTo(cx, cy - 16);
          ctx.lineTo(cx, cy + 16);
          ctx.strokeStyle = 'rgba(5, 150, 105, 0.5)';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, radarRadius, sweepAngle - 0.55, sweepAngle);
          ctx.closePath();
          ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(
            cx + Math.cos(sweepAngle) * radarRadius,
            cy + Math.sin(sweepAngle) * radarRadius
          );
          ctx.strokeStyle = 'rgba(5, 150, 105, 0.65)';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          if (typeof ctx.fillText === 'function') {
            ctx.font = '600 9.5px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(5, 150, 105, 0.75)';
            ctx.fillText('RADAR // 360° TELEMETRY SCAN', cx - radarRadius * 0.95, cy - radarRadius * 0.88);
            ctx.fillText('PROBE: ACTIVE (0.8ms LATENCY)', cx + radarRadius * 0.15, cy + radarRadius * 0.92);
          }

          ctx.restore();

          packets.forEach((pkt) => {
            pkt.progress += pkt.speed * pkt.dir;
            if (pkt.progress > 1) pkt.progress = 0;
            if (pkt.progress < 0) pkt.progress = 1;

            const pt = getLatPoint(lats[pkt.latIdx], pkt.progress);
            ctx.save();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.8, 0, Math.PI * 2);
            ctx.fillStyle = nodeColor;
            ctx.shadowColor = nodeColor;
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.restore();
          });
        }

        nodes.forEach((nd, idx) => {
          const floatY = Math.sin(tick * 0.035 + idx * 2) * 5;
          const nx = cx + nd.bx * width;
          const ny = cy + nd.by * height + floatY;

          if (radarSweep) {
            const nodeAngle = (Math.atan2(ny - cy, nx - cx) + Math.PI * 2) % (Math.PI * 2);
            const angleDiff = Math.abs(sweepAngle - nodeAngle);
            if (angleDiff < 0.12 && nd.ping <= 0.05) {
              nd.ping = 1.0;
            }
            if (nd.ping > 0) {
              const rippleR = 9 + (1 - nd.ping) * 22;
              ctx.save();
              ctx.beginPath();
              ctx.arc(nx, ny, rippleR, 0, Math.PI * 2);
              ctx.strokeStyle = nodeColor;
              ctx.globalAlpha = nd.ping * 0.75;
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.restore();
              nd.ping = Math.max(0, nd.ping - 0.022);
            }
          }

          ctx.save();
          ctx.translate(nx, ny);
          ctx.rotate(nd.rot);

          ctx.fillStyle = nodeColor;
          ctx.shadowColor = nodeColor;
          ctx.shadowBlur = 8;
          ctx.fillRect(-6.5, -6.5, 13, 13);
          ctx.restore();

          if (radarSweep && nodeLabels[idx] && typeof ctx.fillText === 'function') {
            ctx.save();
            ctx.font = '600 10px "JetBrains Mono", monospace';
            ctx.fillStyle = nd.ping > 0.2 ? '#047857' : 'rgba(61, 59, 79, 0.62)';
            ctx.fillText(nodeLabels[idx], nx + 11, ny + 3);
            ctx.restore();
          }
        });
      }

      ctx.restore();
      tick += 1;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [nodeColor, radarSweep, nodeLabels, meshVariant, avatarImage]);

  const { contextSafe } = useGSAP(
    () => {
      if (!floatingCardRef.current) return;

      quickToRef.current.x = gsap.quickTo(floatingCardRef.current, 'x', {
        duration: 0.35,
        ease: 'power3.out',
      });
      quickToRef.current.y = gsap.quickTo(floatingCardRef.current, 'y', {
        duration: 0.35,
        ease: 'power3.out',
      });
      quickToRef.current.rx = gsap.quickTo(floatingCardRef.current, 'rotationX', {
        duration: 0.35,
        ease: 'power3.out',
      });
      quickToRef.current.ry = gsap.quickTo(floatingCardRef.current, 'rotationY', {
        duration: 0.35,
        ease: 'power3.out',
      });

      if (alertStack && alertStack.length > 0) {
        const cards = gsap.utils.toArray('.blueprint-stack-item', floatingCardRef.current);
        if (cards.length > 1) {
          gsap.set(cards, { opacity: 0, y: 20, scale: 0.95, pointerEvents: 'none' });
          const seqTl = gsap.timeline({ repeat: -1 });
          cards.forEach((card) => {
            seqTl
              .to(card, {
                opacity: 1,
                y: 0,
                scale: 1,
                pointerEvents: 'auto',
                duration: 0.45,
                ease: 'back.out(1.4)',
              })
              .to(
                card,
                {
                  opacity: 0,
                  y: -16,
                  scale: 0.96,
                  pointerEvents: 'none',
                  duration: 0.35,
                  ease: 'power2.in',
                },
                '+=2.4'
              );
          });
        }
        return;
      }

      if (liveDotRef.current) {
        gsap.to(liveDotRef.current, {
          scale: 1.45,
          opacity: 0.45,
          duration: 0.9,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      if (messages && messages.length > 1 && messageRef.current) {
        const wrapMsg = gsap.utils.wrap(messages);
        let step = 0;

        const cycleTl = gsap.timeline({ repeat: -1, repeatDelay: 3.2 });
        cycleTl
          .to(messageRef.current, {
            y: -6,
            opacity: 0,
            duration: 0.22,
            ease: 'power2.in',
            onComplete: () => {
              step += 1;
              setActiveMessage(wrapMsg(step));
            },
          })
          .fromTo(
            messageRef.current,
            { y: 6, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.32, ease: 'power2.out' }
          );

        if (avatarRef.current) {
          cycleTl.fromTo(
            avatarRef.current,
            { scale: 1 },
            { scale: 1.07, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' },
            0.2
          );
        }
      }
    },
    { scope: containerRef, dependencies: [messages, alertStack] }
  );

  const handlePointerMove = contextSafe((e) => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const clampCoord = gsap.utils.clamp(-0.5, 0.5);
    const relX = clampCoord((e.clientX - rect.left) / rect.width - 0.5);
    const relY = clampCoord((e.clientY - rect.top) / rect.height - 0.5);

    pointerRef.current = { x: relX, y: relY };

    if (floatingCardRef.current && quickToRef.current.x) {
      quickToRef.current.x(relX * 26);
      quickToRef.current.y(relY * 18);
      quickToRef.current.rx(-relY * 11);
      quickToRef.current.ry(relX * 11);
    }
  });

  const handlePointerLeave = contextSafe(() => {
    pointerRef.current = { x: 0, y: 0 };
    if (floatingCardRef.current && quickToRef.current.x) {
      quickToRef.current.x(0);
      quickToRef.current.y(0);
      quickToRef.current.rx(0);
      quickToRef.current.ry(0);
    }
  });

  return (
    <div
      ref={containerRef}
      className={`blueprint-wireframe-frame ${className}`}
      style={style}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      data-testid={testId}
    >
      <div className="blueprint-wireframe-inner">
        <canvas
          ref={canvasRef}
          className="blueprint-wireframe-canvas"
          aria-hidden="true"
        />
        {showCard && alertStack && alertStack.length > 0 && (
          <div
            ref={floatingCardRef}
            className="blueprint-floating-stack"
            data-testid={`${testId}-floating-stack`}
          >
            {alertStack.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`blueprint-floating-card blueprint-stack-item ${item.variantClass || ''}`}
                data-testid={idx === 1 ? `${testId}-floating-card` : `${testId}-stack-card-${idx}`}
              >
                <div
                  className="blueprint-floating-avatar"
                  style={{ backgroundColor: item.avatarColor || avatarColor }}
                  data-testid={idx === 1 ? `${testId}-avatar` : `${testId}-stack-avatar-${idx}`}
                >
                  {item.avatarImage || avatarImage ? (
                    <img
                      src={item.avatarImage || avatarImage}
                      alt={item.username}
                      className="blueprint-floating-avatar-img"
                      data-testid={idx === 1 ? `${testId}-avatar-img` : `${testId}-stack-avatar-img-${idx}`}
                    />
                  ) : (
                    avatarIcon
                  )}
                </div>
                <div className="blueprint-floating-text">
                  <div className="blueprint-floating-header">
                    <div className="blueprint-floating-username">{item.username}</div>
                    {item.badgeText && (
                      <span className={`blueprint-alert-badge ${item.badgeClass || 'blueprint-alert-badge--warn'}`}>
                        {item.badgeText}
                      </span>
                    )}
                  </div>
                  <div className="blueprint-floating-message">{item.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {showCard && (!alertStack || alertStack.length === 0) && (
          <div
            ref={floatingCardRef}
            className="blueprint-floating-card"
            data-testid={`${testId}-floating-card`}
          >
            <div
              ref={avatarRef}
              className="blueprint-floating-avatar"
              style={{ backgroundColor: avatarColor }}
              data-testid={`${testId}-avatar`}
            >
              {avatarImage ? (
                <img
                  src={avatarImage}
                  alt={username}
                  className="blueprint-floating-avatar-img"
                  data-testid={`${testId}-avatar-img`}
                />
              ) : (
                avatarIcon || username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="blueprint-floating-text">
              <div className="blueprint-floating-header">
                <div className="blueprint-floating-username">{username}</div>
                {radarSweep && (
                  <span
                    ref={liveDotRef}
                    className="blueprint-live-dot"
                    data-testid={`${testId}-live-dot`}
                  />
                )}
              </div>
              <div ref={messageRef} className="blueprint-floating-message">
                {activeMessage}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlueprintWireframeCard;
