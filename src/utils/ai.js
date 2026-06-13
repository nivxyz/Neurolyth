const GEMINI_PROXY_URL = 'https://neurolyth-ai.lighningcraftpro.workers.dev';
export const AI_ENABLED = !!GEMINI_PROXY_URL;

let _pdfjs = null;
async function getPdfjs() {
  if (!_pdfjs) {
    _pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs');
    _pdfjs.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs';
  }
  return _pdfjs;
}

export async function readPdfText(file) {
  const lib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  let text = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text.trim();
}

function readText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Read error'));
    r.readAsText(file);
  });
}

export async function geminiGenerate(prompt, file, systemText = '') {
  if (!AI_ENABLED) throw new Error('AI features are temporarily offline.');
  let fullPrompt = prompt;
  if (file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let fileText = '';
    if (ext === 'pdf') {
      fileText = await readPdfText(file);
      if (!fileText)
        throw new Error(
          'Could not read any text from this PDF — it looks like scanned images. Try a text-based PDF, or paste the text instead.'
        );
    } else if (['txt', 'doc', 'docx'].includes(ext)) {
      fileText = await readText(file);
    } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
      throw new Error(
        "Image files need a vision AI, which the current free model can't read. Please upload a PDF/TXT or paste the text instead."
      );
    }
    if (fileText)
      fullPrompt = `Use ONLY the following content from "${file.name}" to answer.\n"""\n${fileText.substring(0, 16000)}\n"""\n\n${prompt}`;
  }

  const payload = { contents: [{ parts: [{ text: fullPrompt }] }] };
  if (systemText) payload.systemInstruction = { parts: [{ text: systemText }] };

  const res = await fetch(GEMINI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : { error: { message: `Empty response (HTTP ${res.status}).` } };
  } catch {
    data = { error: { message: raw || `AI proxy returned HTTP ${res.status}.` } };
  }
  if (!res.ok && data?.error && data.error.status == null) data.error.status = res.status;
  if (data.error) throw new Error(data.error.message || 'AI request failed.');
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('')?.trim();
  if (!text) throw new Error('Empty response from AI.');
  return text;
}
