# math-scanner

PWA that captures a photo of a math problem and returns the solved answer. Frontend is Vite + React; backend is a Cloudflare Worker calling Gemini 2.5 Flash.

**Live:** https://math-scanner.pages.dev — API: https://math-scanner-api.ohrytskov20230516.workers.dev

```
math-scanner/
├── src/                     # React app (the PWA)
├── worker/                  # Cloudflare Worker (Gemini integration)
│   ├── src/index.ts
│   └── wrangler.toml
└── index.html
```

## Local dev

```bash
# 1. install
pnpm install
cd worker && pnpm install && cd ..

# 2. worker dev (port 8787 by default)
cd worker
echo "GEMINI_API_KEY=<your-key>" > .dev.vars
pnpm dev

# 3. in another shell — frontend dev
echo "VITE_API_URL=http://localhost:8787" > .env.local
pnpm dev
```

Frontend defaults to `http://localhost:5173`. Worker reads `GEMINI_API_KEY` from `.dev.vars`.

## Deploy

```bash
# worker
cd worker
pnpm wrangler secret put GEMINI_API_KEY        # paste key, enter
pnpm wrangler deploy                            # → https://math-scanner-api.<account>.workers.dev

# frontend (Cloudflare Pages)
cd ..
echo "VITE_API_URL=https://math-scanner-api.<account>.workers.dev" > .env.production
pnpm build
pnpm wrangler pages deploy dist --project-name=math-scanner
```

Add the production frontend origin to `ALLOWED_ORIGINS` in `worker/wrangler.toml` before deploying the worker.

## API

```
POST /
Content-Type: application/json
{ "imageBase64": "<base64-no-prefix>", "mimeType": "image/jpeg" }

→ 200 { "answer": "2+3 = 5\n7×8 = 56" }
→ 400 { "error": "missing_image" | "invalid_json" }
→ 502 { "error": "ai_failed" | "ai_no_answer" }
```

Gemini receives the image plus a terse "solve and return one-line answers, mark uncertain reads with `?`" prompt.
