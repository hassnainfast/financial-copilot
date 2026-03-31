'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startManualEntry, continueManualEntry, getAudioUrl, listInventory } from '@/lib/api';
import { DEFAULT_USER_ID, CATEGORIES, formatCurrency } from '@/lib/constants';
import { DollarSign, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import Toast from '@/components/Toast';
import styles from './page.module.css';

export default function ManualEntryPage() {
  const router = useRouter();
  const [step, setStep] = useState('form'); // form, preview, complete
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  // Form state
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [customerName, setCustomerName] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Inventory state
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Fetch inventory on mount
  require('react').useEffect(() => {
    async function loadInventory() {
      try {
        const res = await listInventory(DEFAULT_USER_ID);
        setInventoryItems(res.inventory || []);
      } catch (err) {
        console.error("Failed to load inventory:", err);
      }
    }
    loadInventory();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await startManualEntry({
        userId: DEFAULT_USER_ID,
        amount: Number(amount),
        type,
        category,
        customerName,
        description,
        transactionDate,
        itemName: selectedItemName || null,
        quantity: selectedItemName ? Number(quantity) : null,
      });
      setSessionId(result.session_id);
      setPreviewData(result.data);
      if (result.audio_url) setAudioUrl(getAudioUrl(result.audio_url));
      setStep('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await continueManualEntry({
        sessionId,
        action: 'confirm',
      });
      if (result.audio_url) setAudioUrl(getAudioUrl(result.audio_url));
      if (result.is_complete) {
        setStep('complete');
        setToast({ show: true, message: 'Transaction saved successfully!', type: 'success' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-scroll">
      <Toast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(prev => ({ ...prev, show: false }))} />

      {/* Header */}
      <header className="back-header">
        <button className="back-btn" onClick={() => router.back()} aria-label="Go back">
          ←
        </button>
        <div>
          <FileText size={24} className="text-primary" style={{ marginBottom: '0.25rem' }} />
          <h1 className="title-lg">دستی اندراج</h1>
          <span className="body-sm text-muted">Manual Entry</span>
        </div>
      </header>

      <main className="page-content">
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="animate-fade-in">
            {/* Income/Expense Toggle */}
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

            {/* Amount */}
            <div className="section">
              <div className="input-group">
                <label className="input-label">رقم • Amount (Rs)</label>
                <input
                  type="number"
                  className={`input-field ${styles.amountInput}`}
                  id="manual-amount-input"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="numeric"
                  min="0"
                  step="0.01"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Inventory Item Selection */}
            <div className="section">
              <div className="input-group">
                <label className="input-label">انوینٹری آئٹم • Inventory Item (Optional)</label>
                <select 
                  className="input-field" 
                  value={selectedItemName}
                  onChange={(e) => setSelectedItemName(e.target.value)}
                  style={{ appearance: 'auto' }}
                >
                  <option value="">-- None --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.item_name}>
                      {item.item_name} (Stock: {item.quantity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantity */}
            {selectedItemName && (
              <div className="section">
                <div className="input-group">
                  <label className="input-label">تعداد • Quantity</label>
                  <input
                    type="number"
                    className="input-field"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    inputMode="numeric"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
              </div>
            )}

            {/* Category */}
            <div className="section">
              <label className="input-label mb-2" style={{ display: 'block' }}>زمرہ • Category</label>
              <div className={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.categoryChip} ${category === cat.id ? styles.categoryActive : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    <span>{cat.icon}</span>
                    <span className={styles.categoryChipLabel}>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Name */}
            <div className="section">
              <div className="input-group">
                <label className="input-label">گاہک کا نام • Customer Name</label>
                <input
                  type="text"
                  className="input-field"
                  id="manual-customer-input"
                  placeholder="Cash Customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="section">
              <div className="input-group">
                <label className="input-label">تفصیل • Description</label>
                <textarea
                  className="input-field"
                  id="manual-description-input"
                  placeholder="Transaction details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Date */}
            <div className="section">
              <div className="input-group">
                <label className="input-label">تاریخ • Date</label>
                <input
                  type="date"
                  className="input-field"
                  id="manual-date-input"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="section">
                <div className="badge badge-danger" style={{ padding: 'var(--space-3) var(--space-4)', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={18} />
                  {error}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              id="manual-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
              ) : (
                <>
                  <DollarSign size={20} />
                  محفوظ کریں | Save
                </>
              )}
            </button>
          </form>
        )}

        {step === 'preview' && previewData && (
          <div className="animate-slide-up">
            <div className="glass-card mb-6">
              <h3 className="title-md mb-4">پیش نظارہ • Preview</h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <span className="text-muted">Type</span>
                  <span className={`badge ${type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                    {type === 'income' ? 'آمدنی Income' : 'خرچ Expense'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Amount</span>
                  <span className="number-md">{formatCurrency(previewData.amount || amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Category</span>
                  <span>{getCategoryInfo(previewData.category || category)?.icon} {previewData.category || category}</span>
                </div>
                {(previewData.customer_name || customerName) && (
                  <div className="flex justify-between">
                    <span className="text-muted">Customer</span>
                    <span>{previewData.customer_name || customerName}</span>
                  </div>
                )}
                {(previewData.item_name || selectedItemName) && (
                  <div className="flex justify-between">
                    <span className="text-muted">Item</span>
                    <span>{previewData.item_name || selectedItemName} (x{previewData.quantity || quantity})</span>
                  </div>
                )}
              </div>
            </div>

            {audioUrl && (
              <div className="section">
                <audio controls src={audioUrl} className={styles.audioPlayer}>
                  Your browser does not support audio.
                </audio>
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setStep('form')}
                disabled={loading}
              >
                ✏️ Edit
              </button>
              <button
                className="btn btn-primary flex-1"
                id="manual-confirm-btn"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
                ) : (
                  <>
                    <CheckCircle size={20} />
                    تصدیق Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="animate-scale-in" style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-4)' }}>
              <CheckCircle size={80} className="text-success" />
            </div>
            <h2 className="headline-md text-primary mb-2">محفوظ ہو گیا!</h2>
            <p className="body-lg text-muted mb-6">Transaction saved successfully</p>
            
            {audioUrl && (
              <div className="section">
                <audio controls src={audioUrl} className={styles.audioPlayer} autoPlay>
                  Your browser does not support audio.
                </audio>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg btn-full mt-6"
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

function getCategoryInfo(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
