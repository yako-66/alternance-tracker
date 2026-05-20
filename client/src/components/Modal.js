import React from 'react';
import './Modal.css';

export default function Modal({ title, children, onClose, onSave }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary-sm" onClick={onSave} style={{padding:'10px 24px', fontSize:'14px'}}>Sauvegarder</button>
        </div>
      </div>
    </div>
  );
}
