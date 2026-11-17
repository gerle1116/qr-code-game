/* Stage 8 ZIP metadata checks and bounded extraction; never writes to disk. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../mod-system/mod-zip-reader.js'));
  else root.QRCQAdventureZip = factory(root.QRCQZipReader);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (zip) {
  'use strict';
  const LIMITS = Object.freeze({ maxArchive: 32 * 1024 * 1024, maxFiles: 256, maxFile: 8 * 1024 * 1024, maxTotal: 64 * 1024 * 1024, maxRatio: 200 });
  const error = message => { throw Object.assign(Error(message), { code: 'INVALID_ZIP' }); };
  const cancelled = signal => { if (signal?.aborted) throw Object.assign(Error('Installation cancelled.'), { code: 'CANCELLED' }); };
  function limits(options = {}) {
    if (Object.keys(options).some(k => !Object.hasOwn(LIMITS, k))) error('Unknown ZIP limit.');
    const out = { ...LIMITS, ...options };
    for (const value of Object.values(out)) if (!Number.isSafeInteger(value) || value < 1) error('ZIP limits must be positive safe integers.');
    return out;
  }
  function safeName(name) {
    if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*(?:\/|\.(?:json|png|jpg|jpeg|webp))$/.test(name)) return false;
    return name.replace(/\/$/, '').split('/').every(p => p !== '.' && p !== '..' && !p.endsWith('.') &&
      !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p));
  }
  async function inflateRaw(source, expected, signal) {
    if (typeof DecompressionStream !== 'function') error('This browser does not support deflate-raw ZIP extraction.');
    const reader = new Blob([source]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts = []; let length = 0;
    try {
      while (true) {
        cancelled(signal); const { done, value } = await reader.read(); if (done) break;
        length += value.length; if (length > expected) error('Decompressed bytes exceed declared size.'); parts.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const result = new Uint8Array(length); let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }
  async function extractAdventurePackage(input, { limits: overrides, signal, inflate = inflateRaw } = {}) {
    const cap = limits(overrides), bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    cancelled(signal);
    if (bytes.length < 22 || bytes.length > cap.maxArchive) error('Empty, incomplete or oversized ZIP.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), text = new TextDecoder('utf-8', { fatal: true });
    const within = (offset, count) => offset >= 0 && count >= 0 && offset + count <= bytes.length;
    const u16 = i => view.getUint16(i, true), u32 = i => view.getUint32(i, true);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) { end = i; break; }
    if (end < 0) error('Missing ZIP central directory.');
    const count = u16(end + 10), cdSize = u32(end + 12), cdAt = u32(end + 16);
    if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || count === 65535 || !count || count > cap.maxFiles ||
        cdAt === 0xffffffff || cdSize === 0xffffffff || cdAt + cdSize !== end) error('Invalid count, multi-disk, ZIP64 or oversized central directory.');
    let pos = cdAt, total = 0; const entries = [], names = new Set(), components = new Map();
    function extras(at, length) {
      const stop = at + length;
      while (at < stop) {
        if (at + 4 > stop) error('Malformed ZIP extra field.');
        const id = u16(at), size = u16(at + 2); at += 4;
        if (at + size > stop || [1, 0x9901, 0x7075].includes(id)) error('Unsupported ZIP64, encrypted or alternate-name metadata.'); at += size;
      }
    }
    for (let i = 0; i < count; i++) {
      if (!within(pos, 46) || u32(pos) !== 0x02014b50) error('Damaged central directory.');
      const flags = u16(pos + 8), method = u16(pos + 10), crc = u32(pos + 16), compressed = u32(pos + 20), size = u32(pos + 24);
      const nl = u16(pos + 28), xl = u16(pos + 30), cl = u16(pos + 32), local = u32(pos + 42), external = u32(pos + 38);
      if (pos + 46 + nl + xl + cl > end || u16(pos + 34)) error('Malformed ZIP listing.');
      const name = text.decode(bytes.subarray(pos + 46, pos + 46 + nl)), key = name.replace(/\/$/, '').toLowerCase();
      if (!safeName(name) || names.has(key)) error('Unsafe, duplicate or ambiguous ZIP path: ' + name);
      let prefix = '';
      for (const part of name.replace(/\/$/, '').split('/')) {
        prefix += (prefix ? '/' : '') + part;
        if (components.has(prefix.toLowerCase()) && components.get(prefix.toLowerCase()) !== prefix) error('Ambiguous normalized path components.');
        components.set(prefix.toLowerCase(), prefix);
      }
      names.add(key); const directory = name.endsWith('/'), mode = (external >>> 16) & 0xf000;
      if (![0, 0x8000, 0x4000].includes(mode) || (mode === 0x4000 && !directory) || (mode === 0x8000 && directory) || ((external & 16) && !directory)) error('Symlink or unsupported ZIP entry type.');
      if (flags & ~0x0808 || ![0, 8].includes(method)) error('Encrypted/unsupported flags or compression method.');
      if (compressed === 0xffffffff || size === 0xffffffff || local === 0xffffffff || size > cap.maxFile ||
          (directory && (size || compressed)) || size / Math.max(1, compressed) > cap.maxRatio) error('ZIP64, file size or compression ratio limit exceeded.');
      total += size; if (total > cap.maxTotal) error('Uncompressed package exceeds total limit.');
      extras(pos + 46 + nl, xl); entries.push({ name, directory, flags, method, crc, compressed, size, local }); pos += 46 + nl + xl + cl;
    }
    if (pos !== end) error('Unexpected central-directory bytes.');
    const filesByName = new Set(entries.filter(e => !e.directory).map(e => e.name.toLowerCase()));
    for (const e of entries) {
      const parts = e.name.replace(/\/$/, '').split('/'); parts.pop();
      while (parts.length) { if (filesByName.has(parts.join('/').toLowerCase())) error('File/directory path collision.'); parts.pop(); }
      const at = e.local;
      if (!within(at, 30) || u32(at) !== 0x04034b50 || u16(at + 6) !== e.flags || u16(at + 8) !== e.method) error('Local ZIP headers disagree.');
      const nl = u16(at + 26), xl = u16(at + 28), start = at + 30 + nl + xl;
      if (!within(at + 30, nl + xl) || start + e.compressed > cdAt || text.decode(bytes.subarray(at + 30, at + 30 + nl)) !== e.name) error('Invalid local ZIP path or data bounds.');
      extras(at + 30 + nl, xl);
      let stop = start + e.compressed;
      if (e.flags & 8) {
        if (within(stop, 4) && u32(stop) === 0x08074b50) stop += 4;
        if (stop + 12 > cdAt || u32(stop) !== e.crc || u32(stop + 4) !== e.compressed || u32(stop + 8) !== e.size) error('Invalid ZIP data descriptor.'); stop += 12;
      } else if (u32(at + 14) !== e.crc || u32(at + 18) !== e.compressed || u32(at + 22) !== e.size) error('Local ZIP sizes/checksum disagree.');
      e.start = start; e.stop = stop;
    }
    const ordered = [...entries].sort((a, b) => a.local - b.local); let cursor = 0;
    for (const e of ordered) { if (e.local !== cursor) error('Overlapping, prefixed or hidden ZIP data.'); cursor = e.stop; }
    if (cursor !== cdAt) error('Unlisted ZIP data.');
    const files = Object.create(null); let actual = 0;
    for (const e of entries) {
      cancelled(signal); if (e.directory) continue;
      const source = bytes.subarray(e.start, e.start + e.compressed);
      const out = e.method === 0 ? source : await inflate(source, e.size, signal);
      actual += out.length;
      if (!(out instanceof Uint8Array) || out.length !== e.size || actual > cap.maxTotal || zip.crc32(out) !== e.crc) error('Extracted size or CRC mismatch: ' + e.name);
      files[e.name] = new Uint8Array(out);
    }
    return files;
  }
  return { LIMITS, limits, safeName, extractAdventurePackage };
});
