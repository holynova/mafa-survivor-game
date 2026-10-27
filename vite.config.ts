import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => ({
  base: command === 'build' || mode === 'production' ? '/mafa-survivor-game/' : '/',
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: false,
    watch: {
      ignored: [
        '**/dist/**',
        '**/.git/**',
        '**/scratch/**',
        '**/docs/**',
        '**/.gemini/**',
      ],
    },
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
    testTimeout: 8000,
    hookTimeout: 8000,
  },
}));
