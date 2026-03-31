'use client';

import { useEffect, useState, useMemo } from 'react';
import { listTransactions } from '@/lib/api';
import { DEFAULT_USER_ID, formatCurrency, getCategoryInfo, formatDate } from '@/lib/constants';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import styles from './page.module.css';

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week'); // today, week, month

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const data = await listTransactions(DEFAULT_USER_ID);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const now = new Date();
    let filtered = transactions;
    
    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      filtered = transactions.filter(t => t.transaction_date === todayStr);
    } else if (period === 'week') {
      const weekAgo = new Date(now - 7 * 86400000);
      filtered = transactions.filter(t => new Date(t.transaction_date) >= weekAgo);
    } else {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      filtered = transactions.filter(t => new Date(t.transaction_date) >= monthAgo);
    }

    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const profit = income - expense;
    const totalTx = filtered.length;
    
    // Category breakdown
    const categoryMap = {};
    filtered.forEach(t => {
      const catId = getCategoryInfo(t.category).id;
      if (!categoryMap[catId]) categoryMap[catId] = { income: 0, expense: 0, count: 0 };
      categoryMap[catId][t.type] += t.amount || 0;
      categoryMap[catId].count++;
    });

    const categories = Object.entries(categoryMap)
      .map(([id, data]) => ({
        ...getCategoryInfo(id),
        ...data,
        total: data.income + data.expense,
      }))
      .sort((a, b) => b.total - a.total);

    // Daily breakdown (last 7 days)
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      const dayTx = transactions.filter(t => t.transaction_date === dateStr);
      dailyData.push({
        date: dateStr,
        label: date.toLocaleDateString('en-PK', { weekday: 'short' }),
        income: dayTx.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0),
        expense: dayTx.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0),
      });
    }

    return { income, expense, profit, totalTx, categories, dailyData, filteredCount: filtered.length };
  }, [transactions, period]);

  const maxBarValue = Math.max(...stats.dailyData.map(d => Math.max(d.income, d.expense)), 1);

  return (
    <div className="page-scroll">
      <header className="page-header">
        <div className="page-header-title">
          <h1 className="headline-sm">Analytics</h1>
          <span className="body-sm text-muted">Business insights & trends</span>
        </div>
      </header>

      <main className="page-content">
        {/* Period selector */}
        <div className="section">
          <div className="toggle-switch">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
            ].map(p => (
              <button
                key={p.id}
                className={`toggle-option ${period === p.id ? 'active' : ''}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: '5rem' }} />
            ))}
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <section className="section stagger-children">
              <div className={`glass-card ${styles.profitCard}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="stat-label">Net Profit</span>
                    <div className={`number-hero ${stats.profit >= 0 ? 'text-primary' : 'text-tertiary'}`}>
                      {formatCurrency(stats.profit)}
                    </div>
                  </div>
                  <span className={`badge ${stats.profit >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.875rem', padding: 'var(--space-2) var(--space-4)' }}>
                    {stats.profit >= 0 ? '📈' : '📉'} {stats.income > 0 ? Math.round((stats.profit / stats.income) * 100) : 0}%
                  </span>
                </div>
              </div>

              <div className="summary-cards mt-4">
                <div className="summary-card income">
                  <span className="stat-label">Total Income</span>
                  <span className="number-lg amount-income">{formatCurrency(stats.income)}</span>
                  <span className="body-sm text-muted">{stats.filteredCount} transactions</span>
                </div>
                <div className="summary-card expense">
                  <span className="stat-label">Total Expenses</span>
                  <span className="number-lg amount-expense">{formatCurrency(stats.expense)}</span>
                </div>
              </div>
            </section>

            {/* Bar Chart */}
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Weekly Trend</h2>
              </div>
              <div className="glass-card">
                <div className={styles.barChart}>
                  {stats.dailyData.map((day, i) => (
                    <div key={i} className={styles.barGroup}>
                      <div className={styles.bars}>
                        <div
                          className={styles.barIncome}
                          style={{ height: `${(day.income / maxBarValue) * 100}%` }}
                          title={`Income: ${formatCurrency(day.income)}`}
                        />
                        <div
                          className={styles.barExpense}
                          style={{ height: `${(day.expense / maxBarValue) * 100}%` }}
                          title={`Expense: ${formatCurrency(day.expense)}`}
                        />
                      </div>
                      <span className={styles.barLabel}>{day.label}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.chartLegend}>
                  <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: 'var(--primary)' }} />
                    Income
                  </span>
                  <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: 'var(--tertiary)' }} />
                    Expense
                  </span>
                </div>
              </div>
            </section>

            {/* Category Breakdown */}
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Categories</h2>
              </div>
              <div className="flex flex-col gap-3 stagger-children">
                {stats.categories.map((cat, i) => {
                  const maxTotal = stats.categories[0]?.total || 1;
                  return (
                    <div key={cat.id || i} className="card" style={{ padding: 'var(--space-4)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <span style={{ fontSize: '1.25rem' }}>{cat.icon}</span>
                        <span className="title-sm flex-1">{cat.label}</span>
                        <span className="number-md">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${(cat.total / maxTotal) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="body-sm text-muted">{cat.count} transactions</span>
                        <span className="body-sm text-muted">
                          {Math.round((cat.total / (stats.income + stats.expense || 1)) * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {stats.categories.length === 0 && (
                  <div className="empty-state">
                    <span className="empty-state-icon">📊</span>
                    <p className="empty-state-title">No data for this period</p>
                    <p className="empty-state-text">There are no transactions in the selected period.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
