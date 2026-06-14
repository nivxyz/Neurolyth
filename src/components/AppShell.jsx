import { useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { syncErrMsg } from '../utils/misc';
import Todo from './Todo';
import Marks from './Marks';
import Progress from './Progress';
import Quiz from './Quiz';
import AI from './AI';
import Flashcards from './Flashcards';
import Timetable from './Timetable';
import Notes from './Notes';
import CommandPalette from './CommandPalette';

const NAV_GROUPS = [
  {
    label: 'Study',
    tabs: [
      {
        id: 'Tasks',
        icon: (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="2.5" width="13" height="13" rx="3"/>
            <path d="M6 9l2 2 4-4"/>
          </svg>
        ),
      },
      {
        id: 'Marks',
        icon: (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="9" width="3" height="6" rx="1"/>
            <rect x="7.5" y="5.5" width="3" height="9.5" rx="1"/>
            <rect x="13" y="2" width="3" height="13" rx="1"/>
          </svg>
        ),
      },
      {
        id: 'Progress',
        icon: (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,14 6,9 10,11 16,4"/>
            <polyline points="12,4 16,4 16,8"/>
          </svg>
        ),
      },
      {
        id: 'Notes',
        icon: (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
            <path d="M6 6h6M6 9h6M6 12h4"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Tools',
    tabs: [
      {
        id: 'Quiz',
        icon: (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="9" cy="9" r="7"/>
            <path d="M7 7.2a2.2 2.2 0 0 1 4.2.9c0 1.4-2.2 1.8-2.2 3"/>
            <circle cx="9" cy="13.5" r=".3" fill="currentColor"/>
          </svg>
        ),
      },
      {
        id: 'Flashcards',
        icon: (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="5" width="13" height="10" rx="2"/>
            <path d="M5 5V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/>
          </svg>
        ),
      },
      {
        id: 'Schedule',
        icon: (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="14" height="13" rx="2"/>
            <path d="M2 8h14M6 2v2M12 2v2"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'AI',
    tabs: [
      {
        id: 'AI',
        icon: (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.5 4.5l1.4 1.4M12.1 12.1l1.4 1.4M4.5 13.5l1.4-1.4M12.1 5.9l1.4-1.4"/>
            <circle cx="9" cy="9" r="2.5"/>
          </svg>
        ),
      },
    ],
  },
];

export default function AppShell({ user, showToast }) {
  const [activeTab, setActiveTab] = useState('AI');
  const [greeting, setGreeting] = useState('');
  const [userExams, setUserExams] = useState([]);
  const [userMarks, setUserMarks] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem('nlTheme') || 'dark');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [pendingTopic, setPendingTopic] = useState({ quiz: '', flash: '' });
  const mountedRef = useRef(true);

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('nlTheme', theme);
  }, [theme]);

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

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function saveExamsData(exams, marks) {
    setUserExams(exams);
    setUserMarks(marks);
    try {
      await setDoc(doc(db, 'users', user.uid, 'data', 'exams'), { exams, marks });
    } catch (e) {
      showToast(syncErrMsg('Save', e), true);
    }
  }

  function handleSignOut() { signOut(auth); }

  useEffect(() => {
    const el = document.getElementById('screen-app');
    if (el) requestAnimationFrame(() => el.classList.add('show'));
    return () => { document.getElementById('screen-app')?.classList.remove('show'); };
  }, []);

  const upcomingExam = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return userExams
      .filter(e => e.examDate)
      .map(e => {
        const d = new Date(e.examDate + 'T00:00:00');
        const diff = Math.round((d - today) / 86400000);
        return { name: e.name, diff };
      })
      .filter(e => e.diff >= 0)
      .sort((a, b) => a.diff - b.diff)[0] || null;
  }, [userExams]);

  function openQuizWithTopic(content) {
    setPendingTopic(p => ({ ...p, quiz: content }));
    setActiveTab('Quiz');
  }

  function openFlashcardsWithTopic(content) {
    setPendingTopic(p => ({ ...p, flash: content }));
    setActiveTab('Flashcards');
  }

  return (
    <div id="screen-app" className="app-layout">
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={tab => setActiveTab(tab)}
      />

      <aside className="app-sidebar">
        <span className="sidebar-brand brand-accent">Neurolyth</span>
        <div className="sidebar-greeting">
          {greeting}
          <span style={{ animation: 'caretBlink 1s steps(1) infinite', color: 'var(--accent)' }}>▋</span>
        </div>

        {upcomingExam && (
          <div className={`sidebar-countdown${upcomingExam.diff <= 3 ? ' urgent' : ''}`}>
            <span className="sidebar-countdown-name">{upcomingExam.name}</span>
            <span className="sidebar-countdown-days">
              {upcomingExam.diff === 0 ? 'Today!' : `${upcomingExam.diff}d`}
            </span>
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="sidebar-section-label">{group.label}</div>
              {group.tabs.map(t => (
                <button
                  key={t.id}
                  className={`snav-btn${activeTab === t.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.icon}
                  {t.id}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="sidebar-cmd-hint" onClick={() => setCmdOpen(true)}>
            <span className="cmd-hint-key">⌘K</span>
            Command palette
          </button>
          <button
            className="sidebar-theme-btn"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          >
            <span style={{ fontSize: 15 }}>{theme === 'dark' ? '☀' : '☾'}</span>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button className="sidebar-logout-btn" onClick={handleSignOut}>
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" style={{ opacity: 0.6, flexShrink: 0 }}>
              <path d="M7 3H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4M12 12l3-3-3-3M7 9h8"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="main-content">
          <div className={`panel${activeTab === 'Tasks' ? ' active' : ''}`}>
            <Todo user={user} showToast={showToast} userExams={userExams} />
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
          <div className={`panel${activeTab === 'Notes' ? ' active' : ''}`}>
            <Notes
              user={user}
              showToast={showToast}
              userExams={userExams}
              onGenerateQuiz={openQuizWithTopic}
              onMakeFlashcards={openFlashcardsWithTopic}
            />
          </div>
          <div className={`panel${activeTab === 'Quiz' ? ' active' : ''}`}>
            <Quiz
              showToast={showToast}
              user={user}
              initialTopic={pendingTopic.quiz}
              onTopicConsumed={() => setPendingTopic(p => ({ ...p, quiz: '' }))}
            />
          </div>
          <div className={`panel${activeTab === 'Flashcards' ? ' active' : ''}`}>
            <Flashcards
              user={user}
              showToast={showToast}
              initialTopic={pendingTopic.flash}
              onTopicConsumed={() => setPendingTopic(p => ({ ...p, flash: '' }))}
            />
          </div>
          <div className={`panel${activeTab === 'Schedule' ? ' active' : ''}`}>
            <Timetable user={user} showToast={showToast} />
          </div>
          <div className={`panel${activeTab === 'AI' ? ' active' : ''}`}>
            <AI user={user} showToast={showToast} />
          </div>
        </div>
      </main>
    </div>
  );
}
