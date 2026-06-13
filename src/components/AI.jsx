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

      <div className="ai-layout">
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
      </div>
    </>
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
