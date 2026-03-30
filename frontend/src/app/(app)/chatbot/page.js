'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './page.module.css';

const QUICK_PROMPTS = [
  { label: '📊 Show my profit this week', value: 'What is my profit this week?' },
  { label: '📦 Low stock items', value: 'Which items are low in stock?' },
  { label: '💡 Business tips', value: 'Give me tips to improve my shop business' },
  { label: '📈 Sales trend', value: 'What is my sales trend for the last 7 days?' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI Financial Assistant. Ask me anything about your transactions, inventory, or business insights. I can help with:\n\n• Transaction history & summaries\n• Inventory status\n• Business tips & advice\n• Financial analysis',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          user_id: 'default_user',
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || data.message || 'I received your message but couldn\'t generate a response. Please try again.',
        timestamp: new Date(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ I couldn't connect to the server right now. Please make sure the backend is running.\n\nError: ${err.message}`,
        timestamp: new Date(),
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className={styles.chatContainer}>
      <header className="page-header">
        <div className="page-header-title">
          <h1 className="headline-sm">🤖 AI Assistant</h1>
          <span className="body-sm text-muted">RAG-powered financial chatbot</span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setMessages([{
            role: 'assistant',
            content: 'Chat cleared! How can I help you?',
            timestamp: new Date(),
          }])}
        >
          🗑️ Clear
        </button>
      </header>

      {/* Chat Messages Area */}
      <div className={styles.messagesArea}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage} ${msg.isError ? styles.errorMessage : ''}`}>
            {msg.role === 'assistant' && (
              <div className={styles.avatarIcon}>🤖</div>
            )}
            <div className={styles.messageContent}>
              <div className={styles.messageText}>
                {msg.content.split('\n').map((line, li) => (
                  <span key={li}>
                    {line}
                    {li < msg.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
              <span className={styles.messageTime}>{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className={`${styles.messageBubble} ${styles.assistantMessage}`}>
            <div className={styles.avatarIcon}>🤖</div>
            <div className={styles.messageContent}>
              <div className={styles.typingIndicator}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length <= 2 && (
        <div className={styles.quickPrompts}>
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              className={styles.quickPromptBtn}
              onClick={() => sendMessage(prompt.value)}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            className={styles.chatInput}
            placeholder="Ask me about your finances..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            id="chat-input"
          />
          <button
            className={styles.sendBtn}
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
          >
            {isLoading ? (
              <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
            ) : '↗'}
          </button>
        </div>
      </div>
    </div>
  );
}
