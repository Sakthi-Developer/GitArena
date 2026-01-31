import React, { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore, selectCurrentBranch, selectActiveLevelId } from '../state/useAppStore';

const NAV_ITEMS = [
  { path: '/', label: 'Home', ariaLabel: 'Go to home page' },
  { path: '/editor', label: 'Sandbox', ariaLabel: 'Open sandbox editor' },
] as const;

export const Header = memo(function Header() {
  const location = useLocation();
  const currentBranch = useAppStore(selectCurrentBranch);
  const activeLevelId = useAppStore(selectActiveLevelId);

  return (
    <header
      className="flex items-center justify-between px-3 py-1.5 border-b border-arena-border bg-arena-surface/80 backdrop-blur-md z-50"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-1.5 group"
          aria-label="GitArena home"
        >
          <div className="w-[32px] h-[32px] rounded-lg bg-arena-accent flex items-center justify-center text-white font-bold text-base transition-transform group-hover:scale-105">
            G
          </div>
          <span className="font-semibold text-lg text-arena-text hidden sm:inline">
            Git<span className="text-arena-accent">Arena</span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 ml-3" role="navigation" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-2 py-0.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-arena-accent/15 text-arena-accent'
                    : 'text-arena-textMuted hover:text-arena-text hover:bg-arena-surfaceHover'
                }`}
                aria-label={item.ariaLabel}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {activeLevelId && (
          <div className="text-xs text-arena-textDim font-mono bg-arena-bg px-2 py-0.5 rounded-md">
            Level: {activeLevelId}
          </div>
        )}
        <div
          className="flex items-center gap-1 text-xs font-mono text-arena-textMuted bg-arena-bg px-2 py-0.5 rounded-md"
          aria-label={`Current branch: ${currentBranch}`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
          </svg>
          {currentBranch}
        </div>
      </div>
    </header>
  );
});
