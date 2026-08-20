/* ============================================================
   Zustand Store — App State
   ============================================================ */

import { create } from 'zustand';
import type { AppView, RepoTab, Account, GitHubRepo, GitHubContent, GitHubBranch, GitHubCommit, User } from '@/types';

interface AppState {
  // Auth
  user: User | null;
  setUser: (u: User | null) => void;
  authLoading: boolean;
  setAuthLoading: (l: boolean) => void;

  // Navigation
  view: AppView;
  setView: (v: AppView) => void;

  // Accounts
  accounts: Account[];
  setAccounts: (a: Account[]) => void;
  addAccount: (a: Account) => void;
  removeAccount: (id: string) => void;
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;

  // Repos
  repos: GitHubRepo[];
  setRepos: (r: GitHubRepo[]) => void;
  reposTotalCount: number;
  setReposTotalCount: (n: number) => void;
  selectedRepo: GitHubRepo | null;
  setSelectedRepo: (r: GitHubRepo | null) => void;

  // Repo detail
  repoTab: RepoTab;
  setRepoTab: (t: RepoTab) => void;
  selectedBranch: string;
  setSelectedBranch: (b: string) => void;

  // File browser
  filePath: string;
  setFilePath: (p: string) => void;
  fileContents: GitHubContent[];
  setFileContents: (f: GitHubContent[]) => void;
  openedFile: { content: GitHubContent; decoded: string } | null;
  setOpenedFile: (f: { content: GitHubContent; decoded: string } | null) => void;

  // Branches
  branches: GitHubBranch[];
  setBranches: (b: GitHubBranch[]) => void;

  // Commits
  commits: GitHubCommit[];
  setCommits: (c: GitHubCommit[]) => void;

  // Loading states
  loading: boolean;
  setLoading: (l: boolean) => void;

  // Reset all state (for logout)
  resetAll: () => void;
}

const initialState = {
  view: 'dashboard' as AppView,
  accounts: [] as Account[],
  selectedAccountId: null as string | null,
  repos: [] as GitHubRepo[],
  reposTotalCount: 0,
  selectedRepo: null as GitHubRepo | null,
  repoTab: 'files' as RepoTab,
  selectedBranch: '',
  filePath: '',
  fileContents: [] as GitHubContent[],
  openedFile: null as { content: GitHubContent; decoded: string } | null,
  branches: [] as GitHubBranch[],
  commits: [] as GitHubCommit[],
  loading: false,
};

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),
  authLoading: true,
  setAuthLoading: (authLoading) => set({ authLoading }),

  // Navigation
  view: 'dashboard',
  setView: (view) => set({ view }),

  // Accounts
  accounts: [],
  setAccounts: (accounts) => set({ accounts }),
  addAccount: (a) => set((s) => ({ accounts: [...s.accounts, a] })),
  removeAccount: (id) => set((s) => ({
    accounts: s.accounts.filter((a) => a.id !== id),
    selectedAccountId: s.selectedAccountId === id ? null : s.selectedAccountId,
  })),
  selectedAccountId: null,
  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId, repos: [], commits: [], branches: [], fileContents: [], openedFile: null, filePath: '' }),

  // Repos
  repos: [],
  setRepos: (repos) => set({ repos }),
  reposTotalCount: 0,
  setReposTotalCount: (reposTotalCount) => set({ reposTotalCount }),
  selectedRepo: null,
  setSelectedRepo: (selectedRepo) => set({
    selectedRepo,
    repoTab: 'files',
    selectedBranch: selectedRepo?.default_branch || '',
    filePath: '',
    fileContents: [],
    openedFile: null,
    commits: [],
    branches: [],
  }),

  // Repo detail
  repoTab: 'files',
  setRepoTab: (repoTab) => set({ repoTab }),
  selectedBranch: '',
  setSelectedBranch: (selectedBranch) => set({
    selectedBranch,
    filePath: '',
    fileContents: [],
    openedFile: null,
    view: 'repo-detail',
  }),

  // File browser
  filePath: '',
  setFilePath: (filePath) => set({ filePath, fileContents: [], openedFile: null }),
  fileContents: [],
  setFileContents: (fileContents) => set({ fileContents }),
  openedFile: null,
  setOpenedFile: (openedFile) => set({ openedFile, view: openedFile ? 'file-editor' : 'repo-detail' }),

  // Branches
  branches: [],
  setBranches: (branches) => set({ branches }),

  // Commits
  commits: [],
  setCommits: (commits) => set({ commits }),

  // Loading states
  loading: false,
  setLoading: (loading) => set({ loading }),

  // Reset all state (for logout)
  resetAll: () => set({
    ...initialState,
    user: null,
    authLoading: false,
  }),
}));
