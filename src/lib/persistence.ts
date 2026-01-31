/**
 * LocalStorage persistence with versioned migration.
 * All operations are O(1) amortized (JSON serialization is O(n) on data size).
 */
import type { PersistedState, LevelProgress, UserSettings } from './types';

const STORAGE_KEY = 'gitarena_state';
const CURRENT_VERSION = 1;

const defaultSettings: UserSettings = {
  animationsEnabled: true,
  terminalFontSize: 14,
};

function defaultState(): PersistedState {
  return {
    version: CURRENT_VERSION,
    progress: {},
    settings: { ...defaultSettings },
  };
}

/** Load persisted state from localStorage */
export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw) as Partial<PersistedState>;

    // Migration: if version is older, migrate
    if (!parsed.version || parsed.version < CURRENT_VERSION) {
      return migrate(parsed);
    }

    return {
      version: CURRENT_VERSION,
      progress: parsed.progress ?? {},
      settings: { ...defaultSettings, ...parsed.settings },
    };
  } catch {
    return defaultState();
  }
}

/** Save state to localStorage */
export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

/** Update a level's progress */
export function updateProgress(
  state: PersistedState,
  levelId: string,
  completed: boolean,
  commandCount: number,
): PersistedState {
  const existing = state.progress[levelId];
  const progress: LevelProgress = {
    levelId,
    completed: completed || (existing?.completed ?? false),
    attempts: (existing?.attempts ?? 0) + 1,
    bestCommandCount: existing?.bestCommandCount
      ? Math.min(existing.bestCommandCount, commandCount)
      : commandCount,
    completedAt: completed ? Date.now() : existing?.completedAt,
  };

  return {
    ...state,
    progress: {
      ...state.progress,
      [levelId]: progress,
    },
  };
}

/** Update user settings */
export function updateSettings(
  state: PersistedState,
  settings: Partial<UserSettings>,
): PersistedState {
  return {
    ...state,
    settings: { ...state.settings, ...settings },
  };
}

/** Migrate from older version — O(n) on data size */
function migrate(old: Partial<PersistedState>): PersistedState {
  // v0 -> v1: just ensure shape matches
  return {
    version: CURRENT_VERSION,
    progress: (old.progress as Record<string, LevelProgress>) ?? {},
    settings: { ...defaultSettings, ...(old.settings ?? {}) },
  };
}

/** Clear all persisted data */
export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
