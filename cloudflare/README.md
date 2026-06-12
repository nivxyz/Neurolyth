# Neurolyth AI proxy (Cloudflare Worker)

This Worker keeps the AI API key secret so the AI works on the static
GitHub Pages site. It uses **Groq** (free, no card) and translates between
the app's Gemini-style format and Groq's API, so the frontend is unchanged.
Deploy it once via the Cloudflare dashboard — no CLI needed.

Get a free Groq API key at <https://console.groq.com/keys> (no credit card).
Store it in the Worker secret named `GEMINI_API_KEY` (the name is kept for
continuity — its value is the Groq key).

## Deploy (dashboard, ~3 minutes)

1. Sign up / log in at <https://dash.cloudflare.com> (free).
2. Left sidebar → **Workers & Pages** → **Create** → **Create Worker**.
3. Name it `neurolyth-ai` → **Deploy** (deploys a placeholder).
4. Click **Edit code**. Delete everything in the editor, paste the full
   contents of [`worker.js`](worker.js), then **Deploy**.
5. Go to the Worker's **Settings** → **Variables and Secrets** → **Add**:
   - Type: **Secret**
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini API key
   - **Save / Deploy**
6. Copy the Worker URL shown at the top — it looks like
   `https://neurolyth-ai.<your-subdomain>.workers.dev`.
7. Send that URL back and it gets wired into `script.js` (`GEMINI_PROXY_URL`),
   which flips the AI Helper and Quiz Maker back on.

## Notes

- Allowed browser origins are listed in `ALLOWED_ORIGINS` in `worker.js`
  (the GitHub Pages site + localhost). Add a custom domain there later if needed.
- To change the model, edit `MODEL` in `worker.js` and redeploy.
- If you ever rotate the Gemini key, just update the `GEMINI_API_KEY` secret —
  no code change.
