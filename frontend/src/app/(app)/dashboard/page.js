'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listTransactions } from '@/lib/api';
import { DEFAULT_USER_ID, formatCurrency, getCategoryInfo, formatRelativeTime } from '@/lib/constants';
import { Bell, Store, Pencil, Camera, Mic, Package, FileText } from 'lucide-react';
import styles from './page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    loadTransactions();
    // Load business info from settings
    try {
      const saved = localStorage.getItem('hisaab-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.shopName) setShopName(parsed.shopName);
        if (parsed.ownerName) setOwnerName(parsed.ownerName);
      }
    } catch (e) { /* ignore */ }
  }, []);

  async function loadTransactions() {
    try {
      setLoading(true);
      const data = await listTransactions(DEFAULT_USER_ID);
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }

  const [timeFilter, setTimeFilter] = useState('today');

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
  const monthAgoStr = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
  
  const filteredTx = transactions.filter(t => {
    if (timeFilter === 'today') return t.transaction_date === todayStr;
    if (timeFilter === 'weekly') return t.transaction_date >= weekAgo && t.transaction_date <= todayStr;
    if (timeFilter === 'monthly') return t.transaction_date >= monthAgoStr && t.transaction_date <= todayStr;
    return true;
  });

  const periodIncome = filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const periodExpense = filteredTx.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const recentTransactions = transactions.slice(0, 8);

  return (
    <div className="page-scroll">
      <header className="page-header">
        <div className="page-header-title">
          <h1 className="headline-sm">Dashboard</h1>
          <span className="body-sm text-muted">
            {shopName ? `${shopName}${ownerName ? ` • ${ownerName}` : ''}` : 'Welcome to Hisaab'}
          </span>
        </div>
        <div className="page-header-icons">
          <button className="header-icon-btn" id="notifications-btn" aria-label="Notifications">
            <Bell size={20} />
          </button>
        </div>
      </header>

      <main className="page-content">
        {/* Business Info Banner (if set) */}
        {(shopName || ownerName) && (
          <section className="section animate-fade-in">
            <div className={styles.businessBanner}>
              <div className={styles.businessIcon}><Store size={28} /></div>
              <div>
                <div className="title-md">{shopName || 'My Shop'}</div>
                {ownerName && <div className="body-sm text-muted">Owner: {ownerName}</div>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/settings')}>
                <Pencil size={16} /> Edit
              </button>
            </div>
          </section>
        )}

        {/* Summary Cards */}
        <section className="section animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h2 className="title-md">Overview</h2>
            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.875rem' }}
              value={timeFilter}
              onChange={e => setTimeFilter(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
            </select>
          </div>
          <div className="summary-cards">
            <div className={`summary-card income ${styles.summaryCard}`}>
              <span className="stat-label">Income</span>
              <span className="number-lg amount-income">{formatCurrency(periodIncome)}</span>
            </div>
            <div className={`summary-card expense ${styles.summaryCard}`}>
              <span className="stat-label">Expenses</span>
              <span className="number-lg amount-expense">{formatCurrency(periodExpense)}</span>
            </div>
          </div>
        </section>

        {/* Profit Card */}
        <section className={`section animate-fade-in ${styles.profitSection}`}>
          <div className={`glass-card ${styles.profitCard}`}>
            <div className={styles.profitHeader}>
              <span className="stat-label">Profit</span>
              <span className={`badge ${periodIncome - periodExpense >= 0 ? 'badge-success' : 'badge-danger'}`}>
                {periodIncome - periodExpense >= 0 ? '↑' : '↓'} {periodIncome + periodExpense > 0
                  ? Math.round(((periodIncome - periodExpense) / Math.max(periodIncome, 1)) * 100)
                  : 0}%
              </span>
            </div>
            <span className={`number-hero ${periodIncome - periodExpense >= 0 ? 'text-primary' : 'text-tertiary'}`}>
              {formatCurrency(periodIncome - periodExpense)}
            </span>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Quick Actions</h2>
          </div>
          <div className="quick-actions-grid stagger-children">
            <button className="quick-action" onClick={() => router.push('/entry/image')} id="quick-photo-entry">
              <span className="quick-action-icon photo"><Camera size={20} /></span>
              <div className="quick-action-text">
                <span className="title">Photo Entry</span>
              </div>
            </button>
            <button className="quick-action" onClick={() => router.push('/entry/voice')} id="quick-voice-entry">
              <span className="quick-action-icon voice"><Mic size={20} /></span>
              <div className="quick-action-text">
                <span className="title">Voice Entry</span>
              </div>
            </button>
            <button className="quick-action" onClick={() => router.push('/inventory')} id="quick-inventory">
              <span className="quick-action-icon inventory"><Package size={20} /></span>
              <div className="quick-action-text">
                <span className="title">Inventory</span>
              </div>
            </button>
            <button className="quick-action" onClick={() => router.push('/entry/manual')} id="quick-manual-entry">
              <span className="quick-action-icon manual"><FileText size={20} /></span>
              <div className="quick-action-text">
                <span className="title">Manual Entry</span>
              </div>
            </button>
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Recent Transactions</h2>
            <button className="section-action" onClick={() => router.push('/analytics')}>
              View All →
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: '3.5rem', borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          ) : error ? (
            <div className={styles.errorCard}>
              <p>⚠️ Could not load transactions</p>
              <p className="body-sm text-muted">{error}</p>
              <button className="btn btn-outline btn-sm mt-4" onClick={loadTransactions}>Retry</button>
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📋</span>
              <p className="empty-state-title">No transactions yet</p>
              <p className="empty-state-text">Start by adding a transaction via voice, photo, or manual entry.</p>
            </div>
          ) : (
            <div className="stagger-children">
              {recentTransactions.map((tx) => {
                const cat = getCategoryInfo(tx.category);
                return (
                  <div key={tx.id} className="transaction-item" onClick={() => router.push(`/transaction/${tx.id}`)}>
                    <div className="transaction-icon" style={{ background: tx.type === 'income' ? 'rgba(104, 219, 169, 0.12)' : 'rgba(255, 179, 173, 0.12)' }}>
                      {cat.icon}
                    </div>
                    <div className="transaction-info">
                      <div className="transaction-name">{tx.customer_name || tx.description || cat.label}</div>
                      <div className="transaction-category">{cat.label} • {formatRelativeTime(tx.transaction_date)}</div>
                    </div>
                    <div className={`transaction-amount ${tx.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
