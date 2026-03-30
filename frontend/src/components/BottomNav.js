'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { NAV_ITEMS } from '@/lib/constants';
import styles from './BottomNav.module.css';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addOptions = [
    { id: 'manual', label: 'Manual Entry', urdu: 'دستی اندراج', icon: '✏️', href: '/entry/manual', color: '#a855f7' },
    { id: 'voice', label: 'Voice Entry', urdu: 'آواز سے اندراج', icon: '🎙️', href: '/entry/voice', color: '#68dba9' },
    { id: 'image', label: 'Photo Entry', urdu: 'تصویر سے اندراج', icon: '📷', href: '/entry/image', color: '#3b82f6' },
  ];

  return (
    <>
      {/* Overlay for add menu */}
      {showAddMenu && (
        <div className={styles.overlay} onClick={() => setShowAddMenu(false)}>
          <div className={styles.addMenu} onClick={e => e.stopPropagation()}>
            {addOptions.map((opt, i) => (
              <button
                key={opt.id}
                className={styles.addOption}
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => {
                  setShowAddMenu(false);
                  router.push(opt.href);
                }}
              >
                <span className={styles.addOptionIcon} style={{ background: `${opt.color}20`, color: opt.color }}>
                  {opt.icon}
                </span>
                <div className={styles.addOptionText}>
                  <span className={styles.addOptionLabel}>{opt.label}</span>
                  <span className={styles.addOptionUrdu}>{opt.urdu}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="bottom-nav" id="bottom-navigation">
        {NAV_ITEMS.map((item) => {
          if (item.id === 'add') {
            return (
              <div className="nav-fab-container" key={item.id}>
                <button
                  className="fab"
                  id="add-transaction-fab"
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  aria-label="Add transaction"
                >
                  <span style={{ 
                    transform: showAddMenu ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    fontSize: '1.5rem',
                    fontWeight: 300,
                    lineHeight: 1,
                  }}>+</span>
                </button>
              </div>
            );
          }

          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              id={`nav-${item.id}`}
              onClick={() => router.push(item.href)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
