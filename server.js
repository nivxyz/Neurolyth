import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 3000;
const geminiKey = process.env.GEMINI_API_KEY;

if (!geminiKey) {
  console.warn('GEMINI_API_KEY is not set. /api/gemini will fail until it is provided.');
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function serveFile(res, relPath) {
  const filePath = path.join(__dirname, relPath);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const body = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/gemini') {
    try {
      if (!geminiKey) return send(res, 500, { error: { message: 'GEMINI_API_KEY is not configured.' } });

      const body = await readJson(req);
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const raw = await upstream.text();
      if (!raw) {
        console.error('Gemini upstream returned empty body', { status: upstream.status, ok: upstream.ok });
      }
      let data;
      try {
        data = raw ? JSON.parse(raw) : { error: { message: 'Empty response from Gemini.' } };
      } catch {
        data = { error: { message: raw || `Gemini returned HTTP ${upstream.status}.` } };
      }
      if (!upstream.ok) {
        data = {
          error: {
            message: data?.error?.message || data?.message || raw || `Gemini returned HTTP ${upstream.status}.`,
            status: upstream.status
          }
        };
      }
      res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch (err) {
      send(res, 500, { error: { message: err.message || 'Proxy request failed.' } });
    }
    return;
  }

  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const relPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  await serveFile(res, relPath);
});

server.listen(port, () => {
  console.log(`Neurolyth running at http://localhost:${port}`);
});
