import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { geminiGenerate, AI_ENABLED } from '../utils/ai';
import { genId, syncErrMsg, parseQuizJson } from '../utils/misc';

export default function Flashcards({ user, showToast }) {
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [view, setView] = useState('home'); // home | generate | study
  const [topic, setTopic] = useState('');
  const [numCards, setNumCards] = useState('10');
  const [generating, setGenerating] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [piles, setPiles] = useState({ know: [], unsure: [], learning: [] });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadDecks();
    return () => { mountedRef.current = false; };
  }, [user.uid]);

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
    const prompt = `Generate ${numCards} flashcards on: ${topic}.
Return ONLY valid JSON, no markdown:
{"title":"...", "cards":[{"front":"Question or term","back":"Answer or definition"},...]}
Use LaTeX math ($...$) where relevant.`;
    try {
      const raw = await geminiGenerate(prompt, null, 'You are a flashcard generator. Return only valid JSON.');
      const parsed = parseQuizJson(raw);
      if (!parsed?.cards?.length) throw new Error('Invalid format.');
      const deck = { id: genId(), title: parsed.title || topic, cards: parsed.cards, createdAt: Date.now() };
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
    setActiveDeck(deck);
    setCardIdx(0);
    setFlipped(false);
    setPiles({ know: [], unsure: [], learning: [] });
    setView('study');
  }

  function rate(pile) {
    setPiles(prev => ({ ...prev, [pile]: [...prev[pile], activeDeck.cards[cardIdx]] }));
    if (cardIdx + 1 < activeDeck.cards.length) {
      setCardIdx(i => i + 1);
      setFlipped(false);
    } else {
      setView('results');
    }
  }

  function deleteDeck(id) {
    saveDecks(decks.filter(d => d.id !== id));
  }

  if (view === 'study' && activeDeck) {
    const card = activeDeck.cards[cardIdx];
    const total = activeDeck.cards.length;
    const progress = Math.round((cardIdx / total) * 100);
    return (
      <>
        <div className="page-hero">
          <h2><em>Flashcards</em></h2>
          <p>{activeDeck.title}</p>
        </div>
        <div className="fc-study-wrap">
          <div className="fc-progress-row">
            <span className="fc-prog-label">{cardIdx + 1} / {total}</span>
            <div className="fc-prog-track"><div className="fc-prog-fill" style={{ width: `${progress}%` }} /></div>
            <button className="fc-exit-btn" onClick={() => setView('home')}>Exit</button>
          </div>
          <div className="fc-scene" onClick={() => setFlipped(f => !f)}>
            <div className={`fc-card${flipped ? ' flipped' : ''}`}>
              <div className="fc-face fc-front">
                <div className="fc-side-label">Front</div>
                <div className="fc-text">{card.front}</div>
                <div className="fc-tap-hint">Tap to reveal</div>
              </div>
              <div className="fc-face fc-back">
                <div className="fc-side-label">Back</div>
                <div className="fc-text">{card.back}</div>
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
      </>
    );
  }

  if (view === 'results') {
    const { know, unsure, learning } = piles;
    return (
      <>
        <div className="page-hero"><h2><em>Flashcards</em></h2></div>
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
      </>
    );
  }

  if (view === 'generate') {
    return (
      <>
        <div className="page-hero">
          <h2><em>Flashcards</em></h2>
          <p>Generate a deck from any topic.</p>
        </div>
        <div className="quiz-builder">
          <div className="quiz-input-card">
            <div className="form-field">
              <label className="form-label">Topic</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="e.g. Cell biology, The French Revolution, Quadratic equations…"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>
            <div className="quiz-controls">
              <div className="select-wrap">
                <label className="form-label">Number of cards</label>
                <select className="form-input" value={numCards} onChange={e => setNumCards(e.target.value)}>
                  {['5','10','15','20'].map(n => <option key={n} value={n}>{n} cards</option>)}
                </select>
              </div>
              <button className="gen-quiz-btn" onClick={generate} disabled={generating || !topic.trim()}>
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
          <div className="empty-tasks" style={{ marginTop: 24 }}>
            No decks yet — generate one to get started
          </div>
        ) : (
          <div className="fc-deck-grid">
            {decks.map(deck => (
              <div className="fc-deck-card" key={deck.id}>
                <div className="fc-deck-title">{deck.title}</div>
                <div className="fc-deck-count">{deck.cards.length} cards</div>
                <div className="fc-deck-actions">
                  <button className="fc-study-start" onClick={() => startStudy(deck)}>Study</button>
                  <button className="fc-del-deck" onClick={() => deleteDeck(deck.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
