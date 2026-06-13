// ── Markdown + Math ─────────────────────────────────────────
const PH = ''; // private-use area char as math placeholder

export function formatMarkdown(text) {
  const math = [];
  const stashed = text.replace(
    /\$\$[\s\S]*?\$\$|\$[^\n$]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g,
    m => { math.push(m); return `${PH}${math.length - 1}${PH}`; }
  );
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escaped = esc(stashed);
  const inline = s => s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const lines = escaped.split('\n');
  let out = '', inUl = false, inOl = false;
  const closeLists = () => {
    if (inUl) { out += '</ul>'; inUl = false; }
    if (inOl) { out += '</ol>'; inOl = false; }
  };
  for (const line of lines) {
    const ul = line.match(/^\s*[-*]\s+(.*)/);
    const ol = line.match(/^\s*\d+\.\s+(.*)/);
    if (ul) {
      if (inOl) { out += '</ol>'; inOl = false; }
      if (!inUl) { out += '<ul>'; inUl = true; }
      out += `<li>${inline(ul[1])}</li>`;
    } else if (ol) {
      if (inUl) { out += '</ul>'; inUl = false; }
      if (!inOl) { out += '<ol>'; inOl = true; }
      out += `<li>${inline(ol[1])}</li>`;
    } else {
      closeLists();
      if (line.trim()) out += `<p>${inline(line)}</p>`;
    }
  }
  closeLists();
  if (!out) out = `<p>${inline(escaped)}</p>`;
  const re = new RegExp(`${PH}(\\d+)${PH}`, 'g');
  return out.replace(re, (_, i) => esc(math[+i]));
}

export function renderMath(el) {
  if (!el || !window.renderMathInElement) return;
  try {
    window.renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
  } catch {}
}

// ── Colour / Grade helpers ───────────────────────────────────
export function pctColor(p) {
  if (p >= 90) return '#3de8a0';
  if (p >= 75) return '#00e5ff';
  if (p >= 60) return '#f7c948';
  if (p >= 35) return '#fb923c';
  return '#f75a5a';
}

export function grade(p) {
  if (p >= 90) return { g: 'A+', bg: 'rgba(61,232,160,0.15)', col: '#3de8a0' };
  if (p >= 75) return { g: 'A', bg: 'rgba(0,229,255,0.18)', col: '#7dd8f0' };
  if (p >= 60) return { g: 'B', bg: 'rgba(247,201,72,0.12)', col: '#f7c948' };
  if (p >= 50) return { g: 'C', bg: 'rgba(251,146,60,0.12)', col: '#fb923c' };
  if (p >= 35) return { g: 'D', bg: 'rgba(247,90,90,0.12)', col: '#f87171' };
  return { g: 'F', bg: 'rgba(239,68,68,0.18)', col: '#ef4444' };
}

// ── ID / Date helpers ────────────────────────────────────────
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function deadlineInfo(dl) {
  if (!dl) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dl + 'T00:00:00');
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `Overdue by ${Math.abs(diff)}d`, cls: 'overdue' };
  if (diff === 0) return { label: 'Due today', cls: 'soon' };
  if (diff <= 3) return { label: `Due in ${diff}d`, cls: 'soon' };
  return { label: `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, cls: '' };
}

// ── Firebase error messages ──────────────────────────────────
export function firebaseErrMsg(code) {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/unauthorized-domain':
      'This site is not authorized for sign-in. Add this domain in Firebase → Authentication → Settings → Authorized domains.',
    'auth/popup-blocked': 'Sign-in popup was blocked. Allow popups for this site and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/operation-not-allowed':
      'Google sign-in is not enabled. Enable it in Firebase → Authentication → Sign-in method.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Quiz JSON parser ─────────────────────────────────────────
export function parseQuizJson(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    return JSON.parse(cleaned.replace(/\\(?!["\\/bfnru])/g, '\\\\'));
  }
}

// ── Sync error toast helper ──────────────────────────────────
export function syncErrMsg(action, e) {
  const code = e?.code || e?.message || 'unknown error';
  if (code.includes('permission-denied'))
    return 'Cloud save blocked — publish Firestore security rules in Firebase.';
  if (code.includes('unavailable') || code.includes('not-found') || code.includes('Failed to get'))
    return 'No Firestore database found — create one in the Firebase console.';
  return `${action} failed: ${code}`;
}
