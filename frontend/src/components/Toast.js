'use client';

import { useEffect } from 'react';

export default function Toast({ message, type, show, onClose }) {
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
