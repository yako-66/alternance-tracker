import React from 'react';
import './Modal.css';

export default function Modal({ title, children, onClose, onSave, saving = false, savedOk = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Annuler</button>
          <button
            className={`btn-save${savedOk ? ' btn-save-ok' : ''}`}
            onClick={onSave}
            disabled={saving || savedOk}
          >
            {saving ? '⏳ Enregistrement…' : savedOk ? '✅ Enregistré !' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}
