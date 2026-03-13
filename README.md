# Direct-to-Mood Marketing Studio

> **An AI Creative Director agent that thinks, plans, critiques, and generates complete marketing campaigns — text, images, audio, and video — in a single, fluid output stream.**

[![Gemini Live Agent Challenge](https://img.shields.io/badge/Gemini_Live_Agent-Challenge-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/competition/projects/direct-to-mood-marketing-studio)
[![Google Cloud Run](https://img.shields.io/badge/Google_Cloud-Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://gcloud-830001350094.europe-west1.run.app)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000?style=for-the-badge&logo=vercel&logoColor=white)](https://marketing-studio-jade.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

---

## Live Deployments

| Platform | URL |
|----------|-----|
| **Google Cloud Run** | [gcloud-830001350094.europe-west1.run.app](https://gcloud-830001350094.europe-west1.run.app) |
| **Vercel** | [marketing-studio-jade.vercel.app](https://marketing-studio-jade.vercel.app/) |

---

## What This App Does

Direct-to-Mood Marketing Studio is an **agentic, multimodal marketing campaign generator** built for the **#GeminiLiveAgentChallenge**. It acts as an AI Creative Director that:

1. **Extracts a brand brief** from your business description (and optional logo upload)
2. **Drafts interleaved text + image assets** using Gemini's native `TEXT + IMAGE` modalities in a single generation call
3. **Scores the draft** with an automated QA agent (cohesion + compliance)
4. **Auto-revises** if the quality score is below threshold
5. **Generates a cinematic video clip** using Veo 3.1 — automatically, after the campaign is ready
6. **Streams everything in real-time** via Server-Sent Events so the user watches the campaign materialize live

All assets — hooks, hero images, storytelling copy, lifestyle visuals, CTAs, and video — are generated in **one click** with no mockups and no manual steps between them.

---

## Key Features

### Agentic Pipeline (Multi-Step Reasoning)

The backend executes a structured creative workflow, not a single prompt:

| Step | What Happens | Model |
|------|-------------|-------|
| Brief Extraction | Parses brand voice, audience, tone, palette from business info + optional logo | `gemini-2.5-flash` |
| Interleaved Draft | Generates text and images in alternating sequence within one API call | `gemini-2.5-flash-image` |
| QA Scoring | Evaluates cohesion (0–10), compliance (0–10), issues, and suggested fixes | `gemini-2.5-flash` |
| Auto-Revision | If cohesion < 8, regenerates with targeted fixes (transparent to user) | `gemini-2.5-flash-image` |
| Video Generation | Creates a cinematic video clip from the campaign's CTA copy | `veo-3.1-generate-preview` |

Each step streams status updates, director notes, and assets to the frontend in real-time.

### Native Interleaved Output

Gemini generates text and images in a single `generateContent` call with `responseModalities: [TEXT, IMAGE]`. This is not prompt chaining — it is true interleaved multimodal generation where images are informed by the text context that precedes them.

### Multimodal Input

Users can upload a brand logo or product image. The image is sent as `inlineData` alongside the text prompt, so Gemini incorporates the brand's visual identity into every generated asset.

### Video Generation (Veo 3.1)

After text + image assets are finalized, the app automatically generates an 8-second cinematic video clip using Gemini's `generateVideos` API. The video is silent (visuals only); the frontend provides a **"Play Video with Full Narration"** button that syncs browser-based speech synthesis to the video playback, guaranteeing complete voiceover every time.

### Guardrails

| Control | Description |
|---------|-------------|
| **Channel** | Tailors tone for Instagram, TikTok, LinkedIn, YouTube, or general |
| **Reading Level** | Simple, general, or advanced vocabulary |
| **Taboo Words** | Comma-separated list of banned terms — enforced during QA |
| **Auto-Revise** | Toggle automatic revision when QA score is low |

### Campaign & Storyboard Modes

- **Campaign mode**: Hook → Hero Image → Story → Lifestyle Image → CTA
- **Storyboard mode**: Shot-by-shot visual sequence with frame descriptions and matching images

### Per-Asset Controls

- **Regenerate** any individual image without regenerating the whole campaign
- **Refine** any text asset with natural-language feedback
- **Share** any individual asset to social media (or copy to clipboard)

### Export

- **Download Bundle (.zip)**: Contains `campaign.json`, `campaign.md`, all images as PNGs, and the generated MP4 video
- **Play Voiceover**: Browser speech synthesis reads all text assets aloud
- **Share Social Caption**: Auto-generates platform-appropriate caption with hashtags

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 (standalone, no build step), Babel Standalone, Tailwind CSS, JSZip, Web Speech API |
| **Backend** | Node.js 18+, Express.js |
| **AI — Text + Images** | Google Gemini API (`@google/genai` SDK) — `gemini-2.5-flash` and `gemini-2.5-flash-image` with `Modality.TEXT` + `Modality.IMAGE` |
| **AI — Video** | Gemini Veo 3.1 (`veo-3.1-generate-preview`) via `ai.models.generateVideos` |
| **Streaming** | Server-Sent Events (SSE) |
| **Deployment** | Google Cloud Run (Docker), Vercel (serverless) |

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                          User's Browser                              │
│                                                                       │
│  React 18 SPA ──── SSE Stream ──── Web Speech API ──── JSZip Export  │
└────────────────────────┬──────────────────────────────────────────────┘
                         │  POST /api/generate-campaign (SSE)
                         │  POST /api/generate-video
                         │  POST /api/regen-image (SSE)
                         │  POST /api/refine-campaign (SSE)
                         ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Node.js / Express Backend                          │
│                                                                       │
│  ┌──────────┐   ┌──────────────┐   ┌────────┐   ┌──────────────┐    │
│  │  Brief    │──▶│  Interleaved │──▶│   QA   │──▶│ Auto-Revise  │    │
│  │  Extract  │   │  Draft       │   │  Score │   │ (if needed)  │    │
│  └──────────┘   └──────────────┘   └────────┘   └──────────────┘    │
│                                                         │             │
│                                              ┌──────────▼──────────┐ │
│                                              │  Video Generation   │ │
│                                              │  (Veo 3.1)          │ │
│                                              └─────────────────────┘ │
└────────────────────────┬──────────────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      Google Cloud (Gemini API)                        │
│                                                                       │
│   gemini-2.5-flash          gemini-2.5-flash-image       veo-3.1     │
│   (brief, QA, refine)      (interleaved TEXT+IMAGE)      (video)     │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org/)
- **Gemini API Key** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Setup

```bash
git clone https://github.com/kjelili/Marketing-Studio.git
cd Marketing-Studio
npm install
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=your_key_here
npm start
# Open http://localhost:8080
```

### Using the App

1. **Describe your business** — or pick a demo preset (coffee shop, skincare brand, etc.)
2. **Upload a logo** (optional) — for multimodal brand input
3. **Select a mood** — Elegant, Energetic, Minimal, Warm, Dramatic, or Playful
4. **Set guardrails** — channel, reading level, taboo words
5. **Click Generate** — watch the agentic pipeline run: brief → draft → QA → revision → video
6. **Interact** — regenerate individual images, refine text, share assets, or download the full bundle

---

## API Reference

### `GET /api/health`

Returns server status, platform, SDK version, and available features.

### `POST /api/generate-campaign` (SSE stream)

Main endpoint. Executes the full agentic pipeline and streams results.

**Request body:**

```json
{
  "businessInfo": "A cozy coffee shop in Austin for remote workers...",
  "mood": "warm",
  "mode": "campaign",
  "channel": "instagram",
  "readingLevel": "general",
  "bannedWords": "cheap,discount",
  "autoRevise": true,
  "brandImageDataUrl": "data:image/png;base64,..."
}
```

**SSE events emitted:** `run`, `step`, `director_note`, `brief`, `status`, `model`, `asset` (text or image), `qa`, `replace_all`, `complete`, `error`.

### `POST /api/regen-image` (SSE stream)

Regenerates a single image asset using Gemini interleaved output.

### `POST /api/refine-campaign` (SSE stream)

Multi-turn refinement — send natural language feedback and receive updated assets.

### `POST /api/generate-video`

Generates an MP4 video clip using Veo 3.1. Returns `{ videoUrl }`.

**Request body:**

```json
{
  "videoPrompt": "Your CTA or script text",
  "mood": "warm",
  "channel": "instagram",
  "durationSeconds": 8,
  "aspectRatio": "16:9",
  "resolution": "1080p"
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | From [Google AI Studio](https://aistudio.google.com/apikey) |
| `PORT` | No | `8080` | Server port |
| `NODE_ENV` | No | `development` | `production` enables Cloud Run detection |
| `ALLOWED_ORIGINS` | No | `*` | CORS origins (comma-separated) |

---

## Project Structure

```
Marketing-Studio/
├── index.html            # React 18 frontend (single-file SPA)
├── server.js             # Express backend (agentic pipeline + Gemini integration)
├── package.json          # Dependencies and scripts
├── .env.example          # Environment variable template
├── Dockerfile            # Cloud Run container
├── vercel.json           # Vercel serverless routing
├── deploy-gcp.ps1       # One-click GCP deployment (PowerShell)
├── app.yaml              # App Engine config (alternative)
├── videos/               # Auto-created directory for generated MP4s
└── README.md
```

---

## Deployment

### Google Cloud Run

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud run deploy marketing-studio \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_key,NODE_ENV=production" \
  --memory 512Mi --cpu 1
```

Or use the one-click script: `.\deploy-gcp.ps1`

### Vercel

```bash
npm i -g vercel
vercel
# Set GEMINI_API_KEY in Vercel Dashboard → Settings → Environment Variables
```

---

## Proof of Google Cloud Deployment

The backend runs on **Google Cloud Run** in `europe-west1`:

- **Live URL**: [gcloud-830001350094.europe-west1.run.app](https://gcloud-830001350094.europe-west1.run.app)
- **Health endpoint**: [gcloud-830001350094.europe-west1.run.app/api/health](https://gcloud-830001350094.europe-west1.run.app/api/health) — returns `"platform": "Google Cloud Run"`
- **Code proof**: [`server.js`](server.js) line 149 — `process.env.K_SERVICE ? 'Google Cloud Run' : 'local'` uses the Cloud Run-injected `K_SERVICE` environment variable
- **Deployment config**: [`Dockerfile`](Dockerfile), [`deploy-gcp.ps1`](deploy-gcp.ps1)

---

## Findings and Learnings

### What Worked Well

- **Gemini's interleaved `TEXT + IMAGE` modality** is genuinely powerful — generating text and images in a single call produces visually cohesive campaigns that feel like they were art-directed, not stitched together from separate tools.
- **The agentic pipeline** (brief → draft → QA → revise) dramatically improved output quality. Having the AI critique its own work and iterate before presenting to the user is a major step above single-shot generation.
- **SSE streaming** creates a compelling real-time experience. Users watch the Creative Director "think" — seeing director notes, brief extraction, and assets appear live builds trust and engagement.

### Challenges

- **Gemini's JSON output reliability**: Even with `responseMimeType: 'application/json'`, Gemini occasionally wraps responses in markdown fences. The `extractJsonBlock` utility became essential for robust parsing.
- **Veo 3.1 audio control**: Veo's internal voiceover cannot be precisely controlled for duration or completeness. The solution was to generate silent video (visuals only) and layer browser-based speech synthesis for guaranteed full narration.
- **Image-only generation**: Requesting `Modality.IMAGE` alone from `generateContent` is unreliable. Requesting `[Modality.TEXT, Modality.IMAGE]` and extracting the image part proved far more consistent.

### Key Technical Decisions

- **Single-file frontend** (`index.html` with React 18 + Babel Standalone): Zero build step, instant deployment, no framework overhead. Trade-off: no TypeScript, no module bundling — acceptable for a challenge demo.
- **`@google/genai` SDK** (not REST): Provides typed helpers for `generateContent`, `generateVideos`, and file operations, reducing boilerplate and error handling.
- **Web Speech API for voiceover**: Browser-native TTS guarantees narration completion regardless of Veo's audio capabilities. The video provides cinematic visuals; the browser provides reliable speech.

---

## Security

- API key stored in `.env` / Cloud Run secrets — never sent to the browser
- All Gemini calls proxied through Express (backend gateway pattern)
- CORS configured per deployment
- No user data stored; all API calls are ephemeral
- Input sanitization and payload size limits on server

---

## License

MIT — free to use, modify, and distribute.

---

**Built for the #GeminiLiveAgentChallenge** · [Google Cloud Run](https://gcloud-830001350094.europe-west1.run.app) · [Vercel](https://marketing-studio-jade.vercel.app/) · [GitHub](https://github.com/kjelili/Marketing-Studio)
