import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { deepDiveApi } from "../services/api";
import { useLessonStore } from "../stores/lessonStore";
import { useNotesStore } from "../stores/notesStore";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: 'user' | 'model';
  content: string;
  suggestions?: string[];
  bookmarked?: boolean;
  timestamp?: number;
}

interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
}

interface LessonChats {
  activeSessionId: string;
  sessions: ChatSession[];
}

const QUICK_ACTIONS = [
  { icon: "📚", label: "Summarize topic", query: "Briefly summarize the main topic of this lesson" },
  { icon: "❓", label: "Key concepts", query: "List the most important concepts in this lesson" },
  { icon: "📝", label: "Exam question", query: "Ask me an exam question about this topic" },
  { icon: "🔗", label: "Real-world example", query: "Give me a real-world example for this topic" },
];

const STORAGE_KEY_PREFIX = 'lc.deepdive.chats.';

const getDefaultMessage = (): Message => ({
  role: 'model',
  content: "",
  suggestions: ["What is this lesson about?", "What are the key concepts?", "How should I prepare for the exam?"],
  timestamp: Date.now(),
});

const createNewSession = (name?: string): ChatSession => ({
  id: `chat-${Date.now()}`,
  name: name || `Chat ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
  messages: [getDefaultMessage()],
  createdAt: Date.now()
});

/* ---- Code block ---- */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="dd-code-block">
      <div className="dd-code-header">
        <span>{language || "code"}</span>
        <button onClick={handleCopy} className="dd-code-copy">
          {copied ? "Copied!" : "Copy code"}
        </button>
      </div>
      <pre className="dd-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DeepDivePane() {
  const { currentLessonId } = useLessonStore();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);
  const [savedMsgIdx, setSavedMsgIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [getDefaultMessage()];
  const isWelcome = messages.length <= 1 && messages[0]?.role === 'model' && !messages[0]?.content;

  // Load/save chats
  useEffect(() => {
    if (!currentLessonId) return;
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + currentLessonId);
    if (saved) {
      try {
        const parsed: LessonChats = JSON.parse(saved);
        if (parsed.sessions?.length) {
          setSessions(parsed.sessions);
          setActiveSessionId(parsed.activeSessionId || parsed.sessions[0].id);
          return;
        }
      } catch {}
    }
    const s = createNewSession('First Chat');
    setSessions([s]);
    setActiveSessionId(s.id);
  }, [currentLessonId]);

  useEffect(() => {
    if (!currentLessonId || !sessions.length) return;
    localStorage.setItem(STORAGE_KEY_PREFIX + currentLessonId, JSON.stringify({ activeSessionId, sessions }));
  }, [sessions, activeSessionId, currentLessonId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const h = () => setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
    el.addEventListener('scroll', h);
    return () => el.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowSessionMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const createNewChat = useCallback(() => {
    const s = createNewSession();
    setSessions(p => [...p, s]);
    setActiveSessionId(s.id);
    setShowSessionMenu(false);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(p => {
      const f = p.filter(s => s.id !== id);
      if (!f.length) { const n = createNewSession('First Chat'); setActiveSessionId(n.id); return [n]; }
      if (id === activeSessionId) setActiveSessionId(f[0].id);
      return f;
    });
    setShowSessionMenu(false);
  }, [activeSessionId]);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setShowSessionMenu(false);
    setShowStarredOnly(false);
  }, []);

  const clearCurrentChat = useCallback(() => {
    setSessions(p => p.map(s => s.id === activeSessionId ? { ...s, messages: [getDefaultMessage()] } : s));
    setShowStarredOnly(false);
  }, [activeSessionId]);

  const toggleBookmark = useCallback((i: number) => {
    setSessions(p => p.map(s => s.id === activeSessionId
      ? { ...s, messages: s.messages.map((m, j) => j === i ? { ...m, bookmarked: !m.bookmarked } : m) }
      : s));
  }, [activeSessionId]);

  const copyMessage = useCallback((content: string, i: number) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgIdx(i);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  }, []);

  const exportToMarkdown = useCallback(() => {
    if (!activeSession) return;
    const md = [`# ${activeSession.name}\n`, ...activeSession.messages.map(m =>
      m.role === 'user' ? `**You:** ${m.content}\n` : `**AI:** ${m.content}\n`
    )].join('\n');
    navigator.clipboard.writeText(md);
  }, [activeSession]);

  const displayMessages = useMemo(() => {
    if (!showStarredOnly) return messages;
    return messages.filter(m => m.bookmarked);
  }, [messages, showStarredOnly]);

  const send = async (customMessage?: string) => {
    const text = customMessage || input;
    if (!text.trim() || !currentLessonId || !activeSessionId) return;
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }

    setSessions(p => p.map(s => s.id === activeSessionId
      ? { ...s, messages: [...s.messages, { role: 'user' as const, content: text, timestamp: Date.now() }] }
      : s));
    setLoading(true);

    const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
    const res = await deepDiveApi.chat(currentLessonId, text, history);
    setLoading(false);

    const aiMsg: Message = res.ok && res.text
      ? { role: 'model', content: res.text, suggestions: res.suggestions || [], timestamp: Date.now() }
      : { role: 'model', content: "Something went wrong. " + (res.error || ""), timestamp: Date.now() };

    setSessions(p => p.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, aiMsg] } : s));
  };

  /* ---- Text formatting ---- */
  const formatLine = (text: string, kp: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*(.+?)\*\*|`(.+?)`)/g;
    let last = 0, m, pi = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[2]) parts.push(<strong key={`${kp}-b${pi++}`}>{m[2]}</strong>);
      else if (m[3]) parts.push(<code key={`${kp}-c${pi++}`} className="dd-inline-code">{m[3]}</code>);
      last = re.lastIndex;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length ? parts : [text];
  };

  const formatMessage = (content: string) => {
    const re = /```(\w*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let last = 0, m, bi = 0;
    while ((m = re.exec(content)) !== null) {
      if (m.index > last) parts.push(...formatTextBlock(content.slice(last, m.index), `pre-${bi}`));
      parts.push(<CodeBlock key={`code-${bi}`} language={m[1]} code={m[2]} />);
      last = re.lastIndex; bi++;
    }
    if (last < content.length) parts.push(...formatTextBlock(content.slice(last), `post-${bi}`));
    return parts;
  };

  const formatTextBlock = (text: string, prefix: string): React.ReactNode[] => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('• ') || line.startsWith('- '))
        return <div key={`${prefix}-${i}`} className="dd-list-item">{'• '}{formatLine(line.slice(2), `${prefix}-l${i}`)}</div>;
      if (line.trim() === '---' || line.includes('Suggested Questions:') || /^\d+\.\s/.test(line.trim())) return null;
      if (!line.trim()) return <div key={`${prefix}-${i}`} className="dd-spacer">{'\u00A0'}</div>;
      return <div key={`${prefix}-${i}`} className="dd-text-line">{formatLine(line, `${prefix}-l${i}`)}</div>;
    }).filter(Boolean) as React.ReactNode[];
  };

  if (!currentLessonId) return (
    <div className="dd-no-lesson">
      <div className="dd-no-lesson-icon">📚</div>
      <div>Select a lesson to start a conversation</div>
    </div>
  );

  return (
    <motion.div
      className="dd-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* ---- Minimal Header ---- */}
      <div className="dd-topbar">
        <div className="dd-topbar-left">
          <div className="dd-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>

          <div className="dd-session-picker" ref={menuRef}>
            <button className="dd-session-btn" onClick={() => setShowSessionMenu(!showSessionMenu)}>
              <span className="dd-session-name">{activeSession?.name || 'Chat'}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ opacity: 0.5 }}>
                <path d="M3 5l3 3 3-3"/>
              </svg>
            </button>

            <AnimatePresence>
              {showSessionMenu && (
                <motion.div
                  className="dd-dropdown"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  {sessions.map(s => (
                    <div
                      key={s.id}
                      className={`dd-dropdown-item${s.id === activeSessionId ? ' dd-dropdown-item--active' : ''}`}
                      onClick={() => switchSession(s.id)}
                    >
                      <span className="dd-dropdown-label">{s.name}</span>
                      <span className="dd-dropdown-meta">{s.messages.length - 1} msgs</span>
                      {sessions.length > 1 && (
                        <button
                          className="dd-dropdown-del"
                          onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="dd-dropdown-new" onClick={createNewChat}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                    New chat
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="dd-topbar-actions">
          <button
            className={`dd-icon-btn${showStarredOnly ? ' dd-icon-btn--active' : ''}`}
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            title="Starred messages"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={showStarredOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button className="dd-icon-btn" onClick={exportToMarkdown} title="Export chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          {messages.length > 1 && (
            <button className="dd-icon-btn" onClick={clearCurrentChat} title="Clear chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          )}
          <button className="dd-new-chat-btn" onClick={createNewChat}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New chat
          </button>
        </div>
      </div>

      {/* ---- Messages Area ---- */}
      <div className="dd-messages" ref={messagesRef}>
        {/* Welcome Screen */}
        {isWelcome && (
          <div className="dd-welcome">
            <motion.div
              className="dd-welcome-icon"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </motion.div>
            <motion.h2
              className="dd-welcome-title"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              How can I help you?
            </motion.h2>
            <motion.p
              className="dd-welcome-sub"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              Ask me anything about this lesson
            </motion.p>

            <motion.div
              className="dd-suggestions-grid"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              {QUICK_ACTIONS.map((action, i) => (
                <motion.button
                  key={i}
                  className="dd-suggestion-card"
                  onClick={() => send(action.query)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="dd-suggestion-icon">{action.icon}</span>
                  <span className="dd-suggestion-label">{action.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
        )}

        {/* Message List */}
        {!isWelcome && displayMessages.map((m, i) => {
          if (i === 0 && !m.content) return null;
          const actualIdx = showStarredOnly ? messages.indexOf(m) : i;
          const isUser = m.role === 'user';
          return (
            <motion.div
              key={actualIdx}
              className={`dd-msg-row${isUser ? ' dd-msg-row--user' : ''}${m.bookmarked ? ' dd-msg-row--bookmarked' : ''}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              onMouseEnter={() => setHoveredMsg(actualIdx)}
              onMouseLeave={() => setHoveredMsg(null)}
            >
              <div className="dd-msg-inner">
                {/* Avatar */}
                <div className={`dd-avatar${isUser ? ' dd-avatar--user' : ''}`}>
                  {isUser ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  )}
                </div>

                {/* Content */}
                <div className="dd-msg-body">
                  <div className="dd-msg-role">{isUser ? 'You' : 'LearnCraft AI'}</div>
                  <div className="dd-msg-content">{formatMessage(m.content)}</div>

                  {/* Suggestions */}
                  {!isUser && m.suggestions && m.suggestions.length > 0 && (
                    <div className="dd-msg-suggestions">
                      {m.suggestions.map((s, si) => (
                        <button key={si} className="dd-chip" onClick={() => send(s)}>
                          {s.replace(/\*\*/g, '').replace(/\*/g, '')}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Hover Actions */}
                  {!isUser && actualIdx > 0 && (
                    <div className={`dd-msg-actions${hoveredMsg === actualIdx ? ' dd-msg-actions--visible' : ''}`}>
                      <button className="dd-action" onClick={() => copyMessage(m.content, actualIdx)} title="Copy">
                        {copiedMsgIdx === actualIdx ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        )}
                      </button>
                      <button className={`dd-action${m.bookmarked ? ' dd-action--active' : ''}`} onClick={() => toggleBookmark(actualIdx)} title="Bookmark">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={m.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      </button>
                      <button className={`dd-action${savedMsgIdx === actualIdx ? ' dd-action--saved' : ''}`} onClick={() => {
                        useNotesStore.getState().addNote(m.content, 'deep-dive', currentLessonId || undefined);
                        setSavedMsgIdx(actualIdx);
                        setTimeout(() => setSavedMsgIdx(null), 2500);
                      }} title="Save to notes">
                        {savedMsgIdx === actualIdx ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Thinking indicator */}
        {loading && (
          <motion.div
            className="dd-msg-row"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="dd-msg-inner">
              <div className="dd-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <div className="dd-msg-body">
                <div className="dd-msg-role">LearnCraft AI</div>
                <div className="dd-thinking-dots">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="dd-dot"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />

        {/* Scroll to bottom */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              className="dd-scroll-btn"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Saved to notes toast */}
        <AnimatePresence>
          {savedMsgIdx !== null && (
            <motion.div
              className="dd-save-toast"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Saved to My Notes
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Input Area ---- */}
      <div className="dd-input-zone">
        <div className="dd-input-box">
          <textarea
            ref={textareaRef}
            className="dd-textarea"
            placeholder="Message LearnCraft AI..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
          />
          <button
            className={`dd-send${input.trim() && !loading ? ' dd-send--active' : ''}`}
            onClick={() => send()}
            disabled={loading || !input.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div className="dd-input-hint">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </motion.div>
  );
}
