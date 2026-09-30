import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
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

  const proxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
      changeOrigin: true,
      secure: false,
    },
  };

  return {
    base,
    server: {
      port: env.VITE_FE_PORT ? Number(env.VITE_FE_PORT) : undefined,
      proxy,
    },
    preview: { proxy },
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
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest: false,
        workbox: {
          cacheId: 'openlmis-ui',
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.endsWith('/config.json'),
              handler: 'NetworkFirst',
              options: { cacheName: 'openlmis-ui-config', networkTimeoutSeconds: 3 },
            },
            {
              urlPattern: ({ url }) => /\/locales\/[^/]+\.json$/.test(url.pathname),
              handler: 'NetworkFirst',
              options: { cacheName: 'openlmis-ui-locales', networkTimeoutSeconds: 3 },
            },
          ],
        },
      }),
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
