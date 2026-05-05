exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const body = JSON.parse(event.body);

    // Convert messages to Gemini format
    const contents = body.messages.map(m => {
      // Handle multimodal messages (images/PDFs)
      if (Array.isArray(m.content)) {
        const parts = m.content.map(c => {
          if (c.type === 'text') return { text: c.text };
          if (c.type === 'image') return {
            inline_data: { mime_type: c.source.media_type, data: c.source.data }
          };
          if (c.type === 'document') return {
            inline_data: { mime_type: 'application/pdf', data: c.source.data }
          };
          return { text: '' };
        });
        return { role: 'user', parts };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      };
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 4000,
            responseMimeType: 'application/json'
          }
        }),
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
