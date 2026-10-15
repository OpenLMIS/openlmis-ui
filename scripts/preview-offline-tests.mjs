import { preview } from 'vite';

await preview({
  preview: { host: '127.0.0.1', port: 9165, strictPort: true },
  plugins: [
    {
      name: 'offline-fixture-api-guard',
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          if (!request.url?.startsWith('/api')) return next();
          const refuse = () => {
            response.writeHead(503, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ message: 'Browser API fixture required' }));
          };
          if (request.method === 'GET' && request.url === '/api/offline-test-timeout') {
            setTimeout(refuse, 250);
          } else refuse();
        });
      },
    },
  ],
});
