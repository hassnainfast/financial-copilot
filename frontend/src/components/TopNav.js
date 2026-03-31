'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Home,
  BarChart3,
  Package,
  MessageSquare,
  Zap,
  Target,
  Settings,
  Mic2,
  Camera,
  PenTool,
  Menu,
  Sun,
  Moon,
  Plus,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', href: '/dashboard', icon: Home, label: 'Dashboard' },
  { id: 'analytics', href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'inventory', href: '/inventory', icon: Package, label: 'Inventory' },
  { id: 'chatbot', href: '/chatbot', icon: MessageSquare, label: 'AI Chat' },
  { id: 'predictions', href: '/predictions', icon: Zap, label: 'Predictions' },
  { id: 'goals', href: '/goals', icon: Target, label: 'Goals' },
  { id: 'settings', href: '/settings', icon: Settings, label: 'Settings' },
];

const ADD_OPTIONS = [
  { id: 'voice', label: 'Voice Entry', icon: Mic2, href: '/entry/voice', color: '#68dba9' },
  { id: 'image', label: 'Photo Entry', icon: Camera, href: '/entry/image', color: '#3b82f6' },
  { id: 'manual', label: 'Manual Entry', icon: PenTool, href: '/entry/manual', color: '#a855f7' },
];

const TITLES = {
  dashboard: 'Business Dashboard',
  analytics: 'Financial Analytics',
  inventory: 'Inventory Control',
  chatbot: 'AI Assistant',
  predictions: 'Forecasting & Predictions',
  goals: 'Goals & Planning',
  settings: 'Workspace Settings',
};

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hisaab-theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('hisaab-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  const activeItem = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + '/'));

  const currentTitle = activeItem ? TITLES[activeItem.id] : 'Hisaab Workspace';

  function navigateTo(href) {
    setMobileOpen(false);
    router.push(href);
  }

  return (
    <>
      {mobileOpen && <div className="side-nav-mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`side-nav ${mobileOpen ? 'open' : ''}`} id="top-navigation">
        <div className="side-nav-brand" onClick={() => navigateTo('/dashboard')}>
          <span className="side-nav-brand-icon">H</span>
          <div className="side-nav-brand-text-wrap">
            <span className="side-nav-brand-title">Hisaab</span>
            <span className="side-nav-brand-subtitle">Financial Copilot</span>
          </div>
        </div>

        <div className="side-nav-section-label">Main</div>
        <div className="side-nav-list">
          {NAV_ITEMS.slice(0, 4).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <button
                key={item.id}
                className={`side-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigateTo(item.href)}
              >
                <span className="side-nav-item-icon">
                  <item.icon size={20} strokeWidth={1.8} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="side-nav-section-label" style={{ marginTop: 'var(--space-6)' }}>Workspace</div>
        <div className="side-nav-list">
          {NAV_ITEMS.slice(4).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <button
                key={item.id}
                className={`side-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigateTo(item.href)}
              >
                <span className="side-nav-item-icon">
                  <item.icon size={20} strokeWidth={1.8} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="side-nav-footer">
          <div className="side-nav-footer-title">Quick Entry</div>
          <div className="side-nav-entry-grid">
            {ADD_OPTIONS.map((opt) => (
              <button key={opt.id} className="side-nav-entry-btn" onClick={() => navigateTo(opt.href)}>
                <span className="side-nav-entry-icon" style={{ color: opt.color }}>
                  <opt.icon size={18} strokeWidth={2} />
                </span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <header className="top-nav">
        <div className="top-nav-left">
          <button
            className="top-nav-mobile-toggle"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <Menu size={24} />
          </button>
          <div className="top-nav-title-wrap">
            <div className="top-nav-title">{currentTitle}</div>
            <div className="top-nav-subtitle">Professional business workspace</div>
          </div>
        </div>

        <div className="top-nav-actions">
          <div className="top-nav-add-wrapper">
            <button className="top-nav-add-btn" id="add-entry-btn" onClick={() => setShowAddMenu(!showAddMenu)}>
              <Plus size={18} strokeWidth={2} />
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
                        navigateTo(opt.href);
                      }}
                    >
                      <span className="top-nav-dropdown-icon" style={{ background: `${opt.color}1F`, color: opt.color }}>
                        <opt.icon size={18} strokeWidth={2} />
                      </span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            className="top-nav-theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
          </button>
        </div>
      </header>
    </>
  );
}
