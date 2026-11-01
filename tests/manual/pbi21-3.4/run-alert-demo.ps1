# ==============================================================================
# [S5][PBI21] Task 3.4 - Alert UI Demo & Verification Runner
# Pipeline: Fixture -> Telemetry Ingest -> Rule Engine -> Condition Evaluator ->
#           Deduplication -> Severity -> Alert Event -> Alert API -> Frontend
# ==============================================================================

param(
    [string]$FixturePath = "$PSScriptRoot\..\..\..\pbi21_3_4_alert_ui_demo.json",
    [string]$BaseUrl = $(if ($env:ALERT_DEMO_BASE_URL) { $env:ALERT_DEMO_BASE_URL } else { "http://localhost:5000/api/v1" }),
    [string]$OrgId = $(if ($env:ALERT_DEMO_ORG_ID) { $env:ALERT_DEMO_ORG_ID } else { "6fdcd256-3eb1-4c22-b71c-42e1217963e3" }),
    [string]$ClusterId = $(if ($env:ALERT_DEMO_CLUSTER_ID) { $env:ALERT_DEMO_CLUSTER_ID } else { "c083f597-12a4-4860-9a41-c93860139808" })
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " [S5][PBI21] 3.4 - Alert UI Demo & E2E Trigger Verification " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (-not (Test-Path $FixturePath)) {
    $AltPath = "$PSScriptRoot\pbi21_3_4_alert_ui_demo.json"
    if (Test-Path $AltPath) {
        $FixturePath = $AltPath
    } else {
        Write-Error "Khong tim thay file fixture: $FixturePath"
        exit 1
    }
}

Write-Host "[1/5] Doc file fixture: $FixturePath" -ForegroundColor Yellow
$FixtureRaw = Get-Content -Path $FixturePath -Raw -Encoding UTF8
$Fixture = $FixtureRaw | ConvertFrom-Json
Write-Host "  -> Fixture ID : $($Fixture.fixture_id)"
Write-Host "  -> So kich ban: $($Fixture.scenarios.Count)"

Write-Host "[2/5] Kiem tra ket noi Backend tai $BaseUrl/health ..." -ForegroundColor Yellow
try {
    $Health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5
    Write-Host "  -> Backend Health: OK" -ForegroundColor Green
} catch {
    Write-Error "Backend khong phan hoi tai $BaseUrl/health. Hay dam bao Main_backend dang chay."
    exit 1
}

# Lay token tu bien moi truong hoac tao token dev cuc bo (khong in token ra stdout)
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

if (-not $Token) {
    Write-Error "Khong the khoi tao JWT token cho demo."
    exit 1
}

$Headers = @{
    "Authorization"     = "Bearer $Token"
    "X-Organization-Id" = $OrgId
    "Content-Type"      = "application/json"
}

Write-Host "[3/5] Nap 3 kich ban tu fixture va kich hoat Rule Engine ..." -ForegroundColor Yellow
$IngestBody = @{
    cluster_id = $ClusterId
    mode       = "trigger"
    scenarios  = $Fixture.scenarios
} | ConvertTo-Json -Depth 15

$IngestResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/demo-ingest" -Method Post -Headers $Headers -Body $IngestBody
if (-not $IngestResp.success) {
    Write-Error "Demo ingest that bai!"
    exit 1
}

Write-Host "  -> So kich ban da nap : $($IngestResp.data.ingested_scenarios.Count)" -ForegroundColor Green
foreach ($sc in $IngestResp.data.ingested_scenarios) {
    Write-Host ("     * [{0}] Rule ID: {1} | Resource: {2} ({3})" -f $sc.scenario_id, $sc.rule_id, $sc.resource_name, $sc.metric_type)
}

Write-Host "[4/5] Kiem tra danh sach Alert Events va Deduplication ..." -ForegroundColor Yellow
$IngestDedupeResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/demo-ingest" -Method Post -Headers $Headers -Body $IngestBody
$SummaryResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/summary?cluster_id=$ClusterId" -Method Get -Headers $Headers
$ListResp = Invoke-RestMethod -Uri "$BaseUrl/alerts?cluster_id=$ClusterId&limit=20" -Method Get -Headers $Headers

$Summary = $SummaryResp.data
Write-Host ("  -> Tong quan Alert (Cluster {0}): Active={1} | Critical={2} | Warning={3} | Info={4} | Resolved={5}" -f `
    $ClusterId, $Summary.total_active, $Summary.critical, $Summary.warning, $Summary.info, $Summary.resolved) -ForegroundColor Cyan

$ExpectedResources = @{
    "CPU-HIGH-001"  = @{ resource_name = "worker-node-01"; expected_severity = "WARNING" }
    "K8S-CRASH-001" = @{ resource_name = "orders-api-7d9c8b6f4-x9k2m"; expected_severity = "CRITICAL" }
    "APM-5XX-001"   = @{ resource_name = "checkout-service"; expected_severity = "CRITICAL" }
}

$AllPassed = $true
Write-Host "[5/5] Doi chieu ket qua 3 kich ban tren Alert API:" -ForegroundColor Yellow
$AlertItems = if ($ListResp.data.items) { $ListResp.data.items } else { $ListResp.data }
foreach ($key in $ExpectedResources.Keys) {
    $exp = $ExpectedResources[$key]
    $matched = $AlertItems | Where-Object {
        ($_.resource_name -eq $exp.resource_name -or $_.resource_id -eq $exp.resource_name) -and $_.status -in @("ACTIVE", "ACKNOWLEDGED")
    } | Select-Object -First 1

    if ($null -eq $matched) {
        Write-Host ("  [FAIL] {0}: Khong tim thay Alert ACTIVE cho resource '{1}'" -f $key, $exp.resource_name) -ForegroundColor Red
        $AllPassed = $false
    } else {
        $sevOk = ($matched.severity -eq $exp.expected_severity)
        $dedupeOk = ([int]$matched.occurrence_count -ge 2)
        if ($sevOk -and $dedupeOk) {
            Write-Host ("  [PASS] {0} -> Alert ID: {1} | Severity: {2} | Status: {3} | Value: {4}/{5} | Occurrences: {6}" -f `
                $key, $matched.id, $matched.severity, $matched.status, $matched.metric_value, $matched.threshold, $matched.occurrence_count) -ForegroundColor Green
        } else {
            Write-Host ("  [WARN] {0} -> Alert ID: {1} | Severity: {2} (expected {3}) | Occurrences: {4}" -f `
                $key, $matched.id, $matched.severity, $exp.expected_severity, $matched.occurrence_count) -ForegroundColor Yellow
            if (-not $sevOk) { $AllPassed = $false }
        }
    }
}

if (-not $AllPassed) {
    Write-Error "Co kich ban khong dat yeu cau kiem thu!"
    exit 1
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host " KET QUA: 3/3 KICH BAN CANH BAO DA KICH HOAT THANH CONG!   " -ForegroundColor Green
Write-Host " Giao dien: http://localhost:3000/dashboard/alerts          " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
exit 0
