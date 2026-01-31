import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Header } from './components/Header';
import { AppRoutes } from './routes';

export function App() {
  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col bg-arena-bg text-arena-text">
        <Header />
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}
