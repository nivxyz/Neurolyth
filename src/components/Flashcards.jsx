import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { geminiGenerate } from '../utils/ai';
import { genId, syncErrMsg, parseQuizJson, renderMath } from '../utils/misc';

function MathText({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) renderMath(ref.current);
  }, [text]);
  return <div className="fc-text" ref={ref}>{text}</div>;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Flashcards({ user, showToast, initialTopic, onTopicConsumed }) {
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [view, setView] = useState('home');
  const [topic, setTopic] = useState('');
  const [numCards, setNumCards] = useState('10');
  const [generating, setGenerating] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [studyOrder, setStudyOrder] = useState([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [piles, setPiles] = useState({ know: [], unsure: [], learning: [] });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadDecks();
    return () => { mountedRef.current = false; };
  }, [user.uid]);

  useEffect(() => {
    if (!initialTopic) return;
    setTopic(initialTopic);
    setView('generate');
    onTopicConsumed?.();
  }, [initialTopic]);

  async function loadDecks() {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'data', 'flashcards'));
      if (mountedRef.current && snap.exists()) setDecks(snap.data().decks || []);
    } catch (e) {
      showToast(syncErrMsg('Load flashcards', e), true);
    }
  }

  async function saveDecks(updated) {
    setDecks(updated);
    try {
      await setDoc(doc(db, 'users', user.uid, 'data', 'flashcards'), { decks: updated });
    } catch (e) {
      showToast(syncErrMsg('Save flashcards', e), true);
    }
  }

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    const topicLine = topic.trim() ? `on: ${topic}` : 'based on the uploaded image/file';
    const prompt = `Generate ${numCards} flashcards ${topicLine}.
Return ONLY valid JSON, no markdown:
{"title":"...", "cards":[{"front":"Question or term","back":"Answer or definition"},...]}
Use LaTeX math ($...$) ONLY for actual mathematical equations. Do NOT use LaTeX for code, HTML, or plain text.`;
    try {
      const raw = await geminiGenerate(prompt, imageFile || null, 'You are a flashcard generator. Return only valid JSON.');
      const parsed = parseQuizJson(raw);
      if (!parsed?.cards?.length) throw new Error('Invalid format.');
      const deck = { id: genId(), title: parsed.title || topic, cards: parsed.cards, srsData: {}, createdAt: Date.now() };
      const updated = [deck, ...decks];
      await saveDecks(updated);
      startStudy(deck);
    } catch (e) {
      showToast(e.message || 'Generation failed.', true);
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  }

  function startStudy(deck) {
    const today = todayStr();
    const srs = deck.srsData || {};
    const indices = deck.cards.map((_, i) => i).sort((a, b) => {
      const aDate = srs[a]?.nextReview || today;
      const bDate = srs[b]?.nextReview || today;
      return aDate.localeCompare(bDate);
    });
    setActiveDeck(deck);
    setStudyOrder(indices);
    setCardIdx(0);
    setFlipped(false);
    setPiles({ know: [], unsure: [], learning: [] });
    setView('study');
  }

  function rate(pile) {
    const cardI = studyOrder[cardIdx];
    const srs = activeDeck.srsData || {};
    const current = srs[cardI] || { interval: 1, nextReview: todayStr() };

    let newInterval;
    if (pile === 'know') newInterval = Math.min((current.interval || 1) * 2, 60);
    else if (pile === 'unsure') newInterval = Math.max(current.interval || 1, 1);
    else newInterval = 1;

    const newSrs = { ...srs, [cardI]: { interval: newInterval, nextReview: addDays(newInterval) } };
    const updatedDeck = { ...activeDeck, srsData: newSrs };
    setActiveDeck(updatedDeck);
    saveDecks(decks.map(d => d.id === activeDeck.id ? updatedDeck : d));

    setPiles(prev => ({ ...prev, [pile]: [...prev[pile], activeDeck.cards[cardI]] }));
    if (cardIdx + 1 < studyOrder.length) {
      setCardIdx(i => i + 1);
      setFlipped(false);
    } else {
      setView('results');
    }
  }

  function deleteDeck(id) {
    saveDecks(decks.filter(d => d.id !== id));
  }

  function getDueCount(deck) {
    const today = todayStr();
    const srs = deck.srsData || {};
    return deck.cards.filter((_, i) => (srs[i]?.nextReview || today) <= today).length;
  }

  if (view === 'study' && activeDeck) {
    const cardI = studyOrder[cardIdx];
    const card = activeDeck.cards[cardI];
    const total = studyOrder.length;
    const progress = Math.round((cardIdx / total) * 100);
    return (
      <div className="fs-overlay">
        <div className="fs-topbar">
          <span className="fs-topbar-title">{activeDeck.title}</span>
          <span className="fs-topbar-meta">{cardIdx + 1} / {total}</span>
          <button className="fs-exit-btn" onClick={() => setView('home')}>Exit</button>
        </div>
        <div className="fs-content">
          <div className="fc-study-wrap">
            <div className="fc-progress-row">
              <span className="fc-prog-label">{cardIdx + 1} / {total}</span>
              <div className="fc-prog-track"><div className="fc-prog-fill" style={{ width: `${progress}%` }} /></div>
            </div>
            <div className="fc-scene" onClick={() => setFlipped(f => !f)}>
              <div className={`fc-card${flipped ? ' flipped' : ''}`}>
                <div className="fc-face fc-front">
                  <div className="fc-side-label">Front</div>
                  <MathText text={card.front} />
                  <div className="fc-tap-hint">Tap to reveal</div>
                </div>
                <div className="fc-face fc-back">
                  <div className="fc-side-label">Back</div>
                  <MathText text={card.back} />
                </div>
              </div>
            </div>
            {flipped && (
              <div className="fc-rate-row">
                <button className="fc-rate-btn learning" onClick={() => rate('learning')}>Still learning</button>
                <button className="fc-rate-btn unsure" onClick={() => rate('unsure')}>Almost</button>
                <button className="fc-rate-btn know" onClick={() => rate('know')}>Got it</button>
              </div>
            )}
            {!flipped && (
              <div className="fc-flip-hint">Click the card to flip it</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'results') {
    const { know, unsure, learning } = piles;
    return (
      <div className="fs-overlay">
        <div className="fs-topbar">
          <span className="fs-topbar-title">{activeDeck?.title}</span>
          <button className="fs-exit-btn" onClick={() => setView('home')}>Exit</button>
        </div>
        <div className="fs-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="fc-results">
            <div className="fc-results-title">Session complete!</div>
            <div className="fc-piles-row">
              <div className="fc-pile know">
                <div className="fc-pile-num">{know.length}</div>
                <div className="fc-pile-label">Got it</div>
              </div>
              <div className="fc-pile unsure">
                <div className="fc-pile-num">{unsure.length}</div>
                <div className="fc-pile-label">Almost</div>
              </div>
              <div className="fc-pile learning">
                <div className="fc-pile-num">{learning.length}</div>
                <div className="fc-pile-label">Still learning</div>
              </div>
            </div>
            <div className="score-actions" style={{ justifyContent: 'center', marginTop: 28 }}>
              <button className="score-btn primary" onClick={() => startStudy(activeDeck)}>Study again</button>
              <button className="score-btn secondary" onClick={() => setView('home')}>Back to decks</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'generate') {
    return (
      <>
        <div className="page-hero">
          <h2><em>Flashcards</em></h2>
          <p>Generate a deck from any topic, notes, or handwritten photo.</p>
        </div>
        <div className="quiz-builder">
          <div className="quiz-input-card">
            <div className="form-field">
              <label className="form-label">Topic or paste notes</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="e.g. Cell biology, The French Revolution…"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>
            <div className="quiz-or-divider">or upload image / file</div>
            {!imageFile ? (
              <div className="quiz-upload-zone" style={{ marginBottom: 12 }}>
                <input
                  type="file"
                  accept="image/*,.pdf,.txt,.doc,.docx"
                  onChange={e => setImageFile(e.target.files[0] || null)}
                />
                <span className="quiz-upload-icon">📷</span>
                <div className="quiz-upload-label">Photo of notes, textbook page, or file</div>
                <div className="quiz-file-types">
                  {['JPG','PNG','PDF','TXT'].map(t => <span key={t} className="ftype">{t}</span>)}
                </div>
              </div>
            ) : (
              <div className="quiz-file-chip" style={{ marginBottom: 12 }}>
                <span className="fc-ext">{imageFile.name.split('.').pop().toUpperCase()}</span>
                <span className="fc-name">{imageFile.name}</span>
                <button className="fc-remove" onClick={() => setImageFile(null)}>×</button>
              </div>
            )}
            <div className="quiz-controls">
              <div className="select-wrap">
                <label className="form-label">Number of cards</label>
                <select className="form-input" value={numCards} onChange={e => setNumCards(e.target.value)}>
                  {['5','10','15','20'].map(n => <option key={n} value={n}>{n} cards</option>)}
                </select>
              </div>
              <button className="gen-quiz-btn" onClick={generate} disabled={generating || (!topic.trim() && !imageFile)}>
                {generating ? 'Generating…' : 'Generate deck'}
              </button>
            </div>
          </div>
          {generating && <div className="quiz-loading"><div className="q-spinner"/><p>Generating flashcards…</p></div>}
          <button className="fc-back-link" onClick={() => setView('home')}>← Back to decks</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-hero">
        <h2><em>Flashcards</em></h2>
        <p>Generate AI flashcard decks and study with spaced repetition.</p>
      </div>
      <div className="fc-home">
        <button className="fc-new-btn" onClick={() => { setTopic(''); setView('generate'); }}>
          + New deck
        </button>
        {decks.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 24 }}>
            <div className="empty-state-icon">◫</div>
            <div className="empty-state-title">No decks yet</div>
            <p className="empty-state-sub">Your first deck is one prompt away.</p>
          </div>
        ) : (
          <div className="fc-deck-grid">
            {decks.map(deck => {
              const due = getDueCount(deck);
              const allDue = due === deck.cards.length;
              return (
                <div className="fc-deck-card" key={deck.id}>
                  <div className="fc-deck-title">{deck.title}</div>
                  <div className="fc-deck-count-row">
                    <span className="fc-deck-count">{deck.cards.length} cards</span>
                    {due > 0 && (
                      <span className={`fc-deck-due${allDue ? ' all-due' : ''}`}>
                        {due} due
                      </span>
                    )}
                  </div>
                  <div className="fc-deck-actions">
                    <button className="fc-study-start" onClick={() => startStudy(deck)}>Study</button>
                    <button className="fc-del-deck" onClick={() => deleteDeck(deck.id)}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
