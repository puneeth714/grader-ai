# GradingAI Frontend Integration — Full Demo (plan + implement)

You are the builder. Own the PLAN and the IMPLEMENTATION for wiring the grader-ai demo site to the real grading backend. Write your plan first (markdown, saved into grader-ai/.hermes/plans/), then execute it, then verify every gate yourself. Ask no questions; make reasonable decisions inline. If you hit a command that needs root/sudo and it is NOT available, note it and continue with what you can.

## The two repos

1. `grader-ai`  — /home/puneeth/programmes/grader-ai — the DEMO SITE. Static Cloudflare Pages build (wrangler.toml → static/). Currently contains: landing page (static/index.html), interactive canned demo (static/demo.html + static/app.js fetching /data/demo.json — ALL FAKE DATA: hardcoded 15/20 score, hardcoded annotation boxes, hand-written rubric), and an unused FastAPI backend (app/main.py serving canned sample_data — the frontend never calls it).
2. `grading_agent` — /home/puneeth/programmes/grading_agent — the REAL ENGINE (FastAPI, live on this Pi at 127.0.0.1:8000). This is the authoritative backend. DO NOT EDIT OR COMMIT IN grading_agent unless explicitly listed below. It is already committed and running. It uses Gemini with temperature=0.0 and seed=42 → DETERMINISTIC marks (spread 0.0 proven).

## Verified facts (trust these, don't re-research)

- Engine API (multipart form, CORS allow_origins=["*"] ALREADY SET at backend/app/api.py:36 — frontend can call it cross-origin, no engine change needed for CORS):
  - POST /api/parse — fields: session_id, mode ("exam"|"ppdt"), image (file) → {exam: {...}, questions_count, session_id, paper_id}
  - POST /api/grade — fields: session_id, image (file) → {grade: {...}, image: base64-PNG, card: string, session_id}
  - POST /api/override — JSON {session_id, label, final_marks} → {final_marks, diff}
  - GET /api/health → {"status":"ok"}
- Engine validation: content-type + ≤15MB + decompression cap, fail-closed admin gate; it is PUBLIC (no auth) — fine for demo, do not advertise.
- Tunnel: /etc/cloudflared/config.yml (tunnel 26a0c389-629f-4f2d-9593-ed7852a9a057) currently maps agent.sanskaraai.com → localhost:8000. grading.sanskaraai.com returns 1014 (no ingress rule). DNS for grading.sanskaraai.com resolves (Cloudflare-proxied).
- Demo assets source-of-truth: tests/fixtures in grading_agent are PPDT/SSB images — NEVER copy them into grader-ai. Generate NEW synthetic exam images instead.
- The demo site's own backend/app/main.py is DEAD CODE today. Decide: either delete it (leaner + avoids confusion), keep as mock, or wire it — your call, but the frontend data source must be the REAL engine.

## Scope — make all of this work end-to-end

1. Tunnel: add ingress rule so the grader API is reachable publicly at the machine or protocol-correct domain (default: add `- hostname: grading.sanskaraai.com` → `service: http://localhost:8000` BEFORE the authorizing `http_status:404` catch-all; you may replace or keep agent.sanskaraai.com — default KEEP both). Reload tunnel (cloudflared tunnel reload — if permission denied, tell the user to run it; do not force-restart the whole tunnel if avoidable). Verify /api/health returns ok via both domains.
2. Demo assets: create synthetic question paper + answer script images (Pillow) for a 3-question, 10-mark physics paper (Q1 3 marks Newton's second law, Q2 4 marks acceleration 0→20 m/s in 5 s, Q3 3 marks conservation of energy). Header: PHYSICS — INTERNAL ASSESSMENT, Max Marks: 10, Time: 40 min. Answer sheet: handwritten-style correct answers (legible; slanted font if available). Save under grader-ai/static/assets/ with a generator script in grader-ai/scripts/. NO SSB fixture images anywhere.
3. Smoke-test the real engine on those assets via the (public) tunnel URL from step 1: parse → expect 3 questions, mode=exam; grade → expect total_suggested > 0, non-empty base64 image; run grade twice and compare totals (must match — deterministic).
4. Frontend integration — the CORE REQUIREMENT: rewire the demo frontend so the canned fake path is replaced/аugmented by the REAL backend:
   - Implement it how you see fit, but the end result MUST: let a visitor upload (or pick) a question paper + answer script, call real /api/ + /api/grade, and render the REAL annotated image (base64 PNG) + real per-question marks with reasons.
   - Update ALL landing CTA mains pointing to "See Live Demo"/"Watch the Live Demo" so they path the live integration (keep the old demo.html only as a guided walkthrough/sample-data page, clearly banner-marked as sample data). Decision: add grounded.html (or rewire demo.html in place) — your call — but sample-data demo must link prominently to the live grading page.
   - Keep an engine URL override via ?engine= query param (allow localhost:8000 during dev).
   - Client-side guards: file ≤15MB, image content-type, both files required, disable button while busy, 8s timeout.
5. Offline fallback: when the engine/tunnel is unreachable, render the last real result from a restructured static fallback (grader/static/data/live_demo_fallback.json) with a banner "Offline — showing last real result". Never a dead error.
6. Docs: update grader/reade.md (structure, live flow, tunnel dependency, offline fallback, determinism note, security: never put BOT_TOKEN/GEMINI_API_KEY in grader-ai; .env stays in grading_agent).
7. Commit everything in grader-ai with clean commits per concern. NO commits/edits in grading_agent except (a) if tunnel reload impossible and handled via the user, nothing; (b) if you MUST restart the engine service, use `systemctl restart` for it after confirming its unit name (list with systemctl --no-pager | grep -iE 'grad|exam|correction' or ps aux | grep python), and verify /api/health — the engine's restart must not be left broken.

## Hard constraints

- NEVER echo BOT_TOKEN, GEMINI_API_KEY, or other secrets. They live only in grading_agent/backend/.env. Nothing secret may be committed into grader-ai.
- NEVER copy or reference /home/puneeth/programmes/grading_agent/backend/tests/fixtures (PPDT/SSB images) into grader-ai. (No PPDT/SSB content anywhere in the demo by default.)
- Do not disturb the live engine except a deliberate, verified restart (see scope 7b).
- ai's grader domain — do NOT touch other hosts in /etc/cloudflared/config.yml (other sansk/ai services live behind the same tunnel).
- Deterministic engine — the demo shows real, reproducible grades; the frontend must not round/hide/mangle them.
- Verify with the tools you're allowed to run (curl/python). Final acceptance = real uploaded answer yields a real annotated image + honest marks, repeatably.

Off you go: save your plan, implement, verify, report what you did with exact commit hashes and test outputs.