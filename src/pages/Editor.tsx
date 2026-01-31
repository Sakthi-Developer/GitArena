import React, { useEffect, useCallback } from 'react';
import { GraphCanvas } from '../components/GraphCanvas';
import { Terminal } from '../components/Terminal';
import { Controls } from '../components/Controls';
import { useAppStore } from '../state/useAppStore';
import { getEngine, resetEngine } from '../lib/gitEngine';

export default function Editor() {
  // Initialize sandbox
  useEffect(() => {
    const setup = async () => {
      useAppStore.getState().setLoading(true);
      useAppStore.getState().setActiveLevelId(null);

      const engine = resetEngine();
      await engine.init();

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
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Controls />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 min-h-[200px]">
          <GraphCanvas />
        </div>
        <div className="h-[250px] md:h-auto md:w-[420px] border-t md:border-t-0 md:border-l border-arena-border relative">
          <Terminal />
        </div>
      </div>
    </div>
  );
}
