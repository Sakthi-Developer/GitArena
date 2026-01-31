/** Core domain types for GitArena */

/** Represents a single commit node in the graph */
export interface CommitNode {
  oid: string;
  message: string;
  parents: string[];
  timestamp: number;
  /** Branch names pointing at this commit */
  refs: string[];
  /** Whether HEAD points here */
  isHead: boolean;
}

/** Layout position for a commit in the visual graph */
export interface LayoutNode {
  oid: string;
  x: number;
  y: number;
  col: number;
  row: number;
  color: string;
  parents: string[];
  refs: string[];
  message: string;
  isHead: boolean;
}

/** Edge between two layout nodes */
export interface LayoutEdge {
  from: string;
  to: string;
  color: string;
  /** Control points for curved edges */
  points: Array<{ x: number; y: number }>;
}

/** Full layout result */
export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

/** Quadtree bounding box */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pan/zoom state */
export interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
}

/** Terminal command result */
export interface CommandResult {
  success: boolean;
  output: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

/** Terminal history entry */
export interface HistoryEntry {
  command: string;
  result: CommandResult;
  timestamp: number;
}

/** Parsed command */
export interface ParsedCommand {
  base: string;
  subcommand: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

/** Level definition */
export interface Level {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  /** Commands to set up initial state */
  setupCommands: string[];
  /** Goal description shown to user */
  goal: string;
  hints: string[];
  /** Validator checks whether the current state matches the target */
  validator: LevelValidator;
}

export interface LevelValidator {
  /** Expected branches and their target OIDs (relative, e.g., "HEAD~1") */
  expectedBranches: Record<string, string | null>;
  /** Expected HEAD ref */
  expectedHead: string;
  /** Minimum commit count */
  minCommits?: number;
  /** Expected commit messages (partial match) */
  expectedMessages?: string[];
  /** Custom validator ID for complex checks */
  customCheck?: string;
}

/** User progress for a level */
export interface LevelProgress {
  levelId: string;
  completed: boolean;
  attempts: number;
  bestCommandCount: number;
  completedAt?: number;
}

/** Full persisted state */
export interface PersistedState {
  version: number;
  progress: Record<string, LevelProgress>;
  settings: UserSettings;
}

export interface UserSettings {
  animationsEnabled: boolean;
  terminalFontSize: number;
}

/** Snapshot for undo/redo — structural sharing via immutable ref */
export interface Snapshot {
  id: number;
  timestamp: number;
  /** Serialized fs state (lightweight diff from previous) */
  fsData: Map<string, Uint8Array>;
  commitGraph: CommitNode[];
}

/** i18n key type */
export type I18nKey = string;
