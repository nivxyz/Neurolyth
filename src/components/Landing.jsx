import { useEffect, useRef, useState } from 'react';
import { formatMarkdown, renderMath } from '../utils/misc';
import { geminiGenerate, AI_ENABLED } from '../utils/ai';

const DEMO_PROMPTS = [
  'What is Newton\'s second law?',
  'How does photosynthesis work?',
];
const DEMO_ANSWERS = [
  'Newton\'s second law states that **force equals mass times acceleration**: $F = ma$\n\nIn other words, the net force on an object equals the product of its mass and the acceleration it experiences. A heavier object requires more force to achieve the same acceleration as a lighter one.',
  '**Photosynthesis** is the process plants use to convert light energy into chemical energy (glucose).\n\nThe overall equation is:\n$$6CO_2 + 6H_2O + \\text{light} \\rightarrow C_6H_{12}O_6 + 6O_2$$\n\nIt happens in the chloroplasts through two stages: the light-dependent reactions and the Calvin cycle.',
];

const FONTS = [
  { label: 'Syne', value: "'Syne', sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'DM Sans', value: "'DM Sans', sans-serif" },
];

export default function Landing({ onSignIn }) {
  const landingRef = useRef(null);
  const svgRef = useRef(null);
  const [activeFont, setActiveFont] = useState(0);

  // ── Scroll line SVG animation ──────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const cols = [0.14, 0.38, 0.62, 0.86];
    const AMPLITUDE = 44;
    const WAVELENGTH = 220;
    const SPEED = 0.00038;
    const DOT_R = 5;

    const W = () => window.innerWidth;
    const H = () => (landingRef.current ? landingRef.current.scrollHeight : window.innerHeight * 4);

    function buildPath(xFrac) {
      const x = W() * xFrac;
      const h = H();
      const steps = Math.ceil(h / 8);
      let d = `M ${x} 0`;
      for (let i = 1; i <= steps; i++) {
        const y = (i / steps) * h;
        const dx = AMPLITUDE * Math.sin((2 * Math.PI * y) / WAVELENGTH);
        d += ` L ${x + dx} ${y}`;
      }
      return d;
    }

    svg.innerHTML = '';
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    const paths = cols.map(xFrac => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', buildPath(xFrac));
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'rgba(255,255,255,0.055)');
      p.setAttribute('stroke-width', '1.5');
      const len = p.getTotalLength ? p.getTotalLength() : 2000;
      p.setAttribute('stroke-dasharray', `${len}`);
      p.setAttribute('stroke-dashoffset', `${len}`);
      svg.appendChild(p);
      return { p, len, xFrac };
    });

    const dots = cols.map(() => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', DOT_R);
      c.setAttribute('fill', 'rgba(255,255,255,0.22)');
      svg.appendChild(c);
      return c;
    });

    let start = null;
    let raf;
    function tick(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const h = H();
      paths.forEach(({ p, len, xFrac }, i) => {
        const scrollY = elapsed * SPEED * h;
        const offset = len - (scrollY % len);
        p.setAttribute('stroke-dashoffset', offset);

        const progress = ((elapsed * SPEED * h) % h) / h;
        const y = progress * h;
        const x = W() * xFrac + AMPLITUDE * Math.sin((2 * Math.PI * y) / WAVELENGTH);
        dots[i].setAttribute('cx', x);
        dots[i].setAttribute('cy', y);
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    function rebuild() {
      svg.setAttribute('viewBox', `0 0 ${W()} ${H()}`);
      paths.forEach(({ p, xFrac }) => p.setAttribute('d', buildPath(xFrac)));
    }
    rebuild();
    window.addEventListener('resize', rebuild);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', rebuild);
    };
  }, []);

  // ── IntersectionObserver for .reveal ──────────────────────
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    const els = landingRef.current?.querySelectorAll('.reveal') || [];
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // ── Spotlight on hero ──────────────────────────────────────
  useEffect(() => {
    const hero = landingRef.current?.querySelector('.lp-hero');
    const spotlight = landingRef.current?.querySelector('.hero-spotlight');
    if (!hero || !spotlight) return;
    function move(e) {
      const r = hero.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      spotlight.style.setProperty('--mx', `${x}%`);
      spotlight.style.setProperty('--my', `${y}%`);
    }
    hero.addEventListener('mousemove', move);
    return () => hero.removeEventListener('mousemove', move);
  }, []);

  // ── Font tester ────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty('--font-display', FONTS[activeFont].value);
  }, [activeFont]);

  return (
    <div id="screen-landing" ref={landingRef}>
      <svg className="scroll-path" ref={svgRef} />

      {/* Nav */}
      <nav className="lp-nav">
        <div className="lp-logo">Neuro<span style={{ color: 'var(--accent)' }}>lyth</span></div>
        <button className="lp-nav-btn" onClick={onSignIn}>Sign in →</button>
      </nav>

      {/* Hero */}
      <section className="lp-hero">
        <div className="hero-spotlight" />
        <div className="lp-hero-glow" />
        <div className="lp-eyebrow reveal">Your AI study partner</div>
        <h1 className="lp-hero-title reveal">
          Study smarter.<br /><em>Not harder.</em>
        </h1>
        <p className="lp-hero-sub reveal">
          Neurolyth combines AI tutoring, task management, marks tracking, and quiz generation into one focused dashboard — built for students.
        </p>
        <div className="lp-hero-cta reveal">
          <button className="btn-primary lp-cta-btn" onClick={onSignIn}>Get started free</button>
          <button className="lp-ghost-btn" onClick={() => {
            document.querySelector('.lp-ai-section')?.scrollIntoView({ behavior: 'smooth' });
          }}>See AI demo</button>
        </div>
        <div className="lp-scroll-hint reveal">scroll to explore</div>
      </section>

      {/* Marquee */}
      <div className="lp-marquee" aria-hidden>
        <div className="lp-marquee-track">
          {[...Array(2)].map((_, r) => (
            ['AI Tutoring', 'Task Management', 'Marks Tracker', 'Quiz Maker', 'Progress Charts', 'Chat History', 'PDF Upload', 'KaTeX Math'].map((item, i) => (
              <span key={`${r}-${i}`}>
                <span className="mq-star">★</span> {item}
              </span>
            ))
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="lp-section">
        <div className="lp-section-head reveal">
          <span className="lp-kicker">Everything you need</span>
          <h2 className="lp-section-title">Tools that actually help<br />you <em>study</em></h2>
        </div>
        <div className="lp-feature-grid">
          {[
            { num: '01', title: 'Task Manager', desc: 'Organize assignments with priorities, subjects, and deadlines. Never miss a due date again.' },
            { num: '02', title: 'Marks Tracker', desc: 'Log your scores per subject and exam. Calculate averages, see grade projections, spot weak areas.' },
            { num: '03', title: 'Progress Charts', desc: 'Visual charts of your performance over time. Track improvement across every exam you sit.' },
            { num: '04', title: 'AI Quiz Maker', desc: 'Upload notes or paste text. Neurolyth AI generates a custom multiple-choice quiz in seconds.' },
          ].map(f => (
            <div className="lp-feature-card reveal" key={f.num}>
              <div className="lp-feature-num">{f.num}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <div className="lp-feature-hint">Try it →</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Demo */}
      <section className="lp-section lp-ai-section" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="lp-ai-glow" />
        <div className="lp-ai-inner">
          <div className="lp-ai-copy">
            <span className="lp-kicker reveal">Powered by AI</span>
            <TypewriterHeading />
            <p className="reveal">
              Ask anything — get clear, concise answers with proper maths formatting. The AI remembers your conversation history so it stays in context.
            </p>
            <button className="btn-primary lp-cta-btn reveal" onClick={onSignIn}>
              Start learning →
            </button>
          </div>
          <div className="reveal">
            <DemoChat onSignIn={onSignIn} />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-final">
        <h2 className="lp-final-title reveal">Ready to level up<br />your studies?</h2>
        <p className="lp-final-sub reveal">
          Join students using Neurolyth to stay organised, track progress, and get instant AI help — all in one place.
        </p>
        <button className="btn-primary reveal" onClick={onSignIn}>Create free account →</button>
      </section>

      <footer className="lp-footer">
        <span className="brand-accent">Neurolyth</span> — built for students
      </footer>

      {/* Font tester */}
      <div className="font-tester">
        <div className="font-tester-label">Heading font</div>
        <div className="font-tester-btns">
          {FONTS.map((f, i) => (
            <button
              key={f.label}
              className={activeFont === i ? 'active' : ''}
              style={{ fontFamily: f.value }}
              onClick={() => setActiveFont(i)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TypewriterHeading ─────────────────────────────────────────
function TypewriterHeading() {
  const LINE1 = 'Your personal';
  const LINE2 = 'AI tutor';
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [step, setStep] = useState(0); // 0=wait, 1=type line1, 2=type line2, 3=done
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStep(1); obs.unobserve(el); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setL1(LINE1.slice(0, i));
      if (i >= LINE1.length) { clearInterval(iv); setTimeout(() => setStep(2), 300); }
    }, 52);
    return () => clearInterval(iv);
  }, [step === 1]);

  useEffect(() => {
    if (step !== 2) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setL2(LINE2.slice(0, i));
      if (i >= LINE2.length) { clearInterval(iv); setStep(3); }
    }, 78);
    return () => clearInterval(iv);
  }, [step === 2]);

  return (
    <h2 className="lp-section-title" ref={ref} style={{ minHeight: '2.8em' }}>
      {step > 0 && (
        <>
          {l1}{step === 1 && <span className="tw-cursor" />}
          {step >= 2 && <><br /><em>{l2}{step === 2 && <span className="tw-cursor" />}</em></>}
        </>
      )}
    </h2>
  );
}

// ── DemoChat ───────────────────────────────────────────────────
function DemoChat({ onSignIn }) {
  const LIMIT = 2;
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m Neurolyth AI. Ask me anything about your studies — maths, science, history, anything.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [usedCount, setUsedCount] = useState(() => parseInt(localStorage.getItem('nlDemoCount') || '0', 10));
  const bodyRef = useRef(null);
  const msgRefs = useRef([]);
  const demoIdx = useRef(0);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    messages.forEach((msg, i) => {
      if (msg.role === 'assistant' && msg.done && msgRefs.current[i]) {
        renderMath(msgRefs.current[i]);
      }
    });
  }, [messages]);

  async function send(text) {
    if (!text.trim() || busy) return;
    const count = usedCount;
    if (count >= LIMIT) { onSignIn(); return; }

    const userMsg = { role: 'user', content: text };
    const typingMsg = { role: 'assistant', content: '', typing: true };
    setMessages(prev => [...prev, userMsg, typingMsg]);
    setInput('');
    setBusy(true);

    const newCount = count + 1;
    setUsedCount(newCount);
    localStorage.setItem('nlDemoCount', newCount);

    try {
      let reply;
      if (AI_ENABLED) {
        reply = await geminiGenerate(text, null, 'You are a helpful student study assistant. Keep responses concise and clear.');
      } else {
        reply = DEMO_ANSWERS[demoIdx.current % DEMO_ANSWERS.length];
        demoIdx.current++;
      }

      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last.typing) next[next.length - 1] = { role: 'assistant', content: reply, done: true };
        return next;
      });
    } catch (e) {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last.typing) next[next.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Sign in to use the full AI.', done: true };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  const hitLimit = usedCount >= LIMIT;

  return (
    <div className="lp-ai-demo">
      <div className="lp-ai-demo-bar">
        <div className="lp-ai-dot" />
        <div className="lp-ai-dot" />
        <div className="lp-ai-dot" />
        <span className="lp-ai-demo-title">Neurolyth AI</span>
        <span className="lp-ai-badge">LIVE</span>
      </div>
      <div className="lp-ai-demo-body" ref={bodyRef}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`lp-ai-line ${msg.role}${msg.typing ? ' typing' : ''}${msg.done ? ' formatted' : ''}`}
            ref={el => { msgRefs.current[i] = el; }}
            {...(msg.done ? { dangerouslySetInnerHTML: { __html: formatMarkdown(msg.content) } } : {})}
          >
            {msg.typing ? (
              <><span /><span /><span /></>
            ) : !msg.done ? (
              msg.content
            ) : null}
          </div>
        ))}
        {!busy && !hitLimit && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 4 }}>
            {DEMO_PROMPTS.slice(0, 2 - Math.min(usedCount, 2)).map((p, i) => (
              <button
                key={i}
                onClick={() => send(p)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, padding: '6px 10px', cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="lp-ai-demo-input">
        {hitLimit ? (
          <button className="lp-demo-cta" onClick={onSignIn}>
            Sign in to keep chatting →
          </button>
        ) : (
          <>
            <input
              type="text"
              placeholder="Ask a study question…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(input); }}
              disabled={busy}
            />
            <button id="demo-send" onClick={() => send(input)} disabled={busy || !input.trim()}>
              ↑
            </button>
          </>
        )}
      </div>
    </div>
  );
}
