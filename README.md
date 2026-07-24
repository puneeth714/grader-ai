# Exam Correction MVP

Frontend-only Cloudflare Pages demo MVP for an AI-assisted descriptive exam correction product.

## Run

```bash
cd static
python3 -m http.server 8788
```

Open:

```text
http://127.0.0.1:8788
```

## Deploy

```bash
wrangler pages deploy static --project-name exam-correction-mvp
```

## Demo Flow

1. `Evaluate`: teacher reviews AI annotations, rubric reasoning, overrides marks, and signs off.
2. `Report`: student-facing concept mastery, error patterns, resources, and remedial actions.
3. `ROI`: principal/COE calculator for savings and result declaration speed.
4. `Pilot`: 100-paper campus pilot plan and adoption criteria.

## Static Data

The demo loads from `static/data/demo.json`. Teacher overrides, sign-off, reset, and ROI calculation run in browser memory.
