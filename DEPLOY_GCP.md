# Google Cloud Run Deployment Guide

## Quick Deploy (One Command)

### Option A: PowerShell Script (Recommended)
```powershell
cd C:\Users\DeLL\Desktop\marketing-studio
.\deploy-gcp.ps1
```
The script will walk you through login, project setup, and deployment.

### Option B: Manual Commands
```powershell
# 1. Login to Google Cloud
gcloud auth login

# 2. Set your project
gcloud config set project YOUR_PROJECT_ID

# 3. Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 4. Deploy (replace YOUR_KEY with your Gemini API key)
gcloud run deploy marketing-studio --source . --region us-central1 --allow-unauthenticated --set-env-vars "GEMINI_API_KEY=YOUR_KEY,NODE_ENV=production,ALLOWED_ORIGINS=*" --memory 512Mi --cpu 1
```

## After Deployment

Your app will be live at a URL like:
```
https://marketing-studio-xxxxx-uc.a.run.app
```

## Recording Your Proof

1. Open **Google Cloud Console** → **Cloud Run**
   https://console.cloud.google.com/run

2. **Start screen recording**

3. Show these in the recording:
   - Cloud Run dashboard with `marketing-studio` service listed
   - Click into the service → show **Status: Active**, **URL**, **Region**
   - Click **Logs** tab → show server startup message
   - Open the live URL in browser
   - Type a business description, select a mood, click Generate
   - Show the campaign results loading

4. **Stop recording** — that's your proof!

## Files Added to Your Project

| File | Purpose |
|------|---------|
| `Dockerfile` | Container definition for Cloud Run |
| `.dockerignore` | Excludes unnecessary files from container |
| `.gcloudignore` | Excludes files from source upload |
| `deploy-gcp.ps1` | One-click PowerShell deployment script |
| `app.yaml` | App Engine config (alternative deployment) |

## Costs

Cloud Run has a generous free tier:
- 2 million requests/month free
- 360,000 GB-seconds of memory free
- 180,000 vCPU-seconds free

Your app will cost **$0** for the competition demo.

## Troubleshooting

**"Permission denied" or "billing not enabled"**
→ Enable billing: https://console.cloud.google.com/billing

**"gcloud not found"**
→ Install: https://cloud.google.com/sdk/docs/install
→ Restart PowerShell after installation

**Build fails**
→ Make sure `package.json`, `server.js`, `index.html` are in the current folder
→ Run `gcloud builds log` to see detailed error

**App deploys but campaigns fail**
→ Check your GEMINI_API_KEY is correct
→ View logs: `gcloud run services logs read marketing-studio --region us-central1`
