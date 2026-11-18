'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.zip': 'application/zip'
};

function createGameServer({ tests = false, basePath = '/' } = {}) {
  let failShellInstall = false;
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const resource = decodeURIComponent(url.pathname);
      if (!resource.startsWith(basePath)) { response.writeHead(404); response.end(); return; }
      const name = resource.slice(basePath.length) || 'index.html';
      if (tests && name === 'tests/shell-install-state' && request.method === 'POST') {
        failShellInstall = url.searchParams.get('fail') === '1';
        response.writeHead(204); response.end(); return;
      }
      if (tests && failShellInstall && name === 'adventure-system/adventure-victory.css') {
        response.writeHead(503); response.end(); return;
      }
      if (tests && name === 'index.html' && url.searchParams.has('release-next-shell')) {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<title>Future shell marker</title>'); return;
      }
      const live = /^(?:index\.html|styles\.css|(?:app|language-loader|sw)\.js|manifest\.webmanifest|(?:data|mod-system)\/[a-z0-9_-]+\.js|adventure-system\/[a-z0-9_-]+\.(?:js|css)|(?:icons|images)\/[a-z0-9_-]+\.png)$/i;
      const fixture = /^(?:tests\/(?:(?:integration|release)-browser\.(?:html|js)|integration-old-worker\.js)|adventure-system\/samples\/packages\/(?:catalog\.json|(?:linear|circular|non-linear)\.zip))$/;
      if (!['GET', 'HEAD'].includes(request.method) || (!live.test(name) && !(tests && fixture.test(name)))) {
        response.writeHead(404); response.end(); return;
      }
      const file = path.join(root, name);
      const content = await fs.readFile(file);
      const headers = { 'Content-Type': contentTypes[path.extname(file)], 'Cache-Control': 'no-cache' };
      if (tests && name === 'tests/integration-old-worker.js') headers['Service-Worker-Allowed'] = basePath;
      response.writeHead(200, headers);
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (_) { response.writeHead(404); response.end(); }
  });
}
module.exports = { createGameServer };
if (require.main === module) {
  createGameServer().listen(8000, '127.0.0.1', () => console.log('QR City Quest is available at http://127.0.0.1:8000/.'));
}
