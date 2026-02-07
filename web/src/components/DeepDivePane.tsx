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
  { label: "📚 Summarize topic", query: "Briefly summarize the main topic of this lesson" },
  { label: "❓ Key concepts", query: "List the most important concepts in this lesson" },
  { label: "📝 Exam question", query: "Ask me an exam question about this topic" },
  { label: "🔗 Give example", query: "Give me a real-world example for this topic" },
];

const STORAGE_KEY_PREFIX = 'lc.deepdive.chats.';

const getDefaultMessage = (): Message => ({
  role: 'model',
  content: "Hello! 👋 I'm the AI assistant for this lesson.\n\nYou can ask me about topics you don't understand, concepts you want explained, or any other questions.",
  suggestions: ["What is this lesson about?", "What are the key concepts?", "How should I prepare for the exam?"],
  timestamp: Date.now(),
});

const createNewSession = (name?: string): ChatSession => ({
  id: `chat-${Date.now()}`,
  name: name || `Chat ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
  messages: [getDefaultMessage()],
  createdAt: Date.now()
});

// ---- Code block renderer ----
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="dd-code-block">
      <div className="dd-code-block-header">
        <span style={{ fontSize: 11, fontWeight: 600 }}>{language || "code"}</span>
        <button onClick={handleCopy} className="dd-code-copy-btn">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, overflow: "auto" }}>
        <code style={{ fontSize: 12, lineHeight: 1.5 }}>{code}</code>
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
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Get active session
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [getDefaultMessage()];

  // Load chats from localStorage when lesson changes
  useEffect(() => {
    if (!currentLessonId) return;

    const storageKey = STORAGE_KEY_PREFIX + currentLessonId;
    const savedData = localStorage.getItem(storageKey);

    if (savedData) {
      try {
        const parsed: LessonChats = JSON.parse(savedData);
        if (parsed.sessions && parsed.sessions.length > 0) {
          setSessions(parsed.sessions);
          setActiveSessionId(parsed.activeSessionId || parsed.sessions[0].id);
          const active = parsed.sessions.find(s => s.id === (parsed.activeSessionId || parsed.sessions[0].id));
          setShowQuickActions(!active || active.messages.length <= 1);
          return;
        }
      } catch (e) {
        console.error('Failed to parse saved chats:', e);
      }
    }

    const defaultSession = createNewSession('First Chat');
    setSessions([defaultSession]);
    setActiveSessionId(defaultSession.id);
    setShowQuickActions(true);
  }, [currentLessonId]);

  // Save chats to localStorage whenever sessions change
  useEffect(() => {
    if (!currentLessonId || sessions.length === 0) return;

    const storageKey = STORAGE_KEY_PREFIX + currentLessonId;
    const data: LessonChats = { activeSessionId, sessions };
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [sessions, activeSessionId, currentLessonId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll-to-bottom FAB visibility
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollBtn(!atBottom);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSessionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const createNewChat = useCallback(() => {
    const newSession = createNewSession();
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
    setShowQuickActions(true);
    setShowSessionMenu(false);
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      if (filtered.length === 0) {
        const newSession = createNewSession('First Chat');
        setActiveSessionId(newSession.id);
        setShowQuickActions(true);
        return [newSession];
      }
      if (sessionId === activeSessionId) {
        setActiveSessionId(filtered[0].id);
        setShowQuickActions(filtered[0].messages.length <= 1);
      }
      return filtered;
    });
    setShowSessionMenu(false);
  }, [activeSessionId]);

  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    const session = sessions.find(s => s.id === sessionId);
    setShowQuickActions(!session || session.messages.length <= 1);
    setShowSessionMenu(false);
    setShowStarredOnly(false);
  }, [sessions]);

  const clearCurrentChat = useCallback(() => {
    setSessions(prev => prev.map(s =>
      s.id === activeSessionId
        ? { ...s, messages: [getDefaultMessage()] }
        : s
    ));
    setShowQuickActions(true);
    setShowStarredOnly(false);
  }, [activeSessionId]);

  // Toggle bookmark on a message
  const toggleBookmark = useCallback((msgIndex: number) => {
    setSessions(prev => prev.map(s =>
      s.id === activeSessionId
        ? {
            ...s,
            messages: s.messages.map((m, i) =>
              i === msgIndex ? { ...m, bookmarked: !m.bookmarked } : m
            )
          }
        : s
    ));
  }, [activeSessionId]);

  // Copy a single message
  const copyMessage = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  }, []);

  // Export conversation to markdown
  const exportToMarkdown = useCallback(() => {
    if (!activeSession) return;
    const lines = [`# ${activeSession.name}\n`];
    for (const m of activeSession.messages) {
      if (m.role === 'user') {
        lines.push(`**You:** ${m.content}\n`);
      } else {
        lines.push(`**AI:** ${m.content}\n`);
      }
    }
    const md = lines.join('\n');
    navigator.clipboard.writeText(md);
    // Show brief toast by re-using a state hack
    const el = document.getElementById('dd-export-btn');
    if (el) {
      el.textContent = 'Copied!';
      setTimeout(() => { el.textContent = 'Export'; }, 2000);
    }
  }, [activeSession]);

  // Search across all sessions
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: Array<{ sessionId: string; sessionName: string; msgIndex: number; preview: string }> = [];
    for (const session of sessions) {
      for (let i = 0; i < session.messages.length; i++) {
        const m = session.messages[i];
        if (m.content.toLowerCase().includes(q)) {
          const idx = m.content.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 30);
          const end = Math.min(m.content.length, idx + searchQuery.length + 30);
          results.push({
            sessionId: session.id,
            sessionName: session.name,
            msgIndex: i,
            preview: (start > 0 ? '...' : '') + m.content.slice(start, end) + (end < m.content.length ? '...' : ''),
          });
        }
      }
    }
    return results.slice(0, 20);
  }, [searchQuery, sessions]);

  // Filtered messages (starred filter)
  const displayMessages = useMemo(() => {
    if (!showStarredOnly) return messages;
    return messages.filter(m => m.bookmarked);
  }, [messages, showStarredOnly]);

  const send = async (customMessage?: string) => {
    const text = customMessage || input;
    if (!text.trim() || !currentLessonId || !activeSessionId) return;

    setInput("");
    setShowQuickActions(false);
    setShowStarredOnly(false);

    setSessions(prev => prev.map(s =>
      s.id === activeSessionId
        ? { ...s, messages: [...s.messages, { role: 'user' as const, content: text, timestamp: Date.now() }] }
        : s
    ));
    setLoading(true);

    const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
    const res = await deepDiveApi.chat(currentLessonId, text, history);
    setLoading(false);

    if (res.ok && res.text) {
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, { role: 'model' as const, content: res.text!, suggestions: res.suggestions || [], timestamp: Date.now() }] }
          : s
      ));
    } else {
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, { role: 'model' as const, content: "⚠️ Sorry, an error occurred: " + (res.error || "Unknown error"), timestamp: Date.now() }] }
          : s
      ));
    }
  };

  const formatLine = (text: string, keyPrefix: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;
    let partIdx = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={`${keyPrefix}-b${partIdx++}`}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<code key={`${keyPrefix}-c${partIdx++}`} style={{ background: 'var(--hair)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{match[3]}</code>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
  };

  // Format message with code block detection
  const formatMessage = (content: string) => {
    // Split on fenced code blocks (```lang\n...\n```)
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let blockIdx = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Text before code block
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index);
        parts.push(...formatTextBlock(textBefore, `pre-${blockIdx}`));
      }
      // Code block
      parts.push(
        <CodeBlock key={`code-${blockIdx}`} language={match[1]} code={match[2]} />
      );
      lastIndex = codeBlockRegex.lastIndex;
      blockIdx++;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
      parts.push(...formatTextBlock(content.slice(lastIndex), `post-${blockIdx}`));
    }

    return parts;
  };

  const formatTextBlock = (text: string, prefix: string): React.ReactNode[] => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return <div key={`${prefix}-${i}`} style={{ paddingLeft: 16, marginBottom: 4 }}>{'• '}{formatLine(line.slice(2), `${prefix}-l${i}`)}</div>;
        }
        if (line.trim() === '---' || line.includes('Suggested Questions:') || /^\d+\.\s/.test(line.trim())) {
          return null;
        }
        if (!line.trim()) {
          return <div key={`${prefix}-${i}`} style={{ marginBottom: 4 }}>{'\u00A0'}</div>;
        }
        return <div key={`${prefix}-${i}`} style={{ marginBottom: 4 }}>{formatLine(line, `${prefix}-l${i}`)}</div>;
      })
      .filter(Boolean) as React.ReactNode[];
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!currentLessonId) return (
    <div className="lc-section" style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>
      📚 Please select a lesson first
    </div>
  );

  return (
    <div className="lc-section" style={{
      height: 'calc(100vh - 80px)',
      minHeight: 500,
      display: 'flex',
      flexDirection: 'column',
      padding: 0,
      overflow: 'hidden',
      flex: 1
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--accent-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: 'white', flexShrink: 0
          }}>
            🧠
          </div>

          {/* Session selector dropdown */}
          <div style={{ flex: 1, position: 'relative' }} ref={menuRef}>
            <button
              onClick={() => setShowSessionMenu(!showSessionMenu)}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', justifyContent: 'space-between',
                color: 'var(--text)', fontSize: 13, fontWeight: 600
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                💬 {activeSession?.name || 'Chat'}
                {sessions.length > 1 && (
                  <span style={{ fontSize: 10, background: 'var(--accent-2)', color: 'white', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                    {sessions.length}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
            </button>

            <AnimatePresence>
              {showSessionMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    marginTop: 4, background: 'var(--card)',
                    border: '1px solid var(--border)', borderRadius: 10,
                    boxShadow: 'var(--shadow-2)', zIndex: 100,
                    overflow: 'hidden', maxHeight: 200, overflowY: 'auto'
                  }}
                >
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 8,
                        background: session.id === activeSessionId ? 'var(--bg)' : 'transparent',
                        borderLeft: session.id === activeSessionId ? '3px solid var(--accent-2)' : '3px solid transparent',
                        cursor: 'pointer', transition: 'all 0.1s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseOut={(e) => e.currentTarget.style.background = session.id === activeSessionId ? 'var(--bg)' : 'transparent'}
                    >
                      <div onClick={() => switchSession(session.id)} style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                        {session.name}
                        <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 6 }}>
                          ({session.messages.length - 1} messages)
                        </span>
                      </div>
                      {sessions.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            padding: 4, fontSize: 12, opacity: 0.5, borderRadius: 4
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--danger-bg, #fee)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'transparent'; }}
                          title="Delete chat"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <div
                    onClick={createNewChat}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 8,
                      background: 'transparent', borderTop: '1px solid var(--border)',
                      cursor: 'pointer', fontSize: 13, color: 'var(--accent-2)', fontWeight: 600
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    ➕ New Chat
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => { setShowSearch(!showSearch); setSearchQuery(""); }}
            title="Search messages"
            style={{
              background: showSearch ? 'var(--accent-2)' : 'transparent',
              border: '1px solid var(--border)',
              cursor: 'pointer', padding: 8, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: showSearch ? 'white' : 'var(--text)',
              transition: 'all 0.15s'
            }}
          >
            🔍
          </button>

          <button
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            title={showStarredOnly ? "Show all messages" : "Show starred only"}
            style={{
              background: showStarredOnly ? 'var(--warning)' : 'transparent',
              border: '1px solid var(--border)',
              cursor: 'pointer', padding: 8, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: showStarredOnly ? 'white' : 'var(--text)',
              transition: 'all 0.15s'
            }}
          >
            ⭐
          </button>

          <button
            id="dd-export-btn"
            onClick={exportToMarkdown}
            title="Export conversation as Markdown"
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              cursor: 'pointer', padding: '8px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 600, color: 'var(--text)',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-2)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            Export
          </button>

          <button
            onClick={createNewChat}
            title="Start new chat"
            style={{
              background: 'var(--accent-2)', border: 'none', cursor: 'pointer',
              padding: '8px 12px', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 4, fontSize: 12, fontWeight: 600, color: 'white',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            ➕ New
          </button>

          {messages.length > 1 && (
            <button
              onClick={clearCurrentChat}
              title="Clear this chat"
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                cursor: 'pointer', padding: 8, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0.7, transition: 'all 0.15s', fontSize: 14
              }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'var(--danger, #ef4444)'; }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Search Panel */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'var(--card)', borderBottom: '1px solid var(--border)',
              padding: '10px 16px', overflow: 'hidden'
            }}
          >
            <input
              autoFocus
              className="lc-textarea input w-full"
              placeholder="Search across all sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: 13, marginBottom: searchResults.length ? 8 : 0 }}
            />
            {searchResults.length > 0 && (
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {searchResults.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      switchSession(r.sessionId);
                      setShowSearch(false);
                      setSearchQuery("");
                    }}
                    className="dd-search-result"
                    style={{
                      padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                      borderRadius: 6, marginBottom: 2, color: 'var(--text)',
                      transition: 'background 0.1s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="muted" style={{ fontSize: 10, marginRight: 6 }}>{r.sessionName}:</span>
                    <span dangerouslySetInnerHTML={{
                      __html: r.preview.replace(
                        new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                        '<mark class="dd-search-highlight">$1</mark>'
                      )
                    }} />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--bg)', position: 'relative' }}>
        <AnimatePresence>
          {displayMessages.map((m, i) => {
            // Resolve the actual index in messages array for operations
            const actualIdx = showStarredOnly ? messages.indexOf(m) : i;
            return (
              <motion.div
                key={actualIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 14
                }}
              >
                <div
                  className="dd-message-container"
                  style={{
                    maxWidth: '85%', position: 'relative',
                    padding: '12px 16px', borderRadius: 16,
                    background: m.role === 'user' ? 'var(--accent-2)' : m.bookmarked ? 'var(--warning-bg)' : 'var(--card)',
                    color: m.role === 'user' ? 'white' : 'var(--text)',
                    borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                    borderBottomLeftRadius: m.role === 'model' ? 4 : 16,
                    border: m.role === 'model'
                      ? m.bookmarked ? '1px solid var(--warning)' : '1px solid var(--border)'
                      : 'none',
                    boxShadow: 'var(--shadow-1)'
                  }}
                >
                  {/* Timestamp */}
                  {m.timestamp && (
                    <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>
                      {formatTimestamp(m.timestamp)}
                    </div>
                  )}

                  <div style={{ lineHeight: 1.65, fontSize: 14 }}>
                    {formatMessage(m.content)}
                  </div>

                  {/* Suggestion buttons */}
                  {m.role === 'model' && m.suggestions && m.suggestions.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {m.suggestions.map((s, si) => (
                        <button
                          key={si}
                          onClick={() => send(s)}
                          className="pill"
                          style={{
                            cursor: 'pointer', fontSize: 12, padding: '6px 12px',
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            borderRadius: 999, color: 'var(--text)', transition: 'all 0.15s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'var(--card)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg)'}
                        >
                          💡 {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Action buttons for AI messages */}
                  {m.role === 'model' && actualIdx > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      {/* Bookmark */}
                      <button
                        onClick={() => toggleBookmark(actualIdx)}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '4px 8px', fontSize: 11,
                          color: m.bookmarked ? 'var(--warning)' : 'var(--muted)',
                          cursor: 'pointer', transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', gap: 3
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--warning)'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                        title={m.bookmarked ? "Remove bookmark" : "Bookmark"}
                      >
                        {m.bookmarked ? '⭐' : '☆'}
                      </button>

                      {/* Copy message */}
                      <button
                        onClick={() => copyMessage(m.content, actualIdx)}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '4px 8px', fontSize: 11,
                          color: 'var(--muted)', cursor: 'pointer',
                          transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 3
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-2)'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                        title="Copy message"
                      >
                        {copiedMsgIdx === actualIdx ? '✅' : '📋'}
                      </button>

                      {/* Save to notes */}
                      <button
                        onClick={() => {
                          useNotesStore.getState().addNote(m.content, 'deep-dive', currentLessonId || undefined);
                          const btn = document.getElementById(`save-btn-${actualIdx}`);
                          if (btn) {
                            btn.textContent = '✅ Saved!';
                            setTimeout(() => { btn.textContent = '💾 Save'; }, 2000);
                          }
                        }}
                        id={`save-btn-${actualIdx}`}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '4px 10px', fontSize: 11,
                          color: 'var(--muted)', cursor: 'pointer',
                          transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-2)'; e.currentTarget.style.color = 'var(--accent-2)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
                        title="Save to notes"
                      >
                        💾 Save
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', gap: 6, padding: 12 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                style={{ width: 8, height: 8, background: 'var(--accent-2)', borderRadius: '50%' }}
              />
            ))}
          </motion.div>
        )}
        <div ref={bottomRef} />

        {/* Scroll-to-bottom FAB */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                position: 'sticky', bottom: 16, left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--accent-2)', color: 'white',
                border: 'none', borderRadius: '50%',
                width: 36, height: 36, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, boxShadow: 'var(--shadow-2)',
                zIndex: 10
              }}
            >
              ↓
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions */}
      <AnimatePresence>
        {showQuickActions && messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 8,
              background: 'var(--bg)', borderTop: '1px solid var(--border)'
            }}
          >
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => send(action.query)}
                className="pill"
                style={{
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  padding: '8px 14px', background: 'var(--card)',
                  border: '1px solid var(--border)', borderRadius: 999,
                  color: 'var(--text)', transition: 'all 0.15s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-2)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {action.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div style={{
        padding: 16, background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 10, alignItems: 'center',
        borderRadius: '0 0 var(--radius-xl) var(--radius-xl)'
      }}>
        <input
          className="lc-textarea input"
          style={{ flex: 1, marginBottom: 0, height: 46, borderRadius: 23, padding: '0 20px' }}
          placeholder="Ask a question..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button
          className="btn btn-primary"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            borderRadius: '50%', width: 46, height: 46, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            background: loading || !input.trim() ? 'var(--border)' : 'var(--accent-2)',
            borderColor: loading || !input.trim() ? 'var(--border)' : 'var(--accent-2)',
            color: 'white',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
