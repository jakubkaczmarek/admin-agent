# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server on port 4000
npm run build    # Build production bundle
```

## Architecture Overview

This is the React frontend for the admin-agent support ticket system. It communicates with two backends:

- **Web API** (`src/sourceWebApi`, port 3000) — Express + MSSQL; CRUD for support threads, consumer reviews
- **Agent API** (`src/agent/TicketCreatorAgent`, port 8000) — FastAPI + LangChain; AI-driven ticket generation, categorization, autocomplete

Base URLs are configured in `src/AppConsts.ts`.

## Project Structure

```
src/
├── AppConsts.ts              # API base URL config
├── app/
│   ├── App.tsx               # Router root
│   ├── routes.tsx            # 4 routes: Landing, Login, Dashboard, TicketDetail
│   ├── pages/                # Full-page views
│   ├── components/           # Shared UI components (Radix UI / shadcn pattern)
│   ├── lib/auth.ts           # localStorage-based auth (username only, no tokens)
│   └── constants/            # Category enums and other constants
└── services/                 # API client singletons (e.g. AgentApiClient.getInstance())
```

Path alias: `@` maps to `src/`.

## Key Patterns

**API Clients** — singleton classes in `src/services/`. Each wraps fetch calls and returns `{ success, data } | { success, error }`.

**Background Jobs** — agent endpoints return `202 + job_id`. The UI polls `GET /jobs/{job_id}` until completion.

**Auth** — username stored in `localStorage` via `src/app/lib/auth.ts`. No tokens or sessions.

**UI** — Tailwind CSS + Radix UI primitives. Use existing component patterns from `src/app/components/` before adding new ones.
