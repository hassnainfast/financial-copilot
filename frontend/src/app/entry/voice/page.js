'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { startAudioEntry, continueAudioEntry, getAudioUrl } from '@/lib/api';
import { DEFAULT_USER_ID, formatCurrency } from '@/lib/constants';
import Toast from '@/components/Toast';
import styles from './page.module.css';

export default function VoiceEntryPage() {
  const router = useRouter();
  const [type, setType] = useState('expense');
  const [sessionId, setSessionId] = useState(null);
  const [step, setStep] = useState('select'); // select, listening, processing, complete
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [extractedItems, setExtractedItems] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const result = await startAudioEntry({ userId: DEFAULT_USER_ID, type });
      setSessionId(result.session_id);
      if (result.audio_url) setAudioUrl(getAudioUrl(result.audio_url));
      if (result.message) {
        setChatMessages([{ role: 'assistant', text: result.message }]);
      }
      setStep('listening');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendAudio(blob);
      };
      
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function sendAudio(blob) {
    if (!sessionId) return;
    setLoading(true);
    setStep('processing');
    try {
      const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
      const result = await continueAudioEntry({ sessionId, audioFile });
      processResult(result);
    } catch (err) {
      setError(err.message);
      setStep('listening');
    } finally {
      setLoading(false);
    }
  }

  async function sendText() {
    if (!sessionId || !textInput.trim()) return;
    setLoading(true);
    const userMsg = textInput.trim();
    setTextInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    
    try {
      const result = await continueAudioEntry({ sessionId, userText: userMsg });
      processResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function processResult(result) {
    if (result.message) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: result.message }]);
    }
    if (result.audio_url) setAudioUrl(getAudioUrl(result.audio_url));
    if (result.data?.items) setExtractedItems(result.data.items);
    
    if (result.is_complete) {
      setStep('complete');
      setToast({ show: true, message: 'Transaction saved successfully!', type: 'success' });
    } else {
      setStep('listening');
    }
  }

  return (
    <div className={styles.container}>
      <Toast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(prev => ({ ...prev, show: false }))} />

      {/* Header */}
      <header className="back-header">
        <button className="back-btn" onClick={() => router.back()} aria-label="Go back">
          ←
        </button>
        <div>
          <h1 className="title-lg">آواز سے اندراج</h1>
          <span className="body-sm text-muted">Voice Entry</span>
        </div>
      </header>

      <main className="page-content">
        {step === 'select' && (
          <div className="animate-fade-in">
            {/* Type selection */}
            <div className="section">
              <div className="toggle-switch">
                <button
                  className={`toggle-option ${type === 'income' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setType('income')}
                >
                  آمدنی • Income
                </button>
                <button
                  className={`toggle-option ${type === 'expense' ? 'active expense' : ''}`}
                  type="button"
                  onClick={() => setType('expense')}
                >
                  خرچ • Expense
                </button>
              </div>
            </div>

            <div className={styles.voiceHero}>
              <div className={styles.micCircle}>🎙️</div>
              <h2 className="headline-sm text-center mt-6">
                آواز سے لین دین درج کریں
              </h2>
              <p className="body-md text-muted text-center mt-2">
                Record transactions by speaking in Urdu
              </p>
            </div>

            {error && (
              <div className="badge badge-danger mb-4" style={{ padding: 'var(--space-3) var(--space-4)', width: '100%', justifyContent: 'center' }}>
                ⚠️ {error}
              </div>
            )}

            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
              ) : (
                <>شروع کریں | Start Session</>
              )}
            </button>
          </div>
        )}

        {(step === 'listening' || step === 'processing') && (
          <div className="animate-fade-in">
            {/* Chat messages */}
            <div className={styles.chatArea}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`${styles.chatBubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                  <span className={styles.chatText}>{msg.text}</span>
                </div>
              ))}

              {step === 'processing' && (
                <div className={`${styles.chatBubble} ${styles.assistantBubble}`}>
                  <div className="flex items-center gap-2">
                    <span className="spinner" style={{ width: '1rem', height: '1rem' }} />
                    <span className="body-sm text-muted">Processing...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Extracted items */}
            {extractedItems.length > 0 && (
              <div className="section">
                <div className="glass-card">
                  <h3 className="title-sm mb-3">📋 تفصیلات • Details</h3>
                  {extractedItems.map((item, i) => (
                    <div key={i} className="flex justify-between items-center" style={{ padding: 'var(--space-3) 0' }}>
                      <span className="body-md">{item.item_name || item.description}</span>
                      <span className="number-md text-secondary">{formatCurrency(item.amount || item.price)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center mt-4" style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--glass-border)' }}>
                    <span className="title-sm">کل • Total</span>
                    <span className="number-lg text-secondary">
                      {formatCurrency(extractedItems.reduce((s, it) => s + (it.amount || it.price || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Audio playback */}
            {audioUrl && (
              <div className="section">
                <audio controls src={audioUrl} autoPlay style={{ width: '100%', height: '2.5rem', borderRadius: 'var(--radius-lg)', filter: 'invert(1) hue-rotate(180deg) brightness(0.8)' }}>
                  Your browser does not support audio.
                </audio>
              </div>
            )}

            {/* Recording controls */}
            <div className={styles.recordingArea}>
              <button
                className={`${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
              >
                {isRecording ? '⏹️' : '🎤'}
              </button>
              <span className="body-sm text-muted">
                {isRecording ? 'سن رہا ہوں... • Listening...' : 'بولنے کے لیے دبائیں • Tap to speak'}
              </span>
            </div>

            {/* Text fallback */}
            <div className={styles.textInputArea}>
              <input
                type="text"
                className="input-field"
                placeholder="یا ٹائپ کریں... • Or type here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendText()}
                disabled={loading}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={sendText}
                disabled={loading || !textInput.trim()}
              >
                ↗
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="animate-scale-in" style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-4)' }}>✅</div>
            <h2 className="headline-md text-primary mb-2">محفوظ ہو گیا!</h2>
            <p className="body-lg text-muted mb-6">Voice entry saved successfully</p>
            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={() => router.push('/dashboard')}
            >
              ہوم پر واپس جائیں | Go Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
