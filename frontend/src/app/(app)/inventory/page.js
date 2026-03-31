'use client';

import { useEffect, useState } from 'react';
import { listInventory, deleteInventoryItem } from '@/lib/api';
import { DEFAULT_USER_ID, formatCurrency } from '@/lib/constants';
import { Package, AlertCircle, RefreshCw, Trash2, Search } from 'lucide-react';
import styles from './page.module.css';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    try {
      setLoading(true);
      const data = await listInventory(DEFAULT_USER_ID);
      setItems(data.inventory || []);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteInventoryItem({ itemId, userId: DEFAULT_USER_ID });
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredItems = items.filter(item =>
    item.item_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalItems = items.length;
  // Prevent negative quantities from creating a negative inventory value
  const totalValue = items.reduce((s, i) => {
    const qty = Number(i.quantity || 0);
    return s + ((i.price_per_unit || 0) * (qty > 0 ? qty : 0));
  }, 0);
  const lowStockCount = items.filter(i => (i.quantity || 0) <= 5 && (i.quantity || 0) > 0).length;
  const outOfStockCount = items.filter(i => (i.quantity || 0) <= 0).length;

  function getStockStatus(item) {
    const qty = item.quantity || 0;
    if (qty < 0) return { label: 'Oversold / Deficit', badge: 'badge-danger' };
    if (qty === 0) return { label: 'Out of Stock', badge: 'badge-danger' };
    if (qty <= 5) return { label: 'Low Stock', badge: 'badge-warning' };
    return { label: 'In Stock', badge: 'badge-success' };
  }

  return (
    <div className="page-scroll">
      <header className="page-header">
        <div className="page-header-title">
          <h1 className="headline-sm">Inventory</h1>
          <span className="body-sm text-muted">Manage your stock</span>
        </div>
        <button className="header-icon-btn" onClick={loadInventory} aria-label="Refresh">
          <RefreshCw size={20} />
        </button>
      </header>

      <main className="page-content">
        {/* Stats */}
        <section className="section">
          <div className={styles.statsGrid}>
            <div className="stat-card">
              <span className="stat-label">TOTAL ITEMS</span>
              <span className="stat-value">{totalItems}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">TOTAL VALUE</span>
              <span className="stat-value">{formatCurrency(totalValue, true)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">LOW STOCK</span>
              <span className="stat-value" style={{ color: 'var(--secondary)' }}>{lowStockCount}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">OUT OF STOCK</span>
              <span className="stat-value" style={{ color: 'var(--tertiary)' }}>{outOfStockCount}</span>
            </div>
          </div>
        </section>

        {/* Search */}
        <section className="section">
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="inventory-search"
            />
          </div>
        </section>

        {/* Items */}
        <section className="section">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: '5rem' }} />
              ))}
            </div>
          ) : error ? (
            <div className={styles.errorCard}>
              <AlertCircle size={32} style={{margin: '0 auto 8px'}} />
              <p>Could not load inventory</p>
              <p className="body-sm text-muted">{error}</p>
              <button className="btn btn-outline btn-sm mt-4" onClick={loadInventory}>Retry</button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <Package size={48} className="empty-state-icon" />
              <p className="empty-state-title">
                {searchQuery ? 'No items found' : 'Inventory is empty'}
              </p>
              <p className="empty-state-text">
                {searchQuery ? 'Try adjusting your search criteria' : 'Add items via transactions to manage stock'}
              </p>
            </div>
          ) : (
            <div className={`${styles.inventoryGrid} stagger-children`}>
              {filteredItems.map((item) => {
                const status = getStockStatus(item);
                return (
                  <div key={item.id} className="glass-card" style={{ padding: 'var(--space-4)' }}>
                    <div className="flex items-center gap-3">
                      <div className={styles.itemIcon}><Package size={24} /></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="title-sm">{item.item_name}</span>
                          <span className={`badge ${status.badge}`}>{status.label}</span>
                        </div>
                        <div className="flex justify-between mt-2">
                          <span className="body-sm text-muted">
                            {item.quantity} {item.unit || 'pcs'}
                          </span>
                          <span className="number-md">
                            {formatCurrency(item.price_per_unit || 0)}/{item.unit || 'pc'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3 gap-2">
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--tertiary)' }}
                        onClick={() => handleDelete(item.id)}
                      >
                        🗑️ Delete
                      </button>
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
