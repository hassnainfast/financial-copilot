'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

export default function SplashPage() {
  const router = useRouter();
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimationPhase(1), 100);
    const t2 = setTimeout(() => setAnimationPhase(2), 600);
    const t3 = setTimeout(() => setAnimationPhase(3), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className={styles.splashContainer}>
      {/* Background glow effects */}
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />

      {/* Logo area */}
      <div className={`${styles.logoArea} ${animationPhase >= 1 ? styles.visible : ''}`}>
        <div className={styles.logoCircle}>
          <span className={styles.logoIcon}>📒</span>
        </div>
      </div>

      {/* Brand text */}
      <div className={`${styles.brandArea} ${animationPhase >= 2 ? styles.visible : ''}`}>
        <h1 className={styles.brandUrdu}>حساب</h1>
        <h2 className={styles.brandEnglish}>Hisaab</h2>
        <p className={styles.taglineUrdu}>آپ کے کاروبار کا ذہین ساتھی</p>
        <p className={styles.taglineEnglish}>Your business&apos;s intelligent companion</p>
      </div>

      {/* Features preview */}
      <div className={`${styles.features} ${animationPhase >= 3 ? styles.visible : ''}`}>
        <div className={styles.featureChip}>
          <span>🎙️</span>
          <span>آواز سے اندراج</span>
        </div>
        <div className={styles.featureChip}>
          <span>📷</span>
          <span>تصویر سے اندراج</span>
        </div>
        <div className={styles.featureChip}>
          <span>✏️</span>
          <span>دستی اندراج</span>
        </div>
      </div>

      {/* CTA Button */}
      <div className={`${styles.ctaArea} ${animationPhase >= 3 ? styles.visible : ''}`}>
        <button
          className={`btn btn-primary btn-lg btn-full ${styles.ctaBtn}`}
          id="get-started-btn"
          onClick={() => router.push('/dashboard')}
        >
          <span className={styles.ctaBtnUrdu}>شروع کریں</span>
          <span className={styles.ctaBtnDivider}>|</span>
          <span>Get Started</span>
        </button>
      </div>
    </div>
  );
}
