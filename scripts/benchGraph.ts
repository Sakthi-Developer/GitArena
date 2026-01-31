/**
 * Benchmark harness for GitArena graph algorithms.
 * Run: npx tsx scripts/benchGraph.ts
 *
 * Measures layout computation, quadtree build, and query times
 * for synthetic graphs of varying sizes.
 */
import {
  generateSyntheticGraph,
  computeLayout,
  buildSpatialIndex,
  topologicalSort,
  isAncestor,
} from '../src/lib/graphAlgo';

interface BenchResult {
  name: string;
  size: number;
  durationMs: number;
  opsPerSec: number;
}

function bench(name: string, size: number, fn: () => void, iterations = 10): BenchResult {
  // Warmup
  fn();
  fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  return {
    name,
    size,
    durationMs: Math.round(avgMs * 100) / 100,
    opsPerSec: Math.round(1000 / avgMs),
  };
}

function printResult(r: BenchResult): void {
  console.log(
    `  ${r.name.padEnd(35)} | n=${String(r.size).padStart(6)} | ${String(r.durationMs).padStart(8)}ms | ${String(r.opsPerSec).padStart(6)} ops/s`,
  );
}

console.log('=== GitArena Graph Benchmark Suite ===\n');

const sizes = [100, 1000, 5000, 10000];

for (const n of sizes) {
  console.log(`--- Size: ${n} commits ---`);

  const graph = generateSyntheticGraph(n);

  // Topological sort
  printResult(bench('topologicalSort', n, () => topologicalSort(graph)));

  // Layout computation
  printResult(bench('computeLayout', n, () => computeLayout(graph)));

  // Quadtree build
  const layout = computeLayout(graph);
  printResult(bench('buildSpatialIndex', n, () => buildSpatialIndex(layout)));

  // Quadtree query (1000 random queries)
  const spatialIndex = buildSpatialIndex(layout);
  printResult(
    bench(
      'quadtree queryNearest (1000x)',
      n,
      () => {
        for (let i = 0; i < 1000; i++) {
          spatialIndex.queryNearest(
            Math.random() * layout.width,
            Math.random() * layout.height,
            30,
          );
        }
      },
      5,
    ),
  );

  // Ancestry check
  const firstOid = graph[0].oid;
  const lastOid = graph[graph.length - 1].oid;
  printResult(
    bench('isAncestor (worst case)', n, () => isAncestor(graph, firstOid, lastOid), 20),
  );

  console.log('');
}

console.log('=== Benchmark Complete ===');

// Performance budget check
console.log('\n--- Performance Budget Check ---');
const largeGraph = generateSyntheticGraph(10000);
const layoutStart = performance.now();
const largeLayout = computeLayout(largeGraph);
const layoutTime = performance.now() - layoutStart;

const indexStart = performance.now();
const largeIndex = buildSpatialIndex(largeLayout);
const indexTime = performance.now() - indexStart;

const LAYOUT_BUDGET_MS = 500;
const INDEX_BUDGET_MS = 100;

const layoutPass = layoutTime < LAYOUT_BUDGET_MS;
const indexPass = indexTime < INDEX_BUDGET_MS;

console.log(
  `  Layout 10k commits:  ${Math.round(layoutTime)}ms (budget: ${LAYOUT_BUDGET_MS}ms) ${layoutPass ? 'PASS' : 'FAIL'}`,
);
console.log(
  `  Index 10k commits:   ${Math.round(indexTime)}ms (budget: ${INDEX_BUDGET_MS}ms) ${indexPass ? 'PASS' : 'FAIL'}`,
);

if (!layoutPass || !indexPass) {
  console.log('\n  WARNING: Performance budget exceeded!');
  process.exit(1);
} else {
  console.log('\n  All performance budgets met.');
}
