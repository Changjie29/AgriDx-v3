// 后端开发入口：仅用于本地开发
import app from './index';
import { pathToFileURL } from 'node:url';
import { startHttpServer } from './http/listen';

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url && process.env.NODE_ENV !== 'test') {
  console.log('[server:dev] starting dev server...');
  startHttpServer(app);
}

export default app;
