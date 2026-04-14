/**
 * Teable adapter — shared HTTP helpers and utilities.
 */

import { CliError } from '@jackwener/opencli/errors';

const DEFAULT_BASE_URL = 'https://teable.neuroncloud.ai';

export function getToken() {
  const token = process.env.TEABLE_TOKEN;
  if (!token) {
    throw new CliError(
      'MISSING_TOKEN',
      'TEABLE_TOKEN environment variable is not set.',
      'Set it with: export TEABLE_TOKEN=your_token_here'
    );
  }
  return token;
}

export function getBaseUrl() {
  return (process.env.TEABLE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

async function request(method, path, { params, body } = {}) {
  const token = getToken();
  const base = getBaseUrl();
  const url = new URL(`${base}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(url.toString(), options);

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      msg = errBody.message || JSON.stringify(errBody) || msg;
    } catch {
      const txt = await resp.text().catch(() => '');
      if (txt) msg = txt;
    }
    throw new CliError('TEABLE_API_ERROR', `Teable API error: ${msg}`);
  }

  const text = await resp.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

export const teableGet = (path, params) => request('GET', path, { params });
export const teablePost = (path, body) => request('POST', path, { body });
export const teablePatch = (path, body) => request('PATCH', path, { body });
export const teableDelete = (path) => request('DELETE', path);

/**
 * Read JSON from stdin. Throws if stdin is a TTY (interactive terminal).
 */
export function readStdin() {
  if (process.stdin.isTTY) {
    throw new CliError(
      'STDIN_REQUIRED',
      'No data on stdin. Pipe JSON or use --fields / --from-json instead.',
      "Example: echo '{\"标题\":\"xx\"}' | opencli teable create 试点反馈 --from-stdin"
    );
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(raw.trim()));
      } catch (e) {
        reject(new CliError('INVALID_JSON', `Failed to parse stdin as JSON: ${e.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Convert a simple {field: value} object into Teable's filter format.
 * If the object already has a `conjunction` key, it is passed through unchanged.
 */
export function normalizeFilter(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new CliError('INVALID_FILTER', 'Filter must be a JSON object, e.g. {"状态":"新反馈"}');
  }
  if (obj.conjunction) return obj; // already Teable native format
  const filterSet = Object.entries(obj).map(([fieldId, value]) => ({
    fieldId,
    operator: Array.isArray(value) ? 'isAnyOf' : 'is',
    value,
  }));
  return { conjunction: 'and', filterSet };
}

/**
 * Parse comma-separated field names into a trimmed string array.
 */
export function parseFieldsArg(str) {
  return str.split(',').map(f => f.trim()).filter(Boolean);
}
