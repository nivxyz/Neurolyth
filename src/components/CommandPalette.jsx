import { useEffect, useRef, useState } from 'react';

const NAV_ITEMS = [
  { label: 'Tasks',      icon: '✓', tab: 'Tasks' },
  { label: 'Marks',      icon: '▦', tab: 'Marks' },
  { label: 'Progress',   icon: '↗', tab: 'Progress' },
  { label: 'Notes',      icon: '≡', tab: 'Notes' },
  { label: 'Quiz',       icon: '?', tab: 'Quiz' },
  { label: 'Flashcards', icon: '◫', tab: 'Flashcards' },
  { label: 'Schedule',   icon: '⊟', tab: 'Schedule' },
  { label: 'AI',         icon: '✦', tab: 'AI' },
];

export default function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = query.trim()
    ? NAV_ITEMS.filter(it => it.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_ITEMS;

  function pick(item) {
    onNavigate(item.tab);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      if (e.key === 'Enter' && items[cursor]) pick(items[cursor]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, cursor]);

  if (!open) return null;

  return (
    <div className="cmd-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd-palette">
        <div className="cmd-input-row">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ opacity: 0.4, flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/>
          </svg>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Go to…"
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
          />
          <span className="cmd-esc" onMouseDown={onClose}>Esc</span>
        </div>
        <div className="cmd-list">
          {items.length === 0 ? (
            <div className="cmd-empty">No results for "{query}"</div>
          ) : items.map((item, i) => (
            <div
              key={item.tab}
              className={`cmd-item${i === cursor ? ' selected' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={() => pick(item)}
            >
              <span className="cmd-item-icon">{item.icon}</span>
              <span className="cmd-item-label">{item.label}</span>
              <span className="cmd-item-hint">Navigate</span>
            </div>
          ))}
        </div>
        <div className="cmd-footer">
          <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
