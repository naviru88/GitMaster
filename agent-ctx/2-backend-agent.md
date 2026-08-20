# Task 2 — Backend Agent

## Summary
Built the complete backend for the AI Changelog Generator app, including GitHub API service, data parsing/classification pipeline, LLM draft generation, and all API routes.

## Files Created

### Library Services
- `src/lib/github.ts` — GitHub REST API client (validateRepo, fetchTags, fetchCommitsBetween, fetchMergedPRs)
- `src/lib/parser.ts` — URL parser + conventional commit normalizer (parseGitHubUrl, normalizeChanges)
- `src/lib/classifier.ts` — Rule-based category classifier (classifyChanges)
- `src/lib/draft.ts` — LLM draft generation via z-ai-web-dev-sdk (generateDraft)

### LLM Prompts
- `src/lib/prompts/developer.ts` — Technical/terse changelog prompt for engineers
- `src/lib/prompts/marketing.ts` — Benefit-framed, user-facing changelog prompt

### API Routes
- `src/app/api/projects/route.ts` — GET (list projects), POST (create project with GitHub validation)
- `src/app/api/projects/[id]/route.ts` — GET (single project), DELETE (cascade delete)
- `src/app/api/projects/[id]/changelogs/route.ts` — GET (list changelogs for project)
- `src/app/api/github/validate/route.ts` — POST (validate GitHub repo access)
- `src/app/api/github/tags/route.ts` — GET (fetch repo tags)
- `src/app/api/github/fetch/route.ts` — POST (fetch & classify changes between refs — preview only)
- `src/app/api/changelog/generate/route.ts` — POST (full pipeline: fetch → parse → classify → LLM → save)
- `src/app/api/changelog/[id]/route.ts` — GET (single changelog), PUT (update draft/status/version)

## Notes
- All routes use NextResponse.json() with proper error handling
- ESLint passes with zero errors
- No env API keys needed — z-ai-web-dev-sdk handles its own auth
- Conventional commit regex: `/^(feat|fix|chore|docs|style|refactor|perf|test|ci|build|revert)(\(.+\))?!?:/`
- Classifier maps: feat→Features, fix→Bug Fixes, breaking→Breaking Changes, docs→Documentation, chore/ci/build→Chores/Internal, refactor/perf→Improvements, style/test→Chores/Internal
