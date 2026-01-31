import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GraphCanvas } from '../components/GraphCanvas';
import { Terminal } from '../components/Terminal';
import { Controls } from '../components/Controls';
import { useAppStore } from '../state/useAppStore';
import { getEngine, resetEngine } from '../lib/gitEngine';
import { getLevelById, validateLevel } from '../lib/levels';
import { executeCommand } from '../lib/commandParser';

export default function PlayLevel() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const [goalExpanded, setGoalExpanded] = useState(true);
  const [hintIdx, setHintIdx] = useState(-1);

  const level = levelId ? getLevelById(levelId) : undefined;

  // Initialize level
  useEffect(() => {
    if (!level) return;

    const setup = async () => {
      useAppStore.getState().setLoading(true);
      useAppStore.getState().setActiveLevelId(level.id);

      const engine = resetEngine();
      await engine.init();

      // Run setup commands
      for (const cmd of level.setupCommands) {
        await executeCommand(cmd, engine);
      }

      const commits = await engine.allCommits();
      const branch = await engine.currentBranch();
      const branches = await engine.listBranches();
      useAppStore.getState().setCommits(commits);
      useAppStore.getState().setCurrentBranch(branch);
      useAppStore.getState().setBranches(branches);
      useAppStore.getState().clearHistory();
      useAppStore.getState().setEngineReady(true);
      useAppStore.getState().setLoading(false);
    };

    setup();

    return () => {
      useAppStore.getState().setActiveLevelId(null);
    };
  }, [level]);

  // Validate after each command
  const handleCommandExecuted = useCallback(async () => {
    if (!level) return;
    const engine = getEngine();
    const commits = await engine.allCommits();
    const branch = await engine.currentBranch();
    const branches = await engine.listBranches();

    const result = await validateLevel(level, commits, branch, branches);
    if (result.passed) {
      const cmdCount = useAppStore.getState().commandCount;
      useAppStore.getState().markLevelComplete(level.id, cmdCount);
    }
  }, [level]);

  if (!level) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-arena-text mb-1">Level not found</h2>
          <p className="text-arena-textMuted mb-2">The level "{levelId}" doesn't exist.</p>
          <button onClick={() => navigate('/')} className="btn-primary text-sm">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Goal panel */}
      <div className="border-b border-arena-border bg-arena-surface/50">
        <button
          className="w-full flex items-center justify-between px-3 py-1.5 text-left"
          onClick={() => setGoalExpanded(!goalExpanded)}
          aria-expanded={goalExpanded}
          aria-controls="goal-panel"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-arena-text">{level.title}</span>
            <span className="text-[11px] text-arena-textDim font-mono px-1 py-[1px] bg-arena-bg rounded">
              {level.difficulty}
            </span>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`text-arena-textDim transition-transform ${goalExpanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M12.78 5.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 6.28a.75.75 0 0 1 1.06-1.06L8 8.94l3.72-3.72a.75.75 0 0 1 1.06 0z" />
          </svg>
        </button>

        {goalExpanded && (
          <div id="goal-panel" className="px-3 pb-2 animate-fade-in">
            <p className="text-sm text-arena-textMuted leading-relaxed mb-1.5">{level.goal}</p>
            {level.hints.length > 0 && (
              <div>
                <button
                  onClick={() => setHintIdx((i) => Math.min(i + 1, level.hints.length - 1))}
                  className="text-xs text-arena-accent hover:text-arena-accentHover transition-colors"
                >
                  {hintIdx < 0 ? 'Show hint' : hintIdx < level.hints.length - 1 ? 'Next hint' : 'No more hints'}
                </button>
                {hintIdx >= 0 && (
                  <p className="text-xs text-arena-warning font-mono mt-0.5 animate-fade-in">
                    Hint: {level.hints[hintIdx]}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Controls />

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 min-h-[200px]">
          <GraphCanvas />
        </div>
        <div className="h-[250px] md:h-auto md:w-[400px] border-t md:border-t-0 md:border-l border-arena-border relative">
          <Terminal onCommandExecuted={handleCommandExecuted} />
        </div>
      </div>
    </div>
  );
}
