import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Level, LevelProgress } from '../lib/types';

interface LevelCardProps {
  level: Level;
  progress?: LevelProgress;
  index: number;
}

const DIFFICULTY_COLORS = {
  beginner: 'text-arena-success border-arena-success/30 bg-arena-success/10',
  intermediate: 'text-arena-warning border-arena-warning/30 bg-arena-warning/10',
  advanced: 'text-arena-error border-arena-error/30 bg-arena-error/10',
} as const;

export const LevelCard = memo(function LevelCard({ level, progress, index }: LevelCardProps) {
  const isCompleted = progress?.completed ?? false;

  return (
    <Link
      to={`/play/${level.id}`}
      className="group block animate-slide-up"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
      aria-label={`${level.title} — ${level.difficulty} — ${isCompleted ? 'Completed' : 'Not started'}`}
    >
      <div
        className={`glass-panel p-3 transition-all duration-200 hover:border-arena-borderHover hover:bg-arena-surfaceHover ${
          isCompleted ? 'border-arena-success/30' : ''
        }`}
      >
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-[28px] h-[28px] rounded-md flex items-center justify-center text-sm font-semibold ${
                isCompleted
                  ? 'bg-arena-success/20 text-arena-success'
                  : 'bg-arena-accent/15 text-arena-accent'
              }`}
            >
              {isCompleted ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <h3 className="font-semibold text-arena-text group-hover:text-arena-accent transition-colors">
              {level.title}
            </h3>
          </div>

          <span
            className={`text-[11px] font-medium px-1.5 py-[2px] rounded-md border ${DIFFICULTY_COLORS[level.difficulty]}`}
          >
            {level.difficulty}
          </span>
        </div>

        <p className="text-sm text-arena-textMuted mb-1.5 leading-relaxed">
          {level.description}
        </p>

        <div className="flex items-center justify-between text-xs text-arena-textDim">
          <span className="font-mono">{level.category}</span>
          {progress && progress.attempts > 0 && (
            <span>
              {progress.attempts} attempt{progress.attempts !== 1 ? 's' : ''}
              {progress.bestCommandCount > 0 && ` · best: ${progress.bestCommandCount} cmds`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});
