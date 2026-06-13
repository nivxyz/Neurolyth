import { useEffect, useRef, useState } from 'react';
import { geminiGenerate, AI_ENABLED } from '../utils/ai';
import { parseQuizJson, renderMath } from '../utils/misc';

const NUM_OPTIONS = ['5', '10', '15', '20'];

export default function Quiz({ showToast }) {
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState(null);
  const [numQ, setNumQ] = useState('10');
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const cardRef = useRef(null);
  const questionRefs = useRef([]);

  useEffect(() => {
    if (quiz && questionRefs.current[current]) {
      renderMath(questionRefs.current[current]);
    }
  }, [quiz, current]);

  async function generate() {
    if (!topic.trim() && !file) { showToast('Enter a topic or upload a file.', true); return; }
    setLoading(true);
    setQuiz(null);
    setAnswers({});
    setRevealed({});
    setCurrent(0);
    setFinished(false);

    const prompt = `Generate a ${numQ}-question multiple-choice quiz on: ${topic || 'the uploaded document'}.
Difficulty: ${difficulty}.
Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "title": "Quiz Title",
  "questions": [
    {
      "question": "Question text (use LaTeX math where relevant: $...$ or $$...$$)",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "answer": 0,
      "explanation": "Brief explanation"
    }
  ]
}
The "answer" field is the 0-based index of the correct option.`;

    try {
      const raw = await geminiGenerate(prompt, file, 'You are a quiz generator. Return only valid JSON.');
      const parsed = parseQuizJson(raw);
      if (!parsed?.questions?.length) throw new Error('Invalid quiz format returned.');
      setQuiz(parsed);
    } catch (e) {
      showToast(e.message || 'Quiz generation failed.', true);
    } finally {
      setLoading(false);
    }
  }

  function handleFile(f) {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'doc', 'docx'].includes(ext)) {
      showToast('Unsupported file type. Use PDF, TXT, or DOC.', true);
      return;
    }
    setFile(f);
  }

  function selectAnswer(qIdx, optIdx) {
    if (revealed[qIdx] !== undefined) return;
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
    setRevealed(prev => ({ ...prev, [qIdx]: true }));
  }

  function getScore() {
    if (!quiz) return 0;
    return quiz.questions.filter((q, i) => answers[i] === q.answer).length;
  }

  if (!AI_ENABLED) {
    return (
      <>
        <div className="page-hero">
          <h2>Quiz <em>Maker</em></h2>
        </div>
        <div className="feature-offline">
          <div className="feature-offline-title">AI Quiz Maker is offline</div>
          <p>The AI service is not configured. Quiz generation is not available.</p>
        </div>
      </>
    );
  }

  if (finished && quiz) {
    const score = getScore();
    const pct = Math.round((score / quiz.questions.length) * 100);
    return (
      <>
        <div className="page-hero">
          <h2>Quiz <em>Maker</em></h2>
        </div>
        <div className="score-wrap">
          <div className="score-label">Your score</div>
          <div className={`score-big ${pct >= 75 ? 'great' : pct >= 50 ? 'ok' : 'poor'}`}>
            {pct}%
          </div>
          <div className="score-desc">
            {pct >= 90 ? 'Outstanding!' : pct >= 75 ? 'Great work!' : pct >= 50 ? 'Not bad!' : 'Keep practising!'}
          </div>
          <div className="score-sub">
            {score} / {quiz.questions.length} correct
          </div>
          <div className="score-actions">
            <button className="score-btn primary" onClick={() => {
              setAnswers({}); setRevealed({}); setCurrent(0); setFinished(false);
            }}>
              Review answers
            </button>
            <button className="score-btn secondary" onClick={() => {
              setQuiz(null); setFile(null); setTopic('');
            }}>
              New quiz
            </button>
          </div>
        </div>
      </>
    );
  }

  if (quiz) {
    const q = quiz.questions[current];
    const total = quiz.questions.length;
    const answered = answers[current];
    const isRevealed = revealed[current];
    return (
      <>
        <div className="page-hero">
          <h2>Quiz <em>Maker</em></h2>
        </div>
        <div className="quiz-play-wrap">
          <div className="quiz-play-header">
            <div className="quiz-play-title">{quiz.title}</div>
            <div className="quiz-play-meta">{current + 1} / {total}</div>
          </div>
          <div className="qprogress">
            <div className="qprogress-fill" style={{ width: `${((current + 1) / total) * 100}%` }} />
          </div>
          <div className="q-card" key={current} ref={el => { questionRefs.current[current] = el; }}>
            <div className="q-num">Question {current + 1}</div>
            <div className="q-text">{q.question}</div>
            <div className="q-options">
              {q.options.map((opt, oi) => {
                let cls = '';
                if (isRevealed) {
                  if (oi === q.answer) cls = 'correct';
                  else if (oi === answered) cls = 'wrong';
                  else cls = '';
                }
                return (
                  <button
                    key={oi}
                    className={`q-opt ${cls}`}
                    onClick={() => selectAnswer(current, oi)}
                    disabled={!!isRevealed}
                  >
                    <span className="q-letter">{String.fromCharCode(65 + oi)}</span>
                    {opt.replace(/^[A-D]\)\s*/, '')}
                  </button>
                );
              })}
            </div>
            {isRevealed && q.explanation && (
              <div className="q-explanation">{q.explanation}</div>
            )}
          </div>
          <div className="q-nav">
            <button className="q-nav-btn" onClick={() => setCurrent(c => c - 1)} disabled={current === 0}>
              ← Previous
            </button>
            {current < total - 1 ? (
              <button className="q-nav-btn" onClick={() => setCurrent(c => c + 1)} disabled={!isRevealed}>
                Next →
              </button>
            ) : (
              <button
                className="q-nav-btn finish"
                onClick={() => setFinished(true)}
                disabled={Object.keys(revealed).length < total}
              >
                Finish quiz
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-hero">
        <h2>Quiz <em>Maker</em></h2>
        <p>Generate a custom quiz from any topic or your own notes.</p>
      </div>

      <div className="quiz-builder">
        <div className="quiz-input-card">
          <div className="form-field">
            <label className="form-label">Topic or prompt</label>
            <textarea
              className="form-input"
              rows="3"
              placeholder="e.g. Newton's laws of motion, World War II causes, The French Revolution…"
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
          </div>

          <div className="quiz-or-divider">or upload notes</div>

          {!file ? (
            <div
              className={`quiz-upload-zone${dragOver ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            >
              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={e => handleFile(e.target.files[0])}
              />
              <span className="quiz-upload-icon">📄</span>
              <div className="quiz-upload-label">Drop a file here or click to upload</div>
              <div className="quiz-file-types">
                {['PDF', 'TXT', 'DOC'].map(t => <span key={t} className="ftype">{t}</span>)}
              </div>
            </div>
          ) : (
            <div className="quiz-file-chip">
              <span className="fc-ext">{file.name.split('.').pop().toUpperCase()}</span>
              <span className="fc-name">{file.name}</span>
              <button className="fc-remove" onClick={() => setFile(null)}>×</button>
            </div>
          )}

          <div className="quiz-controls">
            <div className="select-wrap">
              <label className="form-label">Questions</label>
              <select
                className="form-input"
                value={numQ}
                onChange={e => setNumQ(e.target.value)}
              >
                {NUM_OPTIONS.map(n => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </div>
            <div className="select-wrap">
              <label className="form-label">Difficulty</label>
              <select
                className="form-input"
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <button
              className="gen-quiz-btn"
              onClick={generate}
              disabled={loading || (!topic.trim() && !file)}
            >
              {loading ? 'Generating…' : 'Generate quiz'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="quiz-loading">
            <div className="q-spinner" />
            <p>Generating your quiz…</p>
          </div>
        )}
      </div>
    </>
  );
}
