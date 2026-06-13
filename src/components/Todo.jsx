import { useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { genId, deadlineInfo, syncErrMsg } from '../utils/misc';

const PRIORITIES = ['high', 'medium', 'low'];

export default function Todo({ user, showToast, userExams = [] }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('high');
  const [deadline, setDeadline] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');
  const mountedRef = useRef(true);

  // Unique subjects from exams + existing tasks
  const examSubjects = [...new Set(userExams.flatMap(e => e.subjects.map(s => s.name)))];

  useEffect(() => {
    mountedRef.current = true;
    loadTasks();
    return () => { mountedRef.current = false; };
  }, [user.uid]);

  async function loadTasks() {
    setLoading(true);
    try {
      const q = query(collection(db, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (!mountedRef.current) return;
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      if (mountedRef.current) showToast(syncErrMsg('Load tasks', e), true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function addTask() {
    if (!text.trim()) return;
    const task = {
      text: text.trim(),
      subject: subject.trim(),
      priority,
      deadline: deadline || null,
      done: false,
      createdAt: Date.now(),
    };
    setText('');
    setSubject('');
    setDeadline('');

    const tempId = genId();
    setTasks(prev => [{ ...task, id: tempId }, ...prev]);
    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'tasks'), task);
      if (mountedRef.current) setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: ref.id } : t));
    } catch (e) {
      if (mountedRef.current) {
        setTasks(prev => prev.filter(t => t.id !== tempId));
        showToast(syncErrMsg('Save task', e), true);
      }
    }
  }

  async function toggleDone(task) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), { done: !task.done });
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: task.done } : t));
      showToast(syncErrMsg('Update task', e), true);
    }
  }

  async function deleteTask(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => setTasks(prev => prev.filter(t => t.id !== id)), 280);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
    } catch (e) {
      showToast(syncErrMsg('Delete task', e), true);
      loadTasks();
    }
  }

  const allTaskSubjects = [...new Set(tasks.map(t => t.subject).filter(Boolean))];
  const filterOptions = ['All', ...new Set([...examSubjects, ...allTaskSubjects])];
  const visibleTasks = filterSubject === 'All' ? tasks : tasks.filter(t => t.subject === filterSubject);

  const done = visibleTasks.filter(t => t.done).length;
  const total = visibleTasks.length;

  return (
    <>
      <div className="page-hero">
        <h2>Your <em>Tasks</em></h2>
        <p>Stay on top of assignments, deadlines, and study goals.</p>
      </div>

      <div className="todo-layout">
        <div className="add-card">
          <div className="add-card-title">Add a task</div>

          <div className="form-field">
            <label className="form-label">Task</label>
            <input
              className="form-input"
              type="text"
              placeholder="What do you need to do?"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Subject</label>
            <input
              className="form-input"
              type="text"
              placeholder={examSubjects.length ? 'Pick or type a subject…' : 'e.g. Maths, Physics…'}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              list="subj-list"
            />
            {examSubjects.length > 0 && (
              <datalist id="subj-list">
                {examSubjects.map(s => <option key={s} value={s} />)}
              </datalist>
            )}
          </div>

          <div className="form-field">
            <label className="form-label">Deadline</label>
            <input className="form-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>

          <div className="form-field">
            <label className="form-label">Priority</label>
            <div className="priority-row">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  className={`pri-btn ${p}${priority === p ? ' selected' : ''}`}
                  onClick={() => setPriority(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button className="add-task-btn" onClick={addTask} disabled={!text.trim()}>Add task</button>
        </div>

        <div className="tasks-side">
          {filterOptions.length > 1 && (
            <div className="todo-filter-row">
              {filterOptions.map(s => (
                <button
                  key={s}
                  className={`todo-filter-btn${filterSubject === s ? ' active' : ''}`}
                  onClick={() => setFilterSubject(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="todo-stats-bar">
            <span><span className="stat-dot" style={{ background: 'var(--green)' }} />{done} done</span>
            <span><span className="stat-dot" style={{ background: 'var(--muted)' }} />{total - done} remaining</span>
          </div>

          {loading ? (
            <div className="tasks-loading">Loading tasks…</div>
          ) : visibleTasks.length === 0 ? (
            <div className="empty-tasks">{filterSubject === 'All' ? 'No tasks yet — add one to get started' : `No tasks for ${filterSubject}`}</div>
          ) : (
            <div className="task-list">
              {visibleTasks.map(task => {
                const dl = deadlineInfo(task.deadline);
                return (
                  <div key={task.id} className={`task-item pri-${task.priority}${task.done ? ' done' : ''}${task.removing ? ' removing' : ''}`}>
                    <button className="check-btn" onClick={() => toggleDone(task)}>{task.done ? '✓' : ''}</button>
                    <div className="task-body">
                      <div className="task-text">{task.text}</div>
                      <div className="task-meta">
                        <span className={`meta-chip chip-pri ${task.priority}`}>{task.priority}</span>
                        {task.subject && <span className="meta-chip chip-subject">{task.subject}</span>}
                        {dl && <span className={`meta-chip chip-deadline ${dl.cls}`}>{dl.label}</span>}
                      </div>
                    </div>
                    <button className="del-btn" onClick={() => deleteTask(task.id)}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
