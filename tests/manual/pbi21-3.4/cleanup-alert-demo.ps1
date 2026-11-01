# ==============================================================================
# [S5][PBI21] Task 3.4 - Alert UI Demo Recovery / Cleanup Runner
# ==============================================================================

param(
    [string]$FixturePath = "$PSScriptRoot\..\..\..\pbi21_3_4_alert_ui_demo.json",
    [string]$BaseUrl = $(if ($env:ALERT_DEMO_BASE_URL) { $env:ALERT_DEMO_BASE_URL } else { "http://localhost:5000/api/v1" }),
    [string]$OrgId = $(if ($env:ALERT_DEMO_ORG_ID) { $env:ALERT_DEMO_ORG_ID } else { "6fdcd256-3eb1-4c22-b71c-42e1217963e3" }),
    [string]$ClusterId = $(if ($env:ALERT_DEMO_CLUSTER_ID) { $env:ALERT_DEMO_CLUSTER_ID } else { "c083f597-12a4-4860-9a41-c93860139808" })
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " [S5][PBI21] 3.4 - Alert Demo Auto-Resolve / Recovery       " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$Fixture = Get-Content -Path $FixturePath -Raw -Encoding UTF8 | ConvertFrom-Json

$Token = $env:ALERT_DEMO_TOKEN
if (-not $Token) {
    $RepoRoot = Resolve-Path "$PSScriptRoot\..\..\.."
    $BackendDir = Join-Path $RepoRoot "Main_backend"
    Push-Location $BackendDir
    try {
        $Token = node --import tsx -e "import jwt from 'jsonwebtoken'; import { config } from './src/config/env.js'; process.stdout.write(jwt.sign({ id: '53f5bcdb-a15f-43b6-b3d1-afa8eb5843c1', email: 'tungo342005@gmail.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: '$OrgId' }, config.jwt.secret, { expiresIn: '1h' }));"
    } finally {
        Pop-Location
    }
}

$Headers = @{
    "Authorization"     = "Bearer $Token"
    "X-Organization-Id" = $OrgId
    "Content-Type"      = "application/json"
}

$Body = @{
    cluster_id = $ClusterId
    mode       = "recover"
    scenarios  = $Fixture.scenarios
} | ConvertTo-Json -Depth 15

$Resp = Invoke-RestMethod -Uri "$BaseUrl/alerts/demo-ingest" -Method Post -Headers $Headers -Body $Body
if (-not $Resp.success) {
    Write-Error "Khoi phuc canh bao demo that bai!"
    exit 1
}

$SummaryResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/summary?cluster_id=$ClusterId" -Method Get -Headers $Headers
$Summary = $SummaryResp.data
Write-Host ("  -> Sau khi khoi phuc: Active={0} | Resolved={1}" -f $Summary.total_active, $Summary.resolved) -ForegroundColor Green
exit 0
