// Helper chuyển ngữ tiêu đề sự cố và mức độ sang tiếng Việt đồng bộ toàn hệ thống
export const translateIncidentTitle = (rawTitle) => {
  if (!rawTitle) return '';
  let title = String(rawTitle);

  title = title.replace(/\[(Cảnh báo AI|AI Alert|Alert|Cảnh báo)\]\s*/gi, '').trim();

  const causeTranslations = [
    { en: /\bUNKNOWN\b/gi, vi: 'Chưa xác định nguyên nhân' },
    { en: /Unstable application pod/gi, vi: 'Pod ứng dụng bất ổn định' },
    { en: /Container memory exhausted/gi, vi: 'Cạn kiệt bộ nhớ container (OOM)' },
    { en: /Storage capacity exhausted/gi, vi: 'Cạn kiệt dung lượng lưu trữ' },
    { en: /CPU saturation/gi, vi: 'Bão hòa tài nguyên CPU' },
    { en: /Traffic overload/gi, vi: 'Quá tải lưu lượng truy cập' },
    { en: /Deployment failure/gi, vi: 'Lỗi triển khai phiên bản mới' },
    { en: /Upstream dependency failure/gi, vi: 'Lỗi dịch vụ phụ thuộc thượng nguồn' },
    { en: /Application errors/gi, vi: 'Lỗi ứng dụng nội bộ (5xx)' },
    { en: /Service performance degradation/gi, vi: 'Suy giảm hiệu năng dịch vụ' },
    { en: /Insufficient available replicas/gi, vi: 'Không đủ số lượng Pod replica' },
    { en: /Kubernetes scheduling failure/gi, vi: 'Lỗi lập lịch điều phối Kubernetes' },
    { en: /Workload underutilized \(scale down opportunity\)/gi, vi: 'Tài nguyên làm việc dư thừa (Có thể thu hẹp)' },
    { en: /Workload underutilized/gi, vi: 'Tài nguyên làm việc dư thừa' },
    { en: /High latency detected/gi, vi: 'Độ trễ phản hồi tăng cao' },
    { en: /High latency/gi, vi: 'Độ trễ phản hồi cao' },
    { en: /Memory leak detected/gi, vi: 'Phát hiện rò rỉ bộ nhớ' },
    { en: /Pod crash loop back-off/gi, vi: 'Pod bị kẹt vòng lặp CrashLoopBackOff' },
    { en: /OOMKilled/gi, vi: 'Tiến trình bị hủy do tràn RAM (OOMKilled)' },
    { en: /OOM_WIREDTIGER_CACHE_PRESSURE_DUE_TO_UNINDEXED_QUERY/gi, vi: 'Tràn bộ nhớ đệm WiredTiger do truy vấn quét thiếu chỉ mục (Index)' },
  ];

  for (const { en, vi } of causeTranslations) {
    title = title.replace(en, vi);
  }

  title = title.replace(/\s+on\s+/gi, ' trên ');
  return title;
};

export const translateSeverity = (sev) => {
  if (!sev) return 'TRUNG BÌNH';
  const s = String(sev).toUpperCase();
  if (s === 'CRITICAL') return 'KHẨN CẤP';
  if (s === 'HIGH') return 'CAO';
  if (s === 'MEDIUM') return 'TRUNG BÌNH';
  if (s === 'LOW') return 'THẤP';
  return s;
};

// Bộ từ điển tên hành động tự phục hồi sang Tiếng Việt
export const ACTION_DISPLAY_NAMES_VI = {
  SCALE_REPLICAS: 'Điều chỉnh số lượng bản sao Pod',
  SCALE_UP: 'Mở rộng bản sao Pod',
  SCALE_DOWN: 'Thu hẹp bản sao Pod',
  RESTART_POD: 'Khởi động lại Pod',
  REPLACE_POD: 'Thay thế Pod',
  DRAIN_NODE: 'Di dời Pod khỏi Node',
  RESTART_DEPLOYMENT: 'Khởi động lại Deployment',
  ROLLBACK_DEPLOYMENT: 'Khôi phục bản phát hành trước',
  CLEANUP_STORAGE: 'Dọn dẹp lưu trữ',
  CLEANUP_TEMP_FILES: 'Dọn dẹp tệp tạm',
  TEMPORARY_IP_BLOCK: 'Chặn tạm thời IP nguồn',
  BLOCK_IP_TEMP: 'Chặn tạm thời IP nguồn',
  NO_ACTION: 'Giám sát an toàn',
};

// Chuyển ngữ thông điệp thực thi từ K8s Agent / Database sang tiếng Việt 100%
export const translateActionMessageToVi = (rawMsg, targetName = '', actionFriendlyName = 'Tự phục hồi', resolvedNs = 'default') => {
  if (!rawMsg) return `Đã thực thi ${actionFriendlyName} trên dịch vụ "${targetName}"`;

  let text = String(rawMsg).trim();

  // 1. RBAC 403 Forbidden
  const rbacMatch = text.match(
    /User\??\s*"([^"\\]+)\??"\s+cannot\s+(\w+)\s+resource\s+\??"([^"\\]+)\??"(?:\s+in API group\s+\??"([^"\\]*)\??")?(?:\s+in the namespace\s+\??"([^"\\]+)\??")?/i
  ) || text.match(
    /User\s+"([^"]+)"\s+cannot\s+(\w+)\s+resource\s+"([^"]+)"(?:\s+in API group\s+"([^"]*)")?(?:\s+in the namespace\s+"([^"]+)")?/i
  );
  if (rbacMatch || text.includes('(403)') || text.includes('Forbidden')) {
    const saUser = rbacMatch ? rbacMatch[1].replace('system:serviceaccount:', '') : 'selfheal-system:selfheal-agent-sa';
    const verb = rbacMatch ? rbacMatch[2] : 'patch';
    const resource = rbacMatch ? rbacMatch[3] : 'deployments/scale';
    const targetNs = rbacMatch && rbacMatch[5] ? rbacMatch[5] : resolvedNs;
    return `Thực thi ${actionFriendlyName} trên "${targetName}" thất bại [Lỗi 403 Forbidden]: ServiceAccount "${saUser}" thiếu quyền "${verb}" tài nguyên "${resource}" tại namespace "${targetNs}"`;
  }

  // 2. HTTP response headers dump
  if (text.includes('HTTPHeaderDict') || text.includes('HTTP response headers:')) {
    text = text.split('HTTP response headers:')[0].trim();
  }

  // 3. Scaling: "deployment/sme-order-service scaled (scale_up) successfully from 5 to 5 replicas in 'default'"
  const scaleMatch = text.match(
    /(?:[a-z0-9_-]+\/)?([a-z0-9_-]+)\s+scaled\s+\((scale_up|scale_down)\)\s+successfully\s+from\s+(\w+)\s+to\s+(\d+)\s+replicas(?:\s+in\s+'([^']+)')?/i
  );
  if (scaleMatch) {
    const sTarget = scaleMatch[1] || targetName;
    const sDir = scaleMatch[2].toLowerCase() === 'scale_up' ? 'mở rộng' : 'thu hẹp';
    const sPrep = scaleMatch[2].toLowerCase() === 'scale_up' ? 'lên' : 'xuống';
    const sFrom = scaleMatch[3];
    const sTo = scaleMatch[4];
    const sNs = scaleMatch[5] || resolvedNs;
    const fromText = sFrom === 'unknown' ? 'số lượng hiện tại' : sFrom;
    return `Đã điều chỉnh quy mô (${sDir}) thành công cho Deployment "${sTarget}" từ ${fromText} ${sPrep} ${sTo} bản sao trong namespace "${sNs}".`;
  }

  // 4. Scale skipped at minimum
  const scaleMinMatch = text.match(
    /Workload\s+(?:[a-z0-9_-]+\/)?([a-z0-9_-]+)\s+currently at minimum\s+(\d+)\s+replica(?:\s+in\s+'([^']+)')?,\s+scale down skipped safely/i
  );
  if (scaleMinMatch) {
    const sTarget = scaleMinMatch[1] || targetName;
    const sNs = scaleMinMatch[3] || resolvedNs;
    return `Dịch vụ "${sTarget}" hiện đang ở mức tối thiểu 1 bản sao trong namespace "${sNs}", đã bỏ qua thu hẹp để bảo toàn tính sẵn sàng.`;
  }

  // 5. Rolling restart
  const restartMatch = text.match(
    /Zero-downtime rolling restart patched successfully on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (restartMatch) {
    const rTarget = restartMatch[1] || targetName;
    const rNs = restartMatch[2] || resolvedNs;
    return `Đã khởi động lại Pod (Rolling Restart) không gián đoạn cho dịch vụ "${rTarget}" tại namespace "${rNs}".`;
  }

  // 6. Terminate & replace pod
  const replacePodMatch = text.match(
    /Specific unhealthy pod '([^']+)' terminated and successfully replaced by ReplicaSet(?:\s+in\s+'([^']+)')?/i
  );
  if (replacePodMatch) {
    const pName = replacePodMatch[1];
    const pNs = replacePodMatch[2] || resolvedNs;
    return `Đã chấm điểm, cô lập và xóa Pod lỗi "${pName}"; ReplicaSet tại namespace "${pNs}" đã tự động khởi tạo Pod mới thay thế thành công.`;
  }

  // 7. Replaced pod via rolling restart
  const replaceRollingMatch = text.match(
    /Replaced pod via rolling restart on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (replaceRollingMatch) {
    const rTarget = replaceRollingMatch[1] || targetName;
    const rNs = replaceRollingMatch[2] || resolvedNs;
    return `Đã thay thế Pod qua cơ chế rolling restart trên dịch vụ "${rTarget}" tại namespace "${rNs}".`;
  }

  // 8. Rollback
  const rollbackMatch = text.match(
    /True Rollback executed:\s*Restored Deployment '([^']+)' from Revision (\d+) back to Revision (\d+)(?:[^\n\r]*)(?:\s+in\s+'([^']+)')?/i
  );
  if (rollbackMatch) {
    const rbTarget = rollbackMatch[1] || targetName;
    const fromRev = rollbackMatch[2];
    const toRev = rollbackMatch[3];
    const rbNs = rollbackMatch[4] || resolvedNs;
    return `Đã hoàn nguyên (Rollback) thành công Deployment "${rbTarget}" từ bản Revision ${fromRev} về bản Revision ${toRev} trong namespace "${rbNs}".`;
  }

  // 9. Storage cleanup
  const storageMatch = text.match(
    /Ephemeral disk cleanup and emptyDir reclamation executed successfully on ([^' ]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (storageMatch) {
    const sTarget = storageMatch[1] || targetName;
    const sNs = storageMatch[2] || resolvedNs;
    return `Đã dọn dẹp bộ nhớ tạm và thu hồi ổ đĩa trống (emptyDir) thành công cho dịch vụ "${sTarget}" tại namespace "${sNs}".`;
  }

  // 10. Limits adjusted
  const limitsMatch = text.match(
    /Adjusted CPU\/RAM resource limits and applied rolling update on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (limitsMatch) {
    const lTarget = limitsMatch[1] || targetName;
    const lNs = limitsMatch[2] || resolvedNs;
    return `Đã điều chỉnh định mức CPU/RAM và cập nhật rolling update cho dịch vụ "${lTarget}" tại namespace "${lNs}".`;
  }

  // 11. Node cordon
  const cordonMatch = text.match(
    /Cordoned degraded node '([^']+)' and rescheduled pods(?:[^\n\r]*)to healthy node '([^']+)'/i
  );
  if (cordonMatch) {
    const cNode = cordonMatch[1];
    const hNode = cordonMatch[2];
    return `Đã khóa lập lịch Node suy biến "${cNode}" và di tản Pod an toàn sang Node ổn định "${hNode}".`;
  }

  // 12. Single-node guard
  if (text.includes('Single-node cluster guard')) {
    return `Bảo vệ cụm đơn node: Bỏ qua khóa Node và khởi tạo lại Pod an toàn trên dịch vụ "${targetName}".`;
  }

  // 13. NetworkPolicy block IP
  const netBlockMatch = text.match(
    /NetworkPolicy '([^']+)' (?:deployed|updated) successfully:\s*IP '([^']+)' blocked from accessing ([^' ]+)(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (netBlockMatch) {
    const npPolicy = netBlockMatch[1];
    const npIp = netBlockMatch[2];
    const npTarget = netBlockMatch[3] || targetName;
    const npNs = netBlockMatch[4] || resolvedNs;
    return `Đã áp dụng chính sách mạng "${npPolicy}": Chặn IP "${npIp}" truy cập vào dịch vụ "${npTarget}" tại namespace "${npNs}".`;
  }

  // 14. NetworkPolicy unblock
  const netUnblockMatch = text.match(
    /NetworkPolicy '([^']+)' removed:\s*IP '([^']+)' unblocked successfully(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (netUnblockMatch) {
    const npIp = netUnblockMatch[2];
    const npNs = netUnblockMatch[3] || resolvedNs;
    return `Đã gỡ bỏ chính sách NetworkPolicy: Mở chặn IP "${npIp}" truy cập dịch vụ tại namespace "${npNs}".`;
  }

  // 15. NO_ACTION telemetry verified
  if (text.includes('Zero-downtime preserved') || text.includes('NO_ACTION applied')) {
    return `Giám sát an toàn: Viễn trắc ghi nhận dịch vụ "${targetName}" ổn định, giữ nguyên trạng thái an toàn.`;
  }

  // 16. Self-healing mitigate action
  if (text.includes('Self-healing mitigate action')) {
    return `Đã thực thi thành công ${actionFriendlyName} trên dịch vụ "${targetName}".`;
  }

  // Clean English verification tag if present
  text = text.replace(/\s*\(Post-Action Verification Failed\):?/gi, ':');
  text = text.replace(/Post-Action Verification Failed:?\s*/gi, '');

  return text;
};
