// Development-only: runs the UI against UAT with read-only proxies. Never part of a deployment.
import { createServer } from 'vite';
import { createSupersetProxy } from './superset-proxy.mjs';
import { localUatGuard, noStoreGuestTokens } from './vite-guard.mjs';

const uiPort = Number(process.env.LOCAL_UAT_UI_PORT ?? 5173);
const supersetPort = Number(process.env.LOCAL_UAT_SUPERSET_PORT ?? 5174);
const apiTarget = process.env.LOCAL_UAT_API_TARGET ?? 'https://uat.openlmis.org';
const supersetTarget = process.env.LOCAL_UAT_SUPERSET_TARGET ?? 'https://uat.openlmis.org:8443';

if (uiPort === supersetPort) throw new Error('The UI and Superset proxy need different ports.');
const uiOrigin = `http://localhost:${uiPort}`;
const supersetOrigin = `http://localhost:${supersetPort}`;
const log = (line) => console.log(`[local-uat] ${line}`);

const superset = createSupersetProxy({
  upstream: supersetTarget,
  localOrigin: supersetOrigin,
  uiOrigin,
  upstreamUiOrigin: new URL(apiTarget).origin,
  log,
});
await new Promise((resolve, reject) => {
  superset.once('error', reject);
  superset.listen(supersetPort, '127.0.0.1', resolve);
});

process.env.VITE_API_PROXY_TARGET = apiTarget;
process.env.VITE_LEGACY_UI_URL = new URL(apiTarget).origin;
const backend = { secure: true, configure: noStoreGuestTokens };
const ui = await createServer({
  server: {
    host: 'localhost',
    port: uiPort,
    strictPort: true,
    proxy: { '/api': backend, '/localeSettings': { secure: true } },
  },
  plugins: [localUatGuard({ supersetOrigin, log })],
});
await ui.listen();
log(`UI ${uiOrigin}, Superset ${supersetOrigin}; writes to UAT are refused.`);

const stop = async () => {
  await ui.close();
  superset.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
