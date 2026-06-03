import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT || 3005);
const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(rootDir, '.env'), 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) return;
      const [, key, value] = match;
      process.env[key] ||= value.replace(/^"|"$/g, '');
    });
  } catch {
    // .env is optional for static preview, required for API calls.
  }
}

const apiRoutes = [
  ['/api/auth/login', 'api/auth/login.js'],
  ['/api/auth/signup', 'api/auth/signup.js'],
  ['/api/auth/users', 'api/auth/users.js'],
  ['/api/auth/me', 'api/auth/me.js'],
  ['/api/auth/heartbeat', 'api/auth/heartbeat.js'],
  ['/api/auth/logout', 'api/auth/logout.js'],
  ['/api/bridge/gas', 'api/bridge/gas.js'],
  ['/api/storage/upload', 'api/storage/upload.js'],
  ['/api/open/bgn', 'api/open/bgn.js'],
  ['/api/workflows/role-permissions', 'api/workflows/role-permissions.js'],
  ['/api/workflows/inventory-material', 'api/workflows/inventory-material.js'],
  ['/api/workflows/procurement', 'api/workflows/procurement.js']
];

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
  }[ext] || 'application/octet-stream';
}

async function runApi(request, response, url) {
  const exact = apiRoutes.find(([route]) => route === url.pathname);
  let modulePath = exact?.[1];
  request.query = Object.fromEntries(url.searchParams.entries());

  if (!modulePath && url.pathname.startsWith('/api/v1/')) {
    modulePath = 'api/v1/[resource].js';
    request.query.resource = decodeURIComponent(url.pathname.replace('/api/v1/', '').split('/')[0]);
  }

  if (!modulePath) return false;
  const imported = await import(pathToFileURL(path.join(rootDir, modulePath)).href + `?t=${Date.now()}`);
  await imported.default(request, response);
  return true;
}

async function serveStatic(request, response, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/app/index.html';
  if (!pathname.startsWith('/app/')) pathname = `/app${pathname}`;

  let filePath = path.join(rootDir, pathname);
  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Cache-Control': 'no-store'
    });
    response.end(data);
  } catch {
    filePath = path.join(rootDir, 'app/index.html');
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(data);
  }
}

await loadEnv();

http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname === '/healthz') {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end(JSON.stringify({ ok: true, service: 'sipagi-dashboard' }));
      return;
    }

    if (url.pathname.startsWith('/api/') && await runApi(request, response, url)) return;
    await serveStatic(request, response, url);
  } catch (error) {
    response.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: error.message }));
  }
}).listen(port, host, () => {
  console.log(`SIPAGI local dev server: http://${host}:${port}/app/`);
});
