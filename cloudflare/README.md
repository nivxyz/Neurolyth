# Neurolyth AI proxy (Cloudflare Worker)

This Worker keeps the Gemini API key secret so the AI works on the static
GitHub Pages site. Deploy it once via the Cloudflare dashboard — no credit
card, no CLI needed.

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
