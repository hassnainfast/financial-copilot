'use client';

import { useEffect, useState, useMemo } from 'react';
import { listTransactions } from '@/lib/api';
import { DEFAULT_USER_ID, formatCurrency, getCategoryInfo } from '@/lib/constants';

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const insights = useMemo(() => {
    if (!transactions.length) return null;

    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const total = income + expense || 1;

    // Income vs Expense donut percentages
    const incomePercent = Math.round((income / total) * 100);
    const expensePercent = 100 - incomePercent;

    // Category breakdown
    const categoryMap = {};
    transactions.forEach(t => {
      const cat = getCategoryInfo(t.category);
      const key = cat.label || t.category || 'Other';
      if (!categoryMap[key]) categoryMap[key] = { amount: 0, count: 0, icon: cat.icon || '📦' };
      categoryMap[key].amount += t.amount || 0;
      categoryMap[key].count++;
    });
    const categories = Object.entries(categoryMap)
      .map(([label, d]) => ({ label, ...d }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
    const maxCat = categories[0]?.amount || 1;

    // This Week vs Last Week
    const today = new Date();
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() - today.getDay());

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const thisWeekTx = transactions.filter(t => new Date(t.transaction_date) >= startOfThisWeek);
    const lastWeekTx = transactions.filter(t => {
      const d = new Date(t.transaction_date);
      return d >= startOfLastWeek && d < startOfThisWeek;
    });

    const weekComparison = {
      thisWeek: {
        income: thisWeekTx.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0),
        expense: thisWeekTx.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0),
      },
      lastWeek: {
        income: lastWeekTx.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0),
        expense: lastWeekTx.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0),
      }
    };
    const maxWeek = Math.max(
      weekComparison.thisWeek.income, weekComparison.thisWeek.expense,
      weekComparison.lastWeek.income, weekComparison.lastWeek.expense, 1
    );

    // Top customers
    const customerMap = {};
    transactions.forEach(t => {
      const name = t.customer_name || 'Unknown';
      if (!customerMap[name]) customerMap[name] = { amount: 0, count: 0 };
      customerMap[name].amount += t.amount || 0;
      customerMap[name].count++;
    });
    const topCustomers = Object.entries(customerMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Top items (from description)
    const itemMap = {};
    transactions.forEach(t => {
      const desc = t.description || t.category || 'Unknown';
      if (!itemMap[desc]) itemMap[desc] = { count: 0, amount: 0 };
      itemMap[desc].count++;
      itemMap[desc].amount += t.amount || 0;
    });
    const topItems = Object.entries(itemMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Most active days
    const dayMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    transactions.forEach(t => {
      const day = new Date(t.transaction_date).toLocaleDateString('en-PK', { weekday: 'short' });
      if (dayMap[day] !== undefined) dayMap[day]++;
    });
    const maxDay = Math.max(...Object.values(dayMap), 1);
    const activeDays = Object.entries(dayMap).map(([day, count]) => ({ day, count }));

    return {
      income, expense, incomePercent, expensePercent,
      categories, maxCat,
      weekComparison, maxWeek,
      topCustomers, topItems, activeDays, maxDay
    };
  }, [transactions]);

  // Donut chart via SVG
  function DonutChart({ incomePercent, expensePercent, income, expense }) {
    const r = 70;
    const cx = 90;
    const cy = 90;
    const circumference = 2 * Math.PI * r;
    const incomeStroke = (incomePercent / 100) * circumference;
    const expenseStroke = (expensePercent / 100) * circumference;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="22" />
          {/* Expense arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#ff6b6b"
            strokeWidth="22"
            strokeDasharray={`${expenseStroke} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          {/* Income arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#00c896"
            strokeWidth="22"
            strokeDasharray={`${incomeStroke} ${circumference}`}
            strokeDashoffset={-expenseStroke}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
            {incomePercent}%
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11">
            Income
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#00c896', display: 'inline-block' }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Income</span>
            </div>
            <div style={{ color: '#00c896', fontSize: '1.3rem', fontWeight: 700 }}>{formatCurrency(income)}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff6b6b', display: 'inline-block' }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Expenses</span>
            </div>
            <div style={{ color: '#ff6b6b', fontSize: '1.3rem', fontWeight: 700 }}>{formatCurrency(expense)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-scroll">
        <header className="page-header">
          <div className="page-header-title">
            <h1 className="headline-sm">Analytics</h1>
            <span className="body-sm text-muted">Business insights & trends</span>
          </div>
        </header>
        <main className="page-content">
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: '10rem' }} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="page-scroll">
        <header className="page-header">
          <div className="page-header-title">
            <h1 className="headline-sm">Analytics</h1>
            <span className="body-sm text-muted">Business insights & trends</span>
          </div>
        </header>
        <main className="page-content">
          <div className="empty-state">
            <span className="empty-state-icon">📊</span>
            <p className="empty-state-title">No data yet</p>
            <p className="empty-state-text">Add some transactions to see insights.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-scroll">
      <header className="page-header">
        <div className="page-header-title">
          <h1 className="headline-sm">Analytics</h1>
          <span className="body-sm text-muted">Business insights & trends</span>
        </div>
      </header>

      <main className="page-content">

        {/* 1. Income vs Expense Donut */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Income vs Expenses</h2>
          </div>
          <div className="glass-card">
            <DonutChart
              incomePercent={insights.incomePercent}
              expensePercent={insights.expensePercent}
              income={insights.income}
              expense={insights.expense}
            />
          </div>
        </section>

        {/* 2. This Week vs Last Week */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">This Week vs Last Week</h2>
          </div>
          <div className="glass-card">
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', height: '160px', padding: '0 0.5rem' }}>
              {/* This Week */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
                <div style={{ width: '100%', display: 'flex', gap: '4px', alignItems: 'flex-end', height: '130px' }}>
                  <div style={{
                    flex: 1,
                    height: `${(insights.weekComparison.thisWeek.income / insights.maxWeek) * 100}%`,
                    background: '#00c896', borderRadius: '4px 4px 0 0',
                    minHeight: insights.weekComparison.thisWeek.income > 0 ? '4px' : '0'
                  }} title={`Income: ${formatCurrency(insights.weekComparison.thisWeek.income)}`} />
                  <div style={{
                    flex: 1,
                    height: `${(insights.weekComparison.thisWeek.expense / insights.maxWeek) * 100}%`,
                    background: '#ff6b6b', borderRadius: '4px 4px 0 0',
                    minHeight: insights.weekComparison.thisWeek.expense > 0 ? '4px' : '0'
                  }} title={`Expense: ${formatCurrency(insights.weekComparison.thisWeek.expense)}`} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 600 }}>This Week</span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                  In: {formatCurrency(insights.weekComparison.thisWeek.income)}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                  Out: {formatCurrency(insights.weekComparison.thisWeek.expense)}
                </span>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: '80%', background: 'rgba(255,255,255,0.1)', alignSelf: 'center' }} />

              {/* Last Week */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
                <div style={{ width: '100%', display: 'flex', gap: '4px', alignItems: 'flex-end', height: '130px' }}>
                  <div style={{
                    flex: 1,
                    height: `${(insights.weekComparison.lastWeek.income / insights.maxWeek) * 100}%`,
                    background: 'rgba(0,200,150,0.4)', borderRadius: '4px 4px 0 0',
                    minHeight: insights.weekComparison.lastWeek.income > 0 ? '4px' : '0'
                  }} title={`Income: ${formatCurrency(insights.weekComparison.lastWeek.income)}`} />
                  <div style={{
                    flex: 1,
                    height: `${(insights.weekComparison.lastWeek.expense / insights.maxWeek) * 100}%`,
                    background: 'rgba(255,107,107,0.4)', borderRadius: '4px 4px 0 0',
                    minHeight: insights.weekComparison.lastWeek.expense > 0 ? '4px' : '0'
                  }} title={`Expense: ${formatCurrency(insights.weekComparison.lastWeek.expense)}`} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Last Week</span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                  In: {formatCurrency(insights.weekComparison.lastWeek.income)}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                  Out: {formatCurrency(insights.weekComparison.lastWeek.expense)}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#00c896', display: 'inline-block' }} /> Income
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ff6b6b', display: 'inline-block' }} /> Expense
              </span>
            </div>
          </div>
        </section>

        {/* 3. Category Breakdown */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Spending by Category</h2>
          </div>
          <div className="flex flex-col gap-3">
            {insights.categories.map((cat, i) => (
              <div key={i} className="card" style={{ padding: 'var(--space-4)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <span style={{ fontSize: '1.25rem' }}>{cat.icon}</span>
                  <span className="title-sm flex-1">{cat.label}</span>
                  <span className="number-md">{formatCurrency(cat.amount)}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(cat.amount / insights.maxCat) * 100}%`,
                    background: 'linear-gradient(90deg, #00c896, #00a878)',
                    borderRadius: 99
                  }} />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="body-sm text-muted">{cat.count} transactions</span>
                  <span className="body-sm text-muted">{Math.round((cat.amount / (insights.income + insights.expense || 1)) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Top Customers */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Top Customers</h2>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {insights.topCustomers.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.9rem 1.25rem',
                borderBottom: i < insights.topCustomers.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `hsl(${i * 60}, 60%, 35%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem', color: 'white', flexShrink: 0
                }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>{c.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{c.count} transactions</div>
                </div>
                <div style={{ color: '#00c896', fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(c.amount)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Top Items */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Most Frequent Items</h2>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {insights.topItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.9rem 1.25rem',
                borderBottom: i < insights.topItems.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', flexShrink: 0
                }}>
                  #{i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>{item.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{item.count}x ordered</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.9rem' }}>{formatCurrency(item.amount)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Most Active Days */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Most Active Days</h2>
          </div>
          <div className="glass-card">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: '100px' }}>
              {insights.activeDays.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: `${(d.count / insights.maxDay) * 80}%`,
                    background: d.count === insights.maxDay ? '#00c896' : 'rgba(255,255,255,0.12)',
                    borderRadius: '4px 4px 0 0',
                    minHeight: d.count > 0 ? '4px' : '2px',
                    transition: 'height 0.3s ease'
                  }} title={`${d.count} transactions`} />
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}