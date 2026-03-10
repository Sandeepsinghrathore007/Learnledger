# LearnLedger Cloud Functions

## AI Assistant Callable Function

`askStudyAssistant` handles all assistant AI calls on the backend.

Flow:
- Frontend calls callable function
- Function validates request + auth
- Applies per-user rate limit
- Reads cache (`aiResponses/{hash(question+context+language)}`)
- Calls OpenRouter first on cache miss
- Falls back to Gemini if OpenRouter fails
- Returns strict structured JSON response
- Logs usage + activity + chat history

## Secrets

Set at least one backend provider key:

```bash
firebase functions:secrets:set OPENROUTER_API_KEY
firebase functions:secrets:set GEMINI_API_KEY
```

Do not inject `VITE_OPENROUTER_API_KEY` or `VITE_GEMINI_API_KEY` into the frontend build for GitHub Pages. Public static builds should call this backend instead. If a browser key was already exposed, rotate it before redeploying.

## Optional Runtime Config (environment variables)

- `FUNCTION_REGION` (default: `us-central1`)
- `AI_SMALL_MODEL` (default: `openai/gpt-4o-mini`)
- `AI_LARGE_MODEL` (default: `openai/gpt-4o`)
- `AI_GEMINI_MODELS` (default: `gemini-2.5-flash,gemini-2.0-flash`)
- `AI_MAX_QUESTION_CHARS` (default: `320`)
- `AI_MAX_CONTEXT_CHARS` (default: `180`)
- `AI_MAX_OUTPUT_TOKENS` (default: `420`)
- `AI_RATE_LIMIT_WINDOW_SEC` (default: `3600`)
- `AI_RATE_LIMIT_MAX_REQUESTS` (default: `30`)
- `AI_CACHE_TTL_HOURS` (default: `720`)
- `AI_REQUEST_TIMEOUT_MS` (default: `30000`)

You can set these in your function runtime config/environment depending on your deployment setup.
