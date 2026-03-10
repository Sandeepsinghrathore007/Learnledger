# LearnLedger Cloud Functions

## AI Assistant Callable Function

`askStudyAssistant` handles all assistant AI calls on the backend.

Flow:
- Frontend calls callable function
- Function validates request + auth
- Applies per-user rate limit
- Reads cache (`aiResponses/{hash(question+context+language)}`)
- Calls OpenRouter on cache miss
- Returns strict structured JSON response
- Logs usage + activity + chat history

## Secrets

Set the backend provider key:

```bash
firebase functions:secrets:set OPENROUTER_API_KEY
```

Do not inject `VITE_OPENROUTER_API_KEY` into the frontend build unless you intentionally accept a public browser key.

Firebase Functions secrets require the Firebase project to be on the Blaze plan. On the free plan, this backend path cannot be deployed.

## Optional Runtime Config (environment variables)

- `FUNCTION_REGION` (default: `us-central1`)
- `AI_SMALL_MODEL` (default: `openai/gpt-4o-mini`)
- `AI_LARGE_MODEL` (default: `openai/gpt-4o`)
- `AI_MAX_QUESTION_CHARS` (default: `320`)
- `AI_MAX_CONTEXT_CHARS` (default: `180`)
- `AI_MAX_OUTPUT_TOKENS` (default: `420`)
- `AI_RATE_LIMIT_WINDOW_SEC` (default: `3600`)
- `AI_RATE_LIMIT_MAX_REQUESTS` (default: `30`)
- `AI_CACHE_TTL_HOURS` (default: `720`)
- `AI_REQUEST_TIMEOUT_MS` (default: `30000`)

You can set these in your function runtime config/environment depending on your deployment setup.
