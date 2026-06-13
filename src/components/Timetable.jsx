import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { genId, syncErrMsg } from '../utils/misc';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am–9pm
const EVENT_TYPES = ['Class', 'Study', 'Break', 'Exam'];
const TYPE_COLORS = { Class: '#4fa8f7', Study: '#00e5a0', Break: '#a78bfa', Exam: '#ff4d6d' };
const SLOT_H = 52; // px per hour slot

export default function Timetable({ user, showToast }) {
  const [events, setEvents] = useState([]);
  const [modal, setModal] = useState(null); // { day, startHour } or { event } for editing
  const [form, setForm] = useState({ title: '', type: 'Class', duration: 1 });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'data', 'timetable'));
        if (mountedRef.current && snap.exists()) setEvents(snap.data().events || []);
      } catch (e) {
        showToast(syncErrMsg('Load timetable', e), true);
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, [user.uid]);

  async function persist(updated) {
    setEvents(updated);
    try {
      await setDoc(doc(db, 'users', user.uid, 'data', 'timetable'), { events: updated });
    } catch (e) {
      showToast(syncErrMsg('Save timetable', e), true);
    }
  }

  function openAdd(day, startHour) {
    // Don't open if a cell is occupied
    if (events.some(ev => ev.day === day && startHour >= ev.startHour && startHour < ev.startHour + ev.duration)) return;
    setForm({ title: '', type: 'Class', duration: 1 });
    setModal({ day, startHour });
  }

  function addEvent() {
    if (!form.title.trim()) return;
    const ev = { id: genId(), day: modal.day, startHour: modal.startHour, duration: Number(form.duration), title: form.title.trim(), type: form.type };
    persist([...events, ev]);
    setModal(null);
  }

  function deleteEvent(id) {
    persist(events.filter(e => e.id !== id));
    setModal(null);
  }

  function openEdit(ev) {
    setForm({ title: ev.title, type: ev.type, duration: ev.duration });
    setModal({ editId: ev.id, day: ev.day, startHour: ev.startHour });
  }

  function saveEdit() {
    if (!form.title.trim()) return;
    persist(events.map(e => e.id === modal.editId
      ? { ...e, title: form.title.trim(), type: form.type, duration: Number(form.duration) }
      : e
    ));
    setModal(null);
  }

  return (
    <>
      <div className="page-hero">
        <h2><em>Schedule</em></h2>
        <p>Plan your week — classes, study blocks, and breaks.</p>
      </div>

      <div className="tt-legend">
        {EVENT_TYPES.map(t => (
          <span key={t} className="tt-legend-item">
            <span className="tt-legend-dot" style={{ background: TYPE_COLORS[t] }} />{t}
          </span>
        ))}
        <span className="tt-hint">Click any cell to add an event</span>
      </div>

      <div className="tt-wrap">
        {/* Time column */}
        <div className="tt-time-col">
          <div className="tt-day-hdr" />
          {HOURS.map(h => (
            <div key={h} className="tt-time-cell">
              {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day, di) => (
          <div key={day} className="tt-day-col">
            <div className="tt-day-hdr">{day}</div>
            <div className="tt-slots" style={{ height: HOURS.length * SLOT_H }}>
              {/* Clickable hour cells */}
              {HOURS.map(h => (
                <div
                  key={h}
                  className="tt-slot"
                  style={{ height: SLOT_H, top: (h - 7) * SLOT_H }}
                  onClick={() => openAdd(di, h)}
                />
              ))}
              {/* Events */}
              {events.filter(ev => ev.day === di).map(ev => (
                <div
                  key={ev.id}
                  className="tt-event"
                  style={{
                    top: (ev.startHour - 7) * SLOT_H + 2,
                    height: ev.duration * SLOT_H - 4,
                    background: TYPE_COLORS[ev.type] || '#4fa8f7',
                  }}
                  onClick={e => { e.stopPropagation(); openEdit(ev); }}
                >
                  <div className="tt-event-title">{ev.title}</div>
                  <div className="tt-event-type">{ev.type} · {ev.duration}h</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="tt-modal-overlay" onClick={() => setModal(null)}>
          <div className="tt-modal" onClick={e => e.stopPropagation()}>
            <div className="tt-modal-title">
              {modal.editId ? 'Edit event' : `${DAYS[modal.day]}, ${modal.startHour < 12 ? modal.startHour + 'am' : modal.startHour === 12 ? '12pm' : (modal.startHour - 12) + 'pm'}`}
            </div>
            <div className="form-field">
              <label className="form-label">Title</label>
              <input
                className="form-input"
                placeholder="e.g. Physics lecture"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') modal.editId ? saveEdit() : addEvent(); }}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Type</label>
              <div className="tt-type-row">
                {EVENT_TYPES.map(t => (
                  <button
                    key={t}
                    className={`tt-type-btn${form.type === t ? ' active' : ''}`}
                    style={form.type === t ? { borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t], background: TYPE_COLORS[t] + '22' } : {}}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Duration</label>
              <select className="form-input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
                {[1, 1.5, 2, 2.5, 3].map(d => <option key={d} value={d}>{d}h</option>)}
              </select>
            </div>
            <div className="tt-modal-actions">
              {modal.editId && (
                <button className="tt-del-btn" onClick={() => deleteEvent(modal.editId)}>Delete</button>
              )}
              <button className="tt-cancel-btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="tt-save-btn" onClick={modal.editId ? saveEdit : addEvent} disabled={!form.title.trim()}>
                {modal.editId ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
