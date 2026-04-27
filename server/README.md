# AI gateway (server-side keys)

The SPA can call LLMs in two ways:

1. **Vite dev proxy** (`npm run dev` in `web/`) — keys in `web/.env.local` as `OPENAI_API_KEY` etc.; browser hits `/api/openai` etc.
2. **This gateway** — keys only in the Node process; browser sets `VITE_AI_BACKEND_URL=http://localhost:8787` and all `callAI()` traffic goes to `POST /v1/complete`.

Use (2) for production builds or when you do not want any provider key in the frontend bundle.

## Run

```bash
cd server
set OPENAI_API_KEY=...   # Windows: use your key
set ANTHROPIC_API_KEY=...
set GEMINI_API_KEY=...
npm start
```

Default port **8787**. Health: `GET http://localhost:8787/health`

## Web app

In `web/.env.local`:

```
VITE_AI_BACKEND_URL=http://localhost:8787
VITE_AI_PROVIDER=openai
```

Token policy in the SPA is controlled separately (`VITE_AI_LENS_LLM`, `VITE_AI_SCOUT_PIN_LLM`, `VITE_AI_CURATOR_LLM`, `VITE_AI_SCOUT_ENABLED`) — see `web/.env.example`.

## Architecture

```text
Browser (no API keys)  →  VITE_AI_BACKEND_URL  →  server/index.mjs  →  OpenAI / Anthropic / Gemini
```

Optional: put this service behind your own auth, rate limits, and logging in production.
