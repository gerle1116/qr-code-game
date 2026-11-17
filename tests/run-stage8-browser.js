/* Wait on real browser/IndexedDB time; virtual-time dump-dom can finish before IDB I/O. */
'use strict';
const { spawn } = require('node:child_process');
module.exports = async function runBrowser(browser, profile, pageURL) {
  const child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--disable-background-networking', '--remote-debugging-port=0', 'about:blank'], { windowsHide: true });
  let socket, stderr = '', connection;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Chrome debugging connection timed out.')), 10000);
      child.on('error', e => { clearTimeout(timeout); reject(e); });
      child.stderr.on('data', chunk => { stderr += chunk; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let id = 0; const pending = new Map();
    socket.addEventListener('message', event => {
      const value = JSON.parse(event.data); if (!value.id) return;
      const handlers = pending.get(value.id); pending.delete(value.id);
      if (handlers) value.error ? handlers.reject(Error(value.error.message)) : handlers.resolve(value.result);
    });
    connection = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await connection('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await connection('Target.attachToTarget', { targetId, flatten: true });
    await connection('Page.navigate', { url: pageURL }, sessionId);
    const deadline = Date.now() + 40000; let last = '';
    while (Date.now() < deadline) {
      const value = await connection('Runtime.evaluate', { expression: 'document.getElementById("results")?.textContent || "loading"', returnByValue: true }, sessionId);
      last = value.result?.value || '';
      if (/BROWSER: .*; complete/.test(last)) return last;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('Browser test did not complete:\n' + last + '\n' + stderr);
  } finally {
    if (connection) await connection('Browser.close').catch(() => {});
    socket?.close();
    if (child.exitCode === null) await new Promise(resolve => { const timer = setTimeout(() => { child.kill(); resolve(); }, 3000); child.once('close', () => { clearTimeout(timer); resolve(); }); });
  }
};
