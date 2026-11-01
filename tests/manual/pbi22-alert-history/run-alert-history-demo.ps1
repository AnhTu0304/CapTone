# ==============================================================================
# [S5][PBI22] Task 4.1 & 4.2 - Alert History & Query API Demo Runner
# Pipeline: Fixture -> Ingest -> Lifecycle (Ack/Resolve) -> History API -> Timeline
# ==============================================================================

param(
    [string]$FixturePath = "$PSScriptRoot\PBI22_Alert_History_Test_Fixture.json",
    [string]$BaseUrl = $(if ($env:ALERT_DEMO_BASE_URL) { $env:ALERT_DEMO_BASE_URL } else { "http://localhost:5000/api/v1" }),
    [string]$OrgId = $(if ($env:ALERT_DEMO_ORG_ID) { $env:ALERT_DEMO_ORG_ID } else { "6fdcd256-3eb1-4c22-b71c-42e1217963e3" }),
    [string]$ClusterId = $(if ($env:ALERT_DEMO_CLUSTER_ID) { $env:ALERT_DEMO_CLUSTER_ID } else { "c083f597-12a4-4860-9a41-c93860139808" })
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " [S5][PBI22] 4.1 & 4.2 - Alert History & Query API Demo      " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (-not (Test-Path $FixturePath)) {
    $AltPath = "$PSScriptRoot\..\..\PBI22_Alert_History_Test_Fixture.json"
    if (Test-Path $AltPath) {
        $FixturePath = $AltPath
    } else {
        Write-Error "Khong tim thay file fixture: $FixturePath"
        exit 1
    }
}

Write-Host "[1/6] Doc file fixture: $FixturePath" -ForegroundColor Yellow
$FixtureRaw = Get-Content -Path $FixturePath -Raw -Encoding UTF8
$Fixture = $FixtureRaw | ConvertFrom-Json
$FixtureTitle = if ($Fixture.name) { $Fixture.name } else { $Fixture.fixture_id }
Write-Host "  -> Fixture Name: $FixtureTitle"
Write-Host "  -> So kich ban : $($Fixture.scenarios.Count)"

Write-Host "[2/6] Kiem tra ket noi Backend tai $BaseUrl/health ..." -ForegroundColor Yellow
try {
    $Health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5
    Write-Host "  -> Backend Health: OK" -ForegroundColor Green
} catch {
    Write-Error "Backend khong phan hoi tai $BaseUrl/health. Hay dam bao Main_backend dang chay."
    exit 1
}

# Khoi tao JWT token
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

Write-Host "[3/6] Nap $($Fixture.scenarios.Count) kich ban tu fixture va kich hoat canh bao ..." -ForegroundColor Yellow
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
$IngestedCount = if ($IngestResp.data.scenarios_processed) { $IngestResp.data.scenarios_processed.Count } else { 0 }
Write-Host "  -> Nap thanh cong $IngestedCount kich ban" -ForegroundColor Green

Write-Host "[4/6] Mo phong vong doi (Acknowledge & Resolve) de tao Lich su va Timeline ..." -ForegroundColor Yellow
$ActiveEventsResp = Invoke-RestMethod -Uri "$BaseUrl/alerts?cluster_id=$ClusterId&page=1&limit=20" -Method Get -Headers $Headers
$EventsList = if ($ActiveEventsResp.data.items) { $ActiveEventsResp.data.items } else { $ActiveEventsResp.data }
$SampleEventId = $null

if ($EventsList -and $EventsList.Count -gt 0) {
    $SampleEventId = $EventsList[0].id
    # Acknowledge event dau tien
    try {
        $AckBody = @{ note = "DevOps tiep nhan xu ly qua Demo Runner PBI22" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/alerts/$SampleEventId/acknowledge" -Method Patch -Headers $Headers -Body $AckBody | Out-Null
        Write-Host "  -> Acknowledged: $SampleEventId" -ForegroundColor Green
    } catch {
        Write-Host "  -> Note: Acknowledge warning: $_" -ForegroundColor DarkGray
    }

    # Resolve event thu hai neu co
    if ($EventsList.Count -gt 1) {
        $ResolveId = $EventsList[1].id
        try {
            $ResBody = @{ note = "Manual resolution qua Demo Runner PBI22" } | ConvertTo-Json
            Invoke-RestMethod -Uri "$BaseUrl/alerts/$ResolveId/resolve" -Method Patch -Headers $Headers -Body $ResBody | Out-Null
            Write-Host "  -> Resolved: $ResolveId" -ForegroundColor Green
        } catch {
            Write-Host "  -> Note: Resolve warning: $_" -ForegroundColor DarkGray
        }
    }
}

Write-Host "[5/6] Kiem thu cac API truy van Lich su canh bao (Task 4.2) ..." -ForegroundColor Yellow
$PassCount = 0
$TotalChecks = 6

# Check 1: GET /api/v1/alerts/history
try {
    $HistResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/history?page=1&limit=10" -Method Get -Headers $Headers
    $HistData = if ($HistResp.data -is [System.Collections.IList]) { $HistResp.data } else { @($HistResp.data) }
    if ($HistResp.success -and $HistData.Count -gt 0) {
        $sampleDuration = $HistData[0].duration_formatted
        Write-Host "  [PASS] 1. GET /alerts/history tra ve $($HistData.Count) ban ghi (duration_formatted = '$sampleDuration')" -ForegroundColor Green
        $PassCount++
        if (-not $SampleEventId) {
            $SampleEventId = $HistData[0].id
        }
    } else {
        Write-Host "  [FAIL] 1. GET /alerts/history khong tra ve du lieu" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] 1. GET /alerts/history loi: $_" -ForegroundColor Red
}

# Check 2: Filter severity=CRITICAL
try {
    $CritResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/history?severity=CRITICAL" -Method Get -Headers $Headers
    $CritData = if ($CritResp.data -is [System.Collections.IList]) { $CritResp.data } else { @($CritResp.data) }
    $AllCrit = $true
    foreach ($item in $CritData) {
        if ($item.severity -ne "CRITICAL") { $AllCrit = $false; break; }
    }
    if ($CritResp.success -and $CritData.Count -gt 0 -and $AllCrit) {
        Write-Host "  [PASS] 2. Filter severity=CRITICAL tra ve $($CritData.Count) ban ghi hop le" -ForegroundColor Green
        $PassCount++
    } else {
        Write-Host "  [FAIL] 2. Filter severity=CRITICAL khong dung ket qua (count: $($CritData.Count), allCrit: $AllCrit)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] 2. Filter severity=CRITICAL loi: $_" -ForegroundColor Red
}

# Check 3: Filter status
try {
    $StatusResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/history?status=RESOLVED" -Method Get -Headers $Headers
    $StatusData = if ($StatusResp.data -is [System.Collections.IList]) { $StatusResp.data } else { @($StatusResp.data) }
    if ($StatusResp.success) {
        Write-Host "  [PASS] 3. Filter status=RESOLVED tra ve $($StatusData.Count) ban ghi" -ForegroundColor Green
        $PassCount++
    } else {
        Write-Host "  [FAIL] 3. Filter status=RESOLVED khong thanh cong" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] 3. Filter status=RESOLVED loi: $_" -ForegroundColor Red
}

# Check 4: Search filter
try {
    $SearchResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/history?search=Payment" -Method Get -Headers $Headers
    $SearchData = if ($SearchResp.data -is [System.Collections.IList]) { $SearchResp.data } else { @($SearchResp.data) }
    if ($SearchResp.success -and $SearchData.Count -gt 0) {
        Write-Host "  [PASS] 4. Search query '?search=Payment' tra ve $($SearchData.Count) ket qua" -ForegroundColor Green
        $PassCount++
    } else {
        Write-Host "  [FAIL] 4. Search query '?search=Payment' that bai" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] 4. Search query loi: $_" -ForegroundColor Red
}

# Check 5: Summary API
try {
    $SummResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/history/summary" -Method Get -Headers $Headers
    if ($SummResp.success -and $SummResp.data.total_alerts -ge 0) {
        Write-Host ("  [PASS] 5. GET /alerts/history/summary: Total={0}, Critical={1}, Warning={2}, Info={3}, Resolved={4}" -f `
            $SummResp.data.total_alerts, $SummResp.data.critical_alerts, $SummResp.data.warning_alerts, $SummResp.data.info_alerts, $SummResp.data.resolved_alerts) -ForegroundColor Green
        $PassCount++
    } else {
        Write-Host "  [FAIL] 5. GET /alerts/history/summary that bai" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] 5. GET /alerts/history/summary loi: $_" -ForegroundColor Red
}

# Check 6: Timeline API
if ($SampleEventId) {
    try {
        $TimeResp = Invoke-RestMethod -Uri "$BaseUrl/alerts/history/$SampleEventId/timeline" -Method Get -Headers $Headers
        $TimelineList = if ($TimeResp.timeline) { $TimeResp.timeline } elseif ($TimeResp.data.timeline) { $TimeResp.data.timeline } else { @() }
        if ($TimeResp.success -and $TimelineList.Count -gt 0) {
            Write-Host "  [PASS] 6. GET /alerts/history/$SampleEventId/timeline tra ve $($TimelineList.Count) moc su kien" -ForegroundColor Green
            $PassCount++
        } else {
            Write-Host "  [FAIL] 6. Timeline rong cho event $SampleEventId" -ForegroundColor Red
        }
    } catch {
        Write-Host "  [FAIL] 6. GET timeline loi: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  [SKIP] 6. Khong co SampleEventId de test timeline" -ForegroundColor Yellow
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " KET QUA VERIFICATION: $PassCount / $TotalChecks CHECKS PASS" -ForegroundColor $(if ($PassCount -eq $TotalChecks) { "Green" } else { "Yellow" })
Write-Host "============================================================" -ForegroundColor Cyan

if ($PassCount -lt $TotalChecks) {
    exit 1
}
exit 0
