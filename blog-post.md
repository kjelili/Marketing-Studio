How I Built an AI Creative Director with Google Gemini and Google Cloud

Disclosure: I created this project and this blog post for the purposes of entering the #GeminiLiveAgentChallenge hackathon hosted by Google and Devpost. If you are reading this on social media, follow the conversation at #GeminiLiveAgentChallenge.

---

There is a gap in the AI creative tooling space that bothers me.

A small business owner who wants a marketing campaign today has to open ChatGPT for copy, switch to Midjourney for images, hop over to Canva for layout, then use yet another tool for video. Four tools, four different creative contexts, four outputs that do not feel like they belong to the same brand. The copy says "luxury." The image screams "budget." The video feels like it was made by a different company entirely.

I wanted to build what a human creative director actually does — hold the entire campaign in their head, generate text and visuals that reference each other, critique the work, and iterate until everything feels cohesive. Except this creative director runs on Google Gemini and deploys on Google Cloud, and it does the job in thirty seconds instead of thirty hours.

This is the story of how I built Direct-to-Mood Marketing Studio.


The Core Idea: Interleaved Multimodal Generation

Most AI apps that combine text and images do it sequentially. Generate the text. Take a piece of that text. Feed it to an image model. Stitch the results together. The problem is that the image model has no awareness of the broader campaign context — it only sees the snippet you gave it.

Google Gemini changes this with native interleaved output. When you call generateContent with responseModalities set to [TEXT, IMAGE], Gemini does not generate text first and images second. It generates them together, in an alternating stream, where each image is produced while the model still holds the full text context in memory. The hero image is literally born from the same creative thread as the hook that precedes it.

This is the foundation of Direct-to-Mood Marketing Studio. One API call. One creative context. Text and images woven together, not stitched after the fact.


The Agentic Architecture

A single prompt, no matter how well-crafted, produces inconsistent results. My first prototype was a single Gemini call that generated an entire campaign. It worked, but the quality varied wildly. Some campaigns were brilliant. Others had mismatched tone between text and images, or included words the client wanted to avoid.

The solution was to make the app agentic — not just a prompt wrapper, but a multi-step reasoning system that plans, executes, evaluates, and revises.

Here is the pipeline I built:

Step 1 — Brief Extraction. The user describes their business and optionally uploads a logo. Gemini 2.5 Flash analyzes the input and extracts a structured brand brief: target audience, brand voice, color palette, tone, and constraints. If a logo is uploaded, it is sent as inline image data so Gemini can incorporate the brand's visual identity from the start.

Step 2 — Interleaved Draft. The brief feeds into a second Gemini call, this time using gemini-2.5-flash-image with both TEXT and IMAGE modalities enabled. The Creative Director system prompt instructs Gemini to generate a hook, then a matching hero image, then storytelling copy, then a lifestyle image, then a call to action — all in one interleaved stream. The user watches assets materialize in real-time through Server-Sent Events.

Step 3 — QA Scoring. A third Gemini call evaluates the generated campaign. It scores cohesion (do the assets feel like one unified campaign?) and compliance (does the copy respect the channel, reading level, and taboo word constraints?). It returns numerical scores, a list of issues, and suggested fixes.

Step 4 — Auto-Revision. If the cohesion score falls below 8 out of 10, the pipeline automatically regenerates the campaign with the QA agent's suggested fixes baked into the prompt. This happens transparently — the user just sees better output.

Step 5 — Video Generation. Once the text and image assets are finalized, the app automatically calls Gemini's Veo 3.1 model through the generateVideos API to produce an 8-second cinematic video clip. The video generates asynchronously, and the frontend shows progress updates until the MP4 is ready.

Every step is a separate Gemini API call with a distinct role. The brief extractor is an analyst. The drafter is a creative. The QA scorer is a critic. The reviser is an editor. The video generator is a cinematographer. Together, they form a creative team.


Building with the @google/genai SDK

I used Google's official @google/genai Node.js SDK rather than raw REST calls. This made a significant difference in development speed.

For text and image generation, the SDK provides generateContent with a config object where you specify responseModalities. Setting it to [Modality.TEXT, Modality.IMAGE] is all it takes to unlock interleaved output. The response comes back as an array of parts — some with text, some with inlineData containing base64-encoded images. Parsing is straightforward.

For video generation, the SDK provides generateVideos, which returns an operation object that you poll until completion. Once done, you download the MP4 using the files.download method. I store the video in a local directory and serve it through Express static file serving.

For multimodal input, the SDK accepts inlineData parts in the request contents. When a user uploads a brand logo, the frontend converts it to a base64 data URL, sends it to the backend, and the backend includes it as an image part alongside the text prompt. Gemini sees both the text description and the visual brand identity simultaneously.

One thing I learned: always request [Modality.TEXT, Modality.IMAGE] together, even when you only want an image. Requesting Modality.IMAGE alone is unreliable — Gemini sometimes returns nothing. Requesting both and extracting the image part from the response is far more consistent.


Deploying on Google Cloud Run

The backend is a single Node.js/Express server packaged in a Docker container and deployed to Google Cloud Run in the europe-west1 region.

Cloud Run was the right choice for several reasons. The app has no persistent state — every API call is ephemeral, so the stateless container model fits perfectly. Cloud Run scales to zero when there is no traffic, which keeps costs near zero for a hackathon demo. And deployment is a single command: gcloud run deploy with the source flag handles the Docker build, push, and deployment automatically.

The health endpoint at /api/health detects whether it is running on Cloud Run by checking for the K_SERVICE environment variable that Google injects automatically. This provides verifiable proof of cloud deployment without any manual configuration.

I also deployed to Vercel as a secondary option using their serverless function routing. The vercel.json configuration maps API routes to server.js and serves the frontend from index.html. Having two independent deployments provides redundancy and demonstrates that the architecture is platform-agnostic.

Live deployments:
- Google Cloud Run: https://gcloud-830001350094.europe-west1.run.app
- Vercel: https://marketing-studio-jade.vercel.app/


The Frontend: One File, No Build Step

The entire frontend is a single index.html file using React 18 (standalone UMD build), Babel Standalone for in-browser JSX transpilation, and Tailwind CSS from CDN. There is no build step, no webpack, no bundler.

This was a deliberate choice. For a hackathon demo, the ability to clone the repo, run npm start, and have everything work immediately is more valuable than TypeScript or module bundling. The trade-off is acceptable.

The frontend parses the Server-Sent Events stream from the backend and renders assets as they arrive. It also provides per-asset controls — regenerate any image individually, refine any text with natural language feedback, share individual assets to social media via the Web Share API, and download the entire campaign as a zip bundle using JSZip.

For voiceover, I use the browser's native Web Speech API. When the user clicks "Play Video with Full Narration," the app simultaneously plays the Veo-generated video (muted) and speaks the campaign text through SpeechSynthesisUtterance. This guarantees the narration always completes — unlike relying on Veo's internal audio, which can truncate.


Challenges and Solutions

Gemini's JSON reliability. Even when you set responseMimeType to application/json, Gemini occasionally wraps the response in markdown code fences. I built an extractJsonBlock utility that strips fences and finds the JSON object within any string, plus a safeJsonParse wrapper that never throws. Together with a heuristic QA fallback for when parsing fails entirely, the app handles malformed AI output gracefully.

Veo's voiceover limitation. Veo 3.1 generates beautiful cinematic video, but its internal speech synthesis cannot be precisely controlled for pacing or completeness. Long scripts get cut off. The solution was to generate the video without spoken dialogue — just visuals and ambient atmosphere — and layer browser-controlled narration on top. This hybrid approach gives us stunning AI-generated visuals with guaranteed-complete voiceover.

Rate limit retry storms. When the Veo API returns a 429 rate limit error, the React useEffect that auto-triggers video generation would re-fire because the failure reset the loading state, re-satisfying the trigger conditions. I added a videoAttempted flag so auto-generation fires exactly once per campaign, with a manual retry button available if the user wants to try again later.

Image regeneration. Requesting only IMAGE modality from generateContent is unreliable. The fix was to always request [TEXT, IMAGE] and ask Gemini for a short label followed by an image. Then extract just the image part from the response. This pattern works consistently.


What Google AI Models Power This App

Gemini 2.5 Flash — Used for brief extraction, QA scoring, auto-revision reasoning, and multi-turn refinement. Chosen for its speed and structured output capabilities.

Gemini 2.5 Flash Image — Used for interleaved TEXT + IMAGE generation. This is the core creative engine that produces campaigns where text and visuals are contextually entangled.

Veo 3.1 (veo-3.1-generate-preview) — Used for cinematic video clip generation. Produces 8-second marketing spots with professional-grade visuals.

All three models are accessed through the @google/genai SDK, deployed on Google Cloud Run, and callable from a single Express server.


What I Would Build Next

Brand memory. Right now every campaign starts fresh. Adding persistent brand profiles would let the Creative Director remember your logo, past campaigns, and audience preferences across sessions.

A/B variant generation. Generate multiple mood variants of the same campaign side by side — "Show me this in Warm and in Energetic" — then pick the winner.

Gemini Live voice integration. Replace the text input with a real-time voice conversation where you describe your business by talking and get creative direction spoken back.

Direct publishing. One-click export to Meta Business Suite, TikTok Creative Center, LinkedIn Campaign Manager, and YouTube Studio via their APIs.


Try It Yourself

The app is live and free to use:

Google Cloud Run: https://gcloud-830001350094.europe-west1.run.app
Vercel: https://marketing-studio-jade.vercel.app/
GitHub: https://github.com/kjelili/Marketing-Studio

Describe your business, pick a mood, click Generate, and watch your AI Creative Director build a complete campaign — copy, images, and video — in thirty seconds.

---

This project was built for the #GeminiLiveAgentChallenge. It demonstrates real-time, agentic, multimodal generation using Google Gemini models deployed on Google Cloud Run. No mockups. No hardcoded responses. Every asset is generated live by Google AI.

#GeminiLiveAgentChallenge #GoogleCloud #GeminiAPI #Veo #AI #Marketing #CreativeDirector #Hackathon
