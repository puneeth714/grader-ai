# GradingAI Live Demo — Wire Real Engine into grader-ai (Phase 2)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn the `puneeth714/grader-ai` demo site into a REAL live demo — upload a question paper + answer script, get an actual Gemini grade with annotations — while keeping the static landing/demo pages working offline and NOT exposing Puneeth's SSB test images.

**Architecture:** The grading engine (`grading_agent/backend`, FastAPI) is already running on the Pi at 127.0.0.1:8000 and publicly reachable via the existing Cloudflare tunnel at `https://agent.sanskaraai.com` (confirmed: `GET /api/health` → `{"status":"ok"}`). The demo site is a static Cloudflare Pages build (`wrangler.toml` → `static/`). We add a new `live.html` that talks to the engine directly from the browser (multipart POST + CORS is already `allow_origins=["*"]`). The question/answer images for the demo are NEW synthetic exam content — a proper Physics/History descriptive paper — never Puneeth's PPDT/SSB fixture photos.

**Tech Stack:** HTML/CSS/vanilla JS (matches existing static site), FastAPI engine (existing), Cloudflare Pages + existing tunnel, no new dependencies.

---

## Current Context / Assumptions

- `grader-ai` repo cloned at `/home/puneeth/programmes/grader-ai`; HEAD `52f9d3c`; deploys via `wrangler pages deploy static --project-name exam-correction-mvp`.
- Engine API (multipart form fields):
  - `POST /api/parse` — fields `session_id`, `mode` (`exam`|`ppdt`), `image` (file). Returns `{exam: {...}, questions_count, session_id, paper_id}`.
  - `POST /api/grade` — fields `session_id`, `image` (file). Returns `{grade: {...}, image: <base64 PNG>, card: <text>, session_id}`. Grade JSON includes per-question `label`, `suggested_marks`, `max_marks`, `ai_reason`, `confidence`, `rubric_hits`, and normalized bbox `(x,y,w,h)` per question.
  - Engine validates uploads (content-type + 15MB + decompression cap) and is fail-closed on admin gate — but CORS `allow_origins=["*"]` is already set, so the browser demo needs no auth. The engine uses `temperature=0.0` + `seed=42` → deterministic marks (proven spread 0.0 on fixtures).
- Tunnel: `agent.sanskaraai.com` → `http://localhost:8000` (confirmed live). `wrangler.toml` is static-only; live.html calls the tunnel URL directly from the browser.
- SECURITY RULE: `BOT_TOKEN` / `GEMINI_API_KEY` / `.env` never leave `grading_agent`; nothing secret is committed to `grader-ai`. The live page calls the engine's public API — no keys in the frontend.
- NO-SSB RULE: do not copy `tests/fixtures/question_paper.jpg` / `answer_script.jpg` (Puneeth's PPDT/SSB images) into `grader-ai`. Demo uses NEW synthetic exam images (below).

---

## Step-by-Step Plan

### Task 1: Generate demo question paper + answer script images (non-SSB, non-PPDT)

**Objective:** Create 2-3 realistic synthetic exam images (a 3-question Physics descriptive paper and a matching handwritten answer sheet) that the live demo can parse and grade — no SSB photos.

**Files:**
- Create: `grader-ai/scripts/gen_demo_assets.py` (or use ImageMagick/PIL inline; keep under `scripts/`)
- Output: `grader-ai/static/assets/demo_qp.png` (question paper), `grader-ai/static/assets/demo_ans.png` (answer script)

**Step 1: Write the generator script (PIL).**
Question paper content — 3 questions, max 10 total:
- Q1 (3): "Define Newton's second law and give its equation."
- Q2 (4): "A car accelerates from rest to 20 m/s in 5 s. Find its acceleration."
- Q3 (3): "State the law of conservation of energy with one example."
Render as a clean printed-style page (black text on white, a header "PHYSICS — INTERNAL ASSESSMENT", a "Max Marks: 10" line).

Answer script content — a slightly messy handwritten-style answer set: correct second-law statement, correct acceleration calculation with final "4 m/s²", a short conservation example. Render with a handwriting-ish font if available (`DejaVuSans` slant) or clear print — the demo goal is a gradeable image, not perfect cursive.

**Step 2: Run it.**
Run: `python3 grader-ai/scripts/gen_demo_assets.py` (venv with PIL — reuse `grading_agent/../venv` or a system pillow).
Expected: two PNGs created under `static/assets/`.

**Step 3: Commit.**
```bash
cd /home/puneeth/programmes/grader-ai
git add scripts/gen_demo_assets.py static/assets/demo_qp.png static/assets/demo_ans.png
git commit -m "demo: add synthetic physics question paper + answer script assets"
```

**Verification:** open both PNGs; confirm question paper is legible and answer sheet is gradeable (3 answers present, ~10 marks of content).

---

### Task 2: Verify live parse + grade on the new images (against the public tunnel)

**Objective:** Prove the engine returns a real, deterministic grade for the NEW demo images before touching the site.

**Files:**
- (none new — curl only, or a small throwaway script under `/tmp`)

**Step 1: Parse the demo question paper via the public tunnel.**
Run:
```bash
curl -s -X POST https://agent.sanskaraai.com/api/parse \
  -F "session_id=live_demo" -F "mode=exam" \
  -F "image=@/home/puneeth/programmes/grader-ai/static/assets/demo_qp.png"
```
Expected: HTTP 200, JSON with `questions_count: 3`, `exam.questions[].label` ≈ Q1/Q2/Q3, `exam.mode == "exam"`, no PPDT headings.

**Step 2: Grade the demo answer script.**
Run:
```bash
curl -s -X POST https://agent.sanskaraai.com/api/grade \
  -F "session_id=live_demo" \
  -F "image=@/home/puneeth/programmes/grader-ai/static/assets/demo_ans.png" -o /tmp/demo_grade.json
```
Expected: HTTP 200, `grade.total_suggested > 0`, `image` is a non-trivial base64 PNG, `card` is a formatted text card.

**Step 3: Determinism spot-check (2 runs).**
Run the grade curl twice; parse `grade.total_suggested` from both JSONs.
Expected: identical totals (temperature=0).

**Step 4: Commit nothing (verification only).** Record the observed totals in the plan notes / PR description.

**Verification:** parse returns 3 questions; grade returns a sensible total (e.g., 7-10/10); two runs agree.

---

### Task 3: Add `live.html` — upload → real grade → annotated image + card

**Objective:** A static page (deploys with Pages) that sends the user's two images to the engine and renders the returned annotated PNG + per-question marks + reasons.

**Files:**
- Create: `grader-ai/static/live.html`
- Create: `grader-ai/static/live.css` (reuse `styles.css` conventions)
- Modify: `grader-ai/static/index.html` — add nav link `See Live Demo` → `/live.html` (keep existing `/demo.html` as the canned interactive demo)
- Modify: `grader-ai/static/app.js` — optionally extract shared `renderGrade()` helper, or keep live.html self-contained.

**Step 1: Build the page.**
Structure:
- Mode selector (radio): `exam` / `ppdt`.
- File inputs: "Question paper image" and "Answer script image" (accept `.jpg,.jpeg,.png`).
- "Grade it" button → `POST /api/parse` (with `session_id=live_demo_<ts>`), then `POST /api/grade` with the same session_id.
- Render: `<img src="data:image/png;base64,...">` for the annotated image; a card list of per-question `label`, `suggested_marks`/`max_marks`, `ai_reason`, `confidence`; total + a "teacher override" input per question calling `POST /api/override` (optional stretch — only if time).
- Handle errors: show the engine's `detail` message; timeout guard.

**Step 2: Wire the engine URL.**
Use `const ENGINE = "https://agent.sanskaraai.com"` — but make it overridable via `?engine=` query param (so Puneeth can demo against localhost:8000 during a local run). Use `fetch` with `FormData`.

**Step 3: Style it.**
Match the dark `--bg-dark` / `--primary` theme already in `demo.html`; reuse `styles.css`/`landing.css` variables where possible.

**Step 4: Commit.**
```bash
git add static/live.html static/live.css static/index.html
git commit -m "demo: add live grading page wired to real engine"
```

**Verification:** `python3 -m http.server 8788` from `static/`, open `/live.html`, upload `demo_qp.png` + `demo_ans.png`, click Grade → annotated image appears, 3 question cards with marks + reasons, total matches Task 2's curl value.

---

### Task 4: Add a canned "real result" fallback so the demo works offline (Phase-1-style hardening)

**Objective:** If the engine is unreachable (no tunnel / Pi down), `live.html` should degrade gracefully to a pre-recorded REAL result (from Task 2's actual output) instead of a blank error — so a customer demo never dies mid-pitch.

**Files:**
- Create: `grader-ai/static/data/live_demo_fallback.json` — captured from Task 2's real parse+grade output (real grade, real base64 annotation, real card text, real per-question data).
- Modify: `grader-ai/static/live.js` (or inline in live.html): on fetch failure or timeout, load fallback JSON and render identically, with a small banner "Offline — showing last real result".

**Step 1:** Capture Task 2's `/api/parse` + `/api/grade` JSON into `live_demo_fallback.json` (strip nothing; it's public demo data).
**Step 2:** Implement `tryEngine()` → fallback path; keep UI identical.
**Step 3:** Commit.

**Verification:** stop the engine (`systemctl stop` — NOT in demo; just simulate by pointing `?engine=http://127.0.0.1:9`), load live.html, upload images, confirm fallback renders with banner.

---

### Task 5: Cross-origin + security hardening for the live page

**Objective:** Make the browser→tunnel call robust and safe.

**Files:**
- Modify: `grader-ai/static/live.html` / `live.js`.

**Step 1: CORS check.**
Confirm `fetch(ENGINE)` from a Pages origin works. Engine already has `allow_origins=["*"]` — verify preflight for multipart POST passes (OPTIONS 200). If the engine needs `allow_headers=["*"]` confirmed — it already does per `app/main.py` in grader-ai; for the REAL engine (`grading_agent/backend/app/api.py`) check it also sets CORS (likely FastAPI default has none!). **If missing, add CORS middleware to the engine** (config-gated to the tunnel origin or `*` for demo) — this is the ONE engine change the plan allows.
**Step 2: Upload caps client-side.** Enforce ≤15MB and image content-type in JS before sending (mirrors engine's server-side guard).
**Step 3: No secrets.** Confirm `live.html`/`live.js` contain no token/key strings (grep the diff before commit).
**Step 4: Commit** any engine CORS change in `grading_agent` repo separately (`git -C /home/puneeth/programmes/grading_agent`), restart engine, re-verify public health.

**Verification:** from a served static page, live parse+grade succeeds cross-origin; oversized file is rejected client-side; `grep -iE 'token|secret|api_key' static/live*` returns nothing.

---

### Task 6: Docs + deploy

**Objective:** Update README with the live demo flow and deploy.

**Files:**
- Modify: `grader-ai/README.md`

**Step 1:** Add "Live Demo" section: what it does, engine URL, that it requires the Pi tunnel to be up, offline fallback behavior, how to run locally (`?engine=http://127.0.0.1:8000`).
**Step 2:** Deploy preview (optional): `wrangler pages deploy static --project-name exam-correction-mvp` (needs Puneeth's Cloudflare auth — confirm before running).
**Step 3:** Commit README.

**Verification:** README accurate; if deployed, open the live URL and run a demo upload.

---

## Files Likely to Change (summary)

- `grader-ai/scripts/gen_demo_assets.py` (new)
- `grader-ai/static/assets/demo_qp.png`, `demo_ans.png` (new)
- `grader-ai/static/live.html`, `live.css`, `live.js` (new)
- `grader-ai/static/data/live_demo_fallback.json` (new)
- `grader-ai/static/index.html` (nav link)
- `grader-ai/README.md` (docs)
- `grading_agent/backend/app/api.py` (ONLY if CORS missing — add middleware)

## Tests / Validation

- Task 1: images render, legible, no PPDT content.
- Task 2: public-tunnel parse 200 (3 questions, mode=exam), grade 200 (sensible total, non-empty PNG), 2-run determinism.
- Task 3: local serve → live.html uploads and renders real grade.
- Task 4: forced engine-down → fallback renders with banner.
- Task 5: cross-origin preflight OK; >15MB rejected client-side; no secret strings in diff.
- Task 6: README accurate; deploy if credentials present.
- Regression: existing `static/demo.html` + `index.html` unchanged in behavior (grep diff shows only nav link).

## Risks, Tradeoffs, Open Questions

- **CORS on the real engine** — likely the main blocker; plan allows adding middleware to `grading_agent/backend/app/api.py`. If Puneeth prefers NOT to touch the engine, alternative: a tiny Cloudflare Worker proxy in `grader-ai` that forwards `/api/*` → `agent.sanskaraai.com/api/*` (no engine change, but adds a Worker file).
- **Engine is publicly reachable** — `agent.sanskaraai.com` is open. For a demo this is fine; for production the admin gate/rate-limiting must be enabled. Do NOT advertise the URL outside the demo.
- **Synthetic images vs real exam** — the demo assets are generated; they grade well but aren't a real student's paper. If Puneeth wants a real (non-SSB) exam scan later, swap `demo_qp.png`/`demo_ans.png` — the flow is unchanged.
- **Determinism caveat** — engine is deterministic on identical input; a DIFFERENT answer sheet will get a DIFFERENT (correct) grade. That's expected.
- **Open question:** deploy now or keep local-only? (Task 6 step 2 requires Cloudflare auth.)

## Execution Handoff

Plan complete and saved. Ready to execute using subagent-driven-development — dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
