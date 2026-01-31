import { describe, it, expect } from 'vitest';
import { validateLevel, getLevelById, levels } from '../lib/levels';
import type { CommitNode } from '../lib/types';

function makeCommit(
  oid: string,
  parents: string[],
  opts?: Partial<CommitNode>,
): CommitNode {
  return {
    oid,
    message: `Commit ${oid}`,
    parents,
    timestamp: Date.now(),
    refs: [],
    isHead: false,
    ...opts,
  };
}

describe('validateLevel', () => {
  describe('intro-commit level', () => {
    const level = getLevelById('intro-commit')!;

    it('passes with enough commits on main', async () => {
      const commits = [
        makeCommit('a', [], { refs: ['main'], isHead: true }),
        makeCommit('b', ['a']),
        makeCommit('c', ['b']),
      ];
      const result = await validateLevel(level, commits, 'main', ['main']);
      expect(result.passed).toBe(true);
    });

    it('fails with too few commits', async () => {
      const commits = [
        makeCommit('a', [], { refs: ['main'], isHead: true }),
      ];
      const result = await validateLevel(level, commits, 'main', ['main']);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('at least');
    });

    it('fails when on wrong branch', async () => {
      const commits = [
        makeCommit('a', []),
        makeCommit('b', ['a']),
        makeCommit('c', ['b'], { isHead: true }),
      ];
      const result = await validateLevel(level, commits, 'feature', ['main', 'feature']);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Expected HEAD on branch');
    });
  });

  describe('branching-out level', () => {
    const level = getLevelById('branching-out')!;

    it('passes with feature branch and commits', async () => {
      const commits = [
        makeCommit('a', []),
        makeCommit('b', ['a'], { refs: ['main'] }),
        makeCommit('c', ['b'], { refs: ['feature'], isHead: true }),
      ];
      const result = await validateLevel(level, commits, 'feature', ['main', 'feature']);
      expect(result.passed).toBe(true);
    });

    it('fails without feature branch', async () => {
      const commits = [
        makeCommit('a', []),
        makeCommit('b', ['a']),
        makeCommit('c', ['b'], { isHead: true }),
      ];
      const result = await validateLevel(level, commits, 'main', ['main']);
      expect(result.passed).toBe(false);
    });
  });

  describe('merge-basics level', () => {
    const level = getLevelById('merge-basics')!;

    it('passes with merge commit', async () => {
      const commits = [
        makeCommit('a', []),
        makeCommit('b', ['a'], { refs: ['feature'] }),
        makeCommit('c', ['b']),
        makeCommit('merge', ['a', 'c'], { refs: ['main'], isHead: true, message: 'Merge' }),
      ];
      const result = await validateLevel(level, commits, 'main', ['main', 'feature']);
      expect(result.passed).toBe(true);
    });

    it('fails without merge commit', async () => {
      const commits = [
        makeCommit('a', []),
        makeCommit('b', ['a'], { refs: ['main'], isHead: true }),
        makeCommit('c', ['a'], { refs: ['feature'] }),
        makeCommit('d', ['c']),
      ];
      const result = await validateLevel(level, commits, 'main', ['main', 'feature']);
      expect(result.passed).toBe(false);
    });
  });

  describe('rebase-flow level', () => {
    const level = getLevelById('rebase-flow')!;

    it('passes with linear rebased history', async () => {
      const commits = [
        makeCommit('a', []),
        makeCommit('b', ['a'], { refs: ['main'] }),
        makeCommit('c', ['b']),
        makeCommit('d', ['c'], { refs: ['feature'], isHead: true }),
      ];
      const result = await validateLevel(level, commits, 'feature', ['main', 'feature']);
      expect(result.passed).toBe(true);
    });

    it('fails with non-linear history (merge)', async () => {
      const commits = [
        makeCommit('a', []),
        makeCommit('b', ['a'], { refs: ['main'] }),
        makeCommit('c', ['a']),
        makeCommit('merge', ['c', 'b'], { refs: ['feature'], isHead: true }),
      ];
      const result = await validateLevel(level, commits, 'feature', ['main', 'feature']);
      expect(result.passed).toBe(false);
    });
  });
});

describe('getLevelById', () => {
  it('returns level for valid ID', () => {
    expect(getLevelById('intro-commit')).toBeDefined();
  });

  it('returns undefined for invalid ID', () => {
    expect(getLevelById('nonexistent')).toBeUndefined();
  });
});

describe('levels array', () => {
  it('has unique IDs', () => {
    const ids = levels.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has valid difficulty values', () => {
    for (const level of levels) {
      expect(['beginner', 'intermediate', 'advanced']).toContain(level.difficulty);
    }
  });
});
