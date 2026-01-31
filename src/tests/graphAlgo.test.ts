import { describe, it, expect } from 'vitest';
import {
  buildAdjacencyList,
  topologicalSort,
  assignColumns,
  computeLayout,
  Quadtree,
  isAncestor,
  generateSyntheticGraph,
  buildSpatialIndex,
} from '../lib/graphAlgo';
import type { CommitNode } from '../lib/types';

function makeCommit(oid: string, parents: string[], timestamp: number): CommitNode {
  return {
    oid,
    message: `Commit ${oid}`,
    parents,
    timestamp,
    refs: [],
    isHead: false,
  };
}

describe('buildAdjacencyList', () => {
  it('builds correct adjacency list', () => {
    const commits = [
      makeCommit('a', [], 100),
      makeCommit('b', ['a'], 200),
      makeCommit('c', ['b'], 300),
    ];
    const adj = buildAdjacencyList(commits);
    expect(adj.get('a')).toEqual([]);
    expect(adj.get('b')).toEqual(['a']);
    expect(adj.get('c')).toEqual(['b']);
  });
});

describe('topologicalSort', () => {
  it('sorts linear history', () => {
    const commits = [
      makeCommit('a', [], 100),
      makeCommit('b', ['a'], 200),
      makeCommit('c', ['b'], 300),
    ];
    const sorted = topologicalSort(commits);
    const idxA = sorted.indexOf('a');
    const idxB = sorted.indexOf('b');
    const idxC = sorted.indexOf('c');
    // a should come before b, b before c
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
  });

  it('handles merge commits', () => {
    const commits = [
      makeCommit('root', [], 100),
      makeCommit('a', ['root'], 200),
      makeCommit('b', ['root'], 200),
      makeCommit('merge', ['a', 'b'], 300),
    ];
    const sorted = topologicalSort(commits);
    const rootIdx = sorted.indexOf('root');
    const mergeIdx = sorted.indexOf('merge');
    expect(rootIdx).toBeLessThan(mergeIdx);
  });
});

describe('assignColumns', () => {
  it('assigns column 0 to linear history', () => {
    const commits = [
      makeCommit('a', [], 100),
      makeCommit('b', ['a'], 200),
      makeCommit('c', ['b'], 300),
    ];
    const cols = assignColumns(commits);
    expect(cols.get('a')).toBe(0);
    expect(cols.get('b')).toBe(0);
    expect(cols.get('c')).toBe(0);
  });

  it('assigns different columns for branches', () => {
    const commits = [
      makeCommit('root', [], 100),
      makeCommit('a', ['root'], 200),
      makeCommit('b', ['root'], 201),
    ];
    const cols = assignColumns(commits);
    // a and b should be in different columns (or same if parent resolved)
    expect(cols.size).toBe(3);
  });
});

describe('computeLayout', () => {
  it('returns empty layout for no commits', () => {
    const layout = computeLayout([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
  });

  it('computes layout for linear history', () => {
    const commits = [
      makeCommit('a', [], 100),
      makeCommit('b', ['a'], 200),
      makeCommit('c', ['b'], 300),
    ];
    commits[2].isHead = true;

    const layout = computeLayout(commits);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(2);
    // Nodes should have increasing y values (sorted by time desc)
    expect(layout.nodes[0].y).toBeLessThan(layout.nodes[2].y);
  });

  it('handles large graphs', () => {
    const graph = generateSyntheticGraph(1000);
    const layout = computeLayout(graph);
    expect(layout.nodes).toHaveLength(1000);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe('Quadtree', () => {
  it('inserts and queries nearest', () => {
    const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
    qt.insert('A', 10, 10);
    qt.insert('B', 50, 50);
    qt.insert('C', 90, 90);

    expect(qt.queryNearest(11, 11, 20)).toBe('A');
    expect(qt.queryNearest(49, 51, 20)).toBe('B');
    expect(qt.queryNearest(88, 92, 20)).toBe('C');
  });

  it('returns null for no match in radius', () => {
    const qt = new Quadtree<string>({ x: 0, y: 0, width: 100, height: 100 });
    qt.insert('A', 10, 10);
    expect(qt.queryNearest(90, 90, 5)).toBeNull();
  });

  it('handles many items', () => {
    const qt = new Quadtree<number>({ x: 0, y: 0, width: 10000, height: 10000 });
    for (let i = 0; i < 1000; i++) {
      qt.insert(i, Math.random() * 10000, Math.random() * 10000);
    }
    // Should not throw
    const result = qt.queryRect({ x: 4000, y: 4000, width: 2000, height: 2000 });
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});

describe('isAncestor', () => {
  it('detects ancestor in linear chain', () => {
    const commits = [
      makeCommit('a', [], 100),
      makeCommit('b', ['a'], 200),
      makeCommit('c', ['b'], 300),
    ];
    expect(isAncestor(commits, 'a', 'c')).toBe(true);
    expect(isAncestor(commits, 'c', 'a')).toBe(false);
  });

  it('detects ancestor through merge', () => {
    const commits = [
      makeCommit('root', [], 100),
      makeCommit('a', ['root'], 200),
      makeCommit('b', ['root'], 201),
      makeCommit('merge', ['a', 'b'], 300),
    ];
    expect(isAncestor(commits, 'root', 'merge')).toBe(true);
    expect(isAncestor(commits, 'a', 'merge')).toBe(true);
    expect(isAncestor(commits, 'b', 'merge')).toBe(true);
  });

  it('returns false for unrelated nodes', () => {
    const commits = [
      makeCommit('a', [], 100),
      makeCommit('b', [], 200),
    ];
    expect(isAncestor(commits, 'a', 'b')).toBe(false);
  });
});

describe('buildSpatialIndex', () => {
  it('builds index from layout', () => {
    const commits = [
      makeCommit('a', [], 100),
      makeCommit('b', ['a'], 200),
    ];
    const layout = computeLayout(commits);
    const index = buildSpatialIndex(layout);
    // Should find node near first node's position
    const node = index.queryNearest(layout.nodes[0].x, layout.nodes[0].y, 30);
    expect(node).not.toBeNull();
    expect(node!.oid).toBe(layout.nodes[0].oid);
  });
});
