'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { listTransactions } from '@/lib/api';
import { DEFAULT_USER_ID, formatCurrency, getCategoryInfo, formatDate } from '@/lib/constants';
import { ArrowUp, ArrowDown, FileText, Image, Mic } from 'lucide-react';
import styles from './page.module.css';

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransaction();
  }, [params.id]);

  async function loadTransaction() {
    try {
      setLoading(true);
      const data = await listTransactions(DEFAULT_USER_ID);
      const tx = (data.transactions || []).find(t => String(t.id) === String(params.id));
      setTransaction(tx || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-scroll">
        <header className="back-header">
          <button className="back-btn" onClick={() => router.back()}>←</button>
          <div><h1 className="title-lg">Loading...</h1></div>
        </header>
        <main className="page-content">
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: '3rem' }} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="page-scroll">
        <header className="back-header">
          <button className="back-btn" onClick={() => router.back()}>←</button>
          <div><h1 className="title-lg">Not Found</h1></div>
        </header>
        <main className="page-content">
          <div className="empty-state">
            <span className="empty-state-icon">🔍</span>
            <p className="empty-state-title">Transaction not found</p>
            <p className="empty-state-text">لین دین نہیں ملا</p>
            <button className="btn btn-primary mt-6" onClick={() => router.push('/dashboard')}>
              Go Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  const cat = getCategoryInfo(transaction.category);
  const isIncome = transaction.type === 'income';

  return (
    <div className="page-scroll">
      <header className="back-header">
        <button className="back-btn" onClick={() => router.back()} aria-label="Go back">
          ←
        </button>
        <div>
          <h1 className="title-lg">لین دین کی تفصیل</h1>
          <span className="body-sm text-muted">Transaction Details</span>
        </div>
      </header>

      <main className="page-content animate-fade-in">
        {/* Amount Hero */}
        <section className={styles.amountHero}>
          <span className={`badge ${isIncome ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.875rem', padding: 'var(--space-2) var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isIncome ? (
              <>
                <ArrowUp size={16} />
                آمدنی Income
              </>
            ) : (
              <>
                <ArrowDown size={16} />
                خرچ Expense
              </>
            )}
          </span>
          <div className={`number-hero ${isIncome ? 'amount-income' : 'amount-expense'} ${styles.heroAmount}`}>
            {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
          </div>
          <span className="body-sm text-muted">{formatDate(transaction.transaction_date)}</span>
        </section>

        {/* Details Card */}
        <section className="section">
          <div className="glass-card">
            <h3 className="title-sm mb-4 text-muted">تفصیلات • Details</h3>
            
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>زمرہ • Category</span>
              <div className="flex items-center gap-2">
                <span>{cat.icon}</span>
                <span className={styles.detailValue}>{cat.label}</span>
              </div>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>گاہک • Customer</span>
              <span className={styles.detailValue}>{transaction.customer_name || 'Cash Customer'}</span>
            </div>

            {transaction.description && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>تفصیل • Description</span>
                <span className={styles.detailValue}>{transaction.description}</span>
              </div>
            )}

            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>ذریعہ • Source</span>
              <span className={`badge badge-info`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}>
                {transaction.source === 'manual' && (
                  <>
                    <FileText size={16} />
                    Manual
                  </>
                )}
                {transaction.source === 'image' && (
                  <>
                    <Image size={16} />
                    Image
                  </>
                )}
                {transaction.source === 'audio' && (
                  <>
                    <Mic size={16} />
                    Voice
                  </>
                )}
                {!transaction.source && (
                  <>📋 Other</>
                )}
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>تاریخ • Date</span>
              <span className={styles.detailValue}>{formatDate(transaction.transaction_date)}</span>
            </div>

            {transaction.created_at && (
              <div className={styles.detailRow} style={{ borderBottom: 'none' }}>
                <span className={styles.detailLabel}>درج کیا گیا • Recorded</span>
                <span className={styles.detailValue}>{formatDate(transaction.created_at)}</span>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
