'use client';

import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/constants';
import styles from './page.module.css';

export default function GoalsPage() {
  const router = useRouter();

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header-wrapper">
        <header className="page-header">
          <div className="page-header-title">
            <h1 className="title-lg">Financial Goals & Milestones</h1>
            <span className="body-sm text-muted">Track your progress and achievements</span>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="page-content page-scroll pb-24">
        {/* Strategic Goals Grid */}
        <section className={styles.goalsGrid}>
          {/* Strategy Card 1 */}
          <div className={styles.strategyCard}>
            <div className={styles.strategyCardHeader}>
              <div className={`${styles.strategyIcon} ${styles.iconSave}`}>
                📈
              </div>
              <h2 className={styles.strategyTitle}>Save Maximize Strategy</h2>
            </div>
            <p className="body-sm text-muted">Automatically allocate 20% of profits towards future inventory purchases.</p>
          </div>

          {/* Strategy Card 2 */}
          <div className={styles.strategyCard}>
            <div className={styles.strategyCardHeader}>
              <div className={`${styles.strategyIcon} ${styles.iconLimit}`}>
                🛡️
              </div>
              <h2 className={styles.strategyTitle}>Limit Spending Threshold</h2>
            </div>
            <p className="body-sm text-muted">Keep dynamic operational expenses below ₹15,000 to maintain liquidity.</p>
          </div>

          {/* Strategy Card 3 */}
          <div className={styles.strategyCard}>
            <div className={styles.strategyCardHeader}>
              <div className={`${styles.strategyIcon} ${styles.iconProfit}`}>
                🎯
              </div>
              <h2 className={styles.strategyTitle}>Profit Target Milestone</h2>
            </div>
            <p className="body-sm text-muted">Achieve an overall profit margin of 35% across key inventory categories.</p>
          </div>
        </section>

        {/* Active Progress */}
        <section>
          <h2 className={styles.sectionTitle}>Active Progress</h2>
          <div className={styles.progressList}>
            
            {/* Progress 1 */}
            <div className={styles.progressCard}>
              <div className={styles.progressInfo}>
                <span className={styles.progressName}>Inventory Stock Expansion</span>
                <span className={styles.progressAmount}>{formatCurrency(125000)} / {formatCurrency(250000)}</span>
              </div>
              <div className={styles.progressBarContainer}>
                <div className={styles.progressBar} style={{ width: '50%' }}></div>
              </div>
              <div className={styles.progressMeta}>
                <span>50% Completed</span>
                <span>2 Months Remaining</span>
              </div>
            </div>

            {/* Progress 2 */}
            <div className={styles.progressCard}>
              <div className={styles.progressInfo}>
                <span className={styles.progressName}>Shop Operational Expenses</span>
                <span className={styles.progressAmount}>{formatCurrency(8500)} / {formatCurrency(15000)}</span>
              </div>
              <div className={styles.progressBarContainer}>
                <div className={styles.progressBar} style={{ width: '56%', background: 'linear-gradient(135deg, var(--tertiary), #ef4444)' }}></div>
              </div>
              <div className={styles.progressMeta}>
                <span>56% Utilized</span>
                <span className="text-tertiary">Monitor spending closely</span>
              </div>
            </div>

          </div>
        </section>

        {/* Completed Achievements */}
        <section>
          <h2 className={styles.sectionTitle}>Completed Achievements</h2>
          <div className={styles.achievementsList}>
            
            {/* Achievement 1 */}
            <div className={styles.achievementCard}>
              <div className={styles.achievementDetails}>
                <span className={styles.achievementTitle}>Electricity Bill Savings</span>
                <span className={styles.achievementDate}>June 2023</span>
              </div>
              <div className={styles.achievementRight}>
                <span className="number-sm">{formatCurrency(12000)}</span>
                <span className={styles.achievementMeta}>Target Met</span>
              </div>
            </div>

            {/* Achievement 2 */}
            <div className={styles.achievementCard}>
              <div className={styles.achievementDetails}>
                <span className={styles.achievementTitle}>New Bike Installment</span>
                <span className={styles.achievementDate}>May 2023</span>
              </div>
              <div className={styles.achievementRight}>
                <span className="number-sm">{formatCurrency(85000)}</span>
                <span className={styles.achievementMeta}>Target Met</span>
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}
