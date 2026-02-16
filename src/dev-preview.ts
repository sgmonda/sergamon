/**
 * dev-preview.ts
 *
 * Development tool for the Sergamon pixel font project.
 * Watches .glyph files for changes, triggers a rebuild, and serves
 * the site/ directory on a local HTTP server for live preview.
 *
 * Usage:  npx tsx src/dev-preview.ts
 *         npm run dev
 */

import { watch } from 'chokidar';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { execSync } from 'node:child_process';

// ── Configuration ────────────────────────────────────────────────────────────

const PREFERRED_PORT = 3000;
const ROOT = resolve(import.meta.dirname, '..');
const SITE_DIR = join(ROOT, 'site');
const GLYPHS_DIR = join(ROOT, 'glyphs');

// ── MIME types ───────────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.txt':  'text/plain; charset=utf-8',
};

// ── Build helper ─────────────────────────────────────────────────────────────

let isBuilding = false;

function runBuild(): void {
  if (isBuilding) {
    console.log('[dev] Build already in progress, skipping...');
    return;
  }

  isBuilding = true;
  const startTime = Date.now();

  console.log('[dev] Glyph change detected. Rebuilding...');

  try {
    execSync('npm run build', {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    // Copy WOFF2 files to site/fonts/
    try {
      execSync('cp build/*.woff2 site/fonts/ 2>/dev/null || true', {
        cwd: ROOT,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    } catch {
      // WOFF2 files may not exist yet; that is fine
    }

    const elapsed = Date.now() - startTime;
    console.log(`[dev] Build succeeded in ${elapsed}ms. Refresh your browser.`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[dev] Build failed:\n${message}`);
  } finally {
    isBuilding = false;
  }
}

// ── Static file server ──────────────────────────────────────────────────────

async function serveFile(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let urlPath = req.url || '/';

  // Strip query string
  const qIndex = urlPath.indexOf('?');
  if (qIndex !== -1) {
    urlPath = urlPath.slice(0, qIndex);
  }

  // Default to index.html
  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  }

  // Resolve the file path safely within SITE_DIR
  const filePath = join(SITE_DIR, decodeURIComponent(urlPath));

  // Prevent directory traversal
  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      // Try index.html in directory
      const indexPath = join(filePath, 'index.html');
      try {
        const indexStat = await stat(indexPath);
        if (indexStat.isFile()) {
          const data = await readFile(indexPath);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(data);
          return;
        }
      } catch {
        // No index.html in directory
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    if (!fileStat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('[dev] Starting Sergamon development server...');
  console.log(`[dev] Watching: ${GLYPHS_DIR}/**/*.glyph`);
  console.log(`[dev] Serving:  ${SITE_DIR}/`);

  // Run initial build
  runBuild();

  // Watch glyph files
  const watcher = watch(join(GLYPHS_DIR, '**', '*.glyph'), {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
  });

  watcher.on('change', (path) => {
    console.log(`[dev] Changed: ${path}`);
    runBuild();
  });

  watcher.on('add', (path) => {
    console.log(`[dev] Added: ${path}`);
    runBuild();
  });

  watcher.on('unlink', (path) => {
    console.log(`[dev] Removed: ${path}`);
    runBuild();
  });

  watcher.on('error', (err) => {
    console.error(`[dev] Watcher error: ${err.message}`);
  });

  // Start HTTP server
  const server = createServer((req, res) => {
    serveFile(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[dev] Server error: ${message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  });

  let tryPort = PREFERRED_PORT;

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[dev] Port ${tryPort} in use, trying ${tryPort + 1}...`);
      tryPort++;
      server.listen(tryPort);
    } else {
      throw err;
    }
  });

  server.listen(tryPort, () => {
    const { port } = server.address() as AddressInfo;
    console.log(`[dev] Server running at http://localhost:${port}`);
    console.log('[dev] Press Ctrl+C to stop.\n');
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('\n[dev] Shutting down...');
    watcher.close();
    server.close(() => {
      console.log('[dev] Server stopped.');
      process.exit(0);
    });
    // Force exit after 3 seconds if close hangs
    setTimeout(() => process.exit(0), 3000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
