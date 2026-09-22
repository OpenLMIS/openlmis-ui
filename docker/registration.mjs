/**
 * Registers this container with Consul so the OpenLMIS nginx image routes to it.
 *
 * nginx builds an upstream per service carrying SERVICE_TAG, and one `location`
 * per key under the `resources/` KV tree whose value names that upstream. Two
 * keys cover an SPA: the bare prefix and a `<all>` wildcard for everything below.
 */
import { networkInterfaces } from 'node:os';

const CONSUL = `http://${process.env.CONSUL_HOST ?? 'consul'}:${process.env.CONSUL_PORT ?? 8500}/v1`;
const SERVICE_NAME = process.env.SERVICE_NAME ?? 'openlmis-ui';
const SERVICE_TAG = process.env.SERVICE_TAG ?? 'openlmis-service';
const SERVICE_PORT = Number(process.env.SERVICE_PORT ?? 80);
const BASE_PATH = process.env.BASE_PATH ?? '/';

const prefix = BASE_PATH.replace(/^\/+|\/+$/g, '');

// A root deployment would claim the global wildcard and shadow the legacy UI.
if (!prefix) {
  throw new Error('BASE_PATH must name a prefix (for example /v2) so the legacy UI keeps /');
}

const resources = [`/${prefix}`, `/${prefix}/<all>`];

function localAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  throw new Error('No non-internal IPv4 address to register with Consul');
}

// KV values are stored verbatim and interpolated straight into `proxy_pass`, so
// a string body must not be JSON-encoded. Objects are the service payload.
async function request(method, path, body) {
  const response = await fetch(`${CONSUL}${path}`, {
    method,
    body: typeof body === 'object' ? JSON.stringify(body) : body,
  });

  if (!response.ok) {
    throw new Error(`Consul ${method} ${path} failed: ${response.status} ${await response.text()}`);
  }
}

async function retry(label, action) {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (attempt === 10) throw error;
      console.warn(`${label} attempt ${attempt} failed, retrying: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function register() {
  const address = localAddress();

  await retry('service register', () =>
    request('PUT', '/agent/service/register', {
      Name: SERVICE_NAME,
      ID: `${SERVICE_NAME}-service`,
      Address: address,
      Port: SERVICE_PORT,
      Tags: [SERVICE_TAG],
      Check: {
        HTTP: `http://${address}:${SERVICE_PORT}/${prefix}/`,
        Interval: '30s',
        Timeout: '5s',
        DeregisterCriticalServiceAfter: '10m',
      },
    }),
  );

  for (const resource of resources) {
    await retry(`resource ${resource}`, () =>
      request('PUT', `/kv/resources${resource}`, SERVICE_NAME),
    );
  }

  console.log(
    `Registered ${SERVICE_NAME} at ${address}:${SERVICE_PORT} for ${resources.join(' ')}`,
  );
}

async function deregister() {
  for (const resource of resources) {
    await request('DELETE', `/kv/resources${resource}`).catch(() => {});
  }
  await request('PUT', `/agent/service/deregister/${SERVICE_NAME}-service`).catch(() => {});
  console.log(`Deregistered ${SERVICE_NAME}`);
}

const command = process.argv[2];

if (command === 'register') {
  await register();
} else if (command === 'deregister') {
  await deregister();
} else {
  throw new Error(`Unknown command: ${command ?? '(none)'}`);
}
