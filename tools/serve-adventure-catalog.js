/* Development-only localhost server for the standalone adventure testers. */
'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function createTesterServer() {
  return http.createServer(async (request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); return response.end(); }
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const target = path.resolve(root, '.' + name);
      const relative = path.relative(root, target);
      if (!['adventure-system', 'adventure-catalog', 'tests'].includes(relative.split(path.sep)[0]) ||
          relative.split(path.sep).some(p => p.startsWith('.')) || !/\.(?:html|js|css|json|png|jpe?g|webp)$/.test(target)) {
        response.writeHead(403); return response.end('Only standalone adventure tester resources are served.');
      }
      const real = await fs.realpath(target);
      if (real !== target) { response.writeHead(403); return response.end(); }
      const content = await fs.readFile(real), extension = path.extname(real);
      response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[extension],
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (_) { response.writeHead(404); response.end('Tester resource not found.'); }
  });
}
module.exports = { createTesterServer };
if (require.main === module) {
  const server = createTesterServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(8000, '127.0.0.1', () => console.log('Open http://127.0.0.1:8000/adventure-system/catalog-tester.html (Ctrl+C stops the server).'));
}
