#!/usr/bin/env node
/**
 * Production entry for the TanStack Start app.
 *
 * The real HTTP server is produced by `vite build` (Nitro `node-server`
 * preset) at `.output/server/index.mjs`. That bundle reads PORT/HOST
 * from the environment when it boots, so this wrapper just:
 *
 *   1. Loads `.env` (if present) so PORT / HOST / SUPABASE_* etc. are set.
 *   2. Applies safe production defaults (PORT=8080, HOST=0.0.0.0).
 *   3. Imports the built server, which starts listening on import.
 *
 * Run with: `npm start`
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Minimal .env loader (no extra dependency) ----------------------------
const envPath = resolve(__dirname, '.env');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// --- Production defaults --------------------------------------------------
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '8080';
process.env.HOST = process.env.HOST || '0.0.0.0';
// Nitro reads NITRO_PORT / NITRO_HOST first — mirror PORT / HOST into them
// so a single env var works regardless of which name the runtime checks.
process.env.NITRO_PORT = process.env.NITRO_PORT || process.env.PORT;
process.env.NITRO_HOST = process.env.NITRO_HOST || process.env.HOST;

// --- Boot the built server ------------------------------------------------
const serverEntry = resolve(__dirname, '.output/server/index.mjs');
if (!existsSync(serverEntry)) {
  console.error(
    '[server] Build output not found at .output/server/index.mjs\n' +
    '         Run `npm run build` before `npm start`.',
  );
  process.exit(1);
}

console.log(
  `[server] Starting production server on http://${process.env.HOST}:${process.env.PORT}`,
);

await import(pathToFileURL(serverEntry).href);
