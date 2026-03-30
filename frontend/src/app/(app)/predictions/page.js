'use client';

import { useEffect, useState } from 'react';
import { listTransactions } from '@/lib/api';
import { DEFAULT_USER_ID, formatCurrency } from '@/lib/constants';
import styles from './page.module.css';

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPredictions();
  }, []);

  async function loadPredictions() {
    try {
      setLoading(true);
      // Fetch historical data to generate simple predictions
      // In a real app, this would call a dedicated ML endpoint
      const data = await listTransactions(DEFAULT_USER_ID);
      const txs = data.transactions || [];
      
      // Generate some dummy predictions based on real data
      const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0) || 50000;
      const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0) || 30000;

      const predictedNextMonthIncome = totalIncome * 1.15;
      const predictedNextMonthExpense = totalExpense * 1.05;

      // Mock data for the chart (next 6 months)
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
      const trendData = months.map((m, i) => {
        const factor = 1 + (i * 0.05);
        return {
          month: m,
          income: Math.round(totalIncome * factor),
          expense: Math.round(totalExpense * (factor * 0.8))
        };
      });

      setPredictions({
        nextMonth: {
          income: predictedNextMonthIncome,
          expense: predictedNextMonthExpense,
          profit: predictedNextMonthIncome - predictedNextMonthExpense,
        },
        insights: [
          { type: 'positive', title: 'Income Expected to Grow', text: 'Based on your recent trends, income is projected to increase by 15% next month.' },
          { type: 'warning', title: 'Watch Inventory Costs', text: 'Expense growth is slowing down, but inventory restocks might cause a spike in May.' },
          { type: 'neutral', title: 'Stable Cash Flow', text: 'Your cash flow remains stable. Consider reinvesting 10% of profit to expand stock.' }
        ],
        trendData
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-scroll">
      <header className="page-header">
        <div className="page-header-title">
          <h1 className="headline-sm">🔮 AI Predictions</h1>
          <span className="body-sm text-muted">Forecasts & Business Insights</span>
        </div>
      </header>

      <main className="page-content">
        {loading || !predictions ? (
          <div className="flex flex-col gap-4">
            <div className="skeleton" style={{ height: '8rem' }} />
            <div className="skeleton" style={{ height: '16rem' }} />
            <div className="skeleton" style={{ height: '10rem' }} />
          </div>
        ) : (
          <>
            {/* Forecast Summary */}
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Next Month's Forecast</h2>
              </div>
              <div className="quick-actions-grid">
                <div className="glass-card flex flex-col items-center text-center gap-2">
                  <div className={styles.iconCircle} style={{ background: 'rgba(104, 219, 169, 0.15)', color: 'var(--primary)' }}>💰</div>
                  <span className="title-sm text-muted">Expected Income</span>
                  <span className="number-lg text-primary">{formatCurrency(predictions.nextMonth.income)}</span>
                </div>
                <div className="glass-card flex flex-col items-center text-center gap-2">
                  <div className={styles.iconCircle} style={{ background: 'rgba(255, 179, 173, 0.15)', color: 'var(--tertiary)' }}>📉</div>
                  <span className="title-sm text-muted">Expected Expenses</span>
                  <span className="number-lg text-tertiary">{formatCurrency(predictions.nextMonth.expense)}</span>
                </div>
                <div className="glass-card flex flex-col items-center text-center gap-2" style={{ gridColumn: 'span 2' }}>
                  <div className={styles.iconCircle} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>📈</div>
                  <span className="title-sm text-muted">Projected Profit</span>
                  <span className="number-hero" style={{ color: '#3b82f6' }}>{formatCurrency(predictions.nextMonth.profit)}</span>
                </div>
              </div>
            </section>

            {/* AI Insights */}
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Business Insights</h2>
              </div>
              <div className="flex flex-col gap-3 stagger-children">
                {predictions.insights.map((insight, i) => (
                  <div key={i} className={`glass-card ${styles.insightCard} ${styles[insight.type]}`}>
                    <div className={styles.insightIcon}>
                      {insight.type === 'positive' && '🌟'}
                      {insight.type === 'warning' && '⚠️'}
                      {insight.type === 'neutral' && '💡'}
                    </div>
                    <div>
                      <h3 className="title-sm mb-1">{insight.title}</h3>
                      <p className="body-sm text-muted">{insight.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Trend Chart (Visual Mock) */}
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">6-Month Projection</h2>
              </div>
              <div className="glass-card">
                <div className={styles.chartContainer}>
                  {predictions.trendData.map((data, i) => {
                    const maxVal = Math.max(...predictions.trendData.map(d => Math.max(d.income, d.expense))) * 1.1;
                    const heightIncome = (data.income / maxVal) * 100;
                    const heightExpense = (data.expense / maxVal) * 100;
                    return (
                      <div key={i} className={styles.barWrapper}>
                        <div className={styles.bars}>
                          <div className={styles.barIncome} style={{ height: `${heightIncome}%` }} title={formatCurrency(data.income)} />
                          <div className={styles.barExpense} style={{ height: `${heightExpense}%` }} title={formatCurrency(data.expense)} />
                        </div>
                        <span className="label-sm text-muted mt-2">{data.month}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center gap-4 mt-4 pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <span className="body-sm text-muted flex items-center gap-2">
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--primary)' }} /> Income
                  </span>
                  <span className="body-sm text-muted flex items-center gap-2">
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--tertiary)' }} /> Expenses
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
