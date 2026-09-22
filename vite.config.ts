import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Splits vendor packages into separate cached chunks so browsers don't re-download them when only app code changes.
const vendorChunks: Record<string, string[]> = {
  'react-vendor': ['react', 'react-dom'],
  'tanstack-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Serving prefix. `/` in dev, `/v2/` when deployed beside the legacy UI.
  // Baked into asset URLs at build time, so it is a build input, not runtime config.
  const prefix = (env.VITE_BASE_PATH ?? '').replace(/^\/+|\/+$/g, '');
  const base = prefix ? `/${prefix}/` : '/';

  return {
    base,
    // Dev server proxy - forwards `/api` calls to the OpenLMIS instance so the app
    // can talk to it without CORS and without leaking the host into the bundle.
    server: {
      port: env.VITE_FE_PORT ? Number(env.VITE_FE_PORT) : undefined,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
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
  };
});
