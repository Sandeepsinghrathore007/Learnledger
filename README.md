# Learnledger

Learnledger is a study management web app built with React, Vite, and Firebase.

## Features - 

- Subject and topic management
- Notes and study materials
- AI assistant for explanations and structured notes
- AI-generated mock tests
- PDF-backed AI study context

## Tech Stack 

- React
- Vite
- Firebase Auth
- Cloud Firestore

## Local Development

```bash
npm install
npm run dev
```

## AI Assistant Deployment

Use `VITE_AI_ASSISTANT_MODE=functions` for deployed builds. The repo already includes a Firebase callable backend in [`functions/src/index.js`](/home/sandeepsingh/Desktop/LearnLedger/studyos/functions/src/index.js) so AI provider keys stay off the client.

Do not pass `VITE_OPENROUTER_API_KEY` or `VITE_GEMINI_API_KEY` into a public static build such as GitHub Pages. If those keys were already exposed, rotate them in the provider dashboards before redeploying.

Firebase Functions deployment requires the project to be on the Blaze plan. If you stay on the free plan, the practical fallback for GitHub Pages is direct browser mode with rotated provider keys and referrer restrictions.
