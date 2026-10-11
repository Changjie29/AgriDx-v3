import type { Express } from 'express';
import type { Server } from 'node:http';

export function startHttpServer(app: Express): Server {
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[server] Agricultural Machinery Fault Diagnosis Platform running on http://0.0.0.0:${port}`);
  });
  const shutdown = (signal: string) => {
    console.log(`[server] received ${signal}, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}
