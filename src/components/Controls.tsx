import React, { memo, useCallback } from 'react';
import { useAppStore, selectActiveLevelId, selectLevelPassed } from '../state/useAppStore';
import { getEngine, resetEngine } from '../lib/gitEngine';
import { getLevelById } from '../lib/levels';
import { executeCommand } from '../lib/commandParser';

interface ControlsProps {
  onReset?: () => void;
}

export const Controls = memo(function Controls({ onReset }: ControlsProps) {
  const activeLevelId = useAppStore(selectActiveLevelId);
  const levelPassed = useAppStore(selectLevelPassed);

  const handleReset = useCallback(async () => {
    const engine = resetEngine();
    await engine.init();

    if (activeLevelId) {
      const level = getLevelById(activeLevelId);
      if (level) {
        for (const cmd of level.setupCommands) {
          await executeCommand(cmd, engine);
        }
      }
    }

    // Refresh state
    const commits = await engine.allCommits();
    const branch = await engine.currentBranch();
    const branches = await engine.listBranches();
    useAppStore.getState().setCommits(commits);
    useAppStore.getState().setCurrentBranch(branch);
    useAppStore.getState().setBranches(branches);
    useAppStore.getState().clearHistory();
    useAppStore.getState().resetCommandCount();
    useAppStore.getState().setLevelPassed(false);
    onReset?.();
  }, [activeLevelId, onReset]);

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-arena-border bg-arena-surface/50">
      <button
        onClick={handleReset}
        className="btn-ghost text-xs flex items-center gap-0.5"
        aria-label="Reset repository"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.001 7.001 0 0 1 15 8a.75.75 0 0 1-1.5 0A5.5 5.5 0 0 0 8 2.5zM1.75 8a.75.75 0 0 1 .75.75A5.5 5.5 0 0 0 8 13.5a5.487 5.487 0 0 0 4.131-1.869l-1.204-1.204A.25.25 0 0 1 11.104 10h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.001 7.001 0 0 1 1 8.75.75.75 0 0 1 1.75 8z" />
        </svg>
        Reset
      </button>

      {levelPassed && (
        <div className="ml-auto flex items-center gap-1 text-arena-success text-sm font-medium animate-scale-in">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm3.78-9.72a.751.751 0 0 0-1.042-1.08L6.833 9.262 5.207 7.636a.75.75 0 1 0-1.06 1.06l2.18 2.18a.75.75 0 0 0 1.062-.02L11.78 6.28z" />
          </svg>
          Level Complete!
        </div>
      )}
    </div>
  );
});
