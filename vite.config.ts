import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5180,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
