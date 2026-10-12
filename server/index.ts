import { pathToFileURL } from 'node:url';
import { createApp } from './app';
import { startHttpServer } from './http/listen';
import { createServerRuntime } from './runtime';

// Retain the default API app for callers of server/index; importing never listens.
const app = createApp(createServerRuntime());
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url && process.env.NODE_ENV !== 'test') {
  startHttpServer(app);
}

export { createApp } from './app';
export default app;
