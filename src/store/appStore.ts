import { create } from 'zustand';
import type { AppView, Project, Voice, GitHubTag, CategorizedChanges, Changelog } from '@/types';

interface AppState {
  // View management
  view: AppView;
  setView: (view: AppView) => void;

  // Project management
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  selectedProject: Project | null;
  selectedProjectId: string | null;
  selectProject: (id: string) => void;
  setSelectedProject: (project: Project | null) => void;

  // Wizard state
  wizardStep: number;
  setWizardStep: (step: number) => void;
  validatedRepo: Record<string, unknown> | null;
  setValidatedRepo: (repo: Record<string, unknown> | null) => void;
  tags: GitHubTag[];
  setTags: (tags: GitHubTag[]) => void;
  fromRef: string;
  setFromRef: (ref: string) => void;
  toRef: string;
  setToRef: (ref: string) => void;
  includePRs: boolean;
  setIncludePRs: (include: boolean) => void;
  voice: Voice;
  setVoice: (voice: Voice) => void;

  // Changelog state
  categorizedChanges: CategorizedChanges | null;
  setCategorizedChanges: (changes: CategorizedChanges | null) => void;
  currentChangelog: Changelog | null;
  setCurrentChangelog: (changelog: Changelog | null) => void;
  projectChangelogs: Changelog[];
  setProjectChangelogs: (changelogs: Changelog[]) => void;
  editedMarkdown: string;
  setEditedMarkdown: (markdown: string) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;

  // New project dialog
  isNewProjectDialogOpen: boolean;
  setIsNewProjectDialogOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // View management
  view: 'dashboard',
  setView: (view) => set({ view }),

  // Project management
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
  removeProject: (id) => set((state) => ({
    projects: state.projects.filter((p) => p.id !== id),
  })),
  selectedProject: null,
  selectedProjectId: null,
  selectProject: (id) => set({ selectedProjectId: id }),
  setSelectedProject: (project) => set({ selectedProject: project }),

  // Wizard state
  wizardStep: 1,
  setWizardStep: (step) => set({ wizardStep: step }),
  validatedRepo: null,
  setValidatedRepo: (repo) => set({ validatedRepo: repo }),
  tags: [],
  setTags: (tags) => set({ tags }),
  fromRef: '',
  setFromRef: (ref) => set({ fromRef: ref }),
  toRef: '',
  setToRef: (ref) => set({ toRef: ref }),
  includePRs: false,
  setIncludePRs: (include) => set({ includePRs: include }),
  voice: 'developer',
  setVoice: (voice) => set({ voice }),

  // Changelog state
  categorizedChanges: null,
  setCategorizedChanges: (changes) => set({ categorizedChanges: changes }),
  currentChangelog: null,
  setCurrentChangelog: (changelog) => set({ currentChangelog: changelog }),
  projectChangelogs: [],
  setProjectChangelogs: (changelogs) => set({ projectChangelogs: changelogs }),
  editedMarkdown: '',
  setEditedMarkdown: (markdown) => set({ editedMarkdown: markdown }),
  isGenerating: false,
  setIsGenerating: (generating) => set({ isGenerating: generating }),

  // New project dialog
  isNewProjectDialogOpen: false,
  setIsNewProjectDialogOpen: (open) => set({ isNewProjectDialogOpen: open }),
}));
