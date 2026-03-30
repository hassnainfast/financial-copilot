'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'analytics', href: '/analytics', icon: '📊', label: 'Analytics' },
  { id: 'inventory', href: '/inventory', icon: '📦', label: 'Inventory' },
  { id: 'chatbot', href: '/chatbot', icon: '🤖', label: 'AI Chat' },
  { id: 'predictions', href: '/predictions', icon: '🔮', label: 'Predictions' },
  { id: 'goals', href: '/goals', icon: '🎯', label: 'Goals' },
  { id: 'settings', href: '/settings', icon: '⚙️', label: 'Settings' },
];

const ADD_OPTIONS = [
  { id: 'voice', label: 'Voice Entry', icon: '🎙️', href: '/entry/voice', color: '#68dba9' },
  { id: 'image', label: 'Photo Entry', icon: '📷', href: '/entry/image', color: '#3b82f6' },
  { id: 'manual', label: 'Manual Entry', icon: '✏️', href: '/entry/manual', color: '#a855f7' },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('hisaab-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('hisaab-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  return (
    <nav className="top-nav" id="top-navigation">
      {/* Left: Brand */}
      <div className="top-nav-brand" onClick={() => router.push('/dashboard')}>
        <span className="top-nav-brand-icon">📒</span>
        <span className="top-nav-brand-text">Hisaab</span>
      </div>

      {/* Center: Nav items */}
      <div className="top-nav-center">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <button
              key={item.id}
              className={`top-nav-item ${isActive ? 'active' : ''}`}
              id={`nav-${item.id}`}
              onClick={() => router.push(item.href)}
              title={item.label}
            >
              <span className="top-nav-icon">{item.icon}</span>
              <span className="top-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="top-nav-actions">
        {/* Add Entry Dropdown */}
        <div className="top-nav-add-wrapper">
          <button
            className="top-nav-add-btn"
            id="add-entry-btn"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            <span style={{
              transform: showAddMenu ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
              display: 'inline-block',
              lineHeight: 1,
              fontSize: '1.1rem',
            }}>+</span>
            <span>New Entry</span>
          </button>

          {showAddMenu && (
            <>
              <div className="top-nav-dropdown-overlay" onClick={() => setShowAddMenu(false)} />
              <div className="top-nav-dropdown">
                {ADD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className="top-nav-dropdown-item"
                    onClick={() => {
                      setShowAddMenu(false);
                      router.push(opt.href);
                    }}
                  >
                    <span
                      className="top-nav-dropdown-icon"
                      style={{ background: `${opt.color}20`, color: opt.color }}
                    >
                      {opt.icon}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Theme toggle */}
        <button
          className="top-nav-theme-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}
