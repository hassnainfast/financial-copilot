'use client';

import { useState, useEffect, useCallback } from 'react';
import { healthCheck } from '@/lib/api';
import styles from './page.module.css';

function Toast({ message, type, show, onClose }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);
  if (!show) return null;
  return (
    <div className={`toast ${type} show`}>
      {type === 'success' && '✅'}
      {type === 'error' && '❌'}
      {type === 'warning' && '⚠️'}
      <span>{message}</span>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    checkBackend();
    loadSettings();
    // Sync dark mode state with DOM
    const saved = localStorage.getItem('hisaab-theme') || 'dark';
    setDarkMode(saved === 'dark');
  }, []);

  function loadSettings() {
    try {
      const saved = localStorage.getItem('hisaab-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.notifications !== undefined) setNotifications(parsed.notifications);
        if (parsed.shopName) setShopName(parsed.shopName);
        if (parsed.ownerName) setOwnerName(parsed.ownerName);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  function saveSettings(updates) {
    try {
      const current = { notifications, shopName, ownerName, ...updates };
      localStorage.setItem('hisaab-settings', JSON.stringify(current));
      showToastMsg('Settings saved', 'success');
    } catch (e) {
      showToastMsg('Failed to save', 'error');
    }
  }

  function showToastMsg(message, type = 'success') {
    setToast({ show: true, message, type });
  }

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }));
  }, []);

  async function checkBackend() {
    try {
      setBackendStatus('checking');
      await healthCheck();
      setBackendStatus('connected');
    } catch {
      setBackendStatus('disconnected');
    }
  }

  function handleNotificationsToggle() {
    const next = !notifications;
    setNotifications(next);
    saveSettings({ notifications: next });
  }

  function handleDarkModeToggle() {
    const next = !darkMode;
    setDarkMode(next);
    const theme = next ? 'dark' : 'light';
    localStorage.setItem('hisaab-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    showToastMsg(`Switched to ${theme} mode`, 'success');
  }

  function openShopNameModal() {
    setEditValue(shopName);
    setActiveModal('shop');
  }

  function saveShopName() {
    setShopName(editValue);
    saveSettings({ shopName: editValue });
    setActiveModal(null);
  }

  function openOwnerNameModal() {
    setEditValue(ownerName);
    setActiveModal('owner');
  }

  function saveOwnerName() {
    setOwnerName(editValue);
    saveSettings({ ownerName: editValue });
    setActiveModal(null);
  }

  function handleExport() {
    try {
      const data = localStorage.getItem('hisaab-settings');
      const blob = new Blob([JSON.stringify({
        settings: data ? JSON.parse(data) : {},
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hisaab-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToastMsg('Settings exported successfully', 'success');
    } catch (e) {
      showToastMsg('Export failed', 'error');
    }
  }

  function handleClearData() {
    setShowConfirmClear(true);
  }

  function confirmClearData() {
    try {
      localStorage.removeItem('hisaab-settings');
      setNotifications(true);
      setDarkMode(true);
      setShopName('');
      setOwnerName('');
      localStorage.setItem('hisaab-theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      setShowConfirmClear(false);
      showToastMsg('All settings cleared', 'success');
    } catch (e) {
      showToastMsg('Failed to clear data', 'error');
    }
  }

  const settingsSections = [
    {
      title: 'Appearance',
      icon: '🎨',
      items: [
        {
          icon: darkMode ? '🌙' : '☀️',
          title: 'Dark Mode',
          subtitle: darkMode ? 'Dark theme enabled' : 'Light theme enabled',
          action: handleDarkModeToggle,
          hasToggle: true,
          toggleValue: darkMode,
        },
        {
          icon: '🔔',
          title: 'Notifications',
          subtitle: notifications ? 'Enabled' : 'Disabled',
          action: handleNotificationsToggle,
          hasToggle: true,
          toggleValue: notifications,
        },
      ],
    },
    {
      title: 'Business Info',
      icon: '🏢',
      items: [
        {
          icon: '🏪',
          title: 'Shop Name',
          subtitle: shopName || 'Click to set',
          action: openShopNameModal,
        },
        {
          icon: '👤',
          title: 'Owner Name',
          subtitle: ownerName || 'Click to set',
          action: openOwnerNameModal,
        },
      ],
    },
    {
      title: 'Data & Backup',
      icon: '💾',
      items: [
        {
          icon: '📤',
          title: 'Export Settings',
          subtitle: 'Download settings as JSON',
          action: handleExport,
        },
        {
          icon: '🗑️',
          title: 'Clear Settings',
          subtitle: 'Reset all settings to defaults',
          action: handleClearData,
          danger: true,
        },
      ],
    },
  ];

  return (
    <div className="page-scroll">
      <Toast message={toast.message} type={toast.type} show={toast.show} onClose={hideToast} />

      <header className="page-header">
        <div className="page-header-title">
          <h1 className="headline-sm">Settings</h1>
          <span className="body-sm text-muted">Manage your preferences</span>
        </div>
      </header>

      <main className="page-content">
        {/* Backend Status */}
        <section className="section">
          <div className="glass-card">
            <div className="flex items-center gap-3">
              <div className={`${styles.statusDot} ${styles[backendStatus]}`} />
              <div className="flex-1">
                <span className="title-sm">Server Connection</span>
                <div className="body-sm text-muted mt-1">
                  {backendStatus === 'connected' && '✅ Connected to backend (localhost:8000)'}
                  {backendStatus === 'disconnected' && '❌ Backend not reachable'}
                  {backendStatus === 'checking' && '⏳ Checking connection...'}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={checkBackend}>
                🔄 Retry
              </button>
            </div>
          </div>
        </section>

        {/* Settings Sections */}
        {settingsSections.map((section, si) => (
          <section key={si} className="section">
            <div className="section-header">
              <h2 className="section-title">{section.icon} {section.title}</h2>
            </div>
            <div className="flex flex-col gap-2">
              {section.items.map((item, ii) => (
                <button
                  key={ii}
                  className={`${styles.settingItem} ${item.danger ? styles.danger : ''}`}
                  onClick={item.action}
                >
                  <span className={styles.settingIcon}>{item.icon}</span>
                  <div className="flex-1" style={{ textAlign: 'left' }}>
                    <div className={styles.settingTitle}>{item.title}</div>
                    <div className={styles.settingSubtitle}>{item.subtitle}</div>
                  </div>
                  {item.hasToggle ? (
                    <div className={`${styles.toggleSwitch} ${item.toggleValue ? styles.toggleOn : ''}`}>
                      <div className={styles.toggleThumb} />
                    </div>
                  ) : (
                    <span className={styles.settingArrow}>›</span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="section" style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
          <p className="body-sm text-muted">Hisaab v1.0.0</p>
          <p className="label-sm text-muted mt-1">AI-Powered Financial Copilot</p>
        </section>
      </main>

      {/* Shop Name Modal */}
      <Modal open={activeModal === 'shop'} onClose={() => setActiveModal(null)} title="🏪 Shop Name">
        <div className="modal-body">
          <div className="input-group">
            <label className="input-label">Enter your shop name</label>
            <input type="text" className="input-field" placeholder="e.g., Ali General Store" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveShopName}>Save</button>
        </div>
      </Modal>

      {/* Owner Name Modal */}
      <Modal open={activeModal === 'owner'} onClose={() => setActiveModal(null)} title="👤 Owner Name">
        <div className="modal-body">
          <div className="input-group">
            <label className="input-label">Enter your name</label>
            <input type="text" className="input-field" placeholder="e.g., Ali Ahmed" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveOwnerName}>Save</button>
        </div>
      </Modal>

      {/* Confirm Clear Dialog */}
      <Modal open={showConfirmClear} onClose={() => setShowConfirmClear(false)} title="⚠️ Clear All Settings?">
        <div className="modal-body">
          <p className="body-lg" style={{ color: 'var(--on-surface-variant)' }}>
            This will reset all your settings to defaults. Shop name, owner name, and preferences will be cleared.
          </p>
          <p className="body-md mt-4" style={{ color: 'var(--tertiary)' }}>This action cannot be undone.</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowConfirmClear(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={confirmClearData}>🗑️ Clear All</button>
        </div>
      </Modal>
    </div>
  );
}
