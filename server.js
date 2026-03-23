require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI, Modality } = require('@google/genai');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ──
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: true }));

// Explicit root route — express.static does not work reliably on Vercel serverless
app.get('/', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  res.sendFile(path.join(__dirname, 'index.html'));
});

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function createSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  return (event, data = {}) => {
    res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
  };
}

async function generateText(aiClient, { model, systemInstruction, contents, temperature = 0.4, maxOutputTokens = 2048, responseMimeType }) {
  const config = {
    systemInstruction,
    temperature,
    maxOutputTokens,
    responseModalities: [Modality.TEXT],
  };
  if (responseMimeType) config.responseMimeType = responseMimeType;

  const result = await aiClient.models.generateContent({
    model,
    contents,
    config,
  });

  const parts = result?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text).filter(Boolean).join('\n').trim();
  return { result, text };
}

function extractJsonBlock(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Strip markdown fences like ```json ... ```
  const fenceMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
  const inner = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const firstBrace = inner.indexOf('{');
  const lastBrace = inner.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;
  return inner.slice(firstBrace, lastBrace + 1);
}

function computeHeuristicQa(assets, tabooWords) {
  const textAssets = assets.filter(a => a.type === 'text' && typeof a.content === 'string');
  const textBlob = textAssets.map(a => a.content.toLowerCase()).join(' ');
  const taboos = (tabooWords || []).map(w => String(w).toLowerCase()).filter(Boolean);

  let violations = [];
  for (const w of taboos) {
    if (!w) continue;
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(textBlob)) violations.push(w);
  }
  violations = Array.from(new Set(violations));

  const hasImages = assets.some(a => a.type === 'image');
  const hasText = textAssets.length > 0;

  let cohesion = 8;
  if (hasImages && hasText) cohesion = 9;
  if (!hasImages || !hasText) cohesion = 7;

  let compliance = violations.length === 0 ? 10 : Math.max(5, 9 - violations.length * 2);

  const issues = [];
  if (!hasImages) issues.push('No images present; campaign is text-only.');
  if (!hasText) issues.push('No text assets present; campaign is image-only.');
  if (violations.length > 0) {
    issues.push(`Found taboo words in copy: ${violations.join(', ')}`);
  }

  const suggested_fixes = [];
  if (violations.length > 0) {
    suggested_fixes.push('Remove or rephrase any copy that uses taboo words.');
  }
  if (!hasImages) {
    suggested_fixes.push('Add at least one on-brand image asset to improve cohesion.');
  }
  if (!hasText) {
    suggested_fixes.push('Add at least one text asset (hook or CTA) to anchor the visuals.');
  }

  return {
    cohesion_score: cohesion,
    compliance_score: compliance,
    issues,
    suggested_fixes,
  };
}

// ── Initialize Google GenAI SDK ──
let ai;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log('✓ Google GenAI SDK initialized');
}

// ── System instruction: Creative Director persona ──
const SYSTEM_INSTRUCTION = `You are a Senior Creative Director AI agent. Your job is to generate complete marketing campaigns as a cohesive, interleaved flow of text and images.

CRITICAL RULES:
1. Generate content as an INTERLEAVED stream: write a text section, then generate a matching image, then write more text, then generate another image.
2. For each campaign, produce this exact flow:
   - First: Write a compelling HOOK (1-2 sentences of marketing copy)
   - Then: Generate a HERO IMAGE that matches the hook's mood and brand
   - Then: Write a STORYTELLING paragraph (2-3 sentences of value proposition)  
   - Then: Generate a LIFESTYLE IMAGE showing the product/service in context
3. Every image you generate MUST match the campaign mood. If the mood is "Warm & Inviting", the images should have warm golden lighting. If "Minimal & Clean", use stark white backgrounds.
4. Write text that references what the images show, creating a cohesive narrative.
5. End with a clear CALL TO ACTION.

You think like a creative director — you consider the target audience, brand positioning, and visual storytelling. You don't just generate assets; you WEAVE them into a unified campaign narrative.`;

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Direct-to-Mood Marketing Studio v2 — Interleaved Multimodal',
    platform: process.env.K_SERVICE ? 'Google Cloud Run' : 'local',
    sdk: '@google/genai',
    features: ['interleaved-output', 'native-image-generation', 'streaming', 'agent-refinement'],
    timestamp: new Date().toISOString()
  });
});

// ══════════════════════════════════════════════════
// VIDEO GENERATION — SSE streaming pattern
// Single long-lived connection: no in-memory Map, works on Vercel serverless
// POST /api/generate-video  → SSE stream with progress updates + final video URL
// ══════════════════════════════════════════════════

app.post('/api/generate-video', async (req, res) => {
  const sendEvent = createSse(res);

  try {
    if (!ai) {
      sendEvent('video_error', { message: 'GenAI SDK not initialized — check GEMINI_API_KEY' });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const {
      videoPrompt,
      mood,
      channel = 'general',
      durationSeconds = 8,
      aspectRatio = '16:9',
      resolution = '1080p',
    } = req.body || {};

    if (!videoPrompt || typeof videoPrompt !== 'string' || !videoPrompt.trim()) {
      sendEvent('video_error', { message: 'Missing videoPrompt' });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const fullPrompt = `
Create a short, cinematic marketing video. Do NOT include any spoken dialogue, narration, or voiceover — the audio track will be added separately by the application.

Mood: ${mood || 'unspecified'}
Channel: ${channel}
Duration: exactly ${durationSeconds} seconds, aspect ratio ${aspectRatio}, resolution ${resolution}.

VISUAL DIRECTION (no speech/voiceover — visuals only with ambient sound or music):
- Show compelling, high-quality visuals that match the marketing message below.
- Use smooth cinematic camera movements, vivid colors, and professional-grade imagery.
- Illustrate the concepts, product, or story described in the script through purely visual storytelling.
- No text overlays, no spoken words, no narration in the video itself.

MARKETING SCRIPT (for visual reference only — NOT to be spoken):
"""
${videoPrompt.trim()}
"""

Generate a polished, visually stunning spot with ambient audio/music but absolutely no spoken voiceover.
`.trim();

    const veoModels = ['veo-3.1-generate-preview', 'veo-2.0-generate-001'];
    const MAX_RETRIES = 2;
    let lastError = null;
    let success = false;

    for (const veoModel of veoModels) {
      if (success) break;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          sendEvent('video_progress', { message: `Trying ${veoModel} (attempt ${attempt})…`, elapsed: 0 });
          console.log(`Video SSE: trying ${veoModel} (attempt ${attempt}/${MAX_RETRIES})…`);

          let operation = await ai.models.generateVideos({
            model: veoModel,
            prompt: fullPrompt,
            config: { durationSeconds, aspectRatio, resolution },
          });

          const maxPolls = 30;
          let polls = 0;
          const startTime = Date.now();
          while (!operation.done && polls < maxPolls) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            sendEvent('video_progress', { message: `Generating video with ${veoModel}…`, elapsed, poll: polls + 1, maxPolls });
            console.log(`  Video SSE: polling (${polls + 1}/${maxPolls}), ${elapsed}s elapsed…`);
            await new Promise(r => setTimeout(r, 10000));
            operation = await ai.operations.getVideosOperation({ operation });
            polls++;
          }

          if (!operation.done) {
            throw new Error(`Video generation timed out after ${maxPolls * 10}s`);
          }

          const generatedVideos = operation?.response?.generatedVideos || [];
          const validVideo = generatedVideos.find(v => v && v.video);
          if (!validVideo) {
            const reason = operation?.response?.error?.message
              || (generatedVideos.length === 0 ? 'Veo returned an empty result — prompt may have been filtered' : 'Veo returned entries but none contained video data');
            throw new Error(reason);
          }

          sendEvent('video_progress', { message: 'Downloading video…', elapsed: Math.round((Date.now() - startTime) / 1000) });

          // Download to /tmp (writable on Vercel) with fallback to __dirname/videos
          let videosDir = '/tmp/videos';
          try {
            if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
          } catch (e) {
            videosDir = path.join(__dirname, 'videos');
            if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
          }

          const fileName = `video-${Date.now()}.mp4`;
          const downloadPath = path.join(videosDir, fileName);

          await ai.files.download({ file: validVideo.video, downloadPath });

          if (!fs.existsSync(downloadPath) || fs.statSync(downloadPath).size === 0) {
            throw new Error('Video file download succeeded but file is empty');
          }

          const fileSizeKB = (fs.statSync(downloadPath).size / 1024).toFixed(0);
          console.log(`✓ Video SSE saved: ${downloadPath} (${fileSizeKB} KB)`);

          // Read video as base64 data URL so the frontend can use it directly
          // (Vercel serverless has no persistent filesystem for serving static files)
          const videoBuffer = fs.readFileSync(downloadPath);
          const videoBase64 = videoBuffer.toString('base64');
          const videoDataUrl = `data:video/mp4;base64,${videoBase64}`;

          // Clean up temp file
          try { fs.unlinkSync(downloadPath); } catch (e) { /* ignore */ }

          sendEvent('video_complete', { videoDataUrl, fileSizeKB });
          success = true;
          break;

        } catch (err) {
          lastError = err;
          console.log(`  ✗ Video SSE: ${veoModel} attempt ${attempt} failed: ${err.message?.substring(0, 200)}`);
          if (attempt < MAX_RETRIES) {
            sendEvent('video_progress', { message: `Retrying ${veoModel}…`, retry: true });
            await new Promise(r => setTimeout(r, attempt * 5000));
          }
        }
      }
    }

    if (!success) {
      sendEvent('video_error', { message: lastError?.message || 'All Veo models failed after retries' });
      console.error('Video SSE failed:', lastError?.message);
    }

  } catch (error) {
    console.error('Video SSE unhandled error:', error.message);
    if (!res.writableEnded) {
      sendEvent('video_error', { message: error.message || 'Unknown error' });
    }
  } finally {
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// ══════════════════════════════════════════════════
// Regen a single image (for variations)
// ══════════════════════════════════════════════════
app.post('/api/regen-image', async (req, res) => {
  const sendEvent = createSse(res);
  try {
    const { prompt, mood, brandImageDataUrl } = req.body || {};
    if (!prompt || !mood) {
      sendEvent('error', { message: 'Missing prompt or mood' });
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    if (!ai) {
      sendEvent('error', { message: 'GenAI SDK not initialized — check GEMINI_API_KEY' });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const brandInline = parseDataUrl(brandImageDataUrl);
    const contents = [{
      role: 'user',
      parts: [
        { text: `Generate an interleaved output with EXACTLY this structure:\n1) TEXT: a 1-line label for the image (no markdown)\n2) IMAGE: one image\n\nMood: "${mood}"\nCreative direction:\n${prompt}\n\nThe IMAGE must strongly match the mood and creative direction.` },
        ...(brandInline ? [{ inlineData: brandInline }] : []),
      ],
    }];

    sendEvent('status', { message: 'Regenerating image...' });

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents,
      config: {
        // Some runs may not emit IMAGE-only parts reliably; request TEXT+IMAGE and extract the image part.
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.95,
        maxOutputTokens: 1024,
      },
    });

    const parts = result?.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p.inlineData && p.inlineData.data)?.inlineData;
    if (!img?.data) throw new Error('No image returned');

    const mimeType = img.mimeType || 'image/png';
    const dataUrl = `data:${mimeType};base64,${img.data}`;
    sendEvent('asset', { assetType: 'image', content: dataUrl, mimeType, index: 0 });
    sendEvent('complete', { assetCount: 1, hasImages: true });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Regen Image Error:', error.message);
    sendEvent('error', { message: error.message });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ══════════════════════════════════════════════════
// MAIN ENDPOINT: Generate interleaved campaign
// Uses Gemini's native TEXT+IMAGE responseModalities
// Returns Server-Sent Events stream
// ══════════════════════════════════════════════════
app.post('/api/generate-campaign', async (req, res) => {
  try {
    const {
      businessInfo,
      mood,
      mode = 'campaign', // campaign | storyboard
      channel = 'general',
      readingLevel = 'general', // simple | general | advanced
      bannedWords = '',
      autoRevise = true,
      brandImageDataUrl,
    } = req.body || {};

    if (!businessInfo || !mood) {
      return res.status(400).json({ error: 'Missing businessInfo or mood' });
    }
    if (!ai) {
      return res.status(500).json({ error: 'GenAI SDK not initialized — check GEMINI_API_KEY' });
    }

    const runId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const sendEvent = createSse(res);

    const bannedList = String(bannedWords || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 25);

    const brandInline = parseDataUrl(brandImageDataUrl);

    sendEvent('run', { runId });
    sendEvent('status', { message: 'Creative Director is thinking...' });
    sendEvent('step', { step: 'brief', message: 'Extracting brand brief...' });
    sendEvent('director_note', { message: 'I am extracting brand voice, audience, and constraints so the output feels like one cohesive creative direction.' });

    const briefPrompt = `Extract a structured brand brief from the user input. Return ONLY valid JSON with keys:
{
  "product": string,
  "audience": string,
  "primary_benefit": string,
  "differentiators": string[],
  "tone": string,
  "visual_style": string,
  "taboo_words": string[],
  "cta_goal": string
}

User input:
${businessInfo}

Campaign mood: ${mood}
Channel: ${channel}
Reading level: ${readingLevel}
Additional taboo words: ${bannedList.length ? bannedList.join(', ') : '(none)'}
`;

    const briefContents = [{
      role: 'user',
      parts: [
        { text: briefPrompt },
        ...(brandInline ? [{ inlineData: brandInline }] : []),
      ],
    }];

    const { text: briefText } = await generateText(ai, {
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: briefContents,
      temperature: 0.25,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
    });

    const briefJsonRaw = extractJsonBlock(briefText) || briefText;
    const briefJson = safeJsonParse(briefJsonRaw) || {};
    const tabooMerged = Array.from(new Set([...(briefJson.taboo_words || []), ...bannedList])).slice(0, 30);

    sendEvent('brief', { brief: briefJson, taboo_words: tabooMerged });
    sendEvent('step', { step: 'draft', message: 'Generating interleaved campaign (text + images)...' });

    const constraints = `CONSTRAINTS:
- Channel: ${channel}
- Reading level: ${readingLevel}
- Do NOT use taboo words: ${tabooMerged.length ? tabooMerged.join(', ') : '(none)'}
- Mood: ${mood}
`;

    const prompt = mode === 'storyboard'
      ? `You are producing a compact storyboard + voiceover for a marketing spot.

Brand brief (JSON):
${JSON.stringify({ ...briefJson, taboo_words: tabooMerged }, null, 2)}

${constraints}

Generate an INTERLEAVED stream in this exact order:
1) TEXT: Title + one-line positioning
2) TEXT: Shot list (4 shots). For each shot include: shot_name, camera, lighting, on-screen text, voiceover line.
3) IMAGE: Frame 1 storyboard image (Shot 1)
4) IMAGE: Frame 2 storyboard image (Shot 2)
5) IMAGE: Frame 3 storyboard image (Shot 3)
6) IMAGE: Frame 4 storyboard image (Shot 4)
7) TEXT: Final call to action (platform-appropriate for ${channel})

The images must look like one coherent campaign (same palette, lighting, art direction).`
      : `Create a complete marketing campaign for: ${businessInfo}

Brand brief (JSON):
${JSON.stringify({ ...briefJson, taboo_words: tabooMerged }, null, 2)}

${constraints}

Generate an interleaved flow of text and images:
1) TEXT: Start with a bold campaign title
2) TEXT: HOOK (1-2 sentences)
3) IMAGE: HERO IMAGE (professional, matches mood)
4) TEXT: STORYTELLING (2-3 sentences)
5) IMAGE: LIFESTYLE IMAGE (contextual, matches mood)
6) TEXT: CALL TO ACTION (1-2 sentences)

Make the text and images feel like one cohesive creative brief. Reference colors, lighting, and atmosphere consistently.`;

    // ── Models to try (with interleaved image support) ──
    const models = [
      'gemini-2.5-flash-image',
      'gemini-3.1-flash-image-preview',
    ];

    let result = null;
    let usedModel = null;

    for (const modelName of models) {
      try {
        console.log(`Trying ${modelName} with interleaved output...`);
        sendEvent('status', { message: `Connecting to ${modelName}...` });

        result = await ai.models.generateContent({
          model: modelName,
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              ...(brandInline ? [{ inlineData: brandInline }] : []),
            ],
          }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
        });

        usedModel = modelName;
        console.log(`✓ Success with ${modelName}`);
        break;
      } catch (err) {
        console.log(`✗ ${modelName} failed:`, err.message?.substring(0, 200));
        // If interleaved fails, try text-only as fallback
        if (modelName === models[models.length - 1]) {
          console.log('All interleaved models failed, trying text-only fallback...');
          sendEvent('status', { message: 'Generating text campaign...' });
          try {
            result = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.9,
                maxOutputTokens: 4096,
              },
            });
            usedModel = 'gemini-2.0-flash (text-only fallback)';
          } catch (fallbackErr) {
            throw new Error('All models failed: ' + fallbackErr.message);
          }
        }
      }
    }

    if (!result || !result.candidates || !result.candidates[0]) {
      throw new Error('No response from Gemini');
    }

    // ── Parse interleaved parts ──
    const parts = result.candidates[0].content.parts;
    const assets = [];
    let assetIndex = 0;

    sendEvent('status', { message: `Campaign generated via ${usedModel}` });
    sendEvent('model', { name: usedModel });

    for (const part of parts) {
      if (part.text) {
        // Text part
        assets.push({ type: 'text', content: part.text, index: assetIndex });
        sendEvent('asset', { assetType: 'text', content: part.text, index: assetIndex });
        assetIndex++;
      } else if (part.inlineData) {
        // Image part — Gemini natively generated this image
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${imageData}`;
        assets.push({ type: 'image', content: dataUrl, mimeType, index: assetIndex });
        sendEvent('asset', { assetType: 'image', content: dataUrl, mimeType, index: assetIndex });
        assetIndex++;
      }
    }

    // ── Agentic QA pass + optional auto-revision ──
    sendEvent('step', { step: 'qa', message: 'Quality-checking cohesion and compliance...' });
    sendEvent('director_note', { message: 'I am reviewing cohesion (tone + visuals) and checking constraints before finalizing.' });

    const qaPrompt = `You are a strict Creative Director QA reviewer.
Return ONLY valid JSON:
{
  "cohesion_score": number,
  "compliance_score": number,
  "issues": string[],
  "suggested_fixes": string[]
}

Context:
- Mood: ${mood}
- Channel: ${channel}
- Reading level: ${readingLevel}
- Taboo words: ${tabooMerged.length ? tabooMerged.join(', ') : '(none)'}

Assets (ordered):
${assets.map((a, idx) => a.type === 'text' ? `Asset ${idx + 1} [TEXT]:\n${a.content}` : `Asset ${idx + 1} [IMAGE]: (AI-generated image)`).join('\n\n---\n\n')}
`;

    const { text: qaText } = await generateText(ai, {
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: [{ role: 'user', parts: [{ text: qaPrompt }] }],
      temperature: 0.2,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
    });
    const qaJsonRaw = extractJsonBlock(qaText) || qaText;
    let qa = safeJsonParse(qaJsonRaw);
    const isValidJsonQa =
      qa &&
      typeof qa.cohesion_score === 'number' &&
      typeof qa.compliance_score === 'number' &&
      Array.isArray(qa.issues) &&
      Array.isArray(qa.suggested_fixes);

    if (!isValidJsonQa) {
      qa = computeHeuristicQa(assets, tabooMerged);
    }
    sendEvent('qa', qa);

    let finalAssetCount = assets.length;
    const shouldRevise =
      Boolean(autoRevise) &&
      typeof qa.cohesion_score === 'number' &&
      qa.cohesion_score < 8 &&
      Array.isArray(qa.suggested_fixes) &&
      qa.suggested_fixes.length > 0;

    if (shouldRevise) {
      sendEvent('step', { step: 'revise', message: 'Auto-revising based on QA feedback...' });
      sendEvent('director_note', { message: 'Applying QA fixes now and regenerating the campaign to improve cohesion.' });

      const revisePrompt = `Revise the campaign using these QA fixes while keeping the same mood and constraints.

Brand brief (JSON):
${JSON.stringify({ ...briefJson, taboo_words: tabooMerged }, null, 2)}

${constraints}

QA suggested fixes:
${qa.suggested_fixes.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Regenerate the full interleaved flow again (TEXT + IMAGE) in the same structure as before.`;

      const reviseResult = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{
          role: 'user',
          parts: [
            { text: revisePrompt },
            ...(brandInline ? [{ inlineData: brandInline }] : []),
          ],
        }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.85,
          maxOutputTokens: 4096,
        },
      });

      const revisedParts = reviseResult?.candidates?.[0]?.content?.parts || [];
      sendEvent('replace_all', { reason: 'Auto-revision applied' });

      let idx = 0;
      for (const part of revisedParts) {
        if (part.text) {
          sendEvent('asset', { assetType: 'text', content: part.text, index: idx++ });
        } else if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          sendEvent('asset', { assetType: 'image', content: dataUrl, mimeType, index: idx++ });
        }
      }
      finalAssetCount = idx;

      // Re-run QA after revision so the client has fresh scores
      const revisedQa = computeHeuristicQa(
        revisedParts.map((p, i) => {
          if (p.text) return { type: 'text', content: p.text };
          if (p.inlineData) return { type: 'image', content: '(image)' };
          return null;
        }).filter(Boolean),
        tabooMerged
      );
      sendEvent('qa', revisedQa);
    }

    sendEvent('complete', { 
      assetCount: finalAssetCount, 
      model: usedModel,
      hasImages: assets.some(a => a.type === 'image'),
      mood 
    });
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Generation Error:', error.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ event: 'error', message: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ══════════════════════════════════════════════════
// AGENT REFINEMENT ENDPOINT
// Multi-turn chat for iterating on campaigns
// ══════════════════════════════════════════════════
app.post('/api/refine-campaign', async (req, res) => {
  try {
    const { history, refinement } = req.body;

    if (!refinement || !ai) {
      return res.status(400).json({ error: 'Missing refinement instruction or SDK not ready' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendEvent = (event, data = {}) => {
      res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
    };

    sendEvent('status', { message: 'Creative Director is refining...' });

    // Build conversation history for multi-turn refinement
    const contents = [];
    if (history && Array.isArray(history)) {
      for (const turn of history) {
        contents.push({
          role: turn.role,
          parts: turn.parts.map(p => {
            if (p.type === 'text') return { text: p.content };
            return { text: p.content }; // For images in history, reference them as text
          })
        });
      }
    }

    // Add the refinement request
    contents.push({
      role: 'user',
      parts: [{ text: `Refine the campaign based on this feedback: ${refinement}\n\nGenerate updated text and images that address this feedback while maintaining the same mood and brand.` }]
    });

    const models = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];
    let result = null;

    for (const modelName of models) {
      try {
        result = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.8,
            maxOutputTokens: 4096,
          },
        });
        break;
      } catch (err) {
        console.log(`Refine: ${modelName} failed, trying next...`);
        if (modelName === models[models.length - 1]) {
          // Text-only fallback
          result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.8,
              maxOutputTokens: 4096,
            },
          });
        }
      }
    }

    if (!result?.candidates?.[0]) {
      throw new Error('No refinement response');
    }

    const parts = result.candidates[0].content.parts;
    let idx = 0;
    for (const part of parts) {
      if (part.text) {
        sendEvent('asset', { assetType: 'text', content: part.text, index: idx++ });
      } else if (part.inlineData) {
        const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        sendEvent('asset', { assetType: 'image', content: dataUrl, index: idx++ });
      }
    }

    sendEvent('complete', { assetCount: idx });
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Refinement Error:', error.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ event: 'error', message: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ── 404 ──
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Global error handler — always return JSON, never HTML ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error', message: err.message || 'Unknown error' });
});

// ── Start (only when NOT on Vercel — Vercel imports the module directly) ──
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const platform = process.env.K_SERVICE ? `Google Cloud Run (${process.env.K_SERVICE})` : 'local';
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🎨 Direct-to-Mood Marketing Studio v2                    ║
║  ── Interleaved Multimodal Campaign Generator ──          ║
║                                                            ║
║  Status: Running ✓                                         ║
║  Port: ${String(PORT).padEnd(49)}║
║  Platform: ${platform.padEnd(45)}║
║  SDK: @google/genai (Gemini native)                        ║
║                                                            ║
║  Features:                                                 ║
║  • Native TEXT + IMAGE interleaved output                  ║
║  • Server-Sent Events streaming                            ║
║  • Agent refinement loop (multi-turn chat)                 ║
║  • Creative Director system instruction                    ║
║  • Veo video generation with retry logic                   ║
║                                                            ║
║  Endpoints:                                                ║
║  • GET  /api/health                                        ║
║  • POST /api/generate-campaign  (SSE stream)               ║
║  • POST /api/refine-campaign    (SSE stream)               ║
║  • POST /api/generate-video     (SSE stream)               ║
║                                                            ║
║  API Key: ${(process.env.GEMINI_API_KEY ? '✓ Configured' : '✗ Missing').padEnd(45)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

process.on('SIGTERM', () => { console.log('SIGTERM → shutdown'); process.exit(0); });
process.on('SIGINT', () => { console.log('SIGINT → shutdown'); process.exit(0); });

module.exports = app;
