import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Splits vendor packages into separate cached chunks so browsers don't re-download them when only app code changes.
const vendorChunks: Record<string, string[]> = {
  'react-vendor': ['react', 'react-dom'],
  'tanstack-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
};

export default defineConfig({
  // Dev server proxy - forwards API calls to backend to avoid CORS issues (dev only).
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // Resolves @/* path aliases defined in tsconfig.json (e.g. @/components/Button)
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: './src/route-tree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    css: false,
    clearMocks: true,
    restoreMocks: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          for (const [chunk, pkgs] of Object.entries(vendorChunks)) {
            if (pkgs.some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
              return chunk;
            }
          }
        },
      },
    },
  },
});
