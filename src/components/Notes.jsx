import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { syncErrMsg } from '../utils/misc';

export default function Notes({ user, showToast, userExams, onGenerateQuiz, onMakeFlashcards }) {
  const [notes, setNotes] = useState({});
  const [active, setActive] = useState('General');
  const [saveStatus, setSaveStatus] = useState('');
  const mountedRef = useRef(true);
  const saveTimer = useRef(null);

  const subjects = ['General', ...new Set(userExams.flatMap(e => e.subjects.map(s => s.name)))];

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'data', 'notes'));
        if (mountedRef.current && snap.exists()) setNotes(snap.data().notes || {});
      } catch (e) {
        showToast(syncErrMsg('Load notes', e), true);
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, [user.uid]);

  function handleChange(val) {
    const updated = { ...notes, [active]: val };
    setNotes(updated);
    setSaveStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid, 'data', 'notes'), { notes: updated });
        if (mountedRef.current) setSaveStatus('saved');
        setTimeout(() => { if (mountedRef.current) setSaveStatus(''); }, 1500);
      } catch (e) {
        showToast(syncErrMsg('Save notes', e), true);
        if (mountedRef.current) setSaveStatus('');
      }
    }, 900);
  }

  const content = notes[active] || '';

  return (
    <>
      <div className="page-hero">
        <h2>Your <em>Notes</em></h2>
        <p>Write, organise, and generate study tools from your notes.</p>
      </div>
      <div className="notes-layout">
        <div className="notes-subj-list">
          {subjects.map(s => (
            <button
              key={s}
              className={`notes-subj-btn${active === s ? ' active' : ''}`}
              onClick={() => setActive(s)}
            >
              {s}
              {notes[s]?.trim() && <span className="notes-dot" />}
            </button>
          ))}
        </div>
        <div className="notes-pane">
          <div className="notes-toolbar">
            <span className="notes-toolbar-title">{active}</span>
            <div className="notes-toolbar-right">
              <span className="notes-status">
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : ''}
              </span>
              <button
                className="notes-gen-btn"
                disabled={!content.trim()}
                onClick={() => onMakeFlashcards(content)}
              >
                Make flashcards
              </button>
              <button
                className="notes-gen-btn notes-gen-primary"
                disabled={!content.trim()}
                onClick={() => onGenerateQuiz(content)}
              >
                Generate quiz →
              </button>
            </div>
          </div>
          <textarea
            className="notes-editor"
            placeholder={`${active} notes…\n\nWrite anything here. Hit "Generate quiz →" or "Make flashcards" above to instantly turn these notes into study tools.`}
            value={content}
            onChange={e => handleChange(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
