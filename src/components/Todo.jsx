import { useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { genId, deadlineInfo, syncErrMsg } from '../utils/misc';

const PRIORITIES = ['high', 'medium', 'low'];

export default function Todo({ user, showToast }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('high');
  const [deadline, setDeadline] = useState('');
  const mountedRef = useRef(true);

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
    const tempTask = { ...task, id: tempId };
    setTasks(prev => [tempTask, ...prev]);

    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'tasks'), task);
      if (mountedRef.current) {
        setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: ref.id } : t));
      }
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
    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== id));
    }, 280);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
    } catch (e) {
      showToast(syncErrMsg('Delete task', e), true);
      loadTasks();
    }
  }

  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;

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
              placeholder="e.g. Maths, Physics…"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Deadline</label>
            <input
              className="form-input"
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
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

          <button className="add-task-btn" onClick={addTask} disabled={!text.trim()}>
            Add task
          </button>
        </div>

        <div className="tasks-side">
          <div className="todo-stats-bar">
            <span>
              <span className="stat-dot" style={{ background: 'var(--green)' }} />
              {done} done
            </span>
            <span>
              <span className="stat-dot" style={{ background: 'var(--muted)' }} />
              {total - done} remaining
            </span>
          </div>

          {loading ? (
            <div className="tasks-loading">Loading tasks…</div>
          ) : tasks.length === 0 ? (
            <div className="empty-tasks">No tasks yet — add one to get started</div>
          ) : (
            <div className="task-list">
              {tasks.map(task => {
                const dl = deadlineInfo(task.deadline);
                return (
                  <div
                    key={task.id}
                    className={`task-item pri-${task.priority}${task.done ? ' done' : ''}${task.removing ? ' removing' : ''}`}
                  >
                    <button className="check-btn" onClick={() => toggleDone(task)}>
                      {task.done ? '✓' : ''}
                    </button>
                    <div className="task-body">
                      <div className="task-text">{task.text}</div>
                      <div className="task-meta">
                        <span className={`meta-chip chip-pri ${task.priority}`}>
                          {task.priority}
                        </span>
                        {task.subject && (
                          <span className="meta-chip chip-subject">{task.subject}</span>
                        )}
                        {dl && (
                          <span className={`meta-chip chip-deadline ${dl.cls}`}>{dl.label}</span>
                        )}
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
