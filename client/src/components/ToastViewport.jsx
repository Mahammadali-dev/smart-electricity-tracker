import { memo, useEffect } from "react";

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4200);

    return () => window.clearTimeout(timeoutId);
  }, [toast.duration, toast.id, onDismiss]);

  return (
    <article className={`toast-item ${toast.tone || "info"}`} role="status" aria-live="polite">
      <div className="toast-copy">
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
      </div>
      <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        ×
      </button>
    </article>
  );
}

function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default memo(ToastViewport);
