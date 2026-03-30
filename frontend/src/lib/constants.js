/**
 * App Constants
 */

// Default user ID (no auth in current backend)
export const DEFAULT_USER_ID = 'user_01';

// Transaction Types
export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
};

// Categories
export const CATEGORIES = [
  { id: 'groceries', label: 'Groceries', urdu: 'گروسری', icon: '🛒' },
  { id: 'electronics', label: 'Electronics', urdu: 'الیکٹرانکس', icon: '📱' },
  { id: 'clothing', label: 'Clothing', urdu: 'کپڑے', icon: '👕' },
  { id: 'food', label: 'Food', urdu: 'کھانا', icon: '🍽️' },
  { id: 'transport', label: 'Transport', urdu: 'ٹرانسپورٹ', icon: '🚗' },
  { id: 'utilities', label: 'Utilities', urdu: 'یوٹیلیٹیز', icon: '💡' },
  { id: 'rent', label: 'Rent', urdu: 'کرایہ', icon: '🏠' },
  { id: 'salary', label: 'Salary', urdu: 'تنخواہ', icon: '💰' },
  { id: 'sales', label: 'Sales', urdu: 'فروخت', icon: '🏪' },
  { id: 'other', label: 'Other', urdu: 'دیگر', icon: '📋' },
];

// Navigation Items  
export const NAV_ITEMS = [
  { id: 'home', href: '/dashboard', icon: '🏠', label: 'Home', urdu: 'ہوم' },
  { id: 'analytics', href: '/analytics', icon: '📊', label: 'Analytics', urdu: 'تجزیہ' },
  { id: 'add', href: null, icon: '+', label: 'Add', urdu: 'شامل' }, // FAB
  { id: 'inventory', href: '/inventory', icon: '📦', label: 'Inventory', urdu: 'اسٹاک' },
  { id: 'settings', href: '/settings', icon: '⚙️', label: 'Settings', urdu: 'ترتیبات' },
];

// Format currency
export function formatCurrency(amount, compact = false) {
  const num = Number(amount);
  if (isNaN(num)) return 'Rs 0';
  
  if (compact && Math.abs(num) >= 1000000) {
    return `Rs ${(num / 1000000).toFixed(1)}M`;
  }
  if (compact && Math.abs(num) >= 1000) {
    return `Rs ${(num / 1000).toFixed(1)}K`;
  }
  
  return `Rs ${num.toLocaleString('en-PK')}`;
}

// Format date
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Format time relative
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateStr);
}

// Get category info
export function getCategoryInfo(categoryId) {
  return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
}
