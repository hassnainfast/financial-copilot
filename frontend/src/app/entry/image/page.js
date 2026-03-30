'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { scanReceiptImage, continueImageEntry, getAudioUrl } from '@/lib/api';
import { DEFAULT_USER_ID, formatCurrency } from '@/lib/constants';
import Toast from '@/components/Toast';
import styles from './page.module.css';

export default function ImageEntryPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [type, setType] = useState('expense');
  const [step, setStep] = useState('upload'); // upload, scanning, review, complete
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [items, setItems] = useState([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setPreviewUrl(URL.createObjectURL(file));
    uploadAndScan(file);
  }

  async function uploadAndScan(file) {
    setLoading(true);
    setStep('scanning');
    setError(null);
    try {
      const result = await scanReceiptImage({ file, userId: DEFAULT_USER_ID, type });
      setSessionId(result.session_id);
      if (result.data?.items) setItems(result.data.items);
      if (result.audio_url) setAudioUrl(getAudioUrl(result.audio_url));
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('upload');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmAll() {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await continueImageEntry({
        sessionId,
        action: 'confirm_all',
      });
      if (result.audio_url) setAudioUrl(getAudioUrl(result.audio_url));
      
      // May need another step for inventory update
      if (result.is_complete) {
        setStep('complete');
        setToast({ show: true, message: 'Transaction saved successfully!', type: 'success' });
      } else if (result.next_step === 'update_inventory') {
        // Auto-continue to inventory update
        const inventoryResult = await continueImageEntry({
          sessionId: result.session_id || sessionId,
          action: 'update_inventory',
        });
        if (inventoryResult.audio_url) setAudioUrl(getAudioUrl(inventoryResult.audio_url));
        setStep('complete');
        setToast({ show: true, message: 'Transaction saved successfully!', type: 'success' });
      } else {
        setStep('complete');
        setToast({ show: true, message: 'Transaction completed!', type: 'success' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveItem(index) {
    if (!sessionId) return;
    setLoading(true);
    try {
      const result = await continueImageEntry({
        sessionId,
        action: 'remove_item',
        itemIndex: index,
      });
      if (result.data?.items) setItems(result.data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalAmount = items.reduce((s, item) => s + (item.total_price || item.amount || 0), 0);

  return (
    <div className="page-scroll">
      <Toast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(prev => ({ ...prev, show: false }))} />

      {/* Header */}
      <header className="back-header">
        <button className="back-btn" onClick={() => router.back()} aria-label="Go back">
          ←
        </button>
        <div>
          <h1 className="title-lg">تصویر سے اندراج</h1>
          <span className="body-sm text-muted">Photo Entry</span>
        </div>
      </header>

      <main className="page-content">
        {step === 'upload' && (
          <div className="animate-fade-in">
            {/* Type toggle */}
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

            {/* Upload area */}
            <div
              className={styles.uploadArea}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={styles.uploadIcon}>📷</div>
              <h3 className="title-md mt-4">رسید کی تصویر لیں</h3>
              <p className="body-sm text-muted mt-2">Take a photo or upload receipt</p>
              <div className={styles.uploadHint}>
                <span className="badge badge-info">JPG, PNG supported</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="image-file-input"
            />

            {error && (
              <div className="badge badge-danger mt-4" style={{ padding: 'var(--space-3) var(--space-4)', width: '100%', justifyContent: 'center' }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

        {step === 'scanning' && (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
            {previewUrl && (
              <div className={styles.scanningPreview}>
                <img src={previewUrl} alt="Receipt" className={styles.receiptImage} />
                <div className={styles.scanLine} />
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className="spinner" />
              <span className="body-lg">اسکین کر رہا ہوں... • Scanning receipt...</span>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="animate-slide-up">
            {/* Receipt preview */}
            {previewUrl && (
              <div className="section">
                <div className={styles.reviewPreview}>
                  <img src={previewUrl} alt="Receipt" className={styles.receiptThumb} />
                </div>
              </div>
            )}

            {/* Extracted items */}
            <div className="section">
              <div className="section-header">
                <h2 className="section-title">نکالے گئے آئٹمز • Extracted Items</h2>
                <span className="badge badge-success">{items.length} items</span>
              </div>

              <div className="flex flex-col gap-3">
                {items.map((item, i) => (
                  <div key={i} className="glass-card" style={{ padding: 'var(--space-4)' }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="title-sm">{item.item_name || item.description}</div>
                        <div className="body-sm text-muted mt-1">
                          {item.quantity} {item.unit} × {formatCurrency(item.price_per_unit || item.price)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="number-md text-secondary">
                          {formatCurrency(item.total_price || item.amount)}
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRemoveItem(i)}
                          style={{ color: 'var(--tertiary)', padding: 'var(--space-1)' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="section">
              <div className="glass-card">
                <div className="flex justify-between items-center">
                  <span className="title-md">کل رقم • Total</span>
                  <span className="number-lg text-secondary">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Audio */}
            {audioUrl && (
              <div className="section">
                <audio controls src={audioUrl} autoPlay style={{ width: '100%', height: '2.5rem', borderRadius: 'var(--radius-lg)', filter: 'invert(1) hue-rotate(180deg) brightness(0.8)' }}>
                  Your browser does not support audio.
                </audio>
              </div>
            )}

            {error && (
              <div className="badge badge-danger mb-4" style={{ padding: 'var(--space-3) var(--space-4)', width: '100%', justifyContent: 'center' }}>
                ⚠️ {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setStep('upload');
                  setPreviewUrl(null);
                  setItems([]);
                }}
              >
                🔄 دوبارہ اسکین
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleConfirmAll}
                disabled={loading || items.length === 0}
              >
                {loading ? (
                  <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
                ) : (
                  <>✓ تصدیق اور محفوظ</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="animate-scale-in" style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-4)' }}>✅</div>
            <h2 className="headline-md text-primary mb-2">محفوظ ہو گیا!</h2>
            <p className="body-lg text-muted mb-6">Receipt items saved & inventory updated</p>
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
