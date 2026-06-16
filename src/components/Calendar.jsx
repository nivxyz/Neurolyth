import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function Calendar({ user, userExams }) {
  const [tasks, setTasks] = useState([]);
  const [srsMap, setSrsMap] = useState({});
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    async function load() {
      try {
        const tSnap = await getDocs(collection(db, 'users', user.uid, 'tasks'));
        setTasks(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
      try {
        const fcSnap = await getDoc(doc(db, 'users', user.uid, 'data', 'flashcards'));
        if (fcSnap.exists()) {
          const decks = fcSnap.data().decks || [];
          const map = {};
          const today = new Date().toISOString().slice(0, 10);
          decks.forEach(deck => {
            const srs = deck.srsData || {};
            deck.cards.forEach((_, i) => {
              const date = srs[i]?.nextReview || today;
              map[date] = (map[date] || 0) + 1;
            });
          });
          setSrsMap(map);
        }
      } catch {}
    }
    load();
  }, [user.uid]);

  const events = {};
  function addEv(date, type, data) {
    if (!events[date]) events[date] = { tasks: [], srs: 0, exams: [] };
    if (type === 'task') events[date].tasks.push(data);
    else if (type === 'srs') events[date].srs += data;
    else events[date].exams.push(data);
  }
  tasks.filter(t => t.deadline && !t.done).forEach(t => addEv(t.deadline, 'task', t));
  Object.entries(srsMap).forEach(([d, n]) => addEv(d, 'srs', n));
  userExams.filter(e => e.examDate).forEach(e => addEv(e.examDate, 'exam', e.name));

  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function prev() { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }
  function next() { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }
  const pad = n => String(n).padStart(2, '0');

  return (
    <>
      <div className="page-hero">
        <h2>Revision <em>Calendar</em></h2>
        <p>Tasks, flashcard reviews, and exam dates in one place.</p>
      </div>

      <div className="cal-card">
        <div className="cal-header">
          <button className="cal-nav-btn" onClick={prev}>‹</button>
          <div className="cal-month-title">{MONTHS[month]} {year}</div>
          <button className="cal-nav-btn" onClick={next}>›</button>
        </div>

        <div className="cal-legend">
          <div className="cal-legend-item"><span className="cal-dot-leg exam" />Exam</div>
          <div className="cal-legend-item"><span className="cal-dot-leg task" />Task due</div>
          <div className="cal-legend-item"><span className="cal-dot-leg srs" />Cards due</div>
        </div>

        <div className="cal-grid-hdr">
          {DAYS.map(d => <div key={d} className="cal-col-hdr">{d}</div>)}
        </div>
        <div className="cal-grid">
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} className="cal-cell empty" />;
            const ds = `${year}-${pad(month+1)}-${pad(day)}`;
            const evs = events[ds];
            const isToday = ds === todayStr;
            return (
              <div key={ds} className={`cal-cell${isToday ? ' today' : ''}${evs?.exams.length ? ' has-exam' : ''}`}>
                <div className="cal-day-num">{day}</div>
                {evs?.exams.length > 0 && (
                  <div className="cal-exam-tag" title={evs.exams.join(', ')}>
                    {evs.exams[0].length > 8 ? evs.exams[0].slice(0, 8) + '…' : evs.exams[0]}
                  </div>
                )}
                {evs && (
                  <div className="cal-dots">
                    {evs.exams.length > 0 && <span className="cal-dot-leg exam" />}
                    {evs.tasks.length > 0 && <span className="cal-dot-leg task" title={`${evs.tasks.length} task${evs.tasks.length > 1 ? 's' : ''}`} />}
                    {evs.srs > 0 && <span className="cal-dot-leg srs" title={`${evs.srs} cards`} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
