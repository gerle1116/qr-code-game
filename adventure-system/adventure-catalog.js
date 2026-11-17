/* Stage 7: catalog metadata only. No ZIP, cover, storage or gameplay operations. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QRCQAdventureCatalog = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HOSTING = Object.freeze({ owner: 'gerle1116', repository: 'qr-code-game', path: 'adventure-catalog/catalog.json' });
  function catalogURL({ owner = HOSTING.owner, repository = HOSTING.repository, ref = 'main', path = HOSTING.path } = {}) {
    if (![owner, repository, ref].every(v => typeof v === 'string' && /^[a-zA-Z0-9_.-]+$/.test(v) && !['.', '..'].includes(v)) ||
        typeof path !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*\.json$/.test(path) || path.split('/').includes('..'))
      throw new TypeError('Supply a valid GitHub owner, repository, branch or commit, and relative JSON path.');
    return `https://raw.githubusercontent.com/${owner}/${repository}/${ref}/${path}`;
  }
  const DEFAULT_CATALOG_URL = catalogURL();
  const DEVELOPMENT_CATALOG_URL = catalogURL({ ref: 'adventure-system' });
  const fail = (code, message, errors = []) => ({ ok: false, code, message, errors });
  const record = v => v !== null && typeof v === 'object' && !Array.isArray(v) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(v));
  const fields = ['id', 'version', 'name', 'description', 'author', 'language', 'type', 'location',
    'estimatedMinutes', 'minimumAge', 'coverUrl', 'downloadUrl', 'packageSize', 'sha256'];
  const canonicalType = v => v === 'nonlinear' ? 'non-linear' : v;
  function safeHTTPS(value, extension) {
    if (typeof value !== 'string' || !value.startsWith('https://') || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash ||
          (url.port && url.port !== '443')) return false;
      // Refuse local destinations and disguised local-file/script references.
      const host = url.hostname.toLowerCase();
      if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
          host.startsWith('[') || /^\d+(?:\.\d+){0,3}$/.test(host)) return false;
      const pathname = decodeURIComponent(url.pathname);
      if (/[\\\u0000-\u001f]/.test(pathname)) return false;
      return !extension || extension.test(pathname);
    } catch (_) { return false; }
  }
  function validateCatalog(catalog) {
    if (!record(catalog) || !Object.hasOwn(catalog, 'catalogVersion'))
      return fail('INVALID_CATALOG', 'Catalog must be an object with catalogVersion and adventures.');
    if (catalog.catalogVersion !== 1) return fail('UNSUPPORTED_VERSION', 'Only catalogVersion 1 is supported.');
    if (!Array.isArray(catalog.adventures) || Object.keys(catalog).some(k => !['catalogVersion', 'adventures'].includes(k)))
      return fail('INVALID_CATALOG', 'Catalog requires an adventures array and no unknown fields.');
    const errors = [], ids = new Set(), adventures = [];
    for (let i = 0; i < catalog.adventures.length; i++) {
      const a = catalog.adventures[i], at = `adventures[${i}]`;
      if (!record(a)) { errors.push(`${at}: expected metadata object`); continue; }
      for (const key of fields) if (!Object.hasOwn(a, key)) errors.push(`${at}.${key}: required`);
      for (const key of Object.keys(a)) if (!fields.includes(key)) errors.push(`${at}.${key}: unsupported field`);
      const check = (key, ok, message) => { if (!ok) errors.push(`${at}.${key}: ${message}`); };
      check('id', typeof a.id === 'string' && /^[a-z][a-z0-9-]*$/.test(a.id) && !['constructor', 'prototype'].includes(a.id), 'expected Stage 1 ID');
      if (ids.has(a.id)) errors.push(`${at}.id: duplicate adventure ID`); ids.add(a.id);
      check('version', typeof a.version === 'string' && /^\d+\.\d+\.\d+$/.test(a.version), 'expected numeric major.minor.patch');
      for (const key of ['name', 'description', 'author', 'location']) check(key, typeof a[key] === 'string' && !!a[key].trim(), 'expected nonempty text');
      check('language', typeof a.language === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(a.language), 'expected exactly one language code');
      check('type', ['linear', 'circular', 'non-linear'].includes(canonicalType(a.type)), 'expected linear, circular or nonlinear/non-linear');
      for (const key of ['estimatedMinutes', 'minimumAge', 'packageSize'])
        check(key, Number.isSafeInteger(a[key]) && a[key] >= (key === 'minimumAge' ? 0 : 1), 'expected safe integer in range');
      check('coverUrl', safeHTTPS(a.coverUrl, /\.(?:png|jpe?g|webp)$/i), 'expected safe HTTPS raster image URL');
      check('downloadUrl', safeHTTPS(a.downloadUrl, /\.zip$/i), 'expected safe HTTPS ZIP URL');
      check('sha256', typeof a.sha256 === 'string' && /^[a-fA-F0-9]{64}$/.test(a.sha256), 'expected 64 hexadecimal characters');
      adventures.push(Object.fromEntries(fields.map(key => [key, key === 'type' ? canonicalType(a[key]) : key === 'sha256' && typeof a[key] === 'string' ? a[key].toLowerCase() : a[key]])));
    }
    if (errors.length) return fail('INVALID_CATALOG', 'Catalog metadata validation failed.', errors);
    return { ok: true, catalog: { catalogVersion: 1, adventures } };
  }
  async function fetchCatalog(url = DEFAULT_CATALOG_URL, { fetch: fetcher = globalThis.fetch, timeoutMs = 10000 } = {}) {
    if (!safeHTTPS(url, /\.json$/i)) return fail('INVALID_URL', 'Catalog URL must be a safe public HTTPS JSON URL.');
    if (typeof fetcher !== 'function') return fail('NETWORK_UNAVAILABLE', 'Online catalog requires a fetch implementation.');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647)
      return fail('INVALID_OPTIONS', 'timeoutMs must be a positive integer no larger than 2147483647.');
    const controller = new AbortController(); let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => {
      resolve(fail('TIMEOUT', 'Catalog request timed out. Check your connection and try again.')); controller.abort();
    }, timeoutMs); });
    const request = async () => {
      try {
        const response = await fetcher(url, { signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response || !response.ok) {
          const status = response?.status;
          return fail(status === 404 ? 'CATALOG_NOT_FOUND' : 'HTTP_ERROR', status === 404 ? 'Catalog was not found (HTTP 404).' : `Catalog request failed (HTTP ${status || 'unknown'}).`);
        }
        if (response.url && !safeHTTPS(response.url, /\.json$/i)) return fail('INVALID_URL', 'Catalog response used an unsafe URL.');
        const source = await response.text();
        if (typeof source !== 'string' || source.length > 2 * 1024 * 1024) return fail('INVALID_CATALOG', 'Catalog must be JSON text no larger than 2 MiB of characters.');
        let parsed;
        try { parsed = JSON.parse(source); } catch (_) { return fail('INVALID_JSON', 'Catalog response is not valid JSON.'); }
        return validateCatalog(parsed);
      } catch (_) { return fail('NETWORK_ERROR', 'Catalog is unavailable. Check your internet connection and try again.'); }
    };
    try { return await Promise.race([request(), timeout]); } finally { clearTimeout(timer); }
  }
  function getAdventures(catalog) {
    const result = validateCatalog(catalog);
    if (!result.ok) { const error = new TypeError(result.message + ' ' + result.errors.join('; ')); error.code = result.code; throw error; }
    return result.catalog.adventures;
  }
  const getAdventureById = (catalog, id) => getAdventures(catalog).find(a => a.id === id) || null;
  function filterAdventures(catalog, filters = {}) {
    if (!record(filters) || Object.keys(filters).some(k => !['type', 'language', 'search', 'location', 'maxMinimumAge', 'sortBy', 'order'].includes(k)))
      throw new TypeError('Unsupported catalog filters.');
    for (const key of ['type', 'language', 'search', 'location', 'sortBy', 'order'])
      if (filters[key] !== undefined && typeof filters[key] !== 'string') throw new TypeError(`${key} must be text.`);
    if (filters.type && !['linear', 'circular', 'non-linear'].includes(canonicalType(filters.type))) throw new TypeError('Unknown adventure type filter.');
    if (filters.maxMinimumAge !== undefined && (!Number.isSafeInteger(filters.maxMinimumAge) || filters.maxMinimumAge < 0)) throw new TypeError('maxMinimumAge must be a nonnegative integer.');
    if (filters.sortBy && !['name', 'duration'].includes(filters.sortBy)) throw new TypeError('Sort by name or duration.');
    if (filters.order && !['asc', 'desc'].includes(filters.order)) throw new TypeError('Sort order must be asc or desc.');
    const lower = s => s.toLowerCase();
    let result = getAdventures(catalog).filter(a => (!filters.type || a.type === canonicalType(filters.type)) &&
      (!filters.language || lower(a.language) === lower(filters.language)) &&
      (!filters.search || lower(a.name + '\n' + a.description).includes(lower(filters.search.trim()))) &&
      (!filters.location || lower(a.location).includes(lower(filters.location.trim()))) &&
      (filters.maxMinimumAge === undefined || a.minimumAge <= filters.maxMinimumAge));
    const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    if (filters.sortBy) result.sort((a, b) => {
      const primary = filters.sortBy === 'duration' ? a.estimatedMinutes - b.estimatedMinutes : compare(lower(a.name), lower(b.name));
      return (primary || compare(a.id, b.id)) * (filters.order === 'desc' ? -1 : 1);
    });
    return result;
  }
  return { HOSTING, DEFAULT_CATALOG_URL, DEVELOPMENT_CATALOG_URL, catalogURL, validateCatalog, fetchCatalog, getAdventures, getAdventureById, filterAdventures };
});
