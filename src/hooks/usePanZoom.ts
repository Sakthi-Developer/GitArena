/**
 * Pan & zoom hook for the graph canvas.
 * Uses requestAnimationFrame-throttled updates for 60fps performance.
 */
import { useCallback, useRef, useEffect } from 'react';
import { useAppStore, selectView } from '../state/useAppStore';
import { clamp, rafThrottle } from '../lib/utils';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.001;

export function usePanZoom(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const view = useAppStore(selectView);
  const setView = useAppStore((s) => s.setView);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const throttledSetView = useRef(
    rafThrottle((v: Partial<typeof view>) => setView(v)),
  ).current;

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panX, panY } = useAppStore.getState().view;

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = clamp(zoom * (1 + delta), MIN_ZOOM, MAX_ZOOM);

        // Zoom toward cursor position
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          const scale = newZoom / zoom;
          const newPanX = cx - (cx - panX) * scale;
          const newPanY = cy - (cy - panY) * scale;
          throttledSetView({ zoom: newZoom, panX: newPanX, panY: newPanY });
        } else {
          throttledSetView({ zoom: newZoom });
        }
      } else {
        // Pan
        throttledSetView({
          panX: panX - e.deltaX,
          panY: panY - e.deltaY,
        });
      }
    },
    [canvasRef, throttledSetView],
  );

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.button === 0 || e.button === 1) {
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };

      const { panX, panY } = useAppStore.getState().view;
      throttledSetView({ panX: panX + dx, panY: panY + dy });
    },
    [throttledSetView],
  );

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointerleave', handlePointerUp);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [canvasRef, handleWheel, handlePointerDown, handlePointerMove, handlePointerUp]);

  const resetView = useCallback(() => {
    setView({ panX: 0, panY: 0, zoom: 1 });
  }, [setView]);

  const zoomIn = useCallback(() => {
    const { zoom } = useAppStore.getState().view;
    setView({ zoom: clamp(zoom * 1.2, MIN_ZOOM, MAX_ZOOM) });
  }, [setView]);

  const zoomOut = useCallback(() => {
    const { zoom } = useAppStore.getState().view;
    setView({ zoom: clamp(zoom / 1.2, MIN_ZOOM, MAX_ZOOM) });
  }, [setView]);

  return { view, resetView, zoomIn, zoomOut };
}
