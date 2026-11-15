/* Stage 1 authoring validator. No runtime integration or package code execution. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const conditions = require('../mod-system/mod-conditions.js');
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string' && v.trim().length > 0;
const qr = v => typeof v === 'string' && /^\d{2}$/.test(v);
const safePath = v => typeof v === 'string' && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+$/.test(v) &&
  v.split('/').every(p => p !== '.' && p !== '..' && !p.includes(':'));

// The schemas deliberately use only this small, explicit JSON Schema subset.
function checkSchema(value, schema, at, errors, root = schema) {
  if (schema.$ref) schema = schema.$ref.slice(2).split('/').reduce((v, k) => v[k], root);
  const fail = message => errors.push(`${at}: ${message}`);
  if (schema.type) {
    const ok = schema.type === 'object' ? record(value) : schema.type === 'array' ? Array.isArray(value) :
      schema.type === 'integer' ? Number.isInteger(value) : typeof value === schema.type;
    if (!ok) { fail(`expected ${schema.type}`); return; }
  }
  if (schema.const !== undefined && value !== schema.const) fail(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(`must be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength && value.trim().length < schema.minLength) fail('must not be empty');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('invalid format');
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('must be finite');
    if (schema.minimum !== undefined && value < schema.minimum) fail(`minimum is ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(`maximum is ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) fail('must not be empty');
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) fail('duplicate entries');
    value.forEach((v, i) => schema.items && checkSchema(v, schema.items, `${at}[${i}]`, errors, root));
  }
  if (record(value)) {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    if (schema.minProperties && Object.keys(value).length < schema.minProperties) fail('must not be empty');
    for (const [key, v] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) { fail(`unsafe key ${key}`); continue; }
      const child = (schema.properties || {})[key];
      if (child) checkSchema(v, child, `${at}.${key}`, errors, root);
      else if (schema.additionalProperties === false) fail(`unsupported field ${key}`);
      else if (record(schema.additionalProperties)) checkSchema(v, schema.additionalProperties, `${at}.${key}`, errors, root);
    }
  }
}

// JSON.parse normally hides duplicate keys. Scan object member names before parsing.
function parseJSON(source) {
  const tokens = source.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [];
  const stack = [];
  tokens.forEach((token, i) => {
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (token.startsWith('"') && tokens[i + 1] === ':' && stack.at(-1)) {
      const key = JSON.parse(token), keys = stack.at(-1);
      if (keys.has(key)) throw Error(`duplicate JSON key ${key}`);
      keys.add(key);
    }
  });
  return JSON.parse(source);
}

function validatePackage(directory) {
  const errors = [], warnings = [], root = path.resolve(directory);
  const error = (at, msg) => errors.push(`${at}: ${msg}`);
  const schema = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', `${name}.schema.json`), 'utf8'));
  function local(name, at, image = false) {
    if (!safePath(name)) { error(at, 'expected safe relative file path'); return null; }
    const target = path.join(root, name);
    let current = root;
    try {
      for (const part of name.split('/')) {
        current = path.join(current, part);
        if (fs.lstatSync(current).isSymbolicLink()) throw Error('symbolic links are forbidden');
      }
      if (!fs.statSync(target).isFile()) throw Error('not a regular file');
      if (image) {
        const bytes = fs.readFileSync(target);
        const png = name.endsWith('.png') && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpg = /\.jpe?g$/.test(name) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const webp = name.endsWith('.webp') && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        if (!png && !jpg && !webp) throw Error('expected PNG, JPEG or WebP image signature');
      }
      return target;
    } catch (e) { error(at, `${name}: ${e.message}`); return null; }
  }
  function read(name, at) {
    const file = local(name, at);
    if (!file) return null;
    if (!name.endsWith('.json')) { error(at, 'data must be JSON'); return null; }
    try { return parseJSON(fs.readFileSync(file, 'utf8')); }
    catch (e) { error(name, `invalid JSON: ${e.message}`); return null; }
  }
  // Reject executable or otherwise unsupported package members, including unreferenced ones.
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name), rel = path.relative(root, file).split(path.sep).join('/');
      if (entry.isSymbolicLink()) error(rel, 'symbolic links are forbidden');
      else if (entry.isDirectory()) walk(file);
      else if (!safePath(rel) || !/\.(json|png|jpg|jpeg|webp)$/.test(rel)) error(rel, 'unsupported package file');
      else if (rel.endsWith('.json')) read(rel, rel);
    }
  }
  try { walk(root); } catch (e) { error('package', e.message); }
  const manifest = read('manifest.json', 'manifest.json');
  if (!record(manifest)) { error('manifest.json', 'expected object'); return { valid: false, errors, warnings }; }
  checkSchema(manifest, schema('manifest'), 'manifest.json', errors);
  if (errors.length) return { valid: false, errors, warnings };
  if (manifest.type === 'linear' && !manifest.scenarios) error('manifest.json.scenarios', 'required for linear adventures');
  if (manifest.type !== 'linear' && manifest.scenarios !== undefined) error('manifest.json.scenarios', 'only linear adventures use scenarios');
  if (manifest.type !== 'linear' && fs.existsSync(path.join(root, 'scenarios.json'))) error('scenarios.json', 'route data is only allowed for linear adventures');
  if (['linear', 'circular'].includes(manifest.type) && !manifest.map) error('manifest.json.map', 'Map configuration required');
  if (manifest.cover) local(manifest.cover, 'manifest.json.cover', true);
  if (record(manifest.map)) {
    local(manifest.map.image, 'manifest.json.map.image', true);
    if (manifest.map.mode === 'markers' && !Array.isArray(manifest.map.markers)) error('manifest.json.map.markers', 'required in markers mode');
    if (manifest.map.mode === 'static' && manifest.map.markers !== undefined) error('manifest.json.map.markers', 'not allowed in static mode');
  }
  const game = read(manifest.gameData, 'manifest.json.gameData');
  if (!record(game)) { error('game-data.json', 'expected object'); return { valid: false, errors, warnings }; }
  checkSchema(game, schema('game-data'), `${manifest.gameData}`, errors);
  if (errors.length) return { valid: false, errors, warnings };
  const encounters = record(game.encounters) ? game.encounters : {}, items = record(game.items) ? game.items : {};
  const pages = new Map(), owners = new Map();
  for (const [id, entry] of Object.entries(game.thingsIKnow || {})) {
    if (!Object.hasOwn(game.knowledgeFolders || {}, entry.folder)) error(`${manifest.gameData}.thingsIKnow.${id}.folder`, 'unknown knowledge folder');
  }
  for (const [kind, collection] of [['encounters', encounters], ['items', items]]) {
    for (const [id, owner] of Object.entries(collection)) {
      const at = `${manifest.gameData}.${kind}.${id}`;
      if (!text(id) || (kind === 'encounters' && !/^(?:\d{2}|[a-z][a-z0-9-]*)$/.test(id))) error(at, 'invalid owner ID');
      if (!record(owner)) { error(at, 'expected object'); continue; }
      const ownerPages = record(owner.pages) ? owner.pages : {};
      if (!Object.hasOwn(ownerPages, owner.startPage)) error(`${at}.startPage`, 'must reference an owned page');
      if (owner.defaultPicture) local(owner.defaultPicture, `${at}.defaultPicture`, true);
      for (const [pid, page] of Object.entries(ownerPages)) {
        if (!/^\d{4}$/.test(pid) || pages.has(pid)) error(`${at}.pages.${pid}`, 'invalid or duplicate four-digit page ID');
        pages.set(pid, page); owners.set(pid, { kind, id, at: `${at}.pages.${pid}` });
      }
      if (owner.overdueItemTimers !== undefined) error(`${at}.overdueItemTimers`, 'legacy overdue timer routing is not supported by format v1 yet');
    }
  }
  const destination = (v, at) => { if (!pages.has(v) && !['HOME', 'TITLE_SCREEN', '-1'].includes(v)) error(at, `unknown dialogue destination ${JSON.stringify(v)}`); };
  const itemRef = (v, at) => { if (!Object.hasOwn(items, v)) error(at, `unknown item ${JSON.stringify(v)}`); };
  const dataActions = new Set(['ADD_ITEM','REMOVE_ITEM','ADD_KNOWLEDGE','START_QUEST','COMPLETE_QUEST','START_ITEM_TIMER','STOP_ITEM_TIMER','UNLOCK_AREA','ADD_COUNTER','SET_COUNTER','RESET_COUNTER']);
  const actions = new Set([...dataActions, 'START_TIMER','OPEN_CASTLE','NEXT_SCAN','DROPDOWN_INVENTORY','DROPDOWN_CHOICE']);
  for (const [pid, p] of pages) {
    const owner = owners.get(pid), at = owner.at;
    if (!record(p)) continue;
    if (p.id !== pid) error(`${at}.id`, 'must equal page key');
    if (p.picture) local(p.picture, `${at}.picture`, true);
    const buttons = Array.isArray(p.buttons) ? p.buttons : [], indices = new Set();
    buttons.forEach((b, i) => {
      if (!record(b)) return;
      if (indices.has(b.index)) error(`${at}.buttons[${i}].index`, 'duplicate button index');
      indices.add(b.index); destination(b.next, `${at}.buttons[${i}].next`);
    });
    if (record(p.condition)) for (const [key, value] of Object.entries(p.condition)) {
      if (!indices.has(Number(key)) || typeof value !== 'string' || conditions.validate(value) !== null)
        error(`${at}.condition.${key}`, 'expected existing button index and safe engine condition expression');
    }
    (Array.isArray(p.actions) ? p.actions : []).forEach((a, i) => {
      const aa = `${at}.actions[${i}]`;
      if (!record(a)) return;
      if (!actions.has(a.type)) error(`${aa}.type`, 'unsupported engine action');
      if (dataActions.has(a.type) && !text(a.data)) error(`${aa}.data`, 'nonempty data required');
      if (['ADD_ITEM','REMOVE_ITEM','START_ITEM_TIMER','STOP_ITEM_TIMER'].includes(a.type)) itemRef(a.data, `${aa}.data`);
      if (['START_QUEST','COMPLETE_QUEST'].includes(a.type) && !Object.hasOwn(game.questDisplayNames || {}, a.data)) error(`${aa}.data`, 'unknown quest');
      if (a.type === 'ADD_KNOWLEDGE' && !Object.hasOwn(game.thingsIKnow || {}, a.data)) error(`${aa}.data`, 'unknown knowledge entry');
      if (['START_TIMER','START_ITEM_TIMER'].includes(a.type) && !(Number.isFinite(a.durationMs) && a.durationMs > 0)) error(`${aa}.durationMs`, 'positive finite duration required');
      if (a.type === 'START_TIMER' && owner.kind !== 'encounters') error(aa, 'START_TIMER requires an encounter page');
      if (a.type === 'NEXT_SCAN' && owner.kind !== 'encounters') error(aa, 'NEXT_SCAN requires an encounter page');
      if (a.type.endsWith('_COUNTER')) {
        if (owner.kind !== 'items' && !a.item) error(`${aa}.item`, 'item required for encounter counter');
        if (a.item) itemRef(a.item, `${aa}.item`);
        if (a.type === 'SET_COUNTER' && !Number.isFinite(a.value)) error(`${aa}.value`, 'finite number required');
        if (a.amount !== undefined && !Number.isFinite(a.amount)) error(`${aa}.amount`, 'finite number required');
      }
      if (a.buttonIndex !== undefined) {
        const selected = Array.isArray(a.buttonIndex) ? a.buttonIndex : [a.buttonIndex];
        if (!selected.length) error(`${aa}.buttonIndex`, 'at least one button index required');
        for (const n of selected) if (!Number.isInteger(n) || !indices.has(n)) error(`${aa}.buttonIndex`, 'unknown button index');
      }
      if (a.waitPage !== undefined) { destination(a.waitPage, `${aa}.waitPage`); if (!pages.has(a.waitPage)) error(`${aa}.waitPage`, 'must reference dialogue page'); }
      if (a.unlessHasItem !== undefined) itemRef(a.unlessHasItem, `${aa}.unlessHasItem`);
      if (a.type.startsWith('DROPDOWN_')) {
        if (!Array.isArray(a.options) || !a.options.length) error(`${aa}.options`, 'nonempty options required');
        (Array.isArray(a.options) ? a.options : []).forEach((o, j) => {
          if (!record(o) || !text(o.label)) { error(`${aa}.options[${j}]`, 'option label required'); return; }
          destination(o.next, `${aa}.options[${j}].next`);
          if (a.type === 'DROPDOWN_INVENTORY') itemRef(o.value, `${aa}.options[${j}].value`);
        });
        if (a.type === 'DROPDOWN_INVENTORY' && a.otherNext === undefined) error(`${aa}.otherNext`, 'inventory fallback required');
      }
      if (a.otherNext !== undefined) destination(a.otherNext, `${aa}.otherNext`);
    });
  }
  const physical = new Set(), completionGroups = [];
  if (manifest.type === 'linear') {
    const scenarios = read(manifest.scenarios, 'manifest.json.scenarios');
    if (scenarios) {
      checkSchema(scenarios, schema('scenarios'), manifest.scenarios, errors);
      if (errors.length) return { valid: false, errors, warnings };
      const starts = new Set();
      for (const [id, s] of Object.entries(record(scenarios.scenarios) ? scenarios.scenarios : {})) {
        const at = `${manifest.scenarios}.scenarios.${id}`;
        if (!/^[a-z][a-z0-9-]*$/.test(id)) error(at, 'invalid scenario ID');
        if (!record(s)) continue;
        if (starts.has(s.startQR)) error(`${at}.startQR`, 'duplicate starting QR');
        starts.add(s.startQR);
        completionGroups.push([at, Object.values(s.encounters)]);
        if (!Array.isArray(s.sequence)) continue;
        if (s.sequence[0] !== s.startQR) error(`${at}.sequence`, 'first QR must equal startQR');
        for (const q of s.sequence) {
          physical.add(q);
          if (!record(s.encounters) || !Object.hasOwn(s.encounters, q)) error(`${at}.encounters.${q}`, 'missing encounter mapping');
        }
        for (const [q, encounter] of Object.entries(record(s.encounters) ? s.encounters : {})) {
          if (!qr(q) || !s.sequence.includes(q)) error(`${at}.encounters.${q}`, 'QR must occur in sequence');
          if (!Object.hasOwn(encounters, encounter)) error(`${at}.encounters.${q}`, 'unknown encounter');
        }
      }
    }
  } else {
    for (const q of Object.keys(encounters)) { if (!qr(q)) error(`${manifest.gameData}.encounters.${q}`, 'non-linear/circular encounters require physical two-digit QR IDs'); physical.add(q); }
  }
  if (record(manifest.map) && Array.isArray(manifest.map.markers)) {
    const ids = new Set();
    manifest.map.markers.forEach((m, i) => {
      if (!record(m)) return;
      if (ids.has(m.id)) error(`manifest.json.map.markers[${i}].id`, 'duplicate marker ID');
      ids.add(m.id);
      if (!physical.has(m.qr)) error(`manifest.json.map.markers[${i}].qr`, 'unknown physical QR');
    });
  }
  if (record(game.progression)) {
    if (manifest.type !== 'circular') error(`${manifest.gameData}.progression`, 'visit metadata is only for circular adventures');
    for (const q of game.progression.eligibleStarts || []) if (!physical.has(q)) error(`${manifest.gameData}.progression.eligibleStarts`, 'unknown QR');
    for (const c of game.progression.visitConditions || []) if (record(c) && !physical.has(c.qr)) error(`${manifest.gameData}.progression.visitConditions`, 'unknown QR');
    warnings.push('Circular visit history/count declarations are authoring metadata; runtime support is deferred.');
  }
  // A conservative graph check, not a proof that all conditions can be satisfied.
  const reachable = (start, allowed = null) => {
    const seen = new Set(), queue = [start]; let wins = false;
    while (queue.length) {
      const id = queue.pop(); if (id === 'TITLE_SCREEN') { wins = true; continue; }
      if (seen.has(id) || !record(pages.get(id))) continue;
      const owner = owners.get(id);
      if (allowed && owner.kind === 'encounters' && !allowed.has(owner.id)) continue;
      seen.add(id); const p = pages.get(id);
      for (const b of p.buttons || []) if (record(b)) queue.push(b.next);
      for (const a of p.actions || []) if (record(a)) {
        for (const o of Array.isArray(a.options) ? a.options : []) if (record(o)) queue.push(o.next);
        if (a.otherNext) queue.push(a.otherNext);
      }
    }
    return wins;
  };
  if (!Object.values(encounters).some(e => record(e) && reachable(e.startPage))) error(`${manifest.gameData}`, 'completion requires a reachable TITLE_SCREEN destination');
  for (const [at, group] of completionGroups) if (!group.some(id => encounters[id] && reachable(encounters[id].startPage, new Set(group)))) error(at, 'scenario has no reachable completion within its mapped encounters');
  warnings.push('Completion is checked structurally; condition satisfiability, physical route feasibility and timer behavior are not proven.');
  return { valid: errors.length === 0, errors, warnings };
}
module.exports = { validatePackage, checkSchema, parseJSON, safePath };
if (require.main === module) {
  const result = validatePackage(process.argv[2] || '.');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.valid ? 0 : 1;
}
