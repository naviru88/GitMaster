# Worklog

## Task ID: 2 — Agent: backend-agent

**Files created (13 total):**

### Library Services
- `src/lib/github.ts` — GitHub REST API service (validateRepo, fetchTags, fetchCommitsBetween, fetchMergedPRs)
- `src/lib/parser.ts` — URL parser + conventional commit normalizer
- `src/lib/classifier.ts` — Rule-based change classifier
- `src/lib/draft.ts` — LLM draft generation via z-ai-web-dev-sdk

### LLM Prompts
- `src/lib/prompts/developer.ts` — Developer-focused changelog prompt
- `src/lib/prompts/marketing.ts` — Marketing-friendly changelog prompt

### API Routes
- `src/app/api/projects/route.ts` — GET list / POST create
- `src/app/api/projects/[id]/route.ts` — GET single / DELETE
- `src/app/api/projects/[id]/changelogs/route.ts` — GET list changelogs
- `src/app/api/github/validate/route.ts` — POST validate repo
- `src/app/api/github/tags/route.ts` — GET fetch tags
- `src/app/api/github/fetch/route.ts` — POST fetch & classify changes
- `src/app/api/changelog/generate/route.ts` — POST full pipeline generate
- `src/app/api/changelog/[id]/route.ts` — GET / PUT changelog

**Status:** Complete. Lint passes with 0 errors.

---

## Task ID: 3 — Agent: frontend-agent

**Files created (11 total):**

### Service Layer
- `src/services/api.ts` — Typed API client with fetch (11 functions: getProjects, createProject, getProject, deleteProject, getProjectChangelogs, validateRepo, getTags, fetchChanges, generateChangelog, getChangelog, updateChangelog)

### State Management
- `src/store/appStore.ts` — Zustand store managing all app state: view routing, project list, wizard steps, changelog state, dialog toggles

### Providers
- `src/components/providers.tsx` — QueryClientProvider wrapper with React Query client

### Layout Components
- `src/components/layout/AppLayout.tsx` — Main layout with dark sidebar (w-64, bg-gray-950), mobile hamburger via Sheet, breadcrumb header, NewProjectDialog integration
- `src/components/layout/DashboardView.tsx` — Project cards grid (responsive 1/2/3 cols), empty state, delete confirmation with AlertDialog, loading skeletons
- `src/components/layout/ProjectView.tsx` — Project header with stars/GitHub link, Tabs (Changelogs/Running Changelog), changelog cards list, running changelog as concatenated markdown

### Wizard
- `src/components/wizard/NewChangelogWizard.tsx` — 4-step wizard: Connect Repo → Select Range → Choose Voice & Generate → Review & Edit. Step indicator with progress bar. Split-pane markdown editor in step 4.

### Changelog Components
- `src/components/changelog/ViewChangelog.tsx` — Full-page markdown renderer with metadata badges, copy/download buttons, edit button for drafts
- `src/components/changelog/EditChangelog.tsx` — Split-pane editor (textarea + markdown preview), save/publish/copy/download actions, publish confirmation dialog, auto-save on blur

### GitHub Components
- `src/components/github/NewProjectDialog.tsx` — Dialog with URL + PAT inputs, validate flow, repo info preview, add project flow

### Main Page
- `src/app/page.tsx` — Single-page entry point with Providers, AppLayout, and AnimatePresence view router

**Status:** Complete. ESLint passes with 0 errors. App compiles and renders successfully.

---

## Task ID: 4 — Agent: main-agent (polish & fix)

**Fixes applied:**
- Fixed API client: `validateRepo` now sends `accessToken` in POST body (not query params)
- Fixed API client: `handleResponse` checks `body.error` in addition to `body.message`
- Fixed `NewProjectDialog`: field mapping matches API response (`fullName`, `stars` not `full_name`, `stargazers_count`)
- Fixed `NewChangelogWizard`: Step2SelectRange `useEffect` no longer depends on stale `wizardStep` value
- Added `ManualRefInputs` component for fallback when tags fail to load (rate limit / no tags)
- Added loading/error states for tag loading in wizard step 2
- Added version tag filtering in `/api/github/tags` (only `v*` tags, fallback to first 50)
- Updated app metadata (title, description, keywords)

**Verified via browser:**
- Dashboard renders with empty state and project cards
- New Project dialog validates GitHub repos and creates projects
- Project view shows changelogs tab and running changelog tab
- Generate New Changelog wizard flow works (4 steps)
- Mobile sidebar via Sheet works
- All navigation (breadcrumb, sidebar, back buttons) functions correctly

**Status:** Complete. Full end-to-end flow verified.
