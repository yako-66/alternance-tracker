import React, { useEffect } from 'react';
import './Modal.css';

export default function Modal({ title, children, onClose, onSave, saving = false, savedOk = false, savedMsg = '' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !savedOk) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, savedOk]);

  return (
    <div className="modal-overlay" onClick={savedOk ? undefined : onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {savedOk ? (
          <div className="modal-success">
            <div className="modal-success-ring">
              <svg viewBox="0 0 80 80" className="modal-success-svg">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="#10B981" strokeWidth="6"
                  strokeDasharray="213.6" strokeDashoffset="0"
                  className="modal-success-circle"
                />
                <polyline points="24,40 35,51 56,30" fill="none" stroke="#10B981" strokeWidth="5"
                  strokeLinecap="round" strokeLinejoin="round"
                  className="modal-success-check"
                />
              </svg>
            </div>
            <div className="modal-success-title">{savedMsg || 'Enregistré !'}</div>
            <div className="modal-success-sub">Fermeture automatique…</div>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <h2 className="modal-title">{title}</h2>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>
            <div className="modal-body">{children}</div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={onClose} disabled={saving}>Annuler</button>
              <button
                className={`btn-save${saving ? ' btn-save-loading' : ''}`}
                onClick={onSave}
                disabled={saving}
              >
                {saving ? <><span className="btn-save-spinner" />Enregistrement…</> : '💾 Sauvegarder'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
