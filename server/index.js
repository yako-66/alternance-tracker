const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { getDb, query, run, save } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// App mono-utilisateur — toutes les requêtes utilisent user_id=1
function auth(req, res, next) {
  req.user = { userId: 1 };
  next();
}

// ── Routes publiques ──
const LANDING_ORIGIN = 'https://yako-66.github.io';

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ai: !!process.env.GROQ_API_KEY, ts: Date.now() });
});

app.options('/api/waitlist', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', LANDING_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});
app.post('/api/waitlist', async (req, res) => {
  await getDb();
  res.setHeader('Access-Control-Allow-Origin', LANDING_ORIGIN);
  const { name, email, profile } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  try {
    run('INSERT OR IGNORE INTO waitlist (name,email,profile,created_at) VALUES (?,?,?,?)',
      [name||'', email.toLowerCase().trim(), profile||'', new Date().toISOString()]);
    const count = query('SELECT COUNT(*) as c FROM waitlist')[0].c;
    res.json({ success: true, count });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/waitlist', async (req, res) => {
  await getDb();
  const rows = query('SELECT name,email,profile,created_at FROM waitlist ORDER BY id DESC', []);
  res.json({ count: rows.length, entries: rows });
});

app.get('/api/public/:token', async (req, res) => {
  await getDb();
  const row = query('SELECT * FROM shares WHERE token=?', [req.params.token])[0];
  if (!row) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  const candidatures = query('SELECT * FROM candidatures WHERE user_id=? ORDER BY id DESC', [row.user_id || 1]);
  res.json({ candidatures });
});

// (DB initialisée au démarrage dans getDb() + listen)

app.get('/api/candidatures', auth, (req, res) => {
  res.json(query('SELECT * FROM candidatures WHERE user_id=? ORDER BY id DESC', [req.user.userId]));
});

app.post('/api/candidatures', auth, (req, res) => {
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation, priorite, score, date_entretien, archived, tags, salaire, secteur, taille, date_rappel } = req.body;
  const result = run(
    'INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags,salaire,secteur,taille,date_rappel,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [entreprise, poste||'', source||'', date_candidature||'', contact||'', statut||'Postulé', notes||'', localisation||'', priorite||0, score||0, date_entretien||'', archived||0, tags||'', salaire||'', secteur||'', taille||'', date_rappel||'', req.user.userId]
  );
  res.json(query('SELECT * FROM candidatures WHERE id=?', [result.lastInsertRowid])[0]);
});

app.put('/api/candidatures/:id', auth, (req, res) => {
  const cid = parseInt(req.params.id);
  const current = query('SELECT * FROM candidatures WHERE id=? AND user_id=?', [cid, req.user.userId])[0];
  if (!current) return res.status(404).json({ error: 'Candidature introuvable' });
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation, priorite, score, date_entretien, archived, tags, salaire, secteur, taille, date_rappel } = req.body;
  run(
    'UPDATE candidatures SET entreprise=?,poste=?,source=?,date_candidature=?,contact=?,statut=?,notes=?,localisation=?,priorite=?,score=?,date_entretien=?,archived=?,tags=?,salaire=?,secteur=?,taille=?,date_rappel=? WHERE id=? AND user_id=?',
    [entreprise, poste||'', source||'', date_candidature||'', contact||'', statut, notes||'', localisation||'', priorite||0, score||0, date_entretien||'', archived||0, tags||'', salaire||'', secteur||'', taille||'', date_rappel||'', cid, req.user.userId]
  );
  if (current.statut !== statut) {
    run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
      [cid, 'Changement de statut', `${current.statut} → ${statut}`, new Date().toISOString().split('T')[0]]);
  }
  res.json(query('SELECT * FROM candidatures WHERE id=?', [cid])[0]);
});

app.delete('/api/candidatures/:id', auth, (req, res) => {
  const cid = parseInt(req.params.id);
  const owned = query('SELECT id FROM candidatures WHERE id=? AND user_id=?', [cid, req.user.userId])[0];
  if (!owned) return res.status(404).json({ error: 'Candidature introuvable' });
  run('DELETE FROM echanges WHERE candidature_id=?', [cid]);
  run('DELETE FROM candidatures WHERE id=?', [cid]);
  res.json({ success: true });
});

app.get('/api/candidatures/:id/echanges', auth, (req, res) => {
  const cid = parseInt(req.params.id);
  const owned = query('SELECT id FROM candidatures WHERE id=? AND user_id=?', [cid, req.user.userId])[0];
  if (!owned) return res.status(403).json({ error: 'Accès refusé' });
  res.json(query('SELECT * FROM echanges WHERE candidature_id=? ORDER BY id DESC', [cid]));
});

app.post('/api/candidatures/:id/echanges', auth, (req, res) => {
  const cid = parseInt(req.params.id);
  const owned = query('SELECT id FROM candidatures WHERE id=? AND user_id=?', [cid, req.user.userId])[0];
  if (!owned) return res.status(403).json({ error: 'Accès refusé' });
  const { type, contenu, date } = req.body;
  const result = run(
    'INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
    [cid, type, contenu, date||new Date().toISOString().split('T')[0]]
  );
  res.json(query('SELECT * FROM echanges WHERE id=?', [result.lastInsertRowid])[0]);
});

app.delete('/api/echanges/:id', auth, (req, res) => {
  const eid = parseInt(req.params.id);
  const echange = query('SELECT e.id FROM echanges e JOIN candidatures c ON c.id=e.candidature_id WHERE e.id=? AND c.user_id=?', [eid, req.user.userId])[0];
  if (!echange) return res.status(403).json({ error: 'Accès refusé' });
  run('DELETE FROM echanges WHERE id=?', [eid]);
  res.json({ success: true });
});

app.get('/api/backup', auth, (req, res) => {
  const candidatures = query('SELECT * FROM candidatures WHERE user_id=? ORDER BY id ASC', [req.user.userId]);
  const ids = candidatures.map(c => c.id);
  const echanges = ids.length ? query(`SELECT * FROM echanges WHERE candidature_id IN (${ids.join(',')}) ORDER BY id ASC`, []) : [];
  res.json({ candidatures, echanges, exportedAt: new Date().toISOString() });
});

app.post('/api/restore', auth, (req, res) => {
  const { candidatures = [], echanges = [] } = req.body;
  run('DELETE FROM echanges WHERE candidature_id IN (SELECT id FROM candidatures WHERE user_id=?)', [req.user.userId]);
  run('DELETE FROM candidatures WHERE user_id=?', [req.user.userId]);
  for (const c of candidatures) {
    run('INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags,salaire,secteur,taille,date_rappel,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [c.entreprise, c.poste||'', c.source||'', c.date_candidature||'', c.contact||'', c.statut||'Postulé', c.notes||'', c.localisation||'', c.priorite||0, c.score||0, c.date_entretien||'', c.archived||0, c.tags||'', c.salaire||'', c.secteur||'', c.taille||'', c.date_rappel||'', req.user.userId]);
  }
  const newIds = query('SELECT id FROM candidatures WHERE user_id=? ORDER BY id ASC', [req.user.userId]).map(r => r.id);
  const oldIds = candidatures.map(c => c.id);
  for (const e of echanges) {
    const idx = oldIds.indexOf(e.candidature_id);
    const newCid = idx >= 0 && newIds[idx] ? newIds[idx] : e.candidature_id;
    run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)', [newCid, e.type, e.contenu, e.date]);
  }
  res.json({ success: true, candidatures: candidatures.length, echanges: echanges.length });
});

app.delete('/api/reset', auth, (req, res) => {
  run('DELETE FROM echanges WHERE candidature_id IN (SELECT id FROM candidatures WHERE user_id=?)', [req.user.userId]);
  run('DELETE FROM candidatures WHERE user_id=?', [req.user.userId]);
  res.json({ success: true });
});

app.get('/api/stats', auth, (req, res) => {
  const uid = req.user.userId;
  const total = query('SELECT COUNT(*) as count FROM candidatures WHERE user_id=?', [uid])[0]?.count || 0;
  const byStatut = query('SELECT statut, COUNT(*) as count FROM candidatures WHERE user_id=? GROUP BY statut', [uid]);
  const recent = query('SELECT * FROM candidatures WHERE user_id=? ORDER BY id DESC LIMIT 5', [uid]);
  res.json({ total, byStatut, recent });
});

// ── AI routes (Groq — 100% gratuit) ──
async function callAI({ system, messages, max_tokens = 1024 }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY non configuré');
  const msgs = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages,
  ];
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: msgs, max_tokens }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq ${res.status}: ${err?.error?.message || JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

app.post('/api/ai/coach', auth, async (req, res) => {
  const { messages, candidatures } = req.body;
  const ctx = (candidatures||[]).slice(0,30).map(c =>
    `- ${c.entreprise} (${c.poste||'?'}) : ${c.statut}, ${c.localisation||''}, ${c.date_candidature||''}`
  ).join('\n') || '(aucune candidature)';
  try {
    const content = await callAI({
      system: `Tu es un coach spécialisé dans la recherche d'alternance en France. Tu connais les candidatures de l'utilisateur :\n${ctx}\n\nRéponds en français, sois concis et actionnable. Max 3 paragraphes.`,
      messages: (messages||[]).slice(-10),
    });
    res.json({ content });
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/parse', auth, async (req, res) => {
  const { text } = req.body;
  try {
    const raw = await callAI({
      system: 'Tu extrais des informations structurées depuis une offre d\'emploi. Réponds UNIQUEMENT avec un JSON valide, aucun autre texte. Format : {"entreprise":"","poste":"","localisation":"","source":"","salaire":"","secteur":"","notes":""}',
      messages: [{ role: 'user', content: (text||'').slice(0, 4000) }],
      max_tokens: 512,
    });
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    res.json(json);
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/cover-letter', auth, async (req, res) => {
  const { candidature, profil } = req.body;
  try {
    const letter = await callAI({
      system: 'Tu rédiges des lettres de motivation professionnelles pour des candidatures en alternance en France. Ton style : direct, enthousiaste, personnalisé. 3 paragraphes max.',
      messages: [{ role: 'user', content: `Rédige une lettre de motivation pour ce poste :\nEntreprise : ${candidature.entreprise}\nPoste : ${candidature.poste||'alternance'}\nLocalisation : ${candidature.localisation||''}\nSecteur : ${candidature.secteur||''}\n\nProfil du candidat :\n${profil || 'Étudiant en alternance recherchant une entreprise'}` }],
      max_tokens: 1500,
    });
    res.json({ letter });
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/interview', auth, async (req, res) => {
  const { messages, candidature } = req.body;
  try {
    const content = await callAI({
      system: `Tu joues le rôle d'un recruteur RH pour le poste de "${candidature?.poste||'alternant'}" chez "${candidature?.entreprise||'notre entreprise'}". Pose des questions d'entretien réalistes, une à la fois. Donne un feedback bref puis pose la suivante. Commence par te présenter. Réponds en français.`,
      messages: (messages||[]).slice(-10),
      max_tokens: 512,
    });
    res.json({ content });
  } catch(e) { res.status(503).json({ error: e.message }); }
});

// ── Import URL ──
app.post('/api/ai/import-url', auth, async (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'URL invalide' });
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    clearTimeout(timeout);
    let text = await r.text();
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
    const raw = await callAI({
      system: 'Tu extrais des informations structurées depuis une page web d\'offre d\'emploi. Réponds UNIQUEMENT avec un JSON valide, aucun autre texte. Format exact : {"entreprise":"","poste":"","localisation":"","source":"","salaire":"","secteur":"","notes":""}',
      messages: [{ role: 'user', content: text }],
      max_tokens: 512,
    });
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    res.json(json);
  } catch(e) {
    res.status(503).json({ error: e.message.includes('aborted') ? 'Site inaccessible (timeout)' : e.message });
  }
});

// ── Share routes ──
app.post('/api/share', auth, (req, res) => {
  let row = query('SELECT token FROM shares WHERE user_id=? LIMIT 1', [req.user.userId])[0];
  if (!row) {
    const token = crypto.randomBytes(16).toString('hex');
    run('INSERT INTO shares (token,created_at,user_id) VALUES (?,?,?)', [token, new Date().toISOString(), req.user.userId]);
    row = { token };
  }
  res.json({ token: row.token });
});

app.delete('/api/share', auth, (req, res) => {
  run('DELETE FROM shares WHERE user_id=?', [req.user.userId]);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Initialise la DB au démarrage (pas à la 1ère requête) pour éviter le délai cold-start
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur sur http://localhost:${PORT}`);

    // Auto-ping toutes les 10 min pour empêcher Render free tier de s'endormir
    const selfUrl = process.env.RENDER_EXTERNAL_URL;
    if (selfUrl) {
      setInterval(() => {
        fetch(`${selfUrl}/api/ping`).catch(() => {});
      }, 10 * 60 * 1000);
      console.log(`🏓 Keep-alive activé → ${selfUrl}/api/ping`);
    }
  });
}).catch(err => {
  console.error('❌ Erreur initialisation DB:', err);
  process.exit(1);
});
