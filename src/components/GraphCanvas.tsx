/**
 * Canvas-based commit graph renderer.
 * Uses requestAnimationFrame for smooth 60fps rendering.
 * Implements LOD (level-of-detail) for large graphs and virtualization.
 */
import React, { memo, useRef, useEffect, useCallback } from 'react';
import { useAppStore, selectLayout, selectView, selectSelectedNode } from '../state/useAppStore';
import { usePanZoom } from '../hooks/usePanZoom';
import { buildSpatialIndex, Quadtree } from '../lib/graphAlgo';
import { graph as graphTokens, colors, typography } from '../styles/tokens';
import type { GraphLayout, LayoutNode, LayoutEdge } from '../lib/types';
import { shortOid } from '../lib/utils';

/**
 * Render the full graph to canvas.
 * Virtualized: only draws nodes/edges visible in the viewport.
 * LOD: simplified rendering when zoom < threshold.
 *
 * Rendering complexity: O(V_visible + E_visible) per frame.
 */
function renderGraph(
  ctx: CanvasRenderingContext2D,
  layout: GraphLayout,
  panX: number,
  panY: number,
  zoom: number,
  width: number,
  height: number,
  selectedNode: string | null,
  quadtree: Quadtree<LayoutNode> | null,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  const isLOD = zoom < 0.3 || layout.nodes.length > graphTokens.lodThreshold;
  const nodeRadius = isLOD ? graphTokens.nodeRadiusLOD : graphTokens.nodeRadius;

  // Determine visible bounds in graph coordinates
  const viewLeft = -panX / zoom - graphTokens.virtualizationPadding;
  const viewTop = -panY / zoom - graphTokens.virtualizationPadding;
  const viewRight = (width - panX) / zoom + graphTokens.virtualizationPadding;
  const viewBottom = (height - panY) / zoom + graphTokens.virtualizationPadding;

  // Get visible nodes — O(k + log n) via quadtree if available
  let visibleNodes: LayoutNode[];
  if (quadtree) {
    visibleNodes = quadtree.queryRect({
      x: viewLeft,
      y: viewTop,
      width: viewRight - viewLeft,
      height: viewBottom - viewTop,
    });
  } else {
    visibleNodes = layout.nodes.filter(
      (n) => n.x >= viewLeft && n.x <= viewRight && n.y >= viewTop && n.y <= viewBottom,
    );
  }

  const visibleOids = new Set(visibleNodes.map((n) => n.oid));

  // Draw edges — only those connecting visible nodes
  ctx.lineWidth = graphTokens.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const edge of layout.edges) {
    if (!visibleOids.has(edge.from) && !visibleOids.has(edge.to)) continue;

    ctx.strokeStyle = edge.color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();

    const pts = edge.points;
    if (pts.length === 2) {
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
    } else if (pts.length === 4) {
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // Draw nodes
  for (const node of visibleNodes) {
    const isSelected = node.oid === selectedNode;
    const isHead = node.isHead;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);

    // Fill
    if (isHead) {
      ctx.fillStyle = node.color;
      ctx.fill();
      // Head glow
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = colors.surface;
      ctx.fill();
      ctx.strokeStyle = node.color;
      ctx.lineWidth = isSelected ? graphTokens.headHighlightWidth : graphTokens.lineWidth;
      ctx.stroke();
    }

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!isLOD) {
      // OID label inside node
      ctx.fillStyle = isHead ? '#ffffff' : colors.text;
      ctx.font = `${typography.weights.medium} ${graphTokens.fontSize - 2}px ${typography.fontMono}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortOid(node.oid), node.x, node.y);

      // Commit message below node
      ctx.fillStyle = colors.textMuted;
      ctx.font = `${typography.weights.normal} ${graphTokens.fontSize - 1}px ${typography.fontSans}`;
      ctx.textAlign = 'center';
      const msg = node.message.length > 30 ? node.message.slice(0, 27) + '...' : node.message;
      ctx.fillText(msg, node.x, node.y + nodeRadius + 16);

      // Branch labels
      if (node.refs.length > 0) {
        let labelX = node.x + nodeRadius + 12;
        const labelY = node.y;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (const ref of node.refs) {
          const text = ref;
          ctx.font = `${typography.weights.semibold} ${graphTokens.fontSize - 1}px ${typography.fontMono}`;
          const metrics = ctx.measureText(text);
          const padX = graphTokens.labelPadding;
          const padY = 4;
          const w = metrics.width + padX * 2;
          const h = 20;

          // Badge background
          ctx.fillStyle = node.color + '25';
          ctx.strokeStyle = node.color + '60';
          ctx.lineWidth = 1;
          roundRect(ctx, labelX, labelY - h / 2, w, h, 6);
          ctx.fill();
          ctx.stroke();

          // Badge text
          ctx.fillStyle = node.color;
          ctx.fillText(text, labelX + padX, labelY + 1);

          // HEAD indicator
          if (node.isHead) {
            const headX = labelX + w + 6;
            ctx.fillStyle = colors.warning;
            ctx.font = `${typography.weights.bold} ${graphTokens.fontSize - 2}px ${typography.fontMono}`;
            ctx.fillText('HEAD', headX, labelY + 1);
          }

          labelX += w + 8;
        }
      }
    }
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export const GraphCanvas = memo(function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const quadtreeRef = useRef<Quadtree<LayoutNode> | null>(null);
  const animFrameRef = useRef<number>(0);

  const layout = useAppStore(selectLayout);
  const view = useAppStore(selectView);
  const selectedNode = useAppStore(selectSelectedNode);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);

  const { resetView, zoomIn, zoomOut } = usePanZoom(canvasRef);

  // Rebuild quadtree when layout changes — O(n log n)
  useEffect(() => {
    if (layout.nodes.length > 0) {
      quadtreeRef.current = buildSpatialIndex(layout);
    } else {
      quadtreeRef.current = null;
    }
  }, [layout]);

  // Canvas resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      renderGraph(ctx, layout, view.panX, view.panY, view.zoom, width, height, selectedNode, quadtreeRef.current);
    });

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [layout, view, selectedNode]);

  // Hit testing on click — O(log n) via quadtree
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !quadtreeRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const { panX, panY, zoom } = useAppStore.getState().view;
      const graphX = (e.clientX - rect.left - panX) / zoom;
      const graphY = (e.clientY - rect.top - panY) / zoom;

      const hit = quadtreeRef.current.queryNearest(graphX, graphY, graphTokens.nodeRadius * 1.5);
      setSelectedNode(hit?.oid ?? null);
    },
    [setSelectedNode],
  );

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-arena-bg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        onClick={handleClick}
        role="img"
        aria-label="Git commit graph visualization"
        tabIndex={0}
      />

      {/* Zoom controls */}
      <div
        className="absolute bottom-3 right-3 flex flex-col gap-0.5 z-10"
        role="toolbar"
        aria-label="Graph zoom controls"
      >
        <button
          onClick={zoomIn}
          className="btn-ghost w-[36px] h-[36px] flex items-center justify-center rounded-lg bg-arena-surface border border-arena-border text-lg"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="btn-ghost w-[36px] h-[36px] flex items-center justify-center rounded-lg bg-arena-surface border border-arena-border text-lg"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          onClick={resetView}
          className="btn-ghost w-[36px] h-[36px] flex items-center justify-center rounded-lg bg-arena-surface border border-arena-border text-xs"
          aria-label="Reset view"
        >
          fit
        </button>
      </div>

      {/* Empty state */}
      {layout.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-arena-textDim text-sm">
          No commits yet. Use the terminal to create commits.
        </div>
      )}
    </div>
  );
});
