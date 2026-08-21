# GitMaster

> A self-hosted, browser-based GUI for pushing, pulling, and managing GitHub repositories — built to replace the terminal `git add / commit / push` workflow with drag-and-drop file uploads, automatic `.gitignore` handling, and a proper account manager for multiple GitHub identities.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![shadcn/ui](https://img.shields.io/badge/shadcn/ui-latest-black)

---

## What it does

GitMaster connects to GitHub's REST API on your behalf (using a Personal Access Token) and gives you a graphical way to do the things you'd normally reach for the terminal for:

- **Push** local files or entire folders to a repo, without a local git checkout
- **Pull** a repo down as a `.zip` or `.tar.gz` archive
- **Browse** repo contents, switch branches, and view commit history
- **Merge** branches
- **Manage multiple GitHub accounts** side by side (e.g. personal + work), each with its own token
- Optionally, **generate commit messages and READMEs with AI** (see [AI Tools](#ai-tools--requires-setup) below — this one needs a bit of configuration)

Everything runs through your own Next.js server talking directly to `api.github.com` — there's no third-party backend in between.

---

## Features

### Multi-account GitHub management
- Connect any number of GitHub accounts via **Personal Access Token**, each with a label (e.g. "Personal", "Work")
- Switch between accounts from the sidebar; each account's repos, branches, and tokens stay isolated

### Repository browsing
- List all repos for a connected account
- Per-repo tabs for **Files**, **Branches**, and **Commits**
- In-browser file viewer/editor for individual files

### Push — the core feature
This is the most heavily built-out part of the app, specifically designed to avoid the problems that come from uploading a raw folder through a browser:

- **Drag-and-drop** whole folders (recursively) or individual files directly onto the push dialog — no reliance on the OS's native file picker, which can be unreliable on some Linux/browser combinations
- **Automatic `.gitignore` detection**: if a `.gitignore` file is found in what you selected, its rules are used automatically; otherwise sensible defaults apply (`node_modules/`, `.git/`, `.DS_Store`, `*.log`, etc.)
- **`.git/` is always excluded**, unconditionally and non-overridably — GitHub's API rejects any path containing a `.git` component outright, so this is enforced regardless of your `.gitignore` settings, both client- and server-side
- **Per-file validation failsafe**: corrupted/unreadable files or anything over GitHub's 100MB blob limit are automatically skipped (with a reason shown) instead of failing the entire push
- **Live progress feedback** at every stage — folder scanning, file caching/encoding, and the actual GitHub upload each show their own progress, pinned to a fixed spot in the dialog so it's never hidden by scrolling
- **Rate-limit aware**: automatically retries with backoff if GitHub's secondary (abuse-prevention) rate limit is hit, instead of failing the push outright
- **Optimized upload path**: small text files are embedded directly into the Git tree in a single request rather than requiring a separate API call per file, which meaningfully cuts down the number of round-trips for a typical push (mostly source code)
- No artificial cap on file count — GitHub's own Trees API doesn't have one either; only total payload size is guarded against

### Pull
- Download any branch of a repo as a `.zip` or `.tar.gz` archive directly to your machine

### Branches & Commits
- View, switch, and merge branches
- Browse commit history per repo

### AI Tools — *requires setup*
- A **commit message generator** and **README generator**, both AI-powered
- ⚠️ **Out of the box these will not work.** They're wired up to `z-ai-web-dev-sdk`, an SDK tied to the specific cloud sandbox this project was originally scaffolded in — it has no API key of its own to configure and won't authenticate outside that environment. To use these features, replace the calls in `src/app/api/ai/commit-message/route.ts` and `src/app/api/ai/readme/route.ts` with a real LLM provider (e.g. the [Anthropic](https://docs.claude.com) or OpenAI SDK) and your own API key.

---

## Known limitations / leftover code

This project was originally scaffolded from a different template app (a GitHub changelog generator) and repurposed into GitMaster. Some files from that original template are still present in the repo but **are not wired into the app's UI or database schema**, and will not work if invoked:

- `src/components/layout/DashboardView.tsx`, `src/components/layout/ProjectView.tsx`
- `src/components/wizard/NewChangelogWizard.tsx`
- `src/components/changelog/*`
- `src/components/github/NewProjectDialog.tsx`
- The `/api/projects/*` and `/api/changelog/*` routes — these reference a `Project`/`Changelog` Prisma model that no longer exists in `prisma/schema.prisma` (only `User` and `Account` are defined)

None of this is reachable from the real app (`src/app/page.tsx` only renders `DashboardView` from `src/components/dashboard/`, `AccountReposView`, `RepoDetailView`, `FileEditor`, and `AIToolsView`), so it doesn't affect normal use — but if you're exploring the codebase, don't be surprised to find it. Safe to delete if you want a cleaner tree.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite |
| State management | Zustand |
| Auth | Local email/password accounts, JWT sessions (`jose`), bcrypt-hashed passwords |
| GitHub integration | Direct REST calls to `api.github.com` (no external proxy) |

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./db/custom.db"
JWT_SECRET="replace-with-any-long-random-string"
```

Both are required. `DATABASE_URL` **must be a relative path** (`file:./db/custom.db`) — an absolute path baked in from a different machine/environment will fail with a permissions or "unable to open database file" error.

### 3. Set up the database

```bash
npm run db:push
```

This creates `db/custom.db` and applies the schema (`User`, `Account` tables) via Prisma.

### 4. Run the dev server

```bash
npm run dev
```

The app runs at **http://localhost:3000**.

### 5. Create an account and connect GitHub

Sign up on first load (this creates a local `User` row), then add a GitHub account from within the app using a **Personal Access Token** (classic or fine-grained, with `repo` scope). That token is what powers push/pull/branch/commit operations — it's stored per-account in the local database.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Run the production build (expects `npm run build` first) |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Apply the Prisma schema to the SQLite database |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create a new Prisma migration |
| `npm run db:reset` | Reset the database (⚠️ destructive) |

---

## Project structure

```
src/
├── app/
│   ├── api/              # Route handlers: auth, accounts, github/*, ai/*
│   ├── layout.tsx
│   └── page.tsx           # Top-level view router
├── components/
│   ├── auth/               # Login/register
│   ├── accounts/            # Add/manage GitHub accounts
│   ├── dashboard/            # Account list (the real dashboard)
│   ├── repos/                 # Repo list, repo detail (Files/Branches/Commits), New Repo dialog
│   ├── files/                  # File browser, editor, Push/Pull dialogs (the core feature)
│   ├── branches/                # Branch management
│   ├── commits/                   # Commit history
│   ├── ai-tools/                   # AI commit message / README generator UI
│   ├── layout/                      # App shell, sidebar, top bar
│   └── ui/                           # shadcn/ui primitives
├── lib/
│   ├── github.ts            # All GitHub REST API calls (blobs, trees, commits, refs, archives)
│   ├── gitignore.ts          # .gitignore pattern matching/filtering
│   ├── auth.ts                 # JWT session handling
│   └── db.ts                    # Prisma client
├── services/api.ts        # Client-side fetch wrappers for the API routes above
└── store/appStore.ts     # Zustand global state (view routing, accounts, selected repo, etc.)
```

---

## Deployment

`next.config.ts` is set to `output: "standalone"`, and a `Caddyfile` is included for reverse-proxy deployment behind Caddy. The `build`/`start` scripts assume this standalone/self-hosted setup (they run via `bun`) rather than a serverless platform like Vercel — adjust as needed if deploying elsewhere. If you do deploy to a platform with function timeouts (e.g. Vercel serverless), note that `src/app/api/github/push/route.ts` sets `maxDuration = 60`.

---

## License

No license file is currently included — add one (e.g. MIT) if you intend to distribute this.
