/**
 * Zustand store — single source of truth for GitArena.
 * Uses selectors and memoized derived state to minimize re-renders.
 */
import { create } from 'zustand';
import type {
  CommitNode,
  GraphLayout,
  HistoryEntry,
  ViewState,
  PersistedState,
  Snapshot,
} from '../lib/types';
import { computeLayout } from '../lib/graphAlgo';
import { loadState, saveState, updateProgress } from '../lib/persistence';

interface AppState {
  // Git state
  commits: CommitNode[];
  currentBranch: string;
  branches: string[];
  layout: GraphLayout;
  selectedNode: string | null;

  // Terminal
  history: HistoryEntry[];
  commandCount: number;

  // View
  view: ViewState;

  // Level
  activeLevelId: string | null;
  levelPassed: boolean;

  // Undo/Redo snapshots (structural sharing via array ref)
  snapshots: Snapshot[];
  snapshotIndex: number;

  // Persisted
  persisted: PersistedState;

  // Loading
  isLoading: boolean;
  engineReady: boolean;

  // Actions
  setCommits: (commits: CommitNode[]) => void;
  setCurrentBranch: (branch: string) => void;
  setBranches: (branches: string[]) => void;
  setSelectedNode: (oid: string | null) => void;
  addHistory: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  incrementCommandCount: () => void;
  resetCommandCount: () => void;
  setView: (view: Partial<ViewState>) => void;
  setActiveLevelId: (id: string | null) => void;
  setLevelPassed: (passed: boolean) => void;
  pushSnapshot: (snapshot: Snapshot) => void;
  setLoading: (loading: boolean) => void;
  setEngineReady: (ready: boolean) => void;
  markLevelComplete: (levelId: string, commandCount: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  commits: [],
  currentBranch: 'main',
  branches: ['main'],
  layout: { nodes: [], edges: [], width: 0, height: 0 },
  selectedNode: null,

  history: [],
  commandCount: 0,

  view: { panX: 0, panY: 0, zoom: 1 },

  activeLevelId: null,
  levelPassed: false,

  snapshots: [],
  snapshotIndex: -1,

  persisted: loadState(),

  isLoading: false,
  engineReady: false,

  // Actions
  setCommits: (commits) => {
    const layout = computeLayout(commits);
    set({ commits, layout });
  },

  setCurrentBranch: (currentBranch) => set({ currentBranch }),
  setBranches: (branches) => set({ branches }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),

  addHistory: (entry) =>
    set((s) => ({ history: [...s.history, entry] })),

  clearHistory: () => set({ history: [] }),

  incrementCommandCount: () =>
    set((s) => ({ commandCount: s.commandCount + 1 })),

  resetCommandCount: () => set({ commandCount: 0 }),

  setView: (partial) =>
    set((s) => ({ view: { ...s.view, ...partial } })),

  setActiveLevelId: (activeLevelId) =>
    set({ activeLevelId, levelPassed: false, commandCount: 0 }),

  setLevelPassed: (levelPassed) => set({ levelPassed }),

  pushSnapshot: (snapshot) =>
    set((s) => {
      // Discard any future snapshots (redo stack) when new action happens
      const trimmed = s.snapshots.slice(0, s.snapshotIndex + 1);
      const next = [...trimmed, snapshot];
      // Keep max 50 snapshots to limit memory
      const capped = next.length > 50 ? next.slice(next.length - 50) : next;
      return { snapshots: capped, snapshotIndex: capped.length - 1 };
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setEngineReady: (engineReady) => set({ engineReady }),

  markLevelComplete: (levelId, commandCount) => {
    const { persisted } = get();
    const next = updateProgress(persisted, levelId, true, commandCount);
    saveState(next);
    set({ persisted: next, levelPassed: true });
  },
}));

// ─── Selectors (memoized via Zustand's shallow comparison) ──────────────────

export const selectLayout = (s: AppState) => s.layout;
export const selectCommits = (s: AppState) => s.commits;
export const selectHistory = (s: AppState) => s.history;
export const selectView = (s: AppState) => s.view;
export const selectSelectedNode = (s: AppState) => s.selectedNode;
export const selectCurrentBranch = (s: AppState) => s.currentBranch;
export const selectBranches = (s: AppState) => s.branches;
export const selectActiveLevelId = (s: AppState) => s.activeLevelId;
export const selectLevelPassed = (s: AppState) => s.levelPassed;
export const selectProgress = (s: AppState) => s.persisted.progress;
export const selectSettings = (s: AppState) => s.persisted.settings;
export const selectEngineReady = (s: AppState) => s.engineReady;
export const selectIsLoading = (s: AppState) => s.isLoading;
