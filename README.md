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

The current GitHub Pages deployment uses `VITE_AI_ASSISTANT_MODE=direct` with `VITE_OPENROUTER_API_KEY`. That keeps the AI assistant working on the Firebase free plan, but the key is still part of the public client build.

If the OpenRouter key is rotated, update the GitHub Actions secret `VITE_OPENROUTER_API_KEY` and redeploy GitHub Pages.

Firebase Functions deployment requires the project to be on the Blaze plan. If you upgrade later, the backend path in [`functions/src/index.js`](/home/sandeepsingh/Desktop/LearnLedger/studyos/functions/src/index.js) is already wired for OpenRouter.
