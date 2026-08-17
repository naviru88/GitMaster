/* ============================================================
   Zustand Store — App State
   ============================================================ */

import { create } from 'zustand';
import type { AppView, RepoTab, Account, GitHubRepo, GitHubContent, GitHubBranch, GitHubCommit } from '@/types';

interface AppState {
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
}

export const useAppStore = create<AppState>((set) => ({
  view: 'dashboard',
  setView: (view) => set({ view }),

  accounts: [],
  setAccounts: (accounts) => set({ accounts }),
  addAccount: (a) => set((s) => ({ accounts: [...s.accounts, a] })),
  removeAccount: (id) => set((s) => ({
    accounts: s.accounts.filter((a) => a.id !== id),
    selectedAccountId: s.selectedAccountId === id ? null : s.selectedAccountId,
  })),
  selectedAccountId: null,
  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId, repos: [], commits: [], branches: [], fileContents: [], openedFile: null, filePath: '' }),

  repos: [],
  setRepos: (repos) => set({ repos }),
  reposTotalCount: 0,
  setReposTotalCount: (reposTotalCount) => set({ reposTotalCount }),
  selectedRepo: null,
  setSelectedRepo: (selectedRepo) => set({ selectedRepo, repoTab: 'files', filePath: '', fileContents: [], openedFile: null, commits: [], branches: [] }),

  repoTab: 'files',
  setRepoTab: (repoTab) => set({ repoTab }),
  selectedBranch: '',
  setSelectedBranch: (selectedBranch) => set({ selectedBranch, filePath: '', fileContents: [], openedFile: null }),

  filePath: '',
  setFilePath: (filePath) => set({ filePath, fileContents: [], openedFile: null }),
  fileContents: [],
  setFileContents: (fileContents) => set({ fileContents }),
  openedFile: null,
  setOpenedFile: (openedFile) => set({ openedFile, view: openedFile ? 'file-editor' : 'repo-detail' }),

  branches: [],
  setBranches: (branches) => set({ branches }),

  commits: [],
  setCommits: (commits) => set({ commits }),

  loading: false,
  setLoading: (loading) => set({ loading }),
}));
