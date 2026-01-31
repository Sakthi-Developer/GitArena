import React from 'react';
import { levels } from '../lib/levels';
import { LevelCard } from '../components/LevelCard';
import { useAppStore, selectProgress } from '../state/useAppStore';

export default function Home() {
  const progress = useAppStore(selectProgress);
  const completedCount = Object.values(progress).filter((p) => p.completed).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[800px] mx-auto px-3 py-6">
        {/* Hero */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-1.5">
            Git<span className="text-gradient">Arena</span>
          </h1>
          <p className="text-arena-textMuted text-lg max-w-[480px] mx-auto leading-relaxed">
            Master Git through interactive visual challenges. Learn branching, merging, rebasing, and more.
          </p>
        </div>

        {/* Progress bar */}
        <div className="glass-panel p-2 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-arena-text">Your Progress</span>
            <span className="text-sm text-arena-textMuted">
              {completedCount}/{levels.length} completed
            </span>
          </div>
          <div className="h-[6px] bg-arena-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-arena-accent to-arena-accentHover rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / levels.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={levels.length}
              aria-label={`${completedCount} of ${levels.length} levels completed`}
            />
          </div>
        </div>

        {/* Level grid */}
        <div className="grid gap-2 sm:grid-cols-2" role="list" aria-label="Available levels">
          {levels.map((level, i) => (
            <div key={level.id} role="listitem">
              <LevelCard level={level} progress={progress[level.id]} index={i} />
            </div>
          ))}
        </div>

        {/* Quick start */}
        <div className="text-center mt-6">
          <a
            href="/editor"
            className="btn-primary inline-flex items-center gap-1 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.75.75 0 1 1-1.06-1.06L10.69 10l-1.47-1.47a.75.75 0 0 1 0-1.06Zm-3.44 0a.75.75 0 0 1 0 1.06L4.31 9l1.47 1.47a.75.75 0 1 1-1.06 1.06l-2-2a.75.75 0 0 1 0-1.06l2-2a.75.75 0 0 1 1.06 0Z" />
            </svg>
            Open Sandbox
          </a>
        </div>
      </div>
    </div>
  );
}
