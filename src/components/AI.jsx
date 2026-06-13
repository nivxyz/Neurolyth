import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { geminiGenerate, AI_ENABLED } from '../utils/ai';
import { formatMarkdown, renderMath, genId, syncErrMsg } from '../utils/misc';

const AI_SYSTEM = 'You are a helpful, friendly student study assistant called Neurolyth AI. Keep answers clear and concise. Use LaTeX math formatting ($...$ for inline, $$...$$ for display) when showing equations. Be encouraging and supportive.';

function AnimatedBubble({ text, onDone }) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const elRef = useRef(null);

  useEffect(() => {
    let i = 0;
    const speed = Math.max(6, Math.min(18, Math.floor(2200 / text.length)));
    const iv = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(iv);
        setDone(true);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text]);

  useEffect(() => {
    if (done && elRef.current) renderMath(elRef.current);
  }, [done]);

  if (done) {
    return (
      <div
        className="ai-bubble formatted"
        ref={elRef}
        dangerouslySetInnerHTML={{ __html: formatMarkdown(text) }}
      />
    );
  }
  return (
    <div className="ai-bubble typing-caret">
      {shown}
    </div>
  );
}

export default function AI({ user, showToast }) {
  const [chats, setChats] = useState({});
  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [animatingId, setAnimatingId] = useState(null);
  const [aiMode, setAiMode] = useState('chat');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadChats();
    return () => { mountedRef.current = false; };
  }, [user.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatId, chats]);

  async function loadChats() {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'data', 'chats'));
      if (!mountedRef.current) return;
      if (snap.exists()) {
        const d = snap.data();
        const savedChats = d.chats || {};
        const savedList = d.chatList || [];
        setChats(savedChats);
        setChatList(savedList);
        if (savedList.length) setActiveChatId(savedList[0].id);
        else newChat(savedChats, savedList, false);
      } else {
        newChat({}, [], false);
      }
    } catch (e) {
      showToast(syncErrMsg('Load chats', e), true);
      newChat({}, [], false);
    }
  }

  async function persistChats(updatedChats, updatedList) {
    try {
      await setDoc(doc(db, 'users', user.uid, 'data', 'chats'), {
        chats: updatedChats,
        chatList: updatedList,
      });
    } catch (e) {
      showToast(syncErrMsg('Save chat', e), true);
    }
  }

  function newChat(existingChats, existingList, persist = true) {
    const id = genId();
    const chat = {
      id,
      title: 'New chat',
      messages: [{ role: 'assistant', content: 'Hi! I\'m Neurolyth AI — your study assistant. What would you like to learn about today?' }],
    };
    const updatedChats = { ...existingChats, [id]: chat };
    const updatedList = [{ id, title: chat.title }, ...existingList];
    setChats(updatedChats);
    setChatList(updatedList);
    setActiveChatId(id);
    if (persist) persistChats(updatedChats, updatedList);
    return id;
  }

  function handleNewChat() {
    newChat(chats, chatList);
  }

  async function deleteChat(id) {
    const updatedChats = { ...chats };
    delete updatedChats[id];
    const updatedList = chatList.filter(c => c.id !== id);
    setChats(updatedChats);
    setChatList(updatedList);
    if (activeChatId === id) {
      setActiveChatId(updatedList.length ? updatedList[0].id : null);
      if (!updatedList.length) {
        setTimeout(() => newChat(updatedChats, updatedList), 0);
        return;
      }
    }
    await persistChats(updatedChats, updatedList);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || !activeChatId) return;
    setInput('');
    setBusy(true);

    const chat = chats[activeChatId];
    const userMsg = { role: 'user', content: text };
    const typingMsg = { role: 'assistant', content: '', typing: true };

    const newTitle = chat.title === 'New chat' ? text.slice(0, 42) : chat.title;
    const updatedChat = {
      ...chat,
      title: newTitle,
      messages: [...chat.messages, userMsg, typingMsg],
    };

    const updatedChats = { ...chats, [activeChatId]: updatedChat };
    const updatedList = chatList.map(c => c.id === activeChatId ? { ...c, title: newTitle } : c);
    setChats(updatedChats);
    setChatList(updatedList);

    try {
      const history = chat.messages.slice(-12);
      const context = history
        .filter(m => !m.typing)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      const fullPrompt = context ? `${context}\nUser: ${text}` : text;

      const reply = await geminiGenerate(fullPrompt, null, AI_SYSTEM);
      if (!mountedRef.current) return;

      const animId = genId();
      setAnimatingId(animId);

      const finalChat = {
        ...updatedChat,
        messages: [
          ...updatedChat.messages.slice(0, -1),
          { role: 'assistant', content: reply, animId },
        ],
      };
      const finalChats = { ...updatedChats, [activeChatId]: finalChat };
      setChats(finalChats);

      await persistChats(finalChats, updatedList);
    } catch (e) {
      if (!mountedRef.current) return;
      const errChat = {
        ...updatedChat,
        messages: [
          ...updatedChat.messages.slice(0, -1),
          { role: 'assistant', content: e.message || 'Something went wrong. Please try again.', done: true },
        ],
      };
      const errChats = { ...updatedChats, [activeChatId]: errChat };
      setChats(errChats);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  const activeChat = activeChatId ? chats[activeChatId] : null;
  const messages = activeChat?.messages || [];

  if (!AI_ENABLED) {
    return (
      <>
        <div className="page-hero"><h2>Neurolyth <em>AI</em></h2></div>
        <div className="feature-offline">
          <div className="feature-offline-title">AI is offline</div>
          <p>The AI proxy service is not configured.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-hero">
        <h2>Neurolyth <em>AI</em></h2>
        <p>Your personal study assistant — ask anything.</p>
      </div>

      <div className="ai-mode-tabs">
        <button className={`ai-mode-tab${aiMode === 'chat' ? ' active' : ''}`} onClick={() => setAiMode('chat')}>Chat</button>
        <button className={`ai-mode-tab${aiMode === 'summarise' ? ' active' : ''}`} onClick={() => setAiMode('summarise')}>Summarise notes</button>
      </div>

      {aiMode === 'summarise' && <Summariser showToast={showToast} />}

      {aiMode === 'chat' && <div className="ai-layout">
        {/* Sidebar */}
        <div className="ai-sidebar">
          <button className="ai-newchat-btn" onClick={handleNewChat}>+ New chat</button>
          <div className="ai-chat-list">
            {chatList.map(c => (
              <div
                key={c.id}
                className={`ai-chat-item${activeChatId === c.id ? ' active' : ''}`}
                onClick={() => setActiveChatId(c.id)}
              >
                <span className="ai-chat-item-title">{c.title}</span>
                <button
                  className="ai-chat-del"
                  onClick={e => { e.stopPropagation(); deleteChat(c.id); }}
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div className="ai-chat-wrap">
          <div className="ai-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg ${msg.role}`}>
                {msg.typing ? (
                  <div className="ai-bubble">
                    <div className="ai-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                ) : msg.role === 'assistant' && msg.animId === animatingId && !msg.done ? (
                  <AnimatedBubble
                    text={msg.content}
                    onDone={() => {
                      setAnimatingId(null);
                      setChats(prev => {
                        const c = prev[activeChatId];
                        if (!c) return prev;
                        return {
                          ...prev,
                          [activeChatId]: {
                            ...c,
                            messages: c.messages.map(m => m.animId === msg.animId ? { ...m, done: true } : m),
                          },
                        };
                      });
                    }}
                  />
                ) : msg.role === 'assistant' ? (
                  <AssistantBubble content={msg.content} />
                ) : (
                  <div className="ai-bubble">{msg.content}</div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-row">
            <textarea
              ref={inputRef}
              className="ai-input"
              placeholder="Ask anything about your studies…"
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              disabled={busy}
            />
            <button className="ai-send-btn" onClick={send} disabled={busy || !input.trim()}>
              ↑
            </button>
          </div>
        </div>
      </div>}
    </>
  );
}

function Summariser({ showToast }) {
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function summarise() {
    if (!notes.trim() && !file) return;
    setBusy(true);
    setResult(null);
    const prompt = `Summarise the following study notes. Return ONLY valid JSON, no markdown:
{"summary":"2-3 sentence overview","keyPoints":["point 1","point 2","..."],"keyTerms":[{"term":"...","definition":"..."}]}

Notes:
${notes || '(see uploaded file)'}`;
    try {
      const raw = await geminiGenerate(prompt, file || null, 'You are a note summariser. Return only valid JSON.');
      const cleaned = raw.replace(/```json|```/g, '').trim();
      setResult(JSON.parse(cleaned));
    } catch (e) {
      showToast(e.message || 'Summarisation failed.', true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="summariser">
      <div className="quiz-input-card" style={{ maxWidth: 680 }}>
        <div className="form-field">
          <label className="form-label">Paste your notes</label>
          <textarea className="form-input" rows="6" placeholder="Paste lecture notes, textbook excerpts, revision material…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="quiz-or-divider">or upload a file</div>
        {!file ? (
          <div className="quiz-upload-zone" style={{ marginBottom: 14 }}>
            <input type="file" accept=".pdf,.txt,.doc,.docx" onChange={e => setFile(e.target.files[0])} />
            <span className="quiz-upload-icon">📄</span>
            <div className="quiz-upload-label">PDF, TXT, or DOC</div>
          </div>
        ) : (
          <div className="quiz-file-chip" style={{ marginBottom: 14 }}>
            <span className="fc-ext">{file.name.split('.').pop().toUpperCase()}</span>
            <span className="fc-name">{file.name}</span>
            <button className="fc-remove" onClick={() => setFile(null)}>×</button>
          </div>
        )}
        <button className="gen-quiz-btn" style={{ width: '100%' }} onClick={summarise} disabled={busy || (!notes.trim() && !file)}>
          {busy ? 'Summarising…' : 'Summarise'}
        </button>
      </div>

      {busy && <div className="quiz-loading"><div className="q-spinner"/><p>Summarising your notes…</p></div>}

      {result && (
        <div className="summary-result">
          <div className="summary-section">
            <div className="summary-section-label">Summary</div>
            <p className="summary-text">{result.summary}</p>
          </div>
          {result.keyPoints?.length > 0 && (
            <div className="summary-section">
              <div className="summary-section-label">Key points</div>
              <ul className="summary-list">
                {result.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {result.keyTerms?.length > 0 && (
            <div className="summary-section">
              <div className="summary-section-label">Key terms</div>
              <div className="summary-terms">
                {result.keyTerms.map((t, i) => (
                  <div key={i} className="summary-term">
                    <span className="summary-term-name">{t.term}</span>
                    <span className="summary-term-def">{t.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantBubble({ content }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) renderMath(ref.current);
  }, [content]);
  return (
    <div
      className="ai-bubble formatted"
      ref={ref}
      dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
    />
  );
}
