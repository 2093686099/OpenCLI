/**
 * Teable adapter — local name→ID cache.
 *
 * Stored at ~/.opencli/teable-cache.json, refreshed every 24 hours.
 * Caches spaces, bases, and tables so commands can accept names in addition to IDs.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { CliError } from '@jackwener/opencli/errors';
import { teableGet } from './utils.js';

const CACHE_PATH = join(homedir(), '.opencli', 'teable-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadCacheFile() {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveCacheFile(cache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function isStale(cache) {
  if (!cache?.updatedAt) return true;
  return Date.now() - new Date(cache.updatedAt).getTime() > CACHE_TTL_MS;
}

export async function refreshCache() {
  const [spaces, bases] = await Promise.all([
    teableGet('/api/space'),
    teableGet('/api/base/access/all'),
  ]);

  const tablesByBase = await Promise.all(
    (bases || []).map(async b => {
      try {
        const tables = await teableGet(`/api/base/${b.id}/table`);
        return (tables || []).map(t => ({ id: t.id, name: t.name, baseId: b.id }));
      } catch {
        return [];
      }
    })
  );

  const cache = {
    updatedAt: new Date().toISOString(),
    spaces: (spaces || []).map(s => ({ id: s.id, name: s.name })),
    bases: (bases || []).map(b => ({ id: b.id, name: b.name, spaceId: b.spaceId })),
    tables: tablesByBase.flat(),
  };

  saveCacheFile(cache);
  return cache;
}

let _cache = null;

export async function getCache() {
  if (_cache && !isStale(_cache)) return _cache;
  const cached = loadCacheFile();
  if (cached && !isStale(cached)) {
    _cache = cached;
    return _cache;
  }
  _cache = await refreshCache();
  return _cache;
}

export function invalidateCache() {
  _cache = null;
}

/** Resolve a base name or ID to a base ID. */
export async function resolveBaseId(nameOrId) {
  if (/^bse/.test(nameOrId)) return nameOrId;
  const cache = await getCache();
  const matches = cache.bases.filter(b => b.name === nameOrId);
  if (matches.length === 0) {
    throw new CliError(
      'NOT_FOUND',
      `Base not found: "${nameOrId}".`,
      "Run 'opencli teable bases' to list available bases, or use the base ID."
    );
  }
  if (matches.length > 1) {
    const ids = matches.map(b => b.id).join(', ');
    throw new CliError('AMBIGUOUS', `Multiple bases named "${nameOrId}". Use the base ID instead: ${ids}`);
  }
  return matches[0].id;
}

/** Resolve a table name or ID to a table ID, with optional base scoping. */
export async function resolveTableId(nameOrId, baseId) {
  if (/^tbl/.test(nameOrId)) return nameOrId;
  const cache = await getCache();
  let matches = cache.tables.filter(t => t.name === nameOrId);
  if (baseId) matches = matches.filter(t => t.baseId === baseId);
  if (matches.length === 0) {
    throw new CliError(
      'NOT_FOUND',
      `Table not found: "${nameOrId}".`,
      "Run 'opencli teable cache-refresh' to refresh the cache, or use the table ID."
    );
  }
  if (matches.length > 1) {
    const ids = matches.map(t => `${t.id} (base: ${t.baseId})`).join(', ');
    throw new CliError(
      'AMBIGUOUS',
      `Multiple tables named "${nameOrId}" across different bases. Use the table ID instead: ${ids}`
    );
  }
  return matches[0].id;
}
