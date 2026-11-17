/* Wait on real browser/IndexedDB time; virtual-time dump-dom can finish before IDB I/O. */
'use strict';
const { spawn } = require('node:child_process');
module.exports = async function runBrowser(browser, profile, pageURL, { keyboard = false, screenshotPath, screenshotURL } = {}) {
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
      if (/BROWSER: .*; complete/.test(last)) {
        if (screenshotPath && screenshotURL) {
          await connection('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
          await connection('Page.navigate', { url: screenshotURL }, sessionId);
          for (let i = 0; i < 100; i++) {
            const ready = await connection('Runtime.evaluate', { expression: 'document.querySelectorAll(".ab-card").length === 3', returnByValue: true }, sessionId);
            if (ready.result?.value) break;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          const capture = await connection('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
          require('node:fs').writeFileSync(screenshotPath, Buffer.from(capture.data, 'base64'));
        }
        return last;
      }
      if (keyboard) {
        const request = await connection('Runtime.evaluate', { expression: 'window.__browserKeyRequest && !window.__browserKeyRequest.done ? window.__browserKeyRequest : null', returnByValue: true }, sessionId);
        const action = request.result?.value;
        if (action) {
          const codes = { Tab: 9, Enter: 13, Escape: 27 };
          for (const type of ['keyDown', 'keyUp']) await connection('Input.dispatchKeyEvent', { type, key: action.key, code: action.key,
            windowsVirtualKeyCode: codes[action.key], nativeVirtualKeyCode: codes[action.key], modifiers: action.shift ? 8 : 0,
            ...(action.key === 'Enter' && type === 'keyDown' ? { text: '\r', unmodifiedText: '\r' } : {}) }, sessionId);
          await connection('Runtime.evaluate', { expression: 'window.__browserKeyRequest.done = true' }, sessionId);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('Browser test did not complete:\n' + last + '\n' + stderr);
  } finally {
    if (connection) await connection('Browser.close').catch(() => {});
    socket?.close();
    if (child.exitCode === null) await new Promise(resolve => { const timer = setTimeout(() => { child.kill(); resolve(); }, 3000); child.once('close', () => { clearTimeout(timer); resolve(); }); });
  }
};
