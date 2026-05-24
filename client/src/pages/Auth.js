import React, { useState } from 'react';
import { api } from '../hooks/api';
import './Auth.css';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState(
    window.location.search.includes('register') ? 'register' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post(`/api/${mode}`, { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_email', data.email);
      onAuth(data.email);
    } catch(err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">⚡</div>
        <h1 className="auth-title">AlternanceTracker</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Connecte-toi à ton espace' : 'Crée ton compte gratuit'}
        </p>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>
            Connexion
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>
            Inscription
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '6 caractères minimum' : '••••••••'}
              required
              minLength={6}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>Pas encore de compte ? <button onClick={() => { setMode('register'); setError(''); }}>S'inscrire</button></>
          ) : (
            <>Déjà un compte ? <button onClick={() => { setMode('login'); setError(''); }}>Se connecter</button></>
          )}
        </p>
      </div>
    </div>
  );
}
