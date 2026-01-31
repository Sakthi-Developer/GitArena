/**
 * Level definitions and validators for GitArena.
 * Each level has setup commands, goal description, and a validator.
 */
import type { Level, LevelValidator, CommitNode } from './types';

export const levels: Level[] = [
  {
    id: 'intro-commit',
    title: 'Your First Commit',
    description: 'Learn the basics of creating commits in Git.',
    difficulty: 'beginner',
    category: 'Basics',
    setupCommands: [],
    goal: 'Create two new commits on the main branch. Use `git commit -m "message"` to create each commit.',
    hints: [
      'Type: git commit -m "Add feature"',
      'Then commit again: git commit -m "Update feature"',
    ],
    validator: {
      expectedBranches: { main: null },
      expectedHead: 'main',
      minCommits: 3, // initial + 2 new
    },
  },
  {
    id: 'branching-out',
    title: 'Branching Out',
    description: 'Create a new branch and make commits on it.',
    difficulty: 'beginner',
    category: 'Branches',
    setupCommands: [
      'git commit -m "Setup commit"',
    ],
    goal: 'Create a branch called "feature" and make one commit on it.',
    hints: [
      'First: git branch feature',
      'Then: git checkout feature',
      'Finally: git commit -m "Feature work"',
    ],
    validator: {
      expectedBranches: { main: null, feature: null },
      expectedHead: 'feature',
      minCommits: 3,
    },
  },
  {
    id: 'merge-basics',
    title: 'Merge Mastery',
    description: 'Merge a feature branch back into main.',
    difficulty: 'intermediate',
    category: 'Merging',
    setupCommands: [
      'git commit -m "Base work"',
      'git branch feature',
      'git checkout feature',
      'git commit -m "Feature A"',
      'git commit -m "Feature B"',
    ],
    goal: 'Switch to main and merge the "feature" branch into it.',
    hints: [
      'Switch: git checkout main',
      'Merge: git merge feature',
    ],
    validator: {
      expectedBranches: { main: null, feature: null },
      expectedHead: 'main',
      minCommits: 4,
      customCheck: 'merge-contains-feature',
    },
  },
  {
    id: 'rebase-flow',
    title: 'Rebase Rhythm',
    description: 'Rebase your feature branch onto an updated main.',
    difficulty: 'advanced',
    category: 'Rebasing',
    setupCommands: [
      'git commit -m "Main update 1"',
      'git branch feature',
      'git checkout feature',
      'git commit -m "Feature work"',
      'git checkout main',
      'git commit -m "Main update 2"',
      'git checkout feature',
    ],
    goal: 'Rebase the "feature" branch onto main so your feature commits come after main\'s latest.',
    hints: [
      'While on feature: git rebase main',
    ],
    validator: {
      expectedBranches: { main: null, feature: null },
      expectedHead: 'feature',
      minCommits: 4,
      customCheck: 'rebase-linear',
    },
  },
];

/**
 * Validate whether the current state matches the level's requirements.
 * O(V + E) for graph traversal checks.
 */
export async function validateLevel(
  level: Level,
  commits: CommitNode[],
  currentBranch: string,
  branches: string[],
): Promise<{ passed: boolean; message: string }> {
  const v = level.validator;

  // Check expected HEAD branch
  if (v.expectedHead && currentBranch !== v.expectedHead) {
    return {
      passed: false,
      message: `Expected HEAD on branch "${v.expectedHead}", but you're on "${currentBranch}".`,
    };
  }

  // Check expected branches exist
  for (const branchName of Object.keys(v.expectedBranches)) {
    if (!branches.includes(branchName)) {
      return {
        passed: false,
        message: `Expected branch "${branchName}" to exist.`,
      };
    }
  }

  // Check minimum commit count
  if (v.minCommits && commits.length < v.minCommits) {
    return {
      passed: false,
      message: `Need at least ${v.minCommits} commits, found ${commits.length}.`,
    };
  }

  // Check expected messages
  if (v.expectedMessages) {
    const messages = commits.map((c) => c.message.toLowerCase());
    for (const expected of v.expectedMessages) {
      if (!messages.some((m) => m.includes(expected.toLowerCase()))) {
        return {
          passed: false,
          message: `Missing expected commit message containing "${expected}".`,
        };
      }
    }
  }

  // Custom checks
  if (v.customCheck) {
    const result = runCustomCheck(v.customCheck, commits, currentBranch, branches);
    if (!result.passed) return result;
  }

  return { passed: true, message: 'Level completed!' };
}

function runCustomCheck(
  checkId: string,
  commits: CommitNode[],
  currentBranch: string,
  branches: string[],
): { passed: boolean; message: string } {
  switch (checkId) {
    case 'merge-contains-feature': {
      // HEAD commit should have 2 parents (merge commit)
      const headCommit = commits.find((c) => c.isHead);
      if (!headCommit) {
        return { passed: false, message: 'No HEAD commit found.' };
      }
      if (headCommit.parents.length < 2) {
        return {
          passed: false,
          message: 'HEAD should be a merge commit with two parents. Did you merge the feature branch?',
        };
      }
      return { passed: true, message: 'Merge verified!' };
    }

    case 'rebase-linear': {
      // After rebase, the feature branch commits should form a linear chain
      const headCommit = commits.find((c) => c.isHead);
      if (!headCommit) {
        return { passed: false, message: 'No HEAD commit found.' };
      }
      // Walk back — all should have exactly 1 parent
      let current = headCommit;
      let depth = 0;
      while (current && depth < 20) {
        if (current.parents.length > 1) {
          return {
            passed: false,
            message: 'History is not linear. Did you rebase (not merge)?',
          };
        }
        const parent = commits.find((c) => c.oid === current.parents[0]);
        if (!parent) break;
        current = parent;
        depth++;
      }
      return { passed: true, message: 'Clean linear history!' };
    }

    default:
      return { passed: true, message: '' };
  }
}

/** Get a level by ID — O(n) but n is small */
export function getLevelById(id: string): Level | undefined {
  return levels.find((l) => l.id === id);
}
