import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { preloadAllAssets } from './assetLoader';
import { boot } from './renderer';
import './style.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

preloadAllAssets()
  .then(() => boot())
  .catch((e) => {
    console.warn('Could not preload art and audio assets, booting anyway:', e);
    boot();
  });
