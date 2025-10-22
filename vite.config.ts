import { defineConfig } from 'vite';
import path from 'path';

// Simple dev-only mock API to avoid 404s for Neynar endpoints
function mockNeynarApi() {
  return {
    name: 'mock-neynar-api',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.method === 'POST' && req.url === '/api/neynar/auth/begin') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ token: 'demo-token', approvalUrl: undefined }));
          return;
        }
        if (req.method === 'POST' && req.url === '/api/neynar/auth/poll') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            fid: 999999,
            username: 'demo_user',
            displayName: 'Demo User',
            pfpUrl: 'https://avatars.githubusercontent.com/u/9919?s=80&v=4'
          }));
          return;
        }
        next();
      });
    },
  } as import('vite').Plugin;
}

export default defineConfig({
    server: {
      port: 5173,
      host: true,
    },
    plugins: [mockNeynarApi()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
});
