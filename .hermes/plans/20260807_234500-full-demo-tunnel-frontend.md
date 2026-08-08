# GradingAI Full Demo — Tunnel Fix + Frontend Wired to Real Backend

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the `puneeth714/grader-ai` demo site actually work end-to-end with Puneeth's real grading backend — correct tunnel hostname, a live upload page that grades through the engine, and the landing/demo pages linked to it — without exposing any SSB test images or secrets.

**Architecture:** The grading engine (`grading_agent/backend`, FastAPI on the Pi at 127.0.0.1:8000) is reachable publicly via the existing cloudflared tunnel. Today the tunnel maps `agent.sanskaraai.com` → :8000, but the product domain `grading.sanskaraai.com` returns 1014 (no ingress rule). The demo site is a static Cloudflare Pages build. We (1) add the `grading.sanskaraai.com` ingress to the tunnel config, (2) add a `live.html` page that POSTs images to the real `/api/parse` + `/api/grade` (multipart; engine already has CORS `allow_origins=["*"]` at `backend/app/api.py:36` — verified), (3) point the landing CTAs at the live page while keeping the canned `demo.html` as a static showcase, (4) add an offline fallback so a demo never dies if the tunnel is down.

**Tech Stack:** HTML/CSS/vanilla JS (matches existing static site), FastAPI engine (existing), cloudflared (existing), Cloudflare Pages, Pillow for synthetic demo assets. No new runtime deps.

---

## Current Context / Assumptions

- `grader-ai` repo: `/home/puneeth/programmes/grader-ai` (cloned, HEAD `52f9d3c`, clean). Deploys `static/` via `wrangler pages deploy`.
- Engine repo: `/home/puneeth/programmes/grading_agent` — live on the Pi at :8000, committed at `bf1bac0`, deterministic (temp=0, seed=42, proven spread 0.0), 23 tests green. **Do not disturb the running service during verification except the deliberate restart in Task 2.**
- Tunnel config: `/etc/cloudflared/config.yml` (running tunnel `26a0c389-629f-4f2d-9593-ed7852a9a057`). Ingress exists for `agent.sanskaraai.com` → `http://localhost:8000`; **`grading.sanskaraai.com` has NO ingress** → Cloudflare error 1014. DNS for `grading.sanskaraai.com` resolves (Cloudflare-proxied) — verified `getent hosts` returns A/AAAA. If the record isn't a CNAME to the tunnel, the Cloudflare dashboard must fix it (see Task 1 step 3).
- Engine API (multipart form): `POST /api/parse` fields `session_id`, `mode` (`exam`|`ppdt`), `image` file → `{exam, questions_count, session_id, paper_id}`. `POST /api/grade` fields `session_id`, `image` file → `{grade, image (base64 PNG), card, session_id}`. Both validated server-side (content-type, ≤15MB, decompression cap). CORS already `*`.
- Landing CTAs (`static/index.html` lines 42, 60, 658, 681) currently point to `/demo.html` (the canned interactive showcase).
- SECURITY RULES: `BOT_TOKEN` / `GEMINI_API_KEY` / `.env` never leave `grading_agent`. Nothing secret in `grader-ai`. NO SSB/PPDT images (`grading_agent/backend/tests/fixtures/*.jpg`) copied into `grader-ai` — demo uses NEW synthetic assets.

---

## Step-by-Step Plan

### Task 1: Tunnel — expose `grading.sanskaraai.com` → engine :8000

**Objective:** Make the product hostname serve the live engine. (System-level config; agy may do it via SSH-style terminal if permitted, else Puneeth/Hermes executes the same commands. Config edit is not a repo change.)

**Files:**
- Modify (system): `/etc/cloudflared/config.yml`

**Step 1: Read current config.**
Run: `grep -nE 'hostname|service' /etc/cloudflared/config.yml`
Expected: ingress list ending with `- service: http_status:404` catch-all; no `grading.sanskaraai.com` line.

**Step 2: Add ingress line before the catch-all.**
Insert:
```yaml
  - hostname: grading.sanskaraai.com
    service: http://localhost:8000
```
Keep `agent.sanskaraai.com` → `http://localhost:8000` as an alias or replace it with `grading.sanskaraai.com` (decide with Puneeth — plan default: ADD, don't remove, to avoid breaking anything that already uses agent.sanskaraai.com).

**Step 3: Reload tunnel + verify DNS.**
Run: `cloudflared tunnel reload` (or `systemctl restart cloudflared`). Then:
- `curl -s -m 8 https://grading.sanskaraai.com/api/health` → expected `{"status":"ok"}`
- `curl -s -m 8 https://agent.sanskaraai.com/api/health` → expected `{"status":"ok"}` (alias preserved)
- If 1014 persists: the DNS record for `grading.sanskaraai.com` is not a CNAME to tunnel `26a0c389-629f-4f2d-9593-ed7852a9a057` (or is on a different zone). Fix in Cloudflare dashboard (CNAME → `26a0c389-629f-4f2d-9593-ed7852a9a057.cfargotunnel.com`, proxied). Do NOT touch other domains' records.

**Step 4: Verify no other service broken.**
Run: `curl -s -m 5 https://sanskaraai.com` (or one known-good ingress) — confirm still 200/whatever it was before.

**Verification:** `grading.sanskaraai.com/api/health` returns ok; alias still ok; catch-all untouched; no unrelated ingress changed.

---

### Task 2: Generate demo assets — real exam content, NOT SSB

**Objective:** Two synthetic exam images (question paper + answer sheet) for the live demo, matching a real descriptive exam — never Puneeth's PPDT/SSB photos.

**Files:**
- Create: `grader-ai/scripts/gen_demo_assets.py`
- Output: `grader-ai/static/assets/demo_qp.png`, `grader-ai/static/assets/demo_ans.png`

**Step 1: Write the generator (PIL, reuse grading_agent venv).**
Question paper — 3 questions, max 10:
- Q1 (3): "Define Newton's second law and give its equation."
- Q2 (4): "A car accelerates from rest to 20 m/s in 5 s. Find its acceleration."
- Q3 (3): "State the law of conservation of energy with one example."
Header: "PHYSICS — INTERNAL ASSESSMENT", "Max Marks: 10", "Time: 40 min".

Answer sheet — matching handwritten-style content: correct second-law statement, calculation with final "4 m/s²", a short conservation example with units. Render legibly (slanted font if available; DejaVu Sans with italic/slant is fine — the goal is a gradeable image).

**Step 2: Run generator.**
Run: `cd /home/puneeth/programmes/grader-ai && ../grading_agent/venv/bin/python scripts/gen_demo_assets.py`
Expected: two PNGs under `static/assets/`.

**Step 3: Commit.**
```bash
cd /home/puneeth/programmes/grader-ai
git add scripts/gen_demo_assets.py static/assets/demo_qp.png static/assets/demo_ans.png
git commit -m "demo: add synthetic physics question paper + answer script assets"
```

**Verification:** images open, legible, contain no PPDT/SSB imagery; question paper lists 3 questions totaling 10 marks.

---

### Task 3: Live engine smoke-test on the new assets (via public tunnel)

**Objective:** Prove the engine grades the NEW demo images end-to-end before frontend work.

**Files:** none (curl only; throwaway scripts under /tmp if needed)

**Step 1: Parse.**
Run:
```bash
curl -s -X POST https://grading.sanskaraai.com/api/parse \
  -F "session_id=live_demo" -F "mode=exam" \
  -F "image=@static/assets/demo_qp.png"
```
Expected: 200, `questions_count: 3`, `exam.mode == "exam"`, no PPDT headings.

**Step 2: Grade.**
Run:
```bash
curl -s -X POST https://grading.sanskaraai.com/api/grade \
  -F "session_id=live_demo" -F "image=@static/assets/demo_ans.png" -o /tmp/demo_grade.json
```
Expected: 200, `grade.total_suggested > 0`, non-empty base64 `image`, `card` text present.

**Step 3: Determinism (2 runs).**
Run grade twice; compare `grade.total_suggested`.
Expected: identical (engine is temp=0/seed42).

**Step 4: Save outputs for the fallback (Task 5).**
Copy the real parse JSON + grade JSON into `/tmp` for later; nothing committed yet.

**Verification:** real engine returns real marks on the synthetic assets, deterministically.

---

### Task 4: `live.html` — real grading page wired to the engine

**Objective:** A Pages-compatible page that uploads two images and renders the REAL annotated result.

**Files:**
- Create: `grader-ai/static/live.html`, `grader-ai/static/live.css`, `grader-ai/static/live.js`
- Modify: `grader-ai/static/index.html` — CTAs (lines 42, 60, 658, 681) → point to `/live.html` labeled "Try the Live Demo" (keep `/demo.html` link in footer/features as "Interactive walkthrough")

**Step 1: Page structure (live.html).**
- Mode radio: `exam` / `ppdt` (default exam)
- File inputs: "Question paper image", "Answer script image" (accept .jpg/.jpeg/.png)
- "Grade it" button
- Result area: `<img id="annotated">` (data:image/png;base64), total + per-question cards (label, suggested/max, ai_reason, confidence), and a text `<pre>` of the card.

**Step 2: live.js flow.**
```js
const ENGINE = new URLSearchParams(location.search).get("engine") || "https://grading.sanskaraai.com";
// 1. POST /api/parse (FormData: session_id="live_demo_" + Date.now(), mode, image)
// 2. POST /api/grade (same session_id, answer image)
// 3. render grade.image as annotated PNG; render grade.questions as cards
// 4. on fetch failure/timeout (8s AbortController) → loadFallback() (Task 5)
```
Client-side guards: file size ≤15MB, image content-type, both files required, disable button while grading.

**Step 3: Style.**
Reuse the existing theme (landing.css / demo styles). Add a status line ("Grading via grading.sanskaraai.com…").

**Step 4: Local test.**
Run: `python3 -m http.server 8788` in `static/` → open `http://127.0.0.1:8788/live.html` → upload assets → expect real annotated image + marks (CORS already `*` on engine; verify no mixed-content issue when served over http — for full fidelity test against the deployed Pages URL).

**Step 5: Commit.**
```bash
git add static/live.html static/live.css static/live.js static/index.html
git commit -m "demo: add live grading page wired to real engine; retarget CTAs"
```

**Verification:** local serve + real upload grades end-to-end; CTA links changed; `grep -iE 'token|secret|api_key' static/live*` returns nothing.

---

### Task 5: Offline fallback — demo never dies

**Objective:** If the engine/tunnel is unreachable, render the last REAL result (from Task 3) instead of an error.

**Files:**
- Create: `grader-ai/static/data/live_demo_fallback.json` (real parse+grade output from Task 3, including the base64 annotated PNG)
- Modify: `grader-ai/static/live.js`

**Step 1:** Save Task 3's real JSON (parse + grade + image) as `live_demo_fallback.json`.
**Step 2:** In `live.js`, `loadFallback()` renders the SAME UI with a banner: "Offline — showing last real result".
**Step 3:** Commit.
```bash
git add static/data/live_demo_fallback.json static/live.js
git commit -m "demo: offline fallback to last real grade result"
```

**Verification:** simulate tunnel-down (`?engine=http://127.0.0.1:9`), upload images → fallback renders with banner; UI identical to live mode.

---

### Task 6: Canned showcase `demo.html` — keep or upgrade

**Objective:** Decide/implement the fate of the current canned interactive demo.

**Decision (default):** Keep `demo.html` as an interactive walkthrough (it demonstrates the TEACHER WORKFLOW UI — override, sign-off, ROI — which live.html doesn't), but add a visible banner at top: "This is a guided walkthrough with sample data — try the [Live Demo](/live.html) with a real paper."

**Files:**
- Modify: `grader-ai/static/demo.html` (+ small banner markup), `grader-ai/static/styles.css` if needed

**Verification:** banner visible on demo.html; both demo paths reachable from nav.

---

### Task 7: README + deploy

**Objective:** Document and (optionally) publish.

**Files:**
- Modify: `grader-ai/README.md`

**Step 1:** Document: live URL (grading.sanskaraai.com), what the live page does, tunnel dependency, offline fallback, local test command, engine determinism note.
**Step 2 (optional, needs Puneeth):** `wrangler pages deploy static --project-name exam-correction-mvp`
**Step 3:** Commit README.

**Verification:** README accurate; if deployed, open live URL and run a demo upload.

---

## Files Likely to Change (summary)

- `/etc/cloudflared/config.yml` (system — tunnel ingress)
- `grader-ai/scripts/gen_demo_assets.py` (new)
- `grader-ai/static/assets/demo_qp.png`, `demo_ans.png` (new)
- `grader-ai/static/live.html`, `live.css`, `live.js` (new)
- `grader-ai/static/data/live_demo_fallback.json` (new)
- `grader-ai/static/index.html` (CTA links)
- `grader-ai/static/demo.html` (walkthrough banner)
- `grader-ai/README.md` (docs)
- `grading_agent` repo: NO code changes expected (CORS already `*`). Only the tunnel config above.

## Tests / Validation

- Task 1: `grading.sanskaraai.com/api/health` ok; alias ok; other ingresses untouched.
- Task 2: assets generated, no SSB content, 3 questions / 10 marks.
- Task 3: parse 200 (3 questions, exam mode); grade 200 (sensible total); 2-run determinism.
- Task 4: local serve upload → real annotated image + cards; CTAs retargeted; no secrets in diff.
- Task 5: forced engine-down → fallback renders with banner.
- Task 6: banner on demo.html; both pages reachable.
- Task 7: README accurate; deploy if credentials present.
- Regression: existing `static/demo.html` behavior unchanged except banner.

## Risks, Tradeoffs, Open Questions

- **Tunnel/DNS risk:** 1014 may be a DNS-record problem, not just missing ingress. If adding ingress + reload doesn't fix, Puneeth must check the Cloudflare dashboard (CNAME to `26a0c389-629f-4f2d-9593-ed7852a9a057.cfargotunnel.com`). Do not edit other domains.
- **Public exposure:** `grading.sanskaraai.com` will be an OPEN grading endpoint. Acceptable for a demo; note in README; do NOT advertise. (Engine admin gate is Telegram-side; the API itself is unauthenticated by design.)
- **Engine restart:** Task 2 (assets) does NOT restart the engine. Only if tunnel reload fails might a cloudflared restart touch the live service — do it carefully, verify health after.
- **Live vs canned:** live.html is the real product; demo.html stays as workflow walkthrough. This is a product choice — if Puneeth wants demo.html fully live too, scope expands (override/sign-off wiring) — not in this plan.
- **Open question:** keep `agent.sanskaraai.com` alias or replace with `grading.sanskaraai.com`? Default: keep both.
- **Open question:** deploy to Pages now or keep local-only? (needs Cloudflare auth)

## Execution Handoff

Plan complete and saved. Ready to execute using subagent-driven-development — dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
