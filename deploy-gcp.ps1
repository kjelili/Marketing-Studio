<#
.SYNOPSIS
    One-click deployment of Direct-to-Mood Marketing Studio to Google Cloud Run
.DESCRIPTION
    This script deploys the application to Google Cloud Run and outputs
    the live URL. Run from the marketing-studio project folder.
.NOTES
    Prerequisites:
    1. Google Cloud CLI installed: https://cloud.google.com/sdk/docs/install
    2. A GCP project with billing enabled
    3. Your GEMINI_API_KEY ready
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId,
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1",
    
    [Parameter(Mandatory=$false)]
    [string]$GeminiApiKey
)

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Direct-to-Mood Marketing Studio — Cloud Run Deploy" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check gcloud CLI ──
Write-Host "[1/6] Checking Google Cloud CLI..." -ForegroundColor Yellow
try {
    $gcloudVersion = gcloud version 2>&1 | Select-Object -First 1
    Write-Host "  OK: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: gcloud CLI not found!" -ForegroundColor Red
    Write-Host "  Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    Write-Host "  Then run: gcloud auth login" -ForegroundColor Red
    exit 1
}

# ── Step 2: Authenticate ──
Write-Host "[2/6] Checking authentication..." -ForegroundColor Yellow
$account = gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>$null
if (-not $account) {
    Write-Host "  No active account. Launching login..." -ForegroundColor Yellow
    gcloud auth login
    $account = gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>$null
}
Write-Host "  OK: Logged in as $account" -ForegroundColor Green

# ── Step 3: Set project ──
Write-Host "[3/6] Setting GCP project..." -ForegroundColor Yellow
if (-not $ProjectId) {
    $currentProject = gcloud config get-value project 2>$null
    if ($currentProject) {
        Write-Host "  Current project: $currentProject"
        $use = Read-Host "  Use this project? (y/n)"
        if ($use -eq "y") {
            $ProjectId = $currentProject
        }
    }
    if (-not $ProjectId) {
        $ProjectId = Read-Host "  Enter your GCP Project ID"
    }
}
gcloud config set project $ProjectId
Write-Host "  OK: Project set to $ProjectId" -ForegroundColor Green

# ── Step 4: Enable required APIs ──
Write-Host "[4/6] Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com 2>$null
gcloud services enable cloudbuild.googleapis.com 2>$null
gcloud services enable artifactregistry.googleapis.com 2>$null
Write-Host "  OK: Cloud Run, Cloud Build, Artifact Registry enabled" -ForegroundColor Green

# ── Step 5: Get API key ──
Write-Host "[5/6] Configuring Gemini API key..." -ForegroundColor Yellow
if (-not $GeminiApiKey) {
    # Try reading from .env file
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" | Where-Object { $_ -match "^GEMINI_API_KEY=" }
        if ($envContent) {
            $GeminiApiKey = ($envContent -split "=", 2)[1].Trim()
            Write-Host "  Found API key in .env file" -ForegroundColor Green
        }
    }
    if (-not $GeminiApiKey) {
        $GeminiApiKey = Read-Host "  Enter your GEMINI_API_KEY"
    }
}
$keyPreview = $GeminiApiKey.Substring(0, [Math]::Min(8, $GeminiApiKey.Length)) + "..."
Write-Host "  OK: API key configured ($keyPreview)" -ForegroundColor Green

# ── Step 6: Deploy ──
Write-Host "[6/6] Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host "  This will take 2-5 minutes (building container + deploying)..." -ForegroundColor Gray
Write-Host ""

gcloud run deploy marketing-studio `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --set-env-vars "GEMINI_API_KEY=$GeminiApiKey,NODE_ENV=production,ALLOWED_ORIGINS=*" `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 3 `
    --timeout 60

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    
    # Get the URL
    $serviceUrl = gcloud run services describe marketing-studio --region $Region --format="value(status.url)" 2>$null
    
    Write-Host ""
    Write-Host "  Live URL: $serviceUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Next steps for your proof recording:" -ForegroundColor Yellow
    Write-Host "  1. Open Google Cloud Console: https://console.cloud.google.com/run" -ForegroundColor White
    Write-Host "  2. Click 'marketing-studio' service" -ForegroundColor White
    Write-Host "  3. Start screen recording" -ForegroundColor White
    Write-Host "  4. Show the service dashboard (status, URL, region)" -ForegroundColor White
    Write-Host "  5. Click 'Logs' tab — show the server startup logs" -ForegroundColor White
    Write-Host "  6. Open the live URL in browser" -ForegroundColor White
    Write-Host "  7. Generate a campaign to prove it works" -ForegroundColor White
    Write-Host "  8. Stop recording — that's your proof!" -ForegroundColor White
    Write-Host ""
    Write-Host "  Console direct link:" -ForegroundColor Gray
    Write-Host "  https://console.cloud.google.com/run/detail/$Region/marketing-studio?project=$ProjectId" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "  DEPLOYMENT FAILED" -ForegroundColor Red
    Write-Host "  Check the error messages above." -ForegroundColor Red
    Write-Host "  Common fixes:" -ForegroundColor Yellow
    Write-Host "    - Enable billing on your GCP project" -ForegroundColor White
    Write-Host "    - Run: gcloud auth login" -ForegroundColor White
    Write-Host "    - Check your project ID is correct" -ForegroundColor White
    Write-Host ""
}
