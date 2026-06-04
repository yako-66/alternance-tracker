import React, { useState } from 'react';
import './Settings.css';

function get(k, def = '') { return localStorage.getItem(k) || def; }
function set(k, v) { localStorage.setItem(k, v); }

export default function Settings() {
  const [name,      setName]      = useState(get('user_name', 'Yakup'));
  const [formation, setFormation] = useState(get('user_formation', 'Mastère Infra & Cloud Xpert'));
  const [city,      setCity]      = useState(get('user_city', 'Lyon, Saint-Étienne'));
  const [saved,     setSaved]     = useState(false);
  const [accentColor, setAccentColor] = useState(get('accent_color', '#7C3AED'));
  const [toast,     setToast]     = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const saveProfile = () => {
    set('user_name', name);
    set('user_formation', formation);
    set('user_city', city);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const applyAccent = (color) => {
    setAccentColor(color);
    set('accent_color', color);
    document.documentElement.style.setProperty('--purple', color);
    showToast('🎨 Couleur appliquée !');
  };

  const resetAccent = () => {
    const def = '#7C3AED';
    setAccentColor(def);
    localStorage.removeItem('accent_color');
    document.documentElement.style.removeProperty('--purple');
    showToast('🎨 Couleur réinitialisée');
  };

  return (
    <div className="settings-page">
      <h1 className="page-title">⚙️ Paramètres</h1>

      <div className="settings-grid">
        {/* PROFIL */}
        <div className="settings-card">
          <h2 className="settings-section-title">👤 Mon profil</h2>
          <div className="settings-form">
            <div className="form-group">
              <label>Prénom</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ton prénom" />
            </div>
            <div className="form-group">
              <label>Formation</label>
              <input value={formation} onChange={e => setFormation(e.target.value)} placeholder="Ex: Mastère Infra & Cloud Xpert" />
            </div>
            <div className="form-group">
              <label>Villes de recherche</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: Lyon, Saint-Étienne" />
            </div>
            <button className={`btn-settings-save ${saved ? 'saved' : ''}`} onClick={saveProfile}>
              {saved ? '✅ Enregistré !' : '💾 Sauvegarder'}
            </button>
          </div>
        </div>

        {/* THÈME */}
        <div className="settings-card">
          <h2 className="settings-section-title">🎨 Thème couleur</h2>
          <div className="settings-actions">
            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Couleur d'accent</div>
                <div className="settings-action-desc">Personnalise la couleur principale de l'interface.</div>
              </div>
              <div className="color-picker-wrap">
                <input type="color" className="color-input" value={accentColor} onChange={e => applyAccent(e.target.value)} />
                <button className="btn-settings-action" onClick={resetAccent}>↩ Réinit.</button>
              </div>
            </div>
            <div className="color-presets">
              {['#7C3AED','#2563EB','#059669','#DC2626','#D97706','#DB2777','#0891B2'].map(c => (
                <button key={c} className={`color-preset ${accentColor === c ? 'active' : ''}`}
                  style={{ background: c }} onClick={() => applyAccent(c)} title={c} />
              ))}
            </div>
          </div>
        </div>

        {/* RACCOURCIS */}
        <div className="settings-card">
          <h2 className="settings-section-title">⌨️ Raccourcis</h2>
          <div className="shortcuts-grid">
            {[
              ['Ctrl+K', 'Recherche globale'],
              ['N', 'Nouvelle candidature (page Candidatures)'],
              ['/', 'Focus barre de recherche'],
              ['Échap', 'Fermer la recherche'],
            ].map(([key, desc]) => (
              <div className="shortcut-row" key={key}>
                <kbd className="kbd">{key}</kbd>
                <span className="shortcut-desc">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && <div className="settings-toast">{toast}</div>}
    </div>
  );
}
