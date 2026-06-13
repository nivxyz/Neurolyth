import { useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { syncErrMsg } from '../utils/misc';
import Todo from './Todo';
import Marks from './Marks';
import Progress from './Progress';
import Quiz from './Quiz';
import AI from './AI';

const TABS = ['Tasks', 'Marks', 'Progress', 'Quiz', 'AI'];

export default function AppShell({ user, showToast }) {
  const [activeTab, setActiveTab] = useState('AI');
  const [greeting, setGreeting] = useState('');
  const [userExams, setUserExams] = useState([]);
  const [userMarks, setUserMarks] = useState({});
  const mountedRef = useRef(true);

  // Typewriter greeting
  useEffect(() => {
    const name = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
    const hour = new Date().getHours();
    const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const full = `${salutation}, ${name}`;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setGreeting(full.slice(0, i));
      if (i >= full.length) clearInterval(iv);
    }, 38);
    return () => clearInterval(iv);
  }, [user]);

  // Load shared exam/marks data
  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'data', 'exams'));
        if (!mountedRef.current) return;
        if (snap.exists()) {
          const d = snap.data();
          setUserExams(d.exams || []);
          setUserMarks(d.marks || {});
        }
      } catch (e) {
        showToast(syncErrMsg('Load exams', e), true);
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, [user.uid]);

  async function saveExamsData(exams, marks) {
    setUserExams(exams);
    setUserMarks(marks);
    try {
      await setDoc(doc(db, 'users', user.uid, 'data', 'exams'), { exams, marks });
    } catch (e) {
      showToast(syncErrMsg('Save', e), true);
    }
  }

  function handleSignOut() {
    signOut(auth);
  }

  useEffect(() => {
    const el = document.getElementById('screen-app');
    if (el) {
      requestAnimationFrame(() => el.classList.add('show'));
    }
    return () => {
      const el2 = document.getElementById('screen-app');
      if (el2) el2.classList.remove('show');
    };
  }, []);

  return (
    <div id="screen-app">
      <div className="topbar">
        <div className="topbar-brand brand-accent">Neurolyth</div>
        <div className="topbar-greeting">{greeting}<span style={{ animation: 'caretBlink 1s steps(1) infinite', color: 'var(--accent)' }}>▋</span></div>
        <nav className="topbar-nav">
          {TABS.map(t => (
            <button
              key={t}
              className={`tnav-btn${activeTab === t ? ' active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
          <button className="logout-btn" onClick={handleSignOut}>Sign out</button>
        </nav>
      </div>

      <div className="main-content">
        <div className={`panel${activeTab === 'Tasks' ? ' active' : ''}`}>
          <Todo user={user} showToast={showToast} />
        </div>
        <div className={`panel${activeTab === 'Marks' ? ' active' : ''}`}>
          <Marks
            user={user}
            userExams={userExams}
            userMarks={userMarks}
            saveExamsData={saveExamsData}
            showToast={showToast}
          />
        </div>
        <div className={`panel${activeTab === 'Progress' ? ' active' : ''}`}>
          <Progress userExams={userExams} userMarks={userMarks} />
        </div>
        <div className={`panel${activeTab === 'Quiz' ? ' active' : ''}`}>
          <Quiz showToast={showToast} />
        </div>
        <div className={`panel${activeTab === 'AI' ? ' active' : ''}`}>
          <AI user={user} showToast={showToast} />
        </div>
      </div>
    </div>
  );
}
