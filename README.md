# ChangelogAI

> AI-powered release notes generator. Pull commits and PRs from any GitHub repo and turn them into structured, human-readable changelogs — with two distinct voices.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![shadcn/ui](https://img.shields.io/badge/shadcn/ui-latest-black)

---

## Overview

ChangelogAI connects to any GitHub repository, pulls raw commit and PR history between two tags or refs, classifies changes into categories, and uses an LLM to generate polished release notes — all with a review/edit step before finalizing.

### The Two-Voice Edge

This is what makes ChangelogAI different. From the **same input data**, you can generate:

| Voice | Audience | Style |
|---|---|---|
| 🛠️ **Developer** | Engineers | Terse, technical, includes PR numbers & SHAs, omits chores |
| 📣 **Marketing** | End users | Plain language, benefit-framed, hides internal details |

---

## Features

### Repository Connection
- Connect any **public** GitHub repository via URL
- Optional **Personal Access Token** for private repos (higher rate limits)
- Automatic repo validation and metadata fetch (name, description, stars)

### Smart Data Ingestion
- Pull commits between any two tags, branches, or commit SHAs
- Optionally include merged pull requests
- Parses **conventional commit prefixes** (`feat:`, `fix:`, `chore:`, etc.)
- Auto-classifies changes into 7 categories:
  - ✨ Features
  - 🐛 Bug Fixes
  - ⚠️ Breaking Changes
  - ⚡ Improvements
  - 🔧 Chores/Internal
  - 📝 Documentation
  - ❓ Uncategorized

### AI-Powered Draft Generation
- LLM rewrites categorized raw changes into clean, structured release notes
- Two distinct output voices (Developer / Marketing)
- Category-aware prompts — chores hidden in marketing mode, technical details in developer mode

### Review & Edit
- **Nothing auto-publishes** — every draft goes through a human review step
- Split-pane markdown editor with live preview
- Edit the AI-generated draft before publishing
- Switch voice and regenerate from the same data
- Auto-saves on blur

### Export & Publish
- **Copy to clipboard** as Markdown
- **Download as `.md` file**
- **Publish** to mark as final (appears in Running Changelog)

### History
- All changelogs stored per project in local database
- View individual changelogs or the full **Running Changelog** (all published, reverse chronological)
- Changelog metadata: version, date range, voice, status

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite |
| State Management | Zustand |
| Server Data | TanStack React Query |
| AI | z-ai-web-dev-sdk (LLM) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Date Formatting | date-fns |
| Markdown | react-markdown |

---

## Project Structure

```
changelog-ai/
├── prisma/
│   └── schema.prisma          # Database models (Project, Changelog)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Single-page app entry (view router)
│   │   ├── layout.tsx         # Root layout with fonts + metadata
│   │   ├── globals.css        # Tailwind theme variables
│   │   └── api/
│   │       ├── projects/      # Project CRUD endpoints
│   │       ├── github/        # GitHub proxy (validate, tags, fetch)
│   │       └── changelog/     # Generate + edit changelog endpoints
│   ├── components/
│   │   ├── layout/            # AppLayout, Dashboard, Project views
│   │   ├── wizard/            # 4-step NewChangelogWizard
│   │   ├── changelog/         # ViewChangelog, EditChangelog
│   │   ├── github/            # NewProjectDialog
│   │   ├── ui/                # shadcn/ui components
│   │   └── providers.tsx      # React Query provider
│   ├── lib/
│   │   ├── github.ts          # GitHub REST API service
│   │   ├── parser.ts          # URL parser + conventional commit extractor
│   │   ├── classifier.ts      # Rule-based change categorization
│   │   ├── draft.ts           # LLM draft generation
│   │   ├── db.ts              # Prisma client singleton
│   │   └── prompts/           # LLM prompt templates
│   │       ├── developer.ts   # Technical voice prompt
│   │       └── marketing.ts   # User-facing voice prompt
│   ├── services/
│   │   └── api.ts             # Typed API client (fetch-based)
│   ├── store/
│   │   └── appStore.ts        # Zustand global state
│   ├── types/
│   │   └── index.ts           # Shared TypeScript types + constants
│   └── hooks/                 # Custom React hooks
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ or **Bun** (recommended)
- A **GitHub Personal Access Token** (optional, for private repos or higher rate limits)

### Installation

```bash
# Clone the repository
git clone https://github.com/naviru88/changelog-ai.git
cd changelog-ai

# Install dependencies
npm install
# or: bun install

# Set up environment variables
cp .env.example .env.local

# Initialize the database
npx prisma db push

# Start the development server
npm run dev
# or: bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |

> GitHub tokens are entered **per-project in the UI**, not as environment variables. This is by design — no global secrets to manage.

---

## Usage

### 1. Connect a Repository

Click **"New Project"** in the sidebar, enter a GitHub URL (e.g., `https://github.com/facebook/react`), and optionally add a Personal Access Token for private repos.

### 2. Generate a Changelog

From the project page, click **"Generate New Changelog"** and follow the 4-step wizard:

| Step | Action |
|---|---|
| **1. Connect** | (Skipped if project already selected) |
| **2. Select Range** | Pick two tags, branches, or manually enter any git ref |
| **3. Choose Voice** | Select Developer 🛠️ or Marketing 📣, review category breakdown |
| **4. Review & Edit** | Edit the AI-generated draft in a split-pane editor |

### 3. Export or Publish

- **Copy** the Markdown to your clipboard
- **Download** as a `.md` file
- **Publish** to mark as final and add to the running changelog

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create project (validates repo via GitHub) |
| `GET` | `/api/projects/:id` | Get single project |
| `DELETE` | `/api/projects/:id` | Delete project and all changelogs |
| `GET` | `/api/projects/:id/changelogs` | List changelogs for project |
| `POST` | `/api/github/validate` | Validate GitHub repo access |
| `GET` | `/api/github/tags` | Fetch version tags for a repo |
| `POST` | `/api/github/fetch` | Fetch & classify changes between two refs |
| `POST` | `/api/changelog/generate` | Full pipeline: fetch → classify → LLM draft → save |
| `GET` | `/api/changelog/:id` | Get single changelog |
| `PUT` | `/api/changelog/:id` | Update draft markdown, status, or version |

---

## How It Works

```
GitHub Repo
    │
    ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Fetch API  │────▶│    Parser    │────▶│  Classifier  │
│ (commits,   │     │ (conventional│     │ (rule-based  │
│  PRs, tags) │     │  prefixes)   │     │  categories) │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │  Categorized │
                                        │   Changes     │
                                        └──────┬───────┘
                                               │
                              ┌────────────────┼────────────────┐
                              ▼                                  ▼
                       ┌─────────────┐                   ┌─────────────┐
                       │  Developer   │                   │  Marketing  │
                       │  Prompt      │                   │  Prompt     │
                       └──────┬──────┘                   └──────┬──────┘
                              │                                  │
                              ▼                                  ▼
                       ┌─────────────┐                   ┌─────────────┐
                       │    LLM      │                   │    LLM      │
                       │  (z-ai-sdk) │                   │  (z-ai-sdk) │
                       └──────┬──────┘                   └──────┬──────┘
                              └────────────┬──────────────────┘
                                           ▼
                                   ┌──────────────┐
                                   │  Draft       │
                                   │  Markdown    │
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  Review &    │
                                   │  Edit (human)│
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  Export /    │
                                   │  Publish     │
                                   └──────────────┘
```

---

## Database Schema

```prisma
model Project {
  id          String      @id @default(cuid())
  name        String
  owner       String
  repo        String
  githubUrl   String
  description String?
  accessToken String?       // Encrypted in production
  stars       Int         @default(0)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  changelogs  Changelog[]
}

model Changelog {
  id            String   @id @default(cuid())
  projectId     String
  version       String?
  fromRef       String
  toRef         String
  voice         String   @default("developer")
  status        String   @default("draft")
  rawChanges    String   // JSON: categorized changes
  draftMarkdown String   // Editable draft
  finalMarkdown String?  // Published version
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

---

## Scripts

```bash
npm run dev          # Start dev server on port 3000
npm run lint         # Run ESLint
npm run db:push      # Push schema to database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:reset      # Reset database
```

---

## Roadmap

- [ ] GitHub OAuth login (currently no auth)
- ] LLM fallback classification for messy commit histories
- [ ] Publish directly to GitHub Releases
- [ ] Generate shareable public changelog pages
- [ ] Support for GitLab and Bitbucket
- [ ] Import/export project configuration
- [ ] Custom category rules per project
- [ ] Changelog templates
- [ ] Dark mode toggle

---

## License

MIT

---

Built with Next.js, Prisma, Tailwind CSS, and shadcn/ui.
