# GradingAI Demo & Live Engine Integration

Cloudflare Pages static frontend for **GradingAI Co-Pilot** — AI-powered exam paper correction for Indian schools & colleges.

## Overview & Architecture

`grader-ai` is built as a zero-latency static web application served via Cloudflare Pages. It directly interfaces with the authoritative `grading_agent` FastAPI backend engine running on localhost / Cloudflare Tunnel.

### File Structure

```text
grader-ai/
├── README.md                           # Architecture and operations documentation
├── wrangler.toml                       # Cloudflare Pages deployment configuration
├── scripts/
│   └── generate_synthetic_assets.py   # Script generating 10-mark Physics exam paper & student answer sheet
└── static/
    ├── index.html                      # Primary landing page with ROI calculator & CTAs
    ├── live.html                       # Live AI Grading page interfacing with real engine / fallback
    ├── live.js                         # Engine API caller (parse, grade, override), guards & fallback handler
    ├── live.css                        # Glassmorphism design system for live grading interface
    ├── demo.html                       # 4-level enterprise multi-stakeholder guided walkthrough
    ├── app.js                          # State manager for guided walkthrough
    ├── landing.css / styles.css        # Core landing & canvas stylesheets
    ├── assets/                         # Synthetic Physics exam assets & PDF deck
    └── data/
        ├── demo.json                   # Sample walkthrough dataset
        └── live_demo_fallback.json     # Last real engine snapshot fallback
```

---

## Live Engine Integration & Data Flow

1. **User Input / Preset**:
   Visitors can upload custom Question Paper & Answer Script images (≤15MB, valid image type) or load the synthetic Physics assessment preset (`/assets/synthetic_question_paper.png` and `/assets/synthetic_answer_script.png`).
2. **Parsing (`POST /api/parse`)**:
   Sends session ID and Question Paper image to extract total questions (e.g. 3 questions in Physics paper).
3. **Grading (`POST /api/grade`)**:
   Sends session ID and Student Answer Script image. Receives:
   - Base64-encoded annotated PNG image featuring drawn vector ticks and margin comments.
   - Question-by-question marks breakdown, confidence scores, and rubric evidence matches.
   - Formatted Markdown report card summary.
4. **Engine URL Override**:
   Override the target backend engine using the `?engine=` URL parameter:
   ```text
   https://grader.sanskaraai.com/live.html?engine=http://localhost:8000
   ```
   Default production endpoints: `https://agent.sanskaraai.com` and `https://grading.sanskaraai.com`.

---

## Determinism & Temperature Guarantee

The underlying engine (`grading_agent`) calls Gemini with fixed `temperature=0.0` and `seed=42`. This guarantees **0.0 mark spread** and deterministic, reproducible marks across consecutive evaluations of the exact same script.

---

## Offline Fallback Mechanism

If the live engine or Cloudflare tunnel is unreachable or times out (>15s):
- The frontend gracefully activates **Offline Fallback Mode**.
- Renders the snapshot saved in `static/data/live_demo_fallback.json`.
- Displays a notice banner: `⚠️ Live Backend Engine Offline — Showing verified offline evaluation snapshot`.
- Prevents dead errors or broken UI.

---

## Security & Secrets Policy

> [!IMPORTANT]
> **NO SECRETS** (such as `BOT_TOKEN` or `GEMINI_API_KEY`) are permitted inside `grader-ai`.
> All secrets remain strictly isolated inside `/home/puneeth/programmes/grading_agent/backend/.env`.
