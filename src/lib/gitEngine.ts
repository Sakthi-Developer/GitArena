/**
 * In-memory Git engine wrapping isomorphic-git.
 * All operations are sandboxed — no network, no real filesystem.
 */
import git from 'isomorphic-git';
import type { CommitNode } from './types';

/** In-memory filesystem compatible with isomorphic-git */
interface FsNode {
  type: 'file' | 'dir';
  content?: Uint8Array;
  children?: Map<string, FsNode>;
}

class MemoryFS {
  private root: FsNode = { type: 'dir', children: new Map() };

  private resolve(filepath: string): string[] {
    return filepath.split('/').filter(Boolean);
  }

  private getParent(parts: string[]): FsNode | null {
    let node = this.root;
    for (let i = 0; i < parts.length - 1; i++) {
      const child = node.children?.get(parts[i]);
      if (!child || child.type !== 'dir') return null;
      node = child;
    }
    return node;
  }

  private mkdirp(parts: string[]): FsNode {
    let node = this.root;
    for (const part of parts) {
      if (!node.children) node.children = new Map();
      let child = node.children.get(part);
      if (!child) {
        child = { type: 'dir', children: new Map() };
        node.children.set(part, child);
      }
      node = child;
    }
    return node;
  }

  readFile(filepath: string): Uint8Array {
    const parts = this.resolve(filepath);
    let node = this.root;
    for (const part of parts) {
      const child = node.children?.get(part);
      if (!child) throw new Error(`ENOENT: ${filepath}`);
      node = child;
    }
    if (node.type !== 'file' || !node.content) throw new Error(`EISDIR: ${filepath}`);
    return node.content;
  }

  writeFile(filepath: string, data: Uint8Array | string): void {
    const parts = this.resolve(filepath);
    const parent = this.mkdirp(parts.slice(0, -1));
    const content = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    if (!parent.children) parent.children = new Map();
    parent.children.set(parts[parts.length - 1], { type: 'file', content });
  }

  unlink(filepath: string): void {
    const parts = this.resolve(filepath);
    const parent = this.getParent(parts);
    if (parent?.children) parent.children.delete(parts[parts.length - 1]);
  }

  readdir(filepath: string): string[] {
    const parts = this.resolve(filepath);
    let node = this.root;
    for (const part of parts) {
      const child = node.children?.get(part);
      if (!child || child.type !== 'dir') throw new Error(`ENOENT: ${filepath}`);
      node = child;
    }
    return Array.from(node.children?.keys() ?? []);
  }

  mkdir(filepath: string): void {
    const parts = this.resolve(filepath);
    this.mkdirp(parts);
  }

  rmdir(filepath: string): void {
    const parts = this.resolve(filepath);
    const parent = this.getParent(parts);
    if (parent?.children) parent.children.delete(parts[parts.length - 1]);
  }

  stat(filepath: string): { type: string; isFile: () => boolean; isDirectory: () => boolean; isSymbolicLink: () => boolean } {
    const parts = this.resolve(filepath);
    let node = this.root;
    if (parts.length === 0) {
      return { type: 'dir', isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false };
    }
    for (const part of parts) {
      const child = node.children?.get(part);
      if (!child) throw new Error(`ENOENT: ${filepath}`);
      node = child;
    }
    return {
      type: node.type,
      isFile: () => node.type === 'file',
      isDirectory: () => node.type === 'dir',
      isSymbolicLink: () => false,
    };
  }

  lstat(filepath: string) {
    return this.stat(filepath);
  }

  /** Snapshot entire fs — O(n) where n = total file count */
  snapshot(): Map<string, Uint8Array> {
    const result = new Map<string, Uint8Array>();
    const walk = (node: FsNode, path: string) => {
      if (node.type === 'file' && node.content) {
        result.set(path, node.content);
      }
      if (node.children) {
        for (const [name, child] of node.children) {
          walk(child, path ? `${path}/${name}` : name);
        }
      }
    };
    walk(this.root, '');
    return result;
  }

  /** Restore from snapshot — O(n) */
  restore(data: Map<string, Uint8Array>): void {
    this.root = { type: 'dir', children: new Map() };
    for (const [path, content] of data) {
      this.writeFile(path, content);
    }
  }
}

/** Promisified FS adapter for isomorphic-git */
function createFsAdapter(memfs: MemoryFS) {
  return {
    promises: {
      readFile: async (path: string) => memfs.readFile(path),
      writeFile: async (path: string, data: Uint8Array | string) => memfs.writeFile(path, data),
      unlink: async (path: string) => memfs.unlink(path),
      readdir: async (path: string) => memfs.readdir(path),
      mkdir: async (path: string) => memfs.mkdir(path),
      rmdir: async (path: string) => memfs.rmdir(path),
      stat: async (path: string) => memfs.stat(path),
      lstat: async (path: string) => memfs.lstat(path),
    },
  };
}

const DIR = '/repo';

export class GitEngine {
  private memfs: MemoryFS;
  private fs: ReturnType<typeof createFsAdapter>;
  private author = { name: 'Player', email: 'player@gitarena.dev' };
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  constructor() {
    this.memfs = new MemoryFS();
    this.fs = createFsAdapter(this.memfs);
  }

  /** Whether the engine has been initialized with a repo */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Ensure the engine is initialized. Safe to call multiple times —
   * returns the same promise if init is already in progress.
   */
  async ensureInitialized(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this.init();
    await this._initPromise;
  }

  /** Initialize a fresh repo */
  async init(): Promise<void> {
    this.memfs = new MemoryFS();
    this.fs = createFsAdapter(this.memfs);
    this._initialized = false;
    await git.init({ fs: this.fs, dir: DIR, defaultBranch: 'main' });
    // Create initial commit
    this.memfs.writeFile(`${DIR}/README.md`, '# GitArena\n');
    await git.add({ fs: this.fs, dir: DIR, filepath: 'README.md' });
    await git.commit({
      fs: this.fs,
      dir: DIR,
      message: 'Initial commit',
      author: this.author,
    });
    this._initialized = true;
    this._initPromise = null;
  }

  /** Create a commit with a generated file change */
  async commit(message: string): Promise<string> {
    const filename = `file-${Date.now()}.txt`;
    this.memfs.writeFile(`${DIR}/${filename}`, `${message}\n`);
    await git.add({ fs: this.fs, dir: DIR, filepath: filename });
    const oid = await git.commit({
      fs: this.fs,
      dir: DIR,
      message,
      author: this.author,
    });
    return oid;
  }

  /** Create a new branch */
  async branch(name: string): Promise<void> {
    await git.branch({ fs: this.fs, dir: DIR, ref: name });
  }

  /** Checkout a branch or commit */
  async checkout(ref: string): Promise<void> {
    await git.checkout({ fs: this.fs, dir: DIR, ref });
  }

  /** Get current branch name */
  async currentBranch(): Promise<string> {
    const branch = await git.currentBranch({ fs: this.fs, dir: DIR });
    return branch || 'HEAD';
  }

  /** List all branches */
  async listBranches(): Promise<string[]> {
    return git.listBranches({ fs: this.fs, dir: DIR });
  }

  /** Delete a branch */
  async deleteBranch(name: string): Promise<void> {
    await git.deleteBranch({ fs: this.fs, dir: DIR, ref: name });
  }

  /** Get HEAD oid */
  async resolveRef(ref: string): Promise<string> {
    return git.resolveRef({ fs: this.fs, dir: DIR, ref });
  }

  /**
   * Get full commit log.
   * O(n) where n = number of commits reachable from ref.
   */
  async log(ref?: string, depth?: number): Promise<CommitNode[]> {
    const resolvedRef = ref ?? (await this.currentBranch());
    const commits = await git.log({
      fs: this.fs,
      dir: DIR,
      ref: resolvedRef,
      depth,
    });

    const branches = await this.listBranches();
    const branchMap = new Map<string, string[]>();

    for (const b of branches) {
      const oid = await git.resolveRef({ fs: this.fs, dir: DIR, ref: b });
      const existing = branchMap.get(oid) ?? [];
      existing.push(b);
      branchMap.set(oid, existing);
    }

    const headOid = await this.resolveRef('HEAD');
    const currentBr = await this.currentBranch();

    return commits.map((c) => ({
      oid: c.oid,
      message: c.commit.message.trim(),
      parents: c.commit.parent,
      timestamp: c.commit.author.timestamp,
      refs: branchMap.get(c.oid) ?? [],
      isHead: c.oid === headOid,
    }));
  }

  /**
   * Get ALL commits across all branches.
   * O(B * C) where B = branches, C = avg commits per branch, deduped with Set.
   */
  async allCommits(): Promise<CommitNode[]> {
    const branches = await this.listBranches();
    const seen = new Set<string>();
    const allNodes: CommitNode[] = [];

    const headOid = await this.resolveRef('HEAD');
    const currentBr = await this.currentBranch();
    const branchMap = new Map<string, string[]>();

    for (const b of branches) {
      const oid = await git.resolveRef({ fs: this.fs, dir: DIR, ref: b });
      const existing = branchMap.get(oid) ?? [];
      existing.push(b);
      branchMap.set(oid, existing);
    }

    for (const b of branches) {
      try {
        const commits = await git.log({ fs: this.fs, dir: DIR, ref: b });
        for (const c of commits) {
          if (seen.has(c.oid)) {
            // Still add branch refs if not yet captured
            const existing = allNodes.find((n) => n.oid === c.oid);
            if (existing) {
              const newRefs = branchMap.get(c.oid) ?? [];
              for (const r of newRefs) {
                if (!existing.refs.includes(r)) existing.refs.push(r);
              }
            }
            continue;
          }
          seen.add(c.oid);
          allNodes.push({
            oid: c.oid,
            message: c.commit.message.trim(),
            parents: c.commit.parent,
            timestamp: c.commit.author.timestamp,
            refs: branchMap.get(c.oid) ?? [],
            isHead: c.oid === headOid,
          });
        }
      } catch {
        // branch may have been deleted during iteration
      }
    }

    return allNodes;
  }

  /**
   * Merge source branch into current branch.
   * Simplified: fast-forward only or creates merge commit.
   */
  async merge(branch: string): Promise<string> {
    const oid = await git.merge({
      fs: this.fs,
      dir: DIR,
      ours: await this.currentBranch(),
      theirs: branch,
      author: this.author,
    });
    return oid.oid ?? '';
  }

  /**
   * Simplified rebase: re-applies commits from current branch onto target.
   * Since we simulate, we collect unique commits and replay them.
   */
  async rebase(onto: string): Promise<void> {
    const currentBr = await this.currentBranch();
    const currentLog = await git.log({ fs: this.fs, dir: DIR, ref: currentBr });
    const ontoLog = await git.log({ fs: this.fs, dir: DIR, ref: onto });
    const ontoOids = new Set(ontoLog.map((c) => c.oid));

    // Find commits unique to current branch
    const uniqueCommits = [];
    for (const c of currentLog) {
      if (ontoOids.has(c.oid)) break;
      uniqueCommits.push(c);
    }
    uniqueCommits.reverse();

    // Checkout onto branch, then replay
    const ontoOid = await this.resolveRef(onto);
    await this.checkout(onto);

    // Create temp branch
    const tempName = `__rebase_${Date.now()}`;
    await this.branch(tempName);
    await this.checkout(tempName);

    // Replay commits
    for (const c of uniqueCommits) {
      await this.commit(c.commit.message.trim());
    }

    // Point original branch here
    const newOid = await this.resolveRef('HEAD');
    // Write branch ref directly
    this.memfs.writeFile(
      `${DIR}/.git/refs/heads/${currentBr}`,
      newOid + '\n',
    );

    await this.checkout(currentBr);

    // Cleanup temp
    try {
      await this.deleteBranch(tempName);
    } catch {
      // ignore
    }
  }

  /**
   * Hard reset current branch to a ref.
   */
  async resetHard(ref: string): Promise<void> {
    const oid = await this.resolveRef(ref);
    const currentBr = await this.currentBranch();
    // Update branch pointer
    this.memfs.writeFile(
      `${DIR}/.git/refs/heads/${currentBr}`,
      oid + '\n',
    );
    await git.checkout({ fs: this.fs, dir: DIR, ref: currentBr, force: true });
  }

  /** Take a snapshot of the current fs state — O(n) files */
  takeSnapshot(): Map<string, Uint8Array> {
    return this.memfs.snapshot();
  }

  /** Restore from a snapshot — O(n) files */
  restoreSnapshot(data: Map<string, Uint8Array>): void {
    this.memfs.restore(data);
  }
}

/** Singleton engine instance */
let engineInstance: GitEngine | null = null;

export function getEngine(): GitEngine {
  if (!engineInstance) {
    engineInstance = new GitEngine();
  }
  return engineInstance;
}

export function resetEngine(): GitEngine {
  engineInstance = new GitEngine();
  return engineInstance;
}
