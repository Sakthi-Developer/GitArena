/**
 * Graph algorithms: adjacency list, topological sort, layout, quadtree.
 * All complexities annotated.
 */
import type { CommitNode, LayoutNode, LayoutEdge, GraphLayout, BBox } from './types';
import { colors, graph as graphTokens } from '../styles/tokens';

// ─── Adjacency List ─────────────────────────────────────────────────────────

/**
 * Build adjacency list from commit nodes.
 * O(V + E) time and space, where V = commits, E = parent edges.
 */
export function buildAdjacencyList(
  commits: CommitNode[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const c of commits) {
    adj.set(c.oid, c.parents);
  }
  return adj;
}

// ─── Topological Sort ───────────────────────────────────────────────────────

/**
 * Kahn's algorithm for topological ordering.
 * O(V + E) time, O(V) space.
 */
export function topologicalSort(commits: CommitNode[]): string[] {
  const oidSet = new Set(commits.map((c) => c.oid));
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const c of commits) {
    if (!inDegree.has(c.oid)) inDegree.set(c.oid, 0);
    for (const p of c.parents) {
      if (!oidSet.has(p)) continue;
      const existing = children.get(p) ?? [];
      existing.push(c.oid);
      children.set(p, existing);
      inDegree.set(c.oid, (inDegree.get(c.oid) ?? 0) + 1);
    }
  }

  // Use index-based queue to avoid O(n) shift() calls
  const queue: string[] = [];
  for (const [oid, deg] of inDegree) {
    if (deg === 0) queue.push(oid);
  }

  const sorted: string[] = [];
  let queueIdx = 0;
  while (queueIdx < queue.length) {
    const node = queue[queueIdx++];
    sorted.push(node);
    for (const child of children.get(node) ?? []) {
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }

  // Remaining nodes (cycles or disconnected) — add them
  const sortedSet = new Set(sorted);
  for (const c of commits) {
    if (!sortedSet.has(c.oid)) sorted.push(c.oid);
  }

  return sorted;
}

// ─── Column Assignment ──────────────────────────────────────────────────────

/**
 * Assign columns to commits for a clean branch layout.
 * Uses a greedy lane-allocation strategy.
 * O(V + E) time, O(V) space.
 */
export function assignColumns(commits: CommitNode[]): Map<string, number> {
  const columns = new Map<string, number>();
  const activeLanes: Array<string | null> = [];

  // Build oid set once — O(V)
  const oidSet = new Set(commits.map((c) => c.oid));

  // Process in reverse topological order (newest first — commits are sorted by time desc)
  const sorted = [...commits].sort((a, b) => b.timestamp - a.timestamp);

  // Map from oid -> reserved lane index for O(1) lookups
  const reservations = new Map<string, number>();

  for (const commit of sorted) {
    // Check if a lane is reserved for this commit — O(1) via map
    let col = reservations.get(commit.oid) ?? -1;
    if (col !== -1) {
      activeLanes[col] = null; // Free the lane
      reservations.delete(commit.oid);
    }

    // No reservation — find the first free lane
    if (col === -1) {
      col = activeLanes.indexOf(null);
      if (col === -1) {
        col = activeLanes.length;
        activeLanes.push(null);
      }
    }

    columns.set(commit.oid, col);

    // Reserve lanes for parents
    for (let i = 0; i < commit.parents.length; i++) {
      const parent = commit.parents[i];
      if (!oidSet.has(parent)) continue;
      if (columns.has(parent) || reservations.has(parent)) continue;

      // First parent gets our lane; others get new lanes
      let laneIdx: number;
      if (i === 0 && activeLanes[col] === null) {
        laneIdx = col;
      } else {
        laneIdx = activeLanes.indexOf(null);
        if (laneIdx === -1) {
          laneIdx = activeLanes.length;
          activeLanes.push(null);
        }
      }
      activeLanes[laneIdx] = parent;
      reservations.set(parent, laneIdx);
    }
  }

  return columns;
}

// ─── Layout Algorithm ───────────────────────────────────────────────────────

/**
 * Compute full graph layout with positions and edges.
 * O(V + E) time for layout, O(V + E) space for result.
 */
export function computeLayout(commits: CommitNode[]): GraphLayout {
  if (commits.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const columns = assignColumns(commits);
  const sorted = [...commits].sort((a, b) => b.timestamp - a.timestamp);
  const oidToIndex = new Map<string, number>();
  sorted.forEach((c, i) => oidToIndex.set(c.oid, i));

  const { colSpacing, rowSpacing } = graphTokens;
  const padding = 60;

  const nodes: LayoutNode[] = sorted.map((commit, row) => {
    const col = columns.get(commit.oid) ?? 0;
    const colorIdx = col % colors.branchColors.length;
    return {
      oid: commit.oid,
      x: padding + col * colSpacing,
      y: padding + row * rowSpacing,
      col,
      row,
      color: colors.branchColors[colorIdx],
      parents: commit.parents,
      refs: commit.refs,
      message: commit.message,
      isHead: commit.isHead,
    };
  });

  const nodeMap = new Map<string, LayoutNode>();
  for (const n of nodes) nodeMap.set(n.oid, n);

  const edges: LayoutEdge[] = [];
  for (const node of nodes) {
    for (const parentOid of node.parents) {
      const parent = nodeMap.get(parentOid);
      if (!parent) continue;

      // Bezier control points for smooth curves
      const points = [];
      if (node.col === parent.col) {
        // Straight line
        points.push({ x: node.x, y: node.y });
        points.push({ x: parent.x, y: parent.y });
      } else {
        // Curved: from child, curve to parent column
        const midY = (node.y + parent.y) / 2;
        points.push({ x: node.x, y: node.y });
        points.push({ x: node.x, y: midY });
        points.push({ x: parent.x, y: midY });
        points.push({ x: parent.x, y: parent.y });
      }

      edges.push({
        from: node.oid,
        to: parentOid,
        color: node.color,
        points,
      });
    }
  }

  const maxCol = Math.max(...nodes.map((n) => n.col), 0);
  const width = padding * 2 + maxCol * colSpacing;
  const height = padding * 2 + (nodes.length - 1) * rowSpacing;

  return { nodes, edges, width: Math.max(width, 200), height: Math.max(height, 200) };
}

// ─── Quadtree for Hit Testing ───────────────────────────────────────────────

interface QuadtreeNode<T> {
  bounds: BBox;
  items: Array<{ item: T; x: number; y: number }>;
  children: Array<QuadtreeNode<T>> | null;
}

/**
 * Quadtree spatial index for O(log n) point queries.
 * Build: O(n log n), Query: O(log n) average.
 */
export class Quadtree<T> {
  private root: QuadtreeNode<T>;
  private maxItems: number;
  private maxDepth: number;

  constructor(bounds: BBox, maxItems = 4, maxDepth = 8) {
    this.root = { bounds, items: [], children: null };
    this.maxItems = maxItems;
    this.maxDepth = maxDepth;
  }

  /** Insert an item — O(log n) average */
  insert(item: T, x: number, y: number): void {
    this.insertInto(this.root, { item, x, y }, 0);
  }

  private insertInto(
    node: QuadtreeNode<T>,
    entry: { item: T; x: number; y: number },
    depth: number,
  ): void {
    if (!this.inBounds(node.bounds, entry.x, entry.y)) return;

    if (node.children === null) {
      node.items.push(entry);
      if (node.items.length > this.maxItems && depth < this.maxDepth) {
        this.subdivide(node);
      }
      return;
    }

    for (const child of node.children) {
      if (this.inBounds(child.bounds, entry.x, entry.y)) {
        this.insertInto(child, entry, depth + 1);
        return;
      }
    }
    node.items.push(entry);
  }

  private subdivide(node: QuadtreeNode<T>): void {
    const { x, y, width, height } = node.bounds;
    const hw = width / 2;
    const hh = height / 2;

    node.children = [
      { bounds: { x, y, width: hw, height: hh }, items: [], children: null },
      { bounds: { x: x + hw, y, width: hw, height: hh }, items: [], children: null },
      { bounds: { x, y: y + hh, width: hw, height: hh }, items: [], children: null },
      { bounds: { x: x + hw, y: y + hh, width: hw, height: hh }, items: [], children: null },
    ];

    const oldItems = node.items;
    node.items = [];
    for (const entry of oldItems) {
      let placed = false;
      for (const child of node.children) {
        if (this.inBounds(child.bounds, entry.x, entry.y)) {
          child.items.push(entry);
          placed = true;
          break;
        }
      }
      if (!placed) node.items.push(entry);
    }
  }

  /**
   * Find nearest item to point within radius.
   * O(log n) average case.
   */
  queryNearest(x: number, y: number, radius: number): T | null {
    let best: T | null = null;
    let bestDist = radius * radius;
    this.queryNode(this.root, x, y, radius, (item, ix, iy) => {
      const d = (ix - x) ** 2 + (iy - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    });
    return best;
  }

  /**
   * Query all items within a rectangular region.
   * O(k + log n) where k = items found.
   */
  queryRect(rect: BBox): T[] {
    const results: T[] = [];
    this.queryRectNode(this.root, rect, results);
    return results;
  }

  private queryRectNode(node: QuadtreeNode<T>, rect: BBox, results: T[]): void {
    if (!this.boundsOverlap(node.bounds, rect)) return;
    for (const entry of node.items) {
      if (
        entry.x >= rect.x &&
        entry.x <= rect.x + rect.width &&
        entry.y >= rect.y &&
        entry.y <= rect.y + rect.height
      ) {
        results.push(entry.item);
      }
    }
    if (node.children) {
      for (const child of node.children) {
        this.queryRectNode(child, rect, results);
      }
    }
  }

  private queryNode(
    node: QuadtreeNode<T>,
    x: number,
    y: number,
    radius: number,
    callback: (item: T, x: number, y: number) => void,
  ): void {
    const searchBounds: BBox = {
      x: x - radius,
      y: y - radius,
      width: radius * 2,
      height: radius * 2,
    };
    if (!this.boundsOverlap(node.bounds, searchBounds)) return;

    for (const entry of node.items) {
      callback(entry.item, entry.x, entry.y);
    }
    if (node.children) {
      for (const child of node.children) {
        this.queryNode(child, x, y, radius, callback);
      }
    }
  }

  private inBounds(bounds: BBox, x: number, y: number): boolean {
    return (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    );
  }

  private boundsOverlap(a: BBox, b: BBox): boolean {
    return !(
      a.x > b.x + b.width ||
      a.x + a.width < b.x ||
      a.y > b.y + b.height ||
      a.y + a.height < b.y
    );
  }
}

// ─── Ancestry Query ─────────────────────────────────────────────────────────

/**
 * Check if `ancestor` is an ancestor of `descendant`.
 * BFS traversal: O(V + E) worst case.
 */
export function isAncestor(
  commits: CommitNode[],
  ancestor: string,
  descendant: string,
): boolean {
  const commitMap = new Map<string, CommitNode>();
  for (const c of commits) commitMap.set(c.oid, c);

  const visited = new Set<string>();
  const queue = [descendant];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === ancestor) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = commitMap.get(current);
    if (node) {
      for (const p of node.parents) {
        if (!visited.has(p)) queue.push(p);
      }
    }
  }

  return false;
}

/**
 * Build a spatial index for the current layout.
 * O(n log n) build time.
 */
export function buildSpatialIndex(layout: GraphLayout): Quadtree<LayoutNode> {
  const qt = new Quadtree<LayoutNode>(
    { x: 0, y: 0, width: layout.width + 200, height: layout.height + 200 },
    4,
    10,
  );
  for (const node of layout.nodes) {
    qt.insert(node, node.x, node.y);
  }
  return qt;
}

// ─── Synthetic Graph Generator (for benchmarks) ────────────────────────────

/**
 * Generate a synthetic commit graph with N commits and branching.
 * O(N) time and space.
 */
export function generateSyntheticGraph(n: number, branchFactor = 3): CommitNode[] {
  const commits: CommitNode[] = [];
  const branches: string[] = ['main'];
  const branchHeads = new Map<string, string>();

  for (let i = 0; i < n; i++) {
    const oid = i.toString(16).padStart(40, '0');
    const branchIdx = i % branches.length;
    const branchName = branches[branchIdx];

    const parents: string[] = [];
    const headOid = branchHeads.get(branchName);
    if (headOid) parents.push(headOid);

    // Occasionally merge from another branch
    if (i > 10 && i % 7 === 0 && branches.length > 1) {
      const otherIdx = (branchIdx + 1) % branches.length;
      const otherHead = branchHeads.get(branches[otherIdx]);
      if (otherHead && !parents.includes(otherHead)) {
        parents.push(otherHead);
      }
    }

    commits.push({
      oid,
      message: `Commit ${i}`,
      parents,
      timestamp: 1700000000 + i * 60,
      refs: i === n - 1 ? [branchName] : [],
      isHead: i === n - 1,
    });

    branchHeads.set(branchName, oid);

    // Create new branches occasionally
    if (i > 0 && i % Math.floor(n / branchFactor) === 0 && branches.length < 8) {
      const newBranch = `feature-${branches.length}`;
      branches.push(newBranch);
      branchHeads.set(newBranch, oid);
    }
  }

  return commits;
}
