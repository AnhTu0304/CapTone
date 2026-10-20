# ==============================================================================
# SelfHeal Agent Uninstaller for Windows PowerShell
# ==============================================================================

[CmdletBinding()]
param (
    [string]$Namespace = "selfheal-system",
    [string]$ReleaseName = "selfheal-agent",
    [switch]$Force
)

Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "          GO CAI DAT CAPTONE KUBERNETES AGENT                                 " -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host ""

$currentContext = (kubectl config current-context 2>$null)
Write-Host "  Kubernetes Context : $currentContext" -ForegroundColor Cyan
Write-Host "  Namespace          : $Namespace" -ForegroundColor Cyan
Write-Host "  Helm Release       : $ReleaseName" -ForegroundColor Cyan
Write-Host ""

Write-Host "[LUU Y] Qua trinh nay se go bo Agent khoi cum Kubernetes." -ForegroundColor Red
Write-Host "Workload ung dung cua cong ty va du lieu tren SelfHeal se KHONG bi anh huong." -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Ban co chac chan muon go cai dat SelfHeal Agent? (y/N)"
    if ($confirm -notmatch "^[yY](es)?$") {
        Write-Host "[CANCEL] Da huy bo thao tac go cai dat." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "  Dang go bo Helm release '$ReleaseName'..." -ForegroundColor Gray
helm uninstall $ReleaseName --namespace $Namespace 2>$null | Out-Null

Write-Host "  Dang xoa Secret luu token..." -ForegroundColor Gray
kubectl delete secret selfheal-agent-secret --namespace $Namespace 2>$null | Out-Null

Write-Host "  Dang don dep Namespace '$Namespace'..." -ForegroundColor Gray
kubectl delete namespace $Namespace 2>$null | Out-Null

Write-Host ""
Write-Host "[THANH CONG] Da go bo hoan toan SelfHeal Agent khoi cum may chu!" -ForegroundColor Green
Write-Host "[THONG BAO] Luu y: Viec go Agent khoi Kubernetes khong tu dong thu hoi Token o Backend. Neu can huy quyen vinh vien, hay lien he Quan tri vien SelfHeal de Revoke token." -ForegroundColor Yellow
Write-Host ""
