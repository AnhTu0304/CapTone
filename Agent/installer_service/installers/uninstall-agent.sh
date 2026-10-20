#!/usr/bin/env bash
# ==============================================================================
# SelfHeal Agent Uninstaller for Linux/macOS
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

AGENT_NAMESPACE="selfheal-system"
RELEASE_NAME="selfheal-agent"

echo -e "${YELLOW}${BOLD}"
echo "=============================================================================="
echo "          GỠ CÀI ĐẶT CAPTONE KUBERNETES AGENT                                 "
echo "=============================================================================="
echo -e "${NC}"

CURRENT_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
echo -e "  Kubernetes Context: ${CYAN}${BOLD}${CURRENT_CONTEXT}${NC}"
echo -e "  Namespace:          ${CYAN}${BOLD}${AGENT_NAMESPACE}${NC}"
echo -e "  Helm Release:       ${CYAN}${BOLD}${RELEASE_NAME}${NC}"
echo ""

echo -e "${RED}[LƯU Ý] Quá trình này sẽ xóa Agent khỏi cụm Kubernetes.${NC}"
echo -e "${YELLOW}Workload ứng dụng của công ty và dữ liệu trên SelfHeal Backend sẽ KHÔNG bị ảnh hưởng.${NC}"
echo ""

read -r -p "Bạn có chắc chắn muốn gỡ cài đặt SelfHeal Agent? (y/N): " CONFIRM
if [[ ! "${CONFIRM}" =~ ^[yY](es)?$ ]]; then
  echo -e "${YELLOW}[CANCEL] Hủy bỏ thao tác gỡ cài đặt.${NC}"
  exit 0
fi

echo -e "  Đang gỡ bỏ Helm release '${RELEASE_NAME}'..."
helm uninstall "${RELEASE_NAME}" --namespace "${AGENT_NAMESPACE}" 2>/dev/null || true

echo -e "  Đang xóa Secret lưu token..."
kubectl delete secret selfheal-agent-secret --namespace "${AGENT_NAMESPACE}" 2>/dev/null || true

echo -e "  Đang dọn dẹp Namespace '${AGENT_NAMESPACE}'..."
kubectl delete namespace "${AGENT_NAMESPACE}" 2>/dev/null || true

echo ""
echo -e "${GREEN}[THÀNH CÔNG] Đã gỡ bỏ hoàn toàn SelfHeal Agent khỏi cụm máy chủ!${NC}"
echo -e "${YELLOW}[THÔNG BÁO] Lưu ý: Việc gỡ Agent khỏi Kubernetes không tự động thu hồi Token tại Backend. Nếu cần hủy quyền truy cập vĩnh viễn, hãy liên hệ Quản trị viên SelfHeal để Revoke token.${NC}"
echo ""
