import { useState } from 'react';
import { grade, pctColor } from '../utils/misc';

export default function Marks({ user, userExams, userMarks, saveExamsData, showToast }) {
  const [activeExam, setActiveExam] = useState(0);
  const [localMarks, setLocalMarks] = useState(() => JSON.parse(JSON.stringify(userMarks)));
  const [results, setResults] = useState({});
  const [inputErr, setInputErr] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [draftExams, setDraftExams] = useState(() => JSON.parse(JSON.stringify(userExams)));
  const [setupStatus, setSetupStatus] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);
  const [targetPct, setTargetPct] = useState({});

  const synced = JSON.stringify(userMarks);
  useState(() => { setLocalMarks(JSON.parse(JSON.stringify(userMarks))); }, [synced]);

  // ── Setup helpers ──────────────────────────────────────────
  function addExam() {
    setDraftExams(prev => [...prev, { id: `ex${Date.now()}`, name: 'New Exam', examDate: '', subjects: [] }]);
  }
  function removeExam(idx) { setDraftExams(prev => prev.filter((_, i) => i !== idx)); }
  function updateExamField(idx, field, val) {
    setDraftExams(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  }
  function addSubject(examIdx) {
    setDraftExams(prev => prev.map((e, i) => i === examIdx
      ? { ...e, subjects: [...e.subjects, { id: `s${Date.now()}`, name: '', max: 100 }] }
      : e
    ));
  }
  function updateSubject(examIdx, subjIdx, field, val) {
    setDraftExams(prev => prev.map((e, i) => i === examIdx
      ? { ...e, subjects: e.subjects.map((s, j) => j === subjIdx ? { ...s, [field]: field === 'max' ? (parseInt(val) || 100) : val } : s) }
      : e
    ));
  }
  function removeSubject(examIdx, subjIdx) {
    setDraftExams(prev => prev.map((e, i) => i === examIdx
      ? { ...e, subjects: e.subjects.filter((_, j) => j !== subjIdx) }
      : e
    ));
  }

  async function saveSetup() {
    setSetupSaving(true);
    setSetupStatus('');
    try {
      const filtered = draftExams
        .filter(e => e.name.trim())
        .map(e => ({ ...e, name: e.name.trim(), subjects: e.subjects.filter(s => s.name.trim()).map(s => ({ ...s, name: s.name.trim() })) }));
      await saveExamsData(filtered, userMarks);
      setSetupStatus('ok');
      setTimeout(() => setSetupStatus(''), 2000);
    } catch { setSetupStatus('err'); }
    finally { setSetupSaving(false); }
  }

  // ── Marks helpers ──────────────────────────────────────────
  function handleMarkChange(examId, subjId, val) {
    setLocalMarks(prev => ({ ...prev, [examId]: { ...(prev[examId] || {}), [subjId]: val } }));
    setInputErr('');
    setResults(prev => ({ ...prev, [examId]: null }));
  }

  function calcResults(exam) {
    setInputErr('');
    const marks = localMarks[exam.id] || {};
    for (const s of exam.subjects) {
      const v = parseFloat(marks[s.id]);
      if (marks[s.id] !== '' && marks[s.id] !== undefined && (isNaN(v) || v < 0 || v > s.max)) {
        setInputErr(`"${s.name}" mark must be between 0 and ${s.max}.`); return;
      }
    }
    const rows = exam.subjects.map(s => {
      const raw = marks[s.id];
      const got = raw === '' || raw === undefined ? null : parseFloat(raw);
      const pct = got !== null ? Math.round((got / s.max) * 100) : null;
      return { name: s.name, got, max: s.max, pct };
    });
    const entered = rows.filter(r => r.got !== null);
    const totalGot = entered.reduce((a, r) => a + r.got, 0);
    const totalMax = entered.reduce((a, r) => a + r.max, 0);
    const overall = totalMax > 0 ? Math.round((totalGot / totalMax) * 100) : null;
    setResults(prev => ({ ...prev, [exam.id]: { rows, overall, totalGot, totalMax } }));
  }

  async function saveCurrentMarks(exam) {
    try {
      await saveExamsData(userExams, { ...userMarks, [exam.id]: localMarks[exam.id] || {} });
      showToast('Marks saved!');
    } catch { showToast('Could not save marks.', true); }
  }

  // ── Grade Target Calculator ────────────────────────────────
  function calcTarget(exam) {
    const target = parseFloat(targetPct[exam.id]);
    if (isNaN(target) || target < 0 || target > 100) return null;
    const marks = localMarks[exam.id] || {};
    const totalMax = exam.subjects.reduce((a, s) => a + s.max, 0);
    const gotSoFar = exam.subjects.reduce((a, s) => {
      const v = parseFloat(marks[s.id]);
      return isNaN(v) ? a : a + v;
    }, 0);
    const remainingSubjects = exam.subjects.filter(s => {
      const v = parseFloat(marks[s.id]);
      return isNaN(v) || marks[s.id] === '' || marks[s.id] === undefined;
    });
    const remainingMax = remainingSubjects.reduce((a, s) => a + s.max, 0);
    if (remainingMax === 0) return null;
    const needed = (target / 100) * totalMax - gotSoFar;
    const neededPct = Math.round((needed / remainingMax) * 100);
    return { neededPct, remainingSubjects, needed: Math.round(needed), remainingMax };
  }

  if (userExams.length === 0 && !setupOpen) {
    return (
      <>
        <div className="page-hero">
          <h2><em>Marks</em> Tracker</h2>
          <p>Log your exam scores and calculate your grades.</p>
        </div>
        <div className="setup-section" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>No exams set up yet. Create your exam structure first.</p>
          <button className="setup-add-exam-btn" style={{ maxWidth: 280, margin: '0 auto' }} onClick={() => { setSetupOpen(true); if (draftExams.length === 0) addExam(); }}>
            + Set up exams
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-hero">
        <h2><em>Marks</em> Tracker</h2>
        <p>Log your exam scores and calculate your grades.</p>
      </div>

      {/* Setup */}
      <div className="setup-section">
        <div className="setup-header-bar">
          <span className="setup-header-title">Exam setup</span>
          <div className="setup-header-actions">
            <button className="setup-toggle-btn" onClick={() => {
              setSetupOpen(o => !o);
              if (!setupOpen) setDraftExams(JSON.parse(JSON.stringify(userExams)));
            }}>{setupOpen ? 'Hide' : 'Edit'}</button>
            {setupOpen && (
              <>
                <button className="setup-save-btn" onClick={saveSetup} disabled={setupSaving}>
                  {setupSaving ? 'Saving…' : 'Save setup'}
                </button>
                {setupStatus === 'ok' && <span className="setup-status ok">Saved ✓</span>}
                {setupStatus === 'err' && <span className="setup-status err">Error</span>}
              </>
            )}
          </div>
        </div>

        {setupOpen && (
          <div>
            {draftExams.map((exam, ei) => (
              <div className="setup-exam-card" key={exam.id}>
                <div className="setup-exam-hdr">
                  <input className="setup-exam-name" value={exam.name} placeholder="Exam name" onChange={e => updateExamField(ei, 'name', e.target.value)} />
                  <input className="setup-exam-date" type="date" value={exam.examDate || ''} onChange={e => updateExamField(ei, 'examDate', e.target.value)} title="Exam date (for countdown)" />
                  <button className="setup-del-exam" onClick={() => removeExam(ei)}>Remove</button>
                </div>
                <div className="setup-subjects">
                  {exam.subjects.map((s, si) => (
                    <div className="setup-subj-row" key={s.id}>
                      <input className="setup-subj-name" placeholder="Subject name" value={s.name} onChange={e => updateSubject(ei, si, 'name', e.target.value)} />
                      <span className="setup-sep">out of</span>
                      <input className="setup-subj-max" type="number" min="1" max="1000" value={s.max} onChange={e => updateSubject(ei, si, 'max', e.target.value)} />
                      <button className="setup-del-subj" onClick={() => removeSubject(ei, si)}>×</button>
                    </div>
                  ))}
                </div>
                <button className="setup-add-subj" onClick={() => addSubject(ei)}>+ Add subject</button>
              </div>
            ))}
            <button className="setup-add-exam-btn" onClick={addExam}>+ Add exam</button>
          </div>
        )}
      </div>

      {/* Exam tabs */}
      {userExams.length > 0 && (
        <div className="marks-layout">
          <div className="exam-selector">
            {userExams.map((exam, i) => (
              <button key={exam.id} className={`etab${activeExam === i ? ' active' : ''}`} onClick={() => { setActiveExam(i); setInputErr(''); }}>
                {exam.name}
                <span className="etab-sub">{exam.subjects.length} subjects</span>
              </button>
            ))}
          </div>

          {userExams.map((exam, i) => {
            const res = results[exam.id];
            const targetCalc = calcTarget(exam);
            return (
              <div key={exam.id} className={`epanel${activeExam === i ? ' active' : ''}`}>
                <div className="exam-scroll">
                  <div className="subjects-grid">
                    {exam.subjects.map(s => {
                      const val = localMarks[exam.id]?.[s.id] ?? '';
                      const pct = val !== '' ? Math.round((parseFloat(val) / s.max) * 100) : null;
                      return (
                        <div className="subject-row" key={s.id}>
                          <div className="s-icon">{s.name.slice(0, 3).toUpperCase()}</div>
                          <div className="s-name">{s.name}</div>
                          <input className="mark-input" type="number" min="0" max={s.max} placeholder="—" value={val} onChange={e => handleMarkChange(exam.id, s.id, e.target.value)} />
                          <span className="out-of">/ {s.max}</span>
                          <span className="pct-badge" style={{ color: pct !== null ? pctColor(pct) : undefined }}>{pct !== null ? `${pct}%` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="err-msg">{inputErr}</div>

                <div className="calc-row">
                  <button className="calc-btn primary" onClick={() => calcResults(exam)}>Calculate results</button>
                  <button className="calc-btn secondary" onClick={() => saveCurrentMarks(exam)}>Save marks</button>
                </div>

                {/* Grade Target Calculator */}
                <div className="target-calc">
                  <div className="target-calc-title">Grade target calculator</div>
                  <div className="target-calc-row">
                    <input
                      className="target-input"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Target %"
                      value={targetPct[exam.id] || ''}
                      onChange={e => setTargetPct(prev => ({ ...prev, [exam.id]: e.target.value }))}
                    />
                    <span className="target-label">overall</span>
                  </div>
                  {targetCalc && (
                    <div className={`target-result${targetCalc.neededPct > 100 ? ' impossible' : targetCalc.neededPct < 0 ? ' achieved' : ''}`}>
                      {targetCalc.neededPct < 0
                        ? `You've already exceeded your ${targetPct[exam.id]}% target!`
                        : targetCalc.neededPct > 100
                        ? `Not achievable — you'd need ${targetCalc.neededPct}% on remaining subjects.`
                        : `You need ${targetCalc.neededPct}% on your remaining ${targetCalc.remainingSubjects.length} subject${targetCalc.remainingSubjects.length > 1 ? 's' : ''} (${targetCalc.needed} / ${targetCalc.remainingMax} marks).`
                      }
                    </div>
                  )}
                </div>

                {res && (
                  <>
                    <div className="results-grid">
                      <div className="res-card">
                        <div className="res-card-label">Overall %</div>
                        <div className="res-card-val" style={{ color: res.overall !== null ? pctColor(res.overall) : undefined }}>
                          {res.overall !== null ? `${res.overall}%` : '—'}
                        </div>
                      </div>
                      <div className="res-card">
                        <div className="res-card-label">Total marks</div>
                        <div className="res-card-val sm">{res.totalGot} / {res.totalMax}</div>
                      </div>
                      {res.overall !== null && (() => {
                        const g = grade(res.overall);
                        return (
                          <div className="res-card">
                            <div className="res-card-label">Grade</div>
                            <div className="res-card-val" style={{ color: g.col }}>{g.g}</div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="bars-section">
                      <div className="bars-title">Per-subject breakdown</div>
                      {res.rows.filter(r => r.pct !== null).map(r => (
                        <div className="bar-row" key={r.name}>
                          <div className="bar-name">{r.name}</div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: `${r.pct}%`, background: pctColor(r.pct) }} /></div>
                          <div className="bar-pct" style={{ color: pctColor(r.pct) }}>{r.pct}%</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
