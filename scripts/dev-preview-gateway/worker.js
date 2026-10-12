const artifactOrigin = 'https://raw.githubusercontent.com/srt2777/AgriDx-v3/dev-preview-built/';
const types = {
  html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', glb: 'model/gltf-binary', woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
};

export async function servePreview(request, upstreamFetch = fetch) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) {
    return Response.json({ error: '开发预览的诊断在浏览器本地运行。' }, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  let file;
  try { file = decodeURIComponent(url.pathname).slice(1) || 'index.html'; }
  catch { return new Response('Invalid path', { status: 400 }); }
  if (file === 'api/health') {
    const response = await upstreamFetch(`${artifactOrigin}dev-preview.json?t=${Date.now()}`, { redirect: 'manual' });
    if (!response.ok) return Response.json({ ok: false, environment: 'development-preview' }, { status: 503 });
    return Response.json({
      ...await response.json(), ok: true, environment: 'development-preview',
      llm: { configured: false, primary: null },
    }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  }
  if (file.split('/').some((part) => !part || part === '.' || part === '..') || /[\\\u0000-\u001f]/.test(file) ||
    !(/^(assets|images|models|licenses|fonts)\//.test(file) || ['index.html', 'favicon.svg', 'dev-preview.json'].includes(file))) {
    return new Response('Not found', { status: 404 });
  }
  const mutable = !/^assets\/.+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(file);
  const target = `${artifactOrigin}${file}${mutable ? `?t=${Date.now()}` : ''}`;
  try {
    // Forward no visitor cookies, login headers, query parameters or production traffic.
    const response = await upstreamFetch(target, { redirect: 'manual' });
    if (!response.ok) return new Response('Preview asset unavailable', { status: response.status === 404 ? 404 : 502 });
    const extension = file.split('.').at(-1);
    const headers = {
      'Content-Type': types[extension] || 'application/octet-stream',
      'Cache-Control': mutable ? 'no-store' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer',
    };
    return new Response(request.method === 'HEAD' ? null : response.body, { headers });
  } catch (error) {
    console.error('[dev-preview] upstream fetch failed:', error instanceof Error ? error.message : 'unknown');
    return new Response('Development preview temporarily unavailable', { status: 502 });
  }
}

export default { fetch: (request) => servePreview(request) };
