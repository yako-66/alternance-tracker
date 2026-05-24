const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { getDb, query, run, save } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// ── Auth helpers ──
function signJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch { return false; }
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' });
  const payload = verifyJWT(header.slice(7));
  if (!payload) return res.status(401).json({ error: 'Session expirée, reconnecte-toi' });
  req.user = payload;
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

app.post('/api/register', async (req, res) => {
  await getDb();
  const { email, password } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min)' });
  const existing = query('SELECT id FROM users WHERE email=?', [email.toLowerCase().trim()]);
  if (existing.length) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  const result = run('INSERT INTO users (email,password_hash) VALUES (?,?)',
    [email.toLowerCase().trim(), hashPassword(password)]);
  const token = signJWT({ userId: result.lastInsertRowid, email: email.toLowerCase().trim() });
  res.json({ token, email: email.toLowerCase().trim() });
});

app.post('/api/login', async (req, res) => {
  await getDb();
  const { email, password } = req.body;
  const user = query('SELECT * FROM users WHERE email=?', [email?.toLowerCase().trim()])[0];
  if (!user || !verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const token = signJWT({ userId: user.id, email: user.email });
  res.json({ token, email: user.email });
});

// ── Routes protégées (JWT requis) ──
app.use(async (req, res, next) => { await getDb(); next(); });

app.get('/api/me', auth, (req, res) => {
  res.json({ userId: req.user.userId, email: req.user.email });
});

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
  res.json(query('SELECT * FROM echanges WHERE candidature_id=? ORDER BY id DESC', [cid]));
});

app.post('/api/candidatures/:id/echanges', auth, (req, res) => {
  const { type, contenu, date } = req.body;
  const result = run(
    'INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
    [parseInt(req.params.id), type, contenu, date||new Date().toISOString().split('T')[0]]
  );
  res.json(query('SELECT * FROM echanges WHERE id=?', [result.lastInsertRowid])[0]);
});

app.delete('/api/echanges/:id', auth, (req, res) => {
  run('DELETE FROM echanges WHERE id=?', [parseInt(req.params.id)]);
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

app.listen(PORT, () => console.log(`🚀 Serveur sur http://localhost:${PORT}`));
