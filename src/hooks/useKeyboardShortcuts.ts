/**
 * Global keyboard shortcuts hook.
 * Supports focus management and accessibility.
 */
import { useEffect, useCallback } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * Register keyboard shortcuts — O(1) per keypress.
 * Keys format: "ctrl+z", "shift+/", "escape", etc.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Only allow Escape in inputs
        if (e.key !== 'Escape') return;
      }

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');

      const key = e.key.toLowerCase();
      if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
        parts.push(key);
      }

      const combo = parts.join('+');
      const handler = shortcuts[combo] ?? shortcuts[e.key.toLowerCase()];

      if (handler) {
        e.preventDefault();
        handler();
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
