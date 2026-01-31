import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Code-split pages for optimal bundle size
const Home = lazy(() => import('./pages/Home'));
const PlayLevel = lazy(() => import('./pages/PlayLevel'));
const Editor = lazy(() => import('./pages/Editor'));

function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex items-center gap-1.5 text-arena-textMuted text-sm">
        <div className="w-[16px] h-[16px] border-2 border-arena-accent border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play/:levelId" element={<PlayLevel />} />
        <Route path="/editor" element={<Editor />} />
      </Routes>
    </Suspense>
  );
}
