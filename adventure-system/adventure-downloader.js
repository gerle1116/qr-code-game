/* Stage 8: verify, extract, validate and stage; activation is an explicit commit. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./adventure-catalog.js'), require('./adventure-zip.js'), require('./validator.js'), require('./adventure-storage.js'));
  else root.QRCQAdventureDownloader = factory(root.QRCQAdventureCatalog, root.QRCQAdventureZip, root.QRCQAdventureValidator, root.QRCQAdventureStorage);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (catalog, zip, validator, storageAPI) {
  'use strict';
  const fail = (code, message, errors) => ({ ok: false, code, message, ...(errors ? { errors } : {}) });
  const error = (code, message) => { throw Object.assign(Error(message), { code }); };
  const caught = (e, fallback = 'INSTALLATION_FAILED') => fail(typeof e.code === 'string' ? e.code :
    ['QuotaExceededError', 'AbortError', 'NotAllowedError', 'VersionError'].includes(e.name) ? e.name : fallback, e.message || 'Installation failed.');
  const abort = signal => { if (signal?.aborted) error('CANCELLED', 'Installation cancelled.'); };
  function remoteURL(value) {
    const target = new URL(value), host = target.hostname.toLowerCase().replace(/\.$/, '');
    if (target.protocol !== 'https:' || target.username || target.password || target.hash || (target.port && target.port !== '443') ||
        host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.startsWith('[') || /^[\d.]+$/.test(host))
      error('INVALID_URL', 'Unsafe download URL.');
  }
  const emit = (options, phase, extra = {}) => { try { options.onProgress?.({ phase, ...extra }); } catch (_) { /* UI callbacks cannot break storage coordination. */ } };
  function entry(value) {
    const r = catalog.validateCatalog({ catalogVersion: 1, adventures: [value] });
    if (!r.ok) error(r.code, r.errors.join('; ') || r.message); return r.catalog.adventures[0];
  }
  function verifyPackageSize(bytes, expectedSize) {
    return bytes instanceof Uint8Array && Number.isSafeInteger(expectedSize) && expectedSize > 0 && bytes.length === expectedSize ?
      { ok: true } : fail('SIZE_MISMATCH', 'ZIP byte length does not match catalog packageSize.');
  }
  async function verifyPackageChecksum(bytes, expectedSha256, { digest = async data => {
    if (!globalThis.crypto?.subtle) error('CRYPTO_UNAVAILABLE', 'Web Crypto SHA-256 requires a secure browser context or an injected digest.');
    return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  } } = {}) {
    try {
      if (!(bytes instanceof Uint8Array) || !/^[a-fA-F0-9]{64}$/.test(expectedSha256)) error('CHECKSUM_MISMATCH', 'Invalid ZIP bytes or expected SHA-256.');
      const result = await digest(bytes);
      const actual = typeof result === 'string' ? result.toLowerCase() : [...new Uint8Array(result)].map(v => v.toString(16).padStart(2, '0')).join('');
      return actual === expectedSha256.toLowerCase() ? { ok: true, sha256: actual } : fail('CHECKSUM_MISMATCH', 'ZIP SHA-256 does not match catalog checksum.');
    } catch (e) { return caught(e); }
  }
  async function downloadAdventure(catalogEntry, options = {}) {
    const controller = new AbortController(); let timer, listener;
    try {
      const e = entry(catalogEntry), cap = zip.limits(options.limits);
      remoteURL(e.downloadUrl);
      if (e.packageSize > cap.maxArchive) error('PACKAGE_TOO_LARGE', 'Catalog packageSize exceeds configured maximum ZIP size.');
      const fetcher = options.fetch || globalThis.fetch;
      if (typeof fetcher !== 'function') error('NETWORK_UNAVAILABLE', 'A fetch implementation is required.');
      const timeoutMs = options.timeoutMs ?? 30000;
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647) error('INVALID_OPTIONS', 'timeoutMs must be a positive timer-compatible integer.');
      abort(options.signal); emit(options, 'downloading', { received: 0, total: e.packageSize });
      const interrupted = new Promise((resolve, reject) => {
        listener = () => { reject(Object.assign(Error('Installation cancelled.'), { code: 'CANCELLED' })); controller.abort(); };
        options.signal?.addEventListener('abort', listener, { once: true });
        timer = setTimeout(() => { reject(Object.assign(Error('Adventure download timed out.'), { code: 'TIMEOUT' })); controller.abort(); }, timeoutMs);
      });
      const task = async () => {
        const response = await fetcher(e.downloadUrl, { signal: controller.signal, credentials: 'omit', redirect: 'follow', cache: 'no-store' });
        if (!response?.ok) error('HTTP_ERROR', `Adventure download failed (HTTP ${response?.status || 'unknown'}).`);
        if (response.url) remoteURL(response.url);
        const length = response.headers?.get('content-length');
        if (length !== null && length !== undefined && (!/^\d+$/.test(length) || Number(length) !== e.packageSize)) error('SIZE_MISMATCH', 'HTTP Content-Length differs from catalog packageSize.');
        let bytes;
        if (response.body?.getReader) {
          const reader = response.body.getReader(), chunks = []; let size = 0;
          try {
            while (true) {
              abort(controller.signal); const { done, value } = await reader.read(); if (done) break;
              size += value.length;
              if (size > e.packageSize || size > cap.maxArchive) error('SIZE_MISMATCH', 'Downloaded bytes exceed the expected package size.');
              chunks.push(value); emit(options, 'downloading', { received: size, total: e.packageSize });
            }
          } finally { await reader.cancel().catch(() => {}); }
          bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        } else bytes = new Uint8Array(await response.arrayBuffer()); // Injected/older fetch adapters only.
        const size = verifyPackageSize(bytes, e.packageSize); if (!size.ok) error(size.code, size.message);
        abort(options.signal); return bytes;
      };
      return { ok: true, bytes: await Promise.race([task(), interrupted]), entry: e };
    } catch (e) { return caught(e, 'NETWORK_ERROR'); }
    finally { clearTimeout(timer); options.signal?.removeEventListener('abort', listener); }
  }
  async function decodeImage(bytes, name) {
    if (typeof globalThis.createImageBitmap !== 'function') error('IMAGE_DECODER_UNAVAILABLE', 'This browser needs createImageBitmap, or supply an image decoder.');
    const bitmap = await createImageBitmap(new Blob([bytes]));
    try { if (!bitmap.width || !bitmap.height) error('INVALID_IMAGE', 'Invalid image dimensions: ' + name); }
    finally { bitmap.close(); }
  }
  async function validateAdventurePackage(files, catalogEntry, { decodeImage: decode = decodeImage, signal } = {}) {
    try {
      abort(signal);
      for (const [name, bytes] of Object.entries(files || {})) if (/\.(png|jpe?g|webp)$/.test(name) && bytes instanceof Uint8Array) {
        try { validator.checkImage(bytes, name); }
        catch (e) { error('INVALID_IMAGE', `${name}: ${e.message}`); }
      }
      const validation = validator.validateFiles(files);
      if (!validation.valid) return fail('INVALID_PACKAGE', 'Stage 1 adventure validation failed.', validation.errors);
      const adventure = storageAPI.adventureFromFiles(files), e = entry(catalogEntry), m = adventure.manifest;
      const metadata = ['id', 'version', 'type', 'language', 'name', 'description', 'author', 'location', 'estimatedMinutes', 'minimumAge'];
      const different = metadata.filter(k => m[k] !== e[k]);
      if (different.length) return fail('CATALOG_MISMATCH', 'Catalog metadata differs from manifest: ' + different.join(', '));
      for (const [name, bytes] of Object.entries(files)) if (/\.(png|jpe?g|webp)$/.test(name)) {
        abort(signal); try { await decode(bytes, name); } catch (e) { error(e.code === 'IMAGE_DECODER_UNAVAILABLE' ? e.code : 'INVALID_IMAGE', `Image could not be decoded: ${name}: ${e.message}`); }
      }
      abort(signal); return { ok: true, adventure, files, warnings: validation.warnings };
    } catch (e) { return caught(e); }
  }
  async function prepareAdventureInstallation(catalogEntry, options = {}) {
    let staged;
    const storage = options.storage;
    try {
      if (!storage) error('STORAGE_UNAVAILABLE', 'Supply an adventure storage coordinator.');
      abort(options.signal); const baseline = await storage.snapshot();
      const downloaded = await downloadAdventure(catalogEntry, options); if (!downloaded.ok) return downloaded;
      emit(options, 'verifying'); abort(options.signal);
      const checksum = await verifyPackageChecksum(downloaded.bytes, downloaded.entry.sha256, options); if (!checksum.ok) return checksum;
      abort(options.signal); emit(options, 'extracting');
      const files = await (options.extract || zip.extractAdventurePackage)(downloaded.bytes, options);
      abort(options.signal); emit(options, 'validating');
      const validated = await validateAdventurePackage(files, downloaded.entry, options); if (!validated.ok) return validated;
      abort(options.signal); emit(options, 'staging');
      staged = await storage.stage(validated, baseline, options); abort(options.signal);
      let finished = false, committing = false;
      const cleanup = () => options.signal?.removeEventListener('abort', onAbort);
      const installation = {
        requiresConfirmation: staged.requiresConfirmation, warning: staged.warning, preparedSave: staged.preparedSave,
        async cancel() {
          if (committing) return fail('COMMIT_IN_PROGRESS', 'The atomic commit has started and cannot be interrupted.');
          if (finished) return fail('INSTALLATION_FINISHED', 'Installation is already finished.');
          await storage.discard(staged.token); finished = true; cleanup(); emit(options, 'cancelled'); return { ok: true };
        },
        async commit({ confirmed = false, signal = options.signal } = {}) {
          if (finished || committing) return fail('INSTALLATION_FINISHED', 'Installation is finished or committing.');
          try {
            abort(signal); committing = true; emit(options, 'activating');
            const result = await storage.commit(staged.token, { confirmed, signal });
            if (result.ok) { finished = true; cleanup(); emit(options, 'complete'); }
            else emit(options, 'awaiting-confirmation', { warning: staged.warning });
            return result;
          } catch (e) { return caught(e); } finally { committing = false; }
        }
      };
      const onAbort = () => { installation.cancel().catch(() => {}); };
      options.signal?.addEventListener('abort', onAbort, { once: true });
      // Close the small race between staging and registering cancellation.
      if (options.signal?.aborted) { await installation.cancel(); return fail('CANCELLED', 'Installation cancelled.'); }
      emit(options, 'awaiting-confirmation', { warning: staged.warning });
      return { ok: true, installation, adventure: validated.adventure, warnings: validated.warnings };
    } catch (e) {
      if (staged) await storage.discard(staged.token).catch(() => {});
      return caught(e);
    }
  }
  return { downloadAdventure, verifyPackageSize, verifyPackageChecksum, extractAdventurePackage: zip.extractAdventurePackage, validateAdventurePackage, prepareAdventureInstallation };
});
