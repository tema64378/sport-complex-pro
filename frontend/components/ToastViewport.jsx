import React from 'react';

const ICON_BY_TYPE = {
  info: 'fas fa-circle-info',
  success: 'fas fa-circle-check',
  warning: 'fas fa-triangle-exclamation',
  error: 'fas fa-circle-xmark',
};

export default function ToastViewport({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast-item toast-${toast.type || 'info'}`}>
          <i className={ICON_BY_TYPE[toast.type] || ICON_BY_TYPE.info} />
          <p>{toast.message}</p>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Закрыть уведомление"
          >
            <i className="fas fa-xmark" />
          </button>
        </article>
      ))}
    </div>
  );
}
