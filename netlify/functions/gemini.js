export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: { message: 'Method not allowed' } })
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: { message: 'GEMINI_API_KEY is not configured.' } })
    };
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: { message: 'Invalid JSON body.' } })
    };
  }

  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

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
          status: upstream.status
        }
      };
    }

    return {
      statusCode: upstream.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: { message: err.message || 'Proxy request failed.' } })
    };
  }
}
