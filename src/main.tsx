import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, loadArtPositions } from './App';
import { boot } from './renderer';
import './style.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

loadArtPositions()
  .then(() => boot())
  .catch((e) => {
    console.warn('Could not preload art positions, booting anyway:', e);
    boot();
  });
