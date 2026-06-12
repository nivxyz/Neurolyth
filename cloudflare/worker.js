// Neurolyth — AI proxy running on Cloudflare Workers (Groq backend).
//
// Why Groq: Google's Gemini free tier returns limit:0 in some regions, so
// we use Groq's free API (Llama 3.3) instead — fast and genuinely free, no
// card required.
//
// The frontend still speaks the Gemini request/response shape, so this
// Worker translates Gemini <-> OpenAI/Groq in both directions. That means
// no frontend changes were needed.
//
// Secret: set GEMINI_API_KEY on the Worker to your **Groq** API key
// (console.groq.com/keys). The variable name is kept for continuity.
//
// Deploy: see cloudflare/README.md.

const ALLOWED_ORIGINS = [
  'https://nivxyz.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

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

// Pull all text out of the Gemini-style request body.
function geminiToMessages(body) {
  const messages = [];

  const sysParts = body?.systemInstruction?.parts || [];
  const sysText = sysParts.map((p) => p.text || '').join('\n').trim();
  if (sysText) messages.push({ role: 'system', content: sysText });

  const contents = Array.isArray(body?.contents) ? body.contents : [];
  const userText = contents
    .flatMap((c) => (c.parts || []).map((p) => p.text || ''))
    .filter(Boolean)
    .join('\n')
    .trim();
  messages.push({ role: 'user', content: userText || 'Hello' });

  return messages;
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

    const apiKey = env.GEMINI_API_KEY; // holds the Groq key
    if (!apiKey) {
      return json({ error: { message: 'API key is not configured on the Worker.' } }, 500, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: { message: 'Invalid JSON body.' } }, 400, origin);
    }

    try {
      const upstream = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: geminiToMessages(body),
          temperature: 0.7,
        }),
      });

      const raw = await upstream.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!upstream.ok || !data) {
        const message =
          data?.error?.message || data?.error || raw || `AI provider returned HTTP ${upstream.status}.`;
        return json({ error: { message, status: upstream.status } }, upstream.status || 502, origin);
      }

      // Translate Groq/OpenAI response back into the Gemini shape the app expects.
      const text = data?.choices?.[0]?.message?.content || '';
      const gemini = { candidates: [{ content: { parts: [{ text }] } }] };
      return json(gemini, 200, origin);
    } catch (err) {
      return json({ error: { message: err.message || 'Proxy request failed.' } }, 500, origin);
    }
  },
};
