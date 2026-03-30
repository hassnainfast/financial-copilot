/**
 * API Client for Financial Copilot Backend
 * Base URL: http://localhost:8000/api
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';
const STATIC_BASE = process.env.NEXT_PUBLIC_STATIC_BASE || 'http://localhost:8000';

// ==========================================
// Helper Functions
// ==========================================

function buildFormData(fields) {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      fd.append(key, value);
    }
  });
  return fd;
}

async function handleResponse(res) {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ==========================================
// Transaction APIs
// ==========================================

/**
 * List all transactions for a user
 */
export async function listTransactions(userId) {
  const res = await fetch(`${API_BASE}/transactions/list?user_id=${encodeURIComponent(userId)}`);
  return handleResponse(res);
}

// ==========================================
// Manual Entry APIs
// ==========================================

/**
 * Start manual transaction entry
 */
export async function startManualEntry({ userId, amount, type, category, customerName, description, transactionDate, itemName, quantity }) {
  const fd = buildFormData({
    user_id: userId,
    amount,
    type,
    category,
    customer_name: customerName,
    description,
    transaction_date: transactionDate,
    item_name: itemName,
    quantity: quantity,
  });

  const res = await fetch(`${API_BASE}/transactions/manual/start`, {
    method: 'POST',
    body: fd,
  });
  return handleResponse(res);
}

/**
 * Continue manual entry workflow (edit/confirm)
 */
export async function continueManualEntry({ sessionId, action, corrections }) {
  const fd = buildFormData({
    session_id: sessionId,
    action,
    corrections: corrections ? JSON.stringify(corrections) : undefined,
  });

  const res = await fetch(`${API_BASE}/transactions/manual/continue`, {
    method: 'POST',
    body: fd,
  });
  return handleResponse(res);
}

// ==========================================
// Image Entry APIs
// ==========================================

/**
 * Scan a receipt image
 */
export async function scanReceiptImage({ file, userId, type }) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('user_id', userId);
  fd.append('type', type);

  const res = await fetch(`${API_BASE}/transactions/image/scan`, {
    method: 'POST',
    body: fd,
  });
  return handleResponse(res);
}

/**
 * Continue image entry workflow (edit/confirm items)
 */
export async function continueImageEntry({ sessionId, action, itemIndex, corrections, confirm }) {
  const fd = buildFormData({
    session_id: sessionId,
    action,
    item_index: itemIndex,
    corrections: corrections ? JSON.stringify(corrections) : undefined,
    confirm,
  });

  const res = await fetch(`${API_BASE}/transactions/image/continue`, {
    method: 'POST',
    body: fd,
  });
  return handleResponse(res);
}

// ==========================================
// Audio Entry APIs
// ==========================================

/**
 * Start audio data entry session
 */
export async function startAudioEntry({ userId, type }) {
  const fd = buildFormData({
    user_id: userId,
    type,
  });

  const res = await fetch(`${API_BASE}/transactions/audio/start`, {
    method: 'POST',
    body: fd,
  });
  return handleResponse(res);
}

/**
 * Continue audio entry session
 */
export async function continueAudioEntry({ sessionId, audioFile, userText }) {
  const fd = new FormData();
  fd.append('session_id', sessionId);
  if (audioFile) {
    fd.append('audio_file', audioFile);
  }
  if (userText) {
    fd.append('user_text', userText);
  }

  const res = await fetch(`${API_BASE}/transactions/audio/continue`, {
    method: 'POST',
    body: fd,
  });
  return handleResponse(res);
}

// ==========================================
// Inventory APIs
// ==========================================

/**
 * List inventory for a user
 */
export async function listInventory(userId) {
  const res = await fetch(`${API_BASE}/inventory/list?user_id=${encodeURIComponent(userId)}`);
  return handleResponse(res);
}

/**
 * Get a specific inventory item
 */
export async function getInventoryItem(userId, itemName) {
  const res = await fetch(
    `${API_BASE}/inventory/item?user_id=${encodeURIComponent(userId)}&item_name=${encodeURIComponent(itemName)}`
  );
  return handleResponse(res);
}

/**
 * Update an inventory item
 */
export async function updateInventoryItem({ itemId, userId, updates }) {
  const fd = buildFormData({
    user_id: userId,
    updates: JSON.stringify(updates),
  });

  const res = await fetch(`${API_BASE}/inventory/item/${itemId}`, {
    method: 'PUT',
    body: fd,
  });
  return handleResponse(res);
}

/**
 * Delete an inventory item
 */
export async function deleteInventoryItem({ itemId, userId }) {
  const fd = buildFormData({ user_id: userId });

  const res = await fetch(`${API_BASE}/inventory/item/${itemId}`, {
    method: 'DELETE',
    body: fd,
  });
  return handleResponse(res);
}

// ==========================================
// Audio URL Helper
// ==========================================

/**
 * Convert a relative audio path to full URL
 */
export function getAudioUrl(relativePath) {
  if (!relativePath) return null;
  if (relativePath.startsWith('http')) return relativePath;
  return `${STATIC_BASE}/${relativePath.replace(/^\//, '')}`;
}

// ==========================================
// Health Check
// ==========================================

export async function healthCheck() {
  const res = await fetch(`${STATIC_BASE}/health`);
  return handleResponse(res);
}
