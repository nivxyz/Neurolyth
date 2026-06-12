// Neurolyth — Gemini proxy running on Cloudflare Workers.
//
// Why: GitHub Pages is static-only, so it can't keep the Gemini API key
// secret. This Worker holds the key as a secret env var (GEMINI_API_KEY)
// and forwards requests to Google, so the key never reaches the browser.
//
// Deploy: see cloudflare/README.md. After deploying, copy the worker URL
// (https://<name>.<your-subdomain>.workers.dev) into GEMINI_PROXY_URL in
// script.js.

const ALLOWED_ORIGINS = [
  'https://nivxyz.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const MODEL = 'gemini-2.0-flash';

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: { message: 'Method not allowed' } }, 405, origin);
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return json({ error: { message: 'GEMINI_API_KEY is not configured on the Worker.' } }, 500, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: { message: 'Invalid JSON body.' } }, 400, origin);
    }

    try {
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      const raw = await upstream.text();
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
            status: upstream.status,
          },
        };
      }
      return json(data, upstream.status, origin);
    } catch (err) {
      return json({ error: { message: err.message || 'Proxy request failed.' } }, 500, origin);
    }
  },
};
