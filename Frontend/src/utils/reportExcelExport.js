/**
 * @file reportExcelExport.js
 * @description Xuất báo cáo SLA & Action Analytics ra định dạng Excel (.xlsx) chuyên nghiệp
 * hỗ trợ chọn từng loại biểu đồ / bảng dữ liệu (Multi-sheet + Nhúng ảnh biểu đồ PNG Canvas sắc nét).
 */

export const REPORT_EXCEL_SECTIONS = [
  {
    id: 'kpi_summary',
    group: 'CHARTS',
    badge: 'KPI',
    title: 'Tổng Quan Chỉ Số KPI (4 Thẻ)',
    description: 'Uptime thực tế, tốc độ hồi sinh MTTR, tổng Action (OK/Lỗi/Hủy) & phân bổ AI/Người',
    sheetName: '1_TongQuan_KPI',
    supportsImage: false,
  },
  {
    id: 'sla_trend',
    group: 'CHARTS',
    badge: 'Biểu đồ 1A',
    title: 'Biểu Đồ 1A: Xu Hướng SLA Uptime & MTTR',
    description: 'Diễn biến Uptime %, mục tiêu SLA 99.9%, MTTR (giây) và số sự cố tự phục hồi theo thời gian',
    sheetName: '2_BieuDo_SLA_MTTR',
    supportsImage: true,
  },
  {
    id: 'action_trend',
    group: 'CHARTS',
    badge: 'Biểu đồ 1B',
    title: 'Biểu Đồ 1B: Kết Quả Action Theo Thời Gian',
    description: 'Cột xếp chồng Thành công / Thất bại / Bị hủy và đường Tỷ lệ đạt (%) từng mốc thời gian',
    sheetName: '3_BieuDo_KQ_Action',
    supportsImage: true,
  },
  {
    id: 'incident_type',
    group: 'CHARTS',
    badge: 'Biểu đồ 2',
    title: 'Biểu Đồ 2: Cơ Cấu Các Loại Sự Cố (Donut)',
    description: 'Toàn bộ phân loại sự cố (CPU, RAM OOM, HTTP 5XX, Latency, Disk Full...) & tỷ trọng %',
    sheetName: '4_BieuDo_LoaiSuCo',
    supportsImage: true,
  },
  {
    id: 'incident_severity',
    group: 'CHARTS',
    badge: 'Biểu đồ 3',
    title: 'Biểu Đồ 3: Mức Độ Nghiêm Trọng (P1–P4)',
    description: 'Phân bổ sự cố CRITICAL (P1), HIGH (P2), MEDIUM (P3), LOW (P4) & tỷ lệ phần trăm',
    sheetName: '5_BieuDo_MucDo_P1P4',
    supportsImage: true,
  },
  {
    id: 'actor_breakdown',
    group: 'CHARTS',
    badge: 'Biểu đồ 4',
    title: 'Biểu Đồ 4: Hiệu Suất Theo AI / Con Người / HITL',
    description: 'So sánh AI MAPE-K với từng kỹ sư/quản trị viên phê duyệt (Tổng, OK, Lỗi, Hủy, % đạt, TB giây)',
    sheetName: '6_BieuDo_AI_Nguoi',
    supportsImage: true,
  },
  {
    id: 'error_action_matrix',
    group: 'CHARTS',
    badge: 'Biểu đồ 5',
    title: 'Biểu Đồ 5: Ma Trận Loại Lỗi × Hành Động',
    description: 'Đối chiếu chéo từng loại sự cố ghép với action nào (RESTART_POD, SCALE_REPLICAS...) & tỷ lệ đạt',
    sheetName: '7_MaTran_Loi_Action',
    supportsImage: true,
  },
  {
    id: 'failure_reasons',
    group: 'CHARTS',
    badge: 'Biểu đồ 6',
    title: 'Biểu Đồ 6: Nguyên Nhân Thất Bại & Bị Hủy',
    description: 'Phân nhóm chuẩn hóa nguyên nhân lỗi (404 K8s, Agent Offline, 403 RBAC, HITL chờ/hủy)',
    sheetName: '8_NguyenNhan_LoiHuy',
    supportsImage: true,
  },
  {
    id: 'action_history',
    group: 'TABLES',
    badge: 'Bảng 1',
    title: 'Bảng Truy Vết Lỗi, Action & Kết Quả Chi Tiết',
    description: 'Chi tiết từng Action: Lỗi gì → Ai xử lý/duyệt → Thời điểm → Thành công/Lỗi/Hủy & Lý do',
    sheetName: '9_Bang_TruyVet_Action',
    supportsImage: false,
  },
  {
    id: 'service_sla',
    group: 'TABLES',
    badge: 'Bảng 2',
    title: 'Bảng Phân Tích SLA Theo Từng Dịch Vụ',
    description: 'Phân hạng Tier, SLA mục tiêu, Uptime thực tế, MTTR trung bình & số lượng Action theo Microservice',
    sheetName: '10_Bang_SLA_DichVu',
    supportsImage: false,
  },
];

const INCIDENT_TYPE_VI_LABELS = {
  CPU_OVERLOAD: 'Quá tải CPU (CPU Overload)',
  OOM: 'Tràn RAM (OOMKilled)',
  HIGH_LATENCY: 'Độ trễ cao (High Latency)',
  HTTP_5XX_SPIKE: 'Lỗi máy chủ (HTTP 5XX)',
  DISK_FULL: 'Đầy ổ đĩa (Disk Full)',
  TRAFFIC_OVERLOAD: 'Quá tải lưu lượng (Traffic)',
};

const INCIDENT_TYPE_COLORS = {
  CPU_OVERLOAD: '#3B82F6',
  OOM: '#8B5CF6',
  HIGH_LATENCY: '#F59E0B',
  HTTP_5XX_SPIKE: '#F43F5E',
  DISK_FULL: '#0D9488',
  TRAFFIC_OVERLOAD: '#6366F1',
};

const SEVERITY_META = [
  { key: 'CRITICAL', label: 'Nghiêm Trọng (P1)', color: '#EF4444' },
  { key: 'HIGH', label: 'Mức Độ Cao (P2)', color: '#F97316' },
  { key: 'MEDIUM', label: 'Trung Bình (P3)', color: '#F59E0B' },
  { key: 'LOW', label: 'Thấp / Cảnh Báo (P4)', color: '#3B82F6' },
];

const formatDateTimeVn = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const drawRoundedRect = (ctx, x, y, w, h, r) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const createHiResCanvas = (width, height) => {
  if (typeof document === 'undefined') return null;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);

    // Nền trắng sạch + khung viền bo góc
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    drawRoundedRect(ctx, 1, 1, width - 2, height - 2, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    return { canvas, ctx, width, height };
  } catch {
    return null;
  }
};

const drawCanvasTitle = (ctx, width, title, subtitle) => {
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 22, 30);

  ctx.fillStyle = '#64748B';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(subtitle, 22, 50);

  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(22, 62);
  ctx.lineTo(width - 22, 62);
  ctx.stroke();
};

/**
 * Vẽ hình ảnh PNG sắc nét cho từng loại biểu đồ bằng Canvas 2D thuần (không lỗi CORS / tab ẩn).
 * Trả về { base64, width, height } hoặc null nếu môi trường không hỗ trợ Canvas.
 */
export const renderChartToPngBase64 = (sectionId, payload) => {
  const { reportData, actionAnalytics, meta } = payload;
  const trends = reportData?.monthlyTrends || [];
  const actionTrends = actionAnalytics?.trends || [];
  const byActor = actionAnalytics?.byActor || [];
  const matrix = actionAnalytics?.errorActionMatrix || [];
  const failureReasons = actionAnalytics?.failureReasons || [];
  const byType = reportData?.incidentBreakdown?.byType || {};
  const bySeverity = reportData?.incidentBreakdown?.bySeverity || {};

  if (sectionId === 'sla_trend') {
    const surface = createHiResCanvas(880, 360);
    if (!surface) return null;
    const { canvas, ctx, width, height } = surface;
    drawCanvasTitle(
      ctx,
      width,
      `Biểu Đồ 1A: Xu Hướng SLA Uptime & Sự Cố Tự Phục Hồi (${meta.timeRangeLabel})`,
      `${meta.orgName} — Đường Uptime (%) so với Cam kết SLA 99.90%`
    );

    const series = trends.length > 0 ? trends : [{ month: 'Hiện tại', uptime: 100, preventedIncidents: 0, mttrSeconds: 0 }];
    const pad = { top: 88, right: 64, bottom: 48, left: 60 };
    const cw = width - pad.left - pad.right;
    const ch = height - pad.top - pad.bottom;
    const baseY = pad.top + ch;
    const maxInc = Math.max(...series.map((d) => Number(d.preventedIncidents) || 0), 1);

    // Legend
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#10B981';
    ctx.fillRect(width - 330, 22, 10, 10);
    ctx.fillStyle = '#334155';
    ctx.fillText('Sự cố phục hồi (vụ)', width - 315, 31);
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(width - 175, 27);
    ctx.lineTo(width - 155, 27);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.fillText('Uptime thực tế (%)', width - 149, 31);

    // Grid & SLA target dashed line
    const targetY = pad.top + ch * 0.25;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const gy = baseY - (g / 3) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(width - pad.right, gy);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round((g / 3) * maxInc)}`, pad.left - 8, gy + 4);
    }

    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#0284C7';
    ctx.beginPath();
    ctx.moveTo(pad.left, targetY);
    ctx.lineTo(width - pad.right, targetY);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#0284C7';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SLA Mục tiêu 99.90%', pad.left + 6, targetY - 5);

    const stepX = series.length > 1 ? cw / (series.length + 0.5) : cw / 2;
    const barW = Math.min(34, Math.max(12, stepX * 0.42));
    const linePts = series.map((d, idx) => {
      const cx = series.length === 1 ? pad.left + cw / 2 : pad.left + (idx + 0.75) * stepX;
      const val = Number(d.preventedIncidents) || 0;
      const bh = (val / maxInc) * (ch * 0.6);
      const by = baseY - bh;

      if (bh > 0) {
        drawRoundedRect(ctx, cx - barW / 2, by, barW, bh, 4);
        ctx.fillStyle = '#10B981';
        ctx.fill();
        ctx.fillStyle = '#047857';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${val}`, cx, by - 5);
      }

      ctx.fillStyle = '#475569';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(d.month || ''), cx, baseY + 18);

      const up = Number(d.uptime) || 99.9;
      const ly =
        up >= 99.9
          ? targetY - Math.min(1, (up - 99.9) / 0.1) * (targetY - pad.top - 8)
          : targetY + Math.min(1, (99.9 - up) / 0.2) * (ch * 0.2);
      return { cx, ly, up };
    });

    if (linePts.length > 0) {
      ctx.strokeStyle = '#1D4ED8';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      linePts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.cx, p.ly) : ctx.lineTo(p.cx, p.ly)));
      ctx.stroke();

      linePts.forEach((p) => {
        ctx.fillStyle = '#1D4ED8';
        ctx.beginPath();
        ctx.arc(p.cx, p.ly, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#1E293B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.up.toFixed(2)}%`, p.cx, p.ly - 9);
      });
    }

    return { base64: canvas.toDataURL('image/png'), width: 760, height: Math.round((height / width) * 760) };
  }

  if (sectionId === 'action_trend') {
    const surface = createHiResCanvas(880, 360);
    if (!surface) return null;
    const { canvas, ctx, width, height } = surface;
    drawCanvasTitle(
      ctx,
      width,
      `Biểu Đồ 1B: Xu Hướng Kết Quả Action Theo Thời Gian (${meta.timeRangeLabel})`,
      'So sánh Thành công (SUCCEEDED), Thất bại (FAILED), Bị hủy/HITL (CANCELLED) & Tỷ lệ đạt (%)'
    );

    const series =
      actionTrends.length > 0
        ? actionTrends.slice(-20)
        : trends.map((t) => ({
            label: t.month,
            total: t.totalActions || 0,
            succeeded: t.succeededActions || 0,
            failed: t.failedActions || 0,
            cancelled: t.cancelledActions || 0,
            successRate: t.totalActions > 0 ? (t.succeededActions / t.totalActions) * 100 : 0,
          }));

    const pad = { top: 88, right: 64, bottom: 48, left: 60 };
    const cw = width - pad.left - pad.right;
    const ch = height - pad.top - pad.bottom;
    const baseY = pad.top + ch;
    const maxTotal = Math.max(...series.map((d) => Number(d.total) || 0), 1);

    // Legend
    const leg = [
      { color: '#10B981', text: 'Thành công' },
      { color: '#EF4444', text: 'Thất bại' },
      { color: '#F59E0B', text: 'Bị hủy / HITL' },
    ];
    let lx = width - 350;
    leg.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, 22, 10, 10);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.text, lx + 14, 31);
      lx += 95;
    });

    for (let g = 0; g <= 3; g++) {
      const gy = baseY - (g / 3) * ch;
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(width - pad.right, gy);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round((g / 3) * maxTotal)}`, pad.left - 8, gy + 4);
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round((g / 3) * 100)}%`, width - pad.right + 8, gy + 4);
    }

    const stepX = series.length > 0 ? cw / series.length : cw;
    const barW = Math.min(28, Math.max(8, stepX * 0.56));
    const linePts = [];

    series.forEach((d, idx) => {
      const cx = pad.left + (idx + 0.5) * stepX;
      const okH = ((Number(d.succeeded) || 0) / maxTotal) * (ch * 0.82);
      const failH = ((Number(d.failed) || 0) / maxTotal) * (ch * 0.82);
      const cancelH = ((Number(d.cancelled) || 0) / maxTotal) * (ch * 0.82);

      const okY = baseY - okH;
      const failY = okY - failH;
      const cancelY = failY - cancelH;

      if (okH > 0) {
        ctx.fillStyle = '#10B981';
        ctx.fillRect(cx - barW / 2, okY, barW, okH);
      }
      if (failH > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(cx - barW / 2, failY, barW, failH);
      }
      if (cancelH > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(cx - barW / 2, cancelY, barW, cancelH);
      }

      if (series.length <= 14 || idx % 2 === 0 || idx === series.length - 1) {
        ctx.fillStyle = '#475569';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(d.label || ''), cx, baseY + 18);
      }

      const rate = Math.min(100, Math.max(0, Number(d.successRate) || 0));
      const ly = baseY - (rate / 100) * (ch * 0.88);
      linePts.push({ cx, ly, rate });
    });

    if (linePts.length > 0) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#1D4ED8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      linePts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.cx, p.ly) : ctx.lineTo(p.cx, p.ly)));
      ctx.stroke();
      ctx.restore();

      linePts.forEach((p) => {
        ctx.fillStyle = '#1D4ED8';
        ctx.beginPath();
        ctx.arc(p.cx, p.ly, 3.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    return { base64: canvas.toDataURL('image/png'), width: 760, height: Math.round((height / width) * 760) };
  }

  if (sectionId === 'incident_type' || sectionId === 'incident_severity') {
    const entries =
      sectionId === 'incident_type'
        ? Object.entries(byType)
            .map(([k, v]) => ({
              key: k,
              label: INCIDENT_TYPE_VI_LABELS[k] || k,
              count: Number(v) || 0,
              color: INCIDENT_TYPE_COLORS[k] || '#64748B',
            }))
            .sort((a, b) => b.count - a.count)
        : SEVERITY_META.map((m) => ({
            key: m.key,
            label: m.label,
            count: Number(bySeverity[m.key]) || 0,
            color: m.color,
          }));

    const rowsShown = entries.slice(0, 8);
    const height = Math.max(320, 120 + rowsShown.length * 36);
    const surface = createHiResCanvas(880, height);
    if (!surface) return null;
    const { canvas, ctx, width } = surface;

    drawCanvasTitle(
      ctx,
      width,
      sectionId === 'incident_type'
        ? 'Biểu Đồ 2: Cơ Cấu Các Loại Sự Cố Hạ Tầng'
        : 'Biểu Đồ 3: Phân Bổ Sự Cố Theo Mức Độ Nghiêm Trọng (P1–P4)',
      `${meta.orgName} — Kỳ ${meta.timeRangeLabel}`
    );

    const total = entries.reduce((s, e) => s + e.count, 0);
    const cx = 155;
    const cy = Math.round(height / 2 + 20);
    const radius = 84;

    if (total === 0) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      let startAngle = -Math.PI / 2;
      entries.forEach((seg) => {
        if (seg.count <= 0) return;
        const slice = (seg.count / total) * Math.PI * 2;
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = 26;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
        ctx.stroke();
        startAngle += slice;
      });
    }

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(total.toLocaleString('vi-VN'), cx, cy + 4);
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('TỔNG SỰ CỐ', cx, cy + 22);

    // Legend rows on right
    let ry = 88;
    rowsShown.forEach((item) => {
      const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0';
      drawRoundedRect(ctx, 310, ry, 540, 28, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(328, ry + 14, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, 344, ry + 18);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${item.count.toLocaleString('vi-VN')} (${pct}%)`, 835, ry + 18);

      ry += 36;
    });

    return { base64: canvas.toDataURL('image/png'), width: 760, height: Math.round((height / width) * 760) };
  }

  if (sectionId === 'actor_breakdown') {
    const actors = byActor.slice(0, 10);
    const height = Math.max(240, 110 + actors.length * 48);
    const surface = createHiResCanvas(880, height);
    if (!surface) return null;
    const { canvas, ctx, width } = surface;
    drawCanvasTitle(
      ctx,
      width,
      'Biểu Đồ 4: Hiệu Suất Action Theo Đối Tượng Thực Thi (AI / Con Người / HITL)',
      'Thanh xếp chồng Thành công (Xanh lá), Thất bại (Đỏ), Hủy/HITL (Vàng cam)'
    );

    const maxTotal = Math.max(...actors.map((a) => Number(a.total) || 0), 1);
    let y = 84;
    actors.forEach((actor) => {
      const total = Number(actor.total) || 0;
      const ok = Number(actor.succeeded) || 0;
      const fail = Number(actor.failed) || 0;
      const cancel = Number(actor.cancelled) || 0;

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${String(actor.actorName || '').substring(0, 34)} (${actor.actorType})`, 24, y + 12);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${ok} OK | ${fail} Lỗi | ${cancel} Hủy | Tổng ${total} (${actor.successRate}% đạt, TB ${actor.avgDurationSeconds}s)`,
        width - 24,
        y + 12
      );

      const trackX = 24;
      const trackY = y + 20;
      const trackW = width - 48;
      drawRoundedRect(ctx, trackX, trackY, trackW, 14, 7);
      ctx.fillStyle = '#F1F5F9';
      ctx.fill();

      const scaledW = Math.max(12, (total / maxTotal) * trackW);
      let curX = trackX;
      if (ok > 0 && total > 0) {
        const w = (ok / total) * scaledW;
        ctx.fillStyle = '#10B981';
        ctx.fillRect(curX, trackY, w, 14);
        curX += w;
      }
      if (fail > 0 && total > 0) {
        const w = (fail / total) * scaledW;
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(curX, trackY, w, 14);
        curX += w;
      }
      if (cancel > 0 && total > 0) {
        const w = (cancel / total) * scaledW;
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(curX, trackY, w, 14);
      }

      y += 46;
    });

    return { base64: canvas.toDataURL('image/png'), width: 760, height: Math.round((height / width) * 760) };
  }

  if (sectionId === 'error_action_matrix') {
    const incTypes = Array.from(new Set(matrix.map((m) => m.incidentType))).slice(0, 7);
    const actCodes = Array.from(new Set(matrix.map((m) => m.actionCode))).slice(0, 6);
    if (incTypes.length === 0 || actCodes.length === 0) return null;

    const lookup = new Map(matrix.map((m) => [`${m.incidentType}::${m.actionCode}`, m]));
    const height = Math.max(260, 125 + incTypes.length * 46);
    const surface = createHiResCanvas(920, height);
    if (!surface) return null;
    const { canvas, ctx, width } = surface;
    drawCanvasTitle(
      ctx,
      width,
      'Biểu Đồ 5: Ma Trận Đối Chiếu Loại Sự Cố × Hành Động Khắc Phục',
      'Xanh (>=85% đạt) · Vàng (45–84% đạt) · Đỏ (<45% đạt)'
    );

    const firstColW = 165;
    const cellW = Math.floor((width - 44 - firstColW) / actCodes.length);
    const headerY = 78;

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Loại Lỗi \\ Action', 24, headerY + 18);

    actCodes.forEach((act, cIdx) => {
      const cx = 24 + firstColW + cIdx * cellW;
      drawRoundedRect(ctx, cx + 2, headerY, cellW - 4, 28, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(act.substring(0, 16), cx + cellW / 2, headerY + 18);
    });

    incTypes.forEach((inc, rIdx) => {
      const ry = headerY + 36 + rIdx * 44;
      drawRoundedRect(ctx, 22, ry, firstColW - 6, 38, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(inc.substring(0, 20), 30, ry + 23);

      actCodes.forEach((act, cIdx) => {
        const cx = 24 + firstColW + cIdx * cellW;
        const cell = lookup.get(`${inc}::${act}`);
        const rate = cell ? Number(cell.successRate) || 0 : 0;
        const bg = !cell ? '#F8FAFC' : rate >= 85 ? '#ECFDF5' : rate >= 45 ? '#FFFBEB' : '#FEF2F2';
        const border = !cell ? '#E2E8F0' : rate >= 85 ? '#A7F3D0' : rate >= 45 ? '#FDE68A' : '#FECACA';
        const txt = !cell ? '#94A3B8' : rate >= 85 ? '#065F46' : rate >= 45 ? '#92400E' : '#991B1B';

        drawRoundedRect(ctx, cx + 2, ry, cellW - 4, 38, 6);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.stroke();

        ctx.fillStyle = txt;
        ctx.textAlign = 'center';
        if (!cell) {
          ctx.font = '12px sans-serif';
          ctx.fillText('—', cx + cellW / 2, ry + 23);
        } else {
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`${cell.total} (${cell.successRate}%)`, cx + cellW / 2, ry + 16);
          ctx.font = '10px monospace';
          ctx.fillText(`${cell.succeeded}✓ ${cell.failed}✕ ${cell.cancelled}⊘`, cx + cellW / 2, ry + 31);
        }
      });
    });

    return { base64: canvas.toDataURL('image/png'), width: 760, height: Math.round((height / width) * 760) };
  }

  if (sectionId === 'failure_reasons') {
    const reasons = failureReasons.slice(0, 10);
    if (reasons.length === 0) return null;
    const height = Math.max(240, 110 + reasons.length * 46);
    const surface = createHiResCanvas(880, height);
    if (!surface) return null;
    const { canvas, ctx, width } = surface;
    drawCanvasTitle(
      ctx,
      width,
      'Biểu Đồ 6: Top Nguyên Nhân Action Thất Bại (FAILED) & Bị Hủy (CANCELLED)',
      'Tổng hợp nguyên nhân gốc đã chuẩn hóa kèm tỷ trọng %'
    );

    const maxCnt = Math.max(...reasons.map((r) => Number(r.count) || 0), 1);
    let y = 84;
    reasons.forEach((item) => {
      const isFail = item.status === 'FAILED';
      ctx.fillStyle = isFail ? '#DC2626' : '#B45309';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`[${item.status}]`, 24, y + 12);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(String(item.reasonCategory || '').substring(0, 62), 104, y + 12);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${item.count.toLocaleString('vi-VN')} lần (${item.percentOfStatus}%)`, width - 24, y + 12);

      const trackW = width - 48;
      drawRoundedRect(ctx, 24, y + 20, trackW, 10, 5);
      ctx.fillStyle = '#F1F5F9';
      ctx.fill();

      const fillW = Math.max(10, ((Number(item.count) || 0) / maxCnt) * trackW);
      drawRoundedRect(ctx, 24, y + 20, fillW, 10, 5);
      ctx.fillStyle = isFail ? '#EF4444' : '#F59E0B';
      ctx.fill();

      y += 44;
    });

    return { base64: canvas.toDataURL('image/png'), width: 760, height: Math.round((height / width) * 760) };
  }

  return null;
};

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const SUBHEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
const ZEBRA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

const addSheetHeaderBanner = (ws, title, meta) => {
  ws.addRow([title]);
  ws.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
  ws.addRow([
    `Tổ chức: ${meta.orgName} | Phạm vi: ${meta.scopeLabel} | Kỳ báo cáo: ${meta.timeRangeLabel} | Mã: ${meta.documentId}`,
  ]);
  ws.getRow(2).font = { italic: true, size: 10, color: { argb: 'FF475569' } };
  ws.addRow([`Thời điểm xuất: ${new Date().toLocaleString('vi-VN')}`]);
  ws.getRow(3).font = { size: 9.5, color: { argb: 'FF64748B' } };
  ws.addRow([]);
};

const styleTableHeaderRow = (row) => {
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
};

const styleDataRow = (row, idx, colAlignments = {}) => {
  row.eachCell((cell, colNumber) => {
    cell.border = THIN_BORDER;
    if (idx % 2 === 1) {
      cell.fill = ZEBRA_FILL;
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: colAlignments[colNumber] || 'left',
      wrapText: true,
    };
  });
};

const maybeEmbedChartImage = (workbook, ws, sectionId, payload) => {
  if (!payload.includeChartImages) return;
  const img = renderChartToPngBase64(sectionId, payload);
  if (!img || !img.base64) return;

  const imageId = workbook.addImage({
    base64: img.base64,
    extension: 'png',
  });

  const startRowIdx = ws.rowCount; // 0-based row after banner
  ws.addImage(imageId, {
    tl: { col: 0, row: startRowIdx },
    ext: { width: img.width, height: img.height },
  });

  // Chèn các dòng trống tương ứng chiều cao ảnh để bảng số liệu nằm ngay bên dưới
  const spacerRows = Math.ceil(img.height / 20) + 1;
  for (let i = 0; i < spacerRows; i++) {
    ws.addRow([]);
  }
};

/**
 * Tạo Workbook Excel (.xlsx) từ danh sách các biểu đồ / bảng đã chọn và tải xuống trình duyệt.
 * Trả về { success, fileName, sheetNames, workbook } để hỗ trợ kiểm thử và phản hồi UI.
 */
export const exportReportsToExcel = async ({
  selectedSections = [],
  reportData = null,
  actionAnalytics = null,
  actionRows = [],
  services = [],
  meta = {},
  includeChartImages = true,
  fileName = 'bao-cao-sla-bieu-do.xlsx',
  download = true,
} = {}) => {
  const orderedIds = REPORT_EXCEL_SECTIONS.map((s) => s.id).filter((id) =>
    selectedSections.includes(id)
  );
  if (orderedIds.length === 0) {
    throw new Error('Vui lòng chọn ít nhất một biểu đồ hoặc bảng dữ liệu để xuất Excel.');
  }

  const mod = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS =
    mod?.Workbook ? mod : mod?.default?.Workbook ? mod.default : typeof window !== 'undefined' && window.ExcelJS ? window.ExcelJS : mod;
  const WorkbookCtor = ExcelJS?.Workbook;
  if (!WorkbookCtor) {
    throw new Error('Không khởi tạo được thư viện ExcelJS Workbook.');
  }

  const workbook = new WorkbookCtor();
  workbook.creator = 'CapTone AIOps Self-Healing Platform';
  workbook.created = new Date();

  const normalizedMeta = {
    orgName: meta.orgName || 'SME Retail Enterprise',
    scopeLabel: meta.scopeLabel || 'Toàn doanh nghiệp',
    timeRangeLabel: meta.timeRangeLabel || '30 Ngày gần nhất',
    documentId: meta.documentId || 'SLA-RPT',
  };

  const payload = { reportData, actionAnalytics, meta: normalizedMeta, includeChartImages };
  const summary = reportData?.summary || {};
  const actionSummary = actionAnalytics?.summary || {};
  const sheetNames = [];

  for (const sectionId of orderedIds) {
    const def = REPORT_EXCEL_SECTIONS.find((s) => s.id === sectionId);
    const ws = workbook.addWorksheet(def.sheetName);
    sheetNames.push(def.sheetName);
    addSheetHeaderBanner(ws, def.title, normalizedMeta);

    if (sectionId === 'kpi_summary') {
      const hRow = ws.addRow(['Nhóm Chỉ Số', 'Tên Chỉ Số', 'Giá Trị Thực Tế', 'Ghi Chú / Đối Chiếu']);
      styleTableHeaderRow(hRow);

      const kpiRows = [
        ['SLA & Uptime', 'Độ sẵn sàng thực tế (Uptime)', summary.actualUptime || '100.00%', `Mục tiêu cam kết SLA ${summary.targetSla || '99.90%'}`],
        ['SLA & Uptime', 'Tổng giờ vận hành kỳ báo cáo', summary.totalOperatingHours ?? 0, normalizedMeta.timeRangeLabel],
        ['Phục Hồi (MTTR)', 'Tốc độ phục hồi trung bình (MTTR)', `${summary.mttrAvgSeconds ?? 0} giây`, `Thực thi K8s TB ${actionSummary.avgExecutionSeconds ?? 0}s (Trung vị ${actionSummary.medianExecutionSeconds ?? 0}s)`],
        ['Phục Hồi (MTTR)', 'Tỷ lệ xác minh sau phục hồi đạt', `${actionSummary.verifiedSuccessRate ?? 0}%`, `${actionSummary.verifiedCount ?? 0} lượt probe kiểm chứng`],
        ['Tổng Hợp Action', 'Tổng số Action ghi nhận', actionSummary.totalActions ?? 0, `${actionSummary.succeededActions ?? 0} OK / ${actionSummary.failedActions ?? 0} Lỗi / ${actionSummary.cancelledActions ?? 0} Hủy`],
        ['Tổng Hợp Action', 'Tổng sự cố phát hiện / Đã xử lý', `${summary.totalIncidentsResolved ?? 0} / ${actionSummary.totalIncidents ?? 0}`, `${actionSummary.incidentsWithAction ?? 0} sự cố có kích hoạt Action`],
        ['Hiệu Suất AI/Người', 'Tỷ lệ Action thành công chung', `${actionSummary.successRate ?? 0}%`, `Tỷ trọng tự trị trên action thành công: ${summary.autonomousHealingRate || '0.0%'}`],
        ['Hiệu Suất AI/Người', 'Action AI Tự Động (AUTO)', `${actionSummary.autoSucceeded ?? 0} / ${actionSummary.autoActionsTotal ?? 0}`, 'Thực thi bởi AI MAPE-K'],
        ['Hiệu Suất AI/Người', 'Action Con Người / Cổng HITL (MANUAL)', `${actionSummary.manualSucceeded ?? 0} / ${actionSummary.manualActionsTotal ?? 0}`, 'Thực thi hoặc phê duyệt thủ công qua HITL'],
      ];
      kpiRows.forEach((r, idx) => {
        const row = ws.addRow(r);
        styleDataRow(row, idx, { 3: 'right' });
      });
      ws.columns = [{ width: 22 }, { width: 38 }, { width: 24 }, { width: 48 }];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'sla_trend') {
      maybeEmbedChartImage(workbook, ws, sectionId, payload);
      const hRow = ws.addRow([
        'Mốc Thời Gian',
        'Uptime Thực Tế (%)',
        'SLA Mục Tiêu (%)',
        'Sự Cố Tự Phục Hồi (vụ)',
        'Downtime Tránh Được (giờ)',
        'MTTR Trung Bình (giây)',
        'Tỷ Lệ Tự Trị (%)',
      ]);
      styleTableHeaderRow(hRow);
      const rows = reportData?.monthlyTrends || [];
      rows.forEach((d, idx) => {
        const row = ws.addRow([
          d.month,
          Number(d.uptime) || 0,
          Number(d.slaTarget) || 99.9,
          Number(d.preventedIncidents) || 0,
          Number(d.downtimeAvoidedHours) || 0,
          Number(d.mttrSeconds) || 0,
          Number(d.autonomousHealingRate) || 0,
        ]);
        styleDataRow(row, idx, { 2: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right', 7: 'right' });
      });
      ws.columns = [
        { width: 18 },
        { width: 20 },
        { width: 18 },
        { width: 24 },
        { width: 26 },
        { width: 24 },
        { width: 20 },
      ];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'action_trend') {
      maybeEmbedChartImage(workbook, ws, sectionId, payload);
      const hRow = ws.addRow([
        'Mốc Thời Gian',
        'Tổng Action',
        'Thành Công (SUCCEEDED)',
        'Thất Bại (FAILED)',
        'Bị Hủy / HITL (CANCELLED)',
        'Đang Chờ (PENDING)',
        'Tỷ Lệ Đạt (%)',
        'AI Tự Động (AUTO)',
        'Thủ Công / HITL (MANUAL)',
        'Thời Lượng TB (giây)',
      ]);
      styleTableHeaderRow(hRow);
      const rows = actionAnalytics?.trends || [];
      rows.forEach((t, idx) => {
        const row = ws.addRow([
          t.label,
          Number(t.total) || 0,
          Number(t.succeeded) || 0,
          Number(t.failed) || 0,
          Number(t.cancelled) || 0,
          Number(t.pending) || 0,
          Number(t.successRate) || 0,
          Number(t.autoCount) || 0,
          Number(t.manualCount) || 0,
          Number(t.avgDurationSeconds) || 0,
        ]);
        styleDataRow(row, idx, {
          2: 'right',
          3: 'right',
          4: 'right',
          5: 'right',
          6: 'right',
          7: 'right',
          8: 'right',
          9: 'right',
          10: 'right',
        });
      });
      ws.columns = [
        { width: 18 },
        { width: 14 },
        { width: 22 },
        { width: 18 },
        { width: 24 },
        { width: 18 },
        { width: 15 },
        { width: 18 },
        { width: 22 },
        { width: 20 },
      ];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'incident_type') {
      maybeEmbedChartImage(workbook, ws, sectionId, payload);
      const hRow = ws.addRow(['Mã Loại Sự Cố', 'Mô Tả Tiếng Việt', 'Số Lượng Sự Cố', 'Tỷ Trọng (%)']);
      styleTableHeaderRow(hRow);
      const byType = reportData?.incidentBreakdown?.byType || {};
      const entries = Object.entries(byType).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
      const total = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
      entries.forEach(([key, rawVal], idx) => {
        const count = Number(rawVal) || 0;
        const pct = total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0;
        const row = ws.addRow([key, INCIDENT_TYPE_VI_LABELS[key] || key, count, pct]);
        styleDataRow(row, idx, { 3: 'right', 4: 'right' });
      });
      const sumRow = ws.addRow(['TỔNG CỘNG', 'Toàn bộ sự cố trong kỳ', total, 100]);
      sumRow.font = { bold: true };
      sumRow.eachCell((c) => {
        c.fill = SUBHEADER_FILL;
        c.border = THIN_BORDER;
      });
      ws.columns = [{ width: 26 }, { width: 38 }, { width: 20 }, { width: 16 }];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'incident_severity') {
      maybeEmbedChartImage(workbook, ws, sectionId, payload);
      const hRow = ws.addRow(['Mã Mức Độ', 'Phân Cấp SLA', 'Số Lượng Sự Cố', 'Tỷ Trọng (%)']);
      styleTableHeaderRow(hRow);
      const bySeverity = reportData?.incidentBreakdown?.bySeverity || {};
      const total = SEVERITY_META.reduce((s, m) => s + (Number(bySeverity[m.key]) || 0), 0);
      SEVERITY_META.forEach((m, idx) => {
        const count = Number(bySeverity[m.key]) || 0;
        const pct = total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0;
        const row = ws.addRow([m.key, m.label, count, pct]);
        styleDataRow(row, idx, { 3: 'right', 4: 'right' });
      });
      const sumRow = ws.addRow(['TỔNG CỘNG', 'Tất cả mức độ', total, 100]);
      sumRow.font = { bold: true };
      sumRow.eachCell((c) => {
        c.fill = SUBHEADER_FILL;
        c.border = THIN_BORDER;
      });
      ws.columns = [{ width: 18 }, { width: 30 }, { width: 20 }, { width: 16 }];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'actor_breakdown') {
      maybeEmbedChartImage(workbook, ws, sectionId, payload);
      const hRow = ws.addRow([
        'Tên Đối Tượng (AI / Người)',
        'Phân Loại',
        'Chế Độ Thực Thi',
        'Tổng Action',
        'Thành Công (SUCCEEDED)',
        'Thất Bại (FAILED)',
        'Bị Hủy / HITL (CANCELLED)',
        'Tỷ Lệ Đạt (%)',
        'Thời Lượng TB (giây)',
      ]);
      styleTableHeaderRow(hRow);
      const actors = actionAnalytics?.byActor || [];
      actors.forEach((a, idx) => {
        const typeLabel =
          a.actorType === 'AI' ? 'AI Tự Trị' : a.actorType === 'HUMAN' ? 'Con Người' : 'Hàng chờ HITL';
        const row = ws.addRow([
          a.actorName,
          typeLabel,
          a.executionMode,
          Number(a.total) || 0,
          Number(a.succeeded) || 0,
          Number(a.failed) || 0,
          Number(a.cancelled) || 0,
          Number(a.successRate) || 0,
          Number(a.avgDurationSeconds) || 0,
        ]);
        styleDataRow(row, idx, { 4: 'right', 5: 'right', 6: 'right', 7: 'right', 8: 'right', 9: 'right' });
      });
      ws.columns = [
        { width: 32 },
        { width: 18 },
        { width: 18 },
        { width: 14 },
        { width: 22 },
        { width: 18 },
        { width: 24 },
        { width: 16 },
        { width: 20 },
      ];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'error_action_matrix') {
      maybeEmbedChartImage(workbook, ws, sectionId, payload);
      const hRow = ws.addRow([
        'Loại Sự Cố (Incident Type)',
        'Mã Hành Động (Action Code)',
        'Tên Hành Động',
        'Tổng Số Lần',
        'Thành Công',
        'Thất Bại',
        'Bị Hủy / HITL',
        'Đang Chờ',
        'Tỷ Lệ Đạt (%)',
      ]);
      styleTableHeaderRow(hRow);
      const matrix = actionAnalytics?.errorActionMatrix || [];
      matrix.forEach((m, idx) => {
        const row = ws.addRow([
          m.incidentType,
          m.actionCode,
          m.actionName,
          Number(m.total) || 0,
          Number(m.succeeded) || 0,
          Number(m.failed) || 0,
          Number(m.cancelled) || 0,
          Number(m.pending) || 0,
          Number(m.successRate) || 0,
        ]);
        styleDataRow(row, idx, { 4: 'right', 5: 'right', 6: 'right', 7: 'right', 8: 'right', 9: 'right' });
      });
      ws.columns = [
        { width: 24 },
        { width: 26 },
        { width: 28 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 18 },
        { width: 12 },
        { width: 16 },
      ];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'failure_reasons') {
      maybeEmbedChartImage(workbook, ws, sectionId, payload);
      const hRow = ws.addRow([
        'Trạng Thái',
        'Nhóm Nguyên Nhân Chuẩn Hóa',
        'Số Lần Xảy Ra',
        'Tỷ Trọng Trong Trạng Thái (%)',
        'Mẫu Thông Điệp Chi Tiết',
      ]);
      styleTableHeaderRow(hRow);
      const reasons = actionAnalytics?.failureReasons || [];
      reasons.forEach((r, idx) => {
        const row = ws.addRow([
          r.status,
          r.reasonCategory,
          Number(r.count) || 0,
          Number(r.percentOfStatus) || 0,
          r.sampleRawReason || '',
        ]);
        styleDataRow(row, idx, { 1: 'center', 3: 'right', 4: 'right' });
        const stCell = row.getCell(1);
        stCell.font = { bold: true, color: { argb: r.status === 'FAILED' ? 'FFB91C1C' : 'FFB45309' } };
      });
      ws.columns = [{ width: 16 }, { width: 42 }, { width: 18 }, { width: 28 }, { width: 64 }];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'action_history') {
      const hRow = ws.addRow([
        'Mã Action',
        'Thời Điểm Thực Thi',
        'Dịch Vụ / Target',
        'Loại Sự Cố',
        'Mức Độ',
        'Tiêu Đề Sự Cố',
        'Mã Hành Động',
        'Chế Độ',
        'AI / Người Thực Hiện',
        'Người Duyệt HITL',
        'Kết Quả',
        'Thời Lượng (giây)',
        'Xác Minh Sau Phục Hồi',
        'Nhóm Nguyên Nhân',
        'Chi Tiết Kết Quả / Nguyên Nhân Lỗi',
      ]);
      styleTableHeaderRow(hRow);
      (actionRows || []).forEach((item, idx) => {
        const detailText =
          item.failureReason ||
          item.resultSummary ||
          (item.executionStatus === 'SUCCEEDED' ? 'Thành công' : '—');
        const verifyText =
          item.verificationResult === null || item.verificationResult === undefined
            ? '—'
            : item.verificationResult
              ? 'Đạt (Ổn định)'
              : 'Không đạt';
        const row = ws.addRow([
          item.shortId || '',
          formatDateTimeVn(item.startedAt || item.createdAt),
          item.targetName || '',
          item.incidentType || '',
          item.severity || '',
          item.incidentTitle || '',
          item.actionCode || '',
          item.executionMode || '',
          item.actorName || '',
          item.approverName || '—',
          item.executionStatus || '',
          item.durationSeconds ?? '—',
          verifyText,
          item.reasonCategory || (item.executionStatus === 'SUCCEEDED' ? 'Thành công' : '—'),
          detailText,
        ]);
        styleDataRow(row, idx, { 11: 'center', 12: 'right', 13: 'center' });
        const stCell = row.getCell(11);
        stCell.font = {
          bold: true,
          color: {
            argb:
              item.executionStatus === 'SUCCEEDED'
                ? 'FF047857'
                : item.executionStatus === 'FAILED'
                  ? 'FFB91C1C'
                  : 'FFB45309',
          },
        };
      });
      ws.autoFilter = {
        from: { row: hRow.number, column: 1 },
        to: { row: Math.max(hRow.number, ws.rowCount), column: 15 },
      };
      ws.columns = [
        { width: 14 },
        { width: 22 },
        { width: 24 },
        { width: 20 },
        { width: 12 },
        { width: 34 },
        { width: 22 },
        { width: 12 },
        { width: 26 },
        { width: 22 },
        { width: 15 },
        { width: 18 },
        { width: 20 },
        { width: 34 },
        { width: 52 },
      ];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    } else if (sectionId === 'service_sla') {
      const hRow = ws.addRow([
        'Tên Dịch Vụ',
        'Phân Hạng Tier',
        'SLA Mục Tiêu',
        'Uptime Thực Tế',
        'Thực Thi TB (MTTR)',
        'Tổng Action',
        'Action Thành Công',
        'Action Lỗi',
        'Action Bị Hủy',
        'Trạng Thái Tuân Thủ',
      ]);
      styleTableHeaderRow(hRow);
      (services || []).forEach((svc, idx) => {
        const row = ws.addRow([
          svc.name,
          svc.tier,
          svc.targetSla,
          svc.actualUptime,
          svc.mttrAvg,
          svc.actionsTotal ?? svc.incidentsResolved ?? 0,
          svc.incidentsResolved ?? 0,
          svc.actionsFailed ?? 0,
          svc.actionsCancelled ?? 0,
          svc.status,
        ]);
        styleDataRow(row, idx, { 3: 'center', 4: 'center', 5: 'right', 6: 'right', 7: 'right', 8: 'right', 9: 'right' });
      });
      ws.columns = [
        { width: 28 },
        { width: 26 },
        { width: 16 },
        { width: 16 },
        { width: 20 },
        { width: 14 },
        { width: 18 },
        { width: 14 },
        { width: 16 },
        { width: 24 },
      ];
      ws.views = [{ state: 'frozen', ySplit: hRow.number }];
    }
  }

  const finalName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  if (download && typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', finalName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return {
    success: true,
    fileName: finalName,
    sheetNames,
    workbook,
  };
};
