# Implementation Plan: GradingAI Frontend Integration & Real Engine Wiring

## Overview
This plan details the full integration of the `grader-ai` demo site with the authoritative `grading_agent` FastAPI backend running locally and exposed via Cloudflare Tunnel. 

## Objectives & Scope

### 1. Cloudflare Tunnel Ingress Configuration
- Verify and maintain `agent.sanskaraai.com` -> `http://localhost:8000`.
- Add `grading.sanskaraai.com` -> `http://localhost:8000` to `/etc/cloudflared/config.yml` before the catch-all `http_status:404` rule.
- Reload `cloudflared` service and verify `/api/health` returns `{"status":"ok"}`.

### 2. Synthetic Asset Generation
- Script: `grader-ai/scripts/generate_synthetic_assets.py` using PIL (Pillow).
- Question Paper (`grader-ai/static/assets/synthetic_question_paper.png`):
  - Header: `PHYSICS — INTERNAL ASSESSMENT`, `Max Marks: 10`, `Time: 40 min`
  - Q1 (3 marks): Newton's second law of motion definition and formula ($F = ma$).
  - Q2 (4 marks): Uniform acceleration calculation (0 -> 20 m/s in 5s; find acceleration $a$ and distance $s$).
  - Q3 (3 marks): Law of conservation of energy with an example.
- Answer Script (`grader-ai/static/assets/synthetic_answer_script.png`):
  - Legible handwritten-style layout answering Q1, Q2, Q3 correctly with step-by-step working.
- No fixture/SSB images copied from `grading_agent`.

### 3. Engine Verification & Smoke Test
- Run synthetic assets through `POST /api/parse` (`mode="exam"`) and expect 3 questions extracted.
- Run through `POST /api/grade` and expect total marks > 0, score breakdown, and base64 PNG annotated image.
- Execute dual run to confirm determinism (spread 0.0 marks difference).
- Capture payload response to `grader-ai/static/data/live_demo_fallback.json`.

### 4. Frontend Rewiring (`grader-ai/static/`)
- Clean up unused dead backend in `grader-ai/app/`.
- Update Landing Page (`index.html`): Link all primary CTAs ("See Live Demo", "Watch the Live Demo") directly to the interactive live grading app.
- Update App & Logic (`demo.html`, `app.js`, `styles.css`):
  - Allow visitors to either choose pre-loaded synthetic exam paper/script OR upload custom question paper & answer script.
  - Call `/api/parse` and `/api/grade` endpoints asynchronously.
  - Display real annotated base64 PNG image returned by backend engine.
  - Render actual per-question scores, confidence, card markdown, and total marks.
  - Query parameter support: `?engine=` to allow switching backend URL (default: `https://agent.sanskaraai.com` / `https://grading.sanskaraai.com`, fallback to `http://localhost:8000`).
  - Client-side guards: File size limit (<= 15MB), image MIME type checking, dual-file requirement, disabled busy states, 8-second request timeout.
  - Sample Data Walkthrough banner on canned view.

### 5. Offline Fallback
- If the live backend or tunnel is unreachable, automatically fall back to `live_demo_fallback.json`.
- Render a warning banner: `"Offline — showing last real result"` while ensuring the site remains fully operational.

### 6. Documentation
- Update `README.md` in `grader-ai/` with repo architecture, live flow, tunnel configuration, offline fallback mechanisms, determinism details, and security policies.

### 7. Version Control & Verification
- Clean, granular git commits in `grader-ai` repo per stage.
- End-to-end testing of real uploads, rendering, and fallback behavior.
