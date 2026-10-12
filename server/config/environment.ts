import dotenv from 'dotenv';
import path from 'node:path';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

/** Keep environment loading ahead of provider construction and proxy detection. */
export function initializeEnvironment(): void {
  // Existing process variables win; root .env then server/.env fill missing values.
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy;
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log('[server] proxy enabled (redacted)');
  }
}
