const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { getDb, query, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// App mono-utilisateur — userId fixe = 1 (Yakup)
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
  res.setHeader('Access-Control-Allow-Origin', LANDING_ORIGIN);
  const { name, email, profile } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  try {
    await run('INSERT OR IGNORE INTO waitlist (name,email,profile,created_at) VALUES (?,?,?,?)',
      [name || '', email.toLowerCase().trim(), profile || '', new Date().toISOString()]);
    const rows = await query('SELECT COUNT(*) as c FROM waitlist');
    res.json({ success: true, count: rows[0].c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/waitlist', async (req, res) => {
  try {
    const rows = await query('SELECT name,email,profile,created_at FROM waitlist ORDER BY id DESC');
    res.json({ count: rows.length, entries: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/public/:token', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM shares WHERE token=?', [req.params.token]);
    if (!rows[0]) return res.status(404).json({ error: 'Lien invalide ou expiré' });
    const candidatures = await query('SELECT * FROM candidatures WHERE user_id=? ORDER BY id DESC', [rows[0].user_id || 1]);
    res.json({ candidatures });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Candidatures ──

app.get('/api/candidatures', auth, async (req, res) => {
  try {
    res.json(await query('SELECT * FROM candidatures WHERE user_id=? ORDER BY id DESC', [req.user.userId]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/candidatures', auth, async (req, res) => {
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation,
    priorite, score, date_entretien, archived, tags, salaire, secteur, taille, date_rappel } = req.body;
  try {
    const result = await run(
      'INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags,salaire,secteur,taille,date_rappel,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [entreprise, poste || '', source || '', date_candidature || '', contact || '',
       statut || 'Postulé', notes || '', localisation || '', priorite || 0, score || 0,
       date_entretien || '', archived || 0, tags || '', salaire || '', secteur || '',
       taille || '', date_rappel || '', req.user.userId]
    );
    const rows = await query('SELECT * FROM candidatures WHERE id=?', [result.lastInsertRowid]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/candidatures/:id', auth, async (req, res) => {
  const cid = parseInt(req.params.id);
  try {
    const current = (await query('SELECT * FROM candidatures WHERE id=? AND user_id=?', [cid, req.user.userId]))[0];
    if (!current) return res.status(404).json({ error: 'Candidature introuvable' });
    const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation,
      priorite, score, date_entretien, archived, tags, salaire, secteur, taille, date_rappel } = req.body;
    await run(
      'UPDATE candidatures SET entreprise=?,poste=?,source=?,date_candidature=?,contact=?,statut=?,notes=?,localisation=?,priorite=?,score=?,date_entretien=?,archived=?,tags=?,salaire=?,secteur=?,taille=?,date_rappel=? WHERE id=? AND user_id=?',
      [entreprise, poste || '', source || '', date_candidature || '', contact || '', statut,
       notes || '', localisation || '', priorite || 0, score || 0, date_entretien || '',
       archived || 0, tags || '', salaire || '', secteur || '', taille || '', date_rappel || '',
       cid, req.user.userId]
    );
    if (current.statut !== statut) {
      await run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
        [cid, 'Changement de statut', `${current.statut} → ${statut}`, new Date().toISOString().split('T')[0]]);
    }
    const rows = await query('SELECT * FROM candidatures WHERE id=?', [cid]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/candidatures/:id', auth, async (req, res) => {
  const cid = parseInt(req.params.id);
  try {
    const owned = (await query('SELECT id FROM candidatures WHERE id=? AND user_id=?', [cid, req.user.userId]))[0];
    if (!owned) return res.status(404).json({ error: 'Candidature introuvable' });
    await run('DELETE FROM echanges WHERE candidature_id=?', [cid]);
    await run('DELETE FROM candidatures WHERE id=?', [cid]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Échanges ──

app.get('/api/candidatures/:id/echanges', auth, async (req, res) => {
  const cid = parseInt(req.params.id);
  try {
    const owned = (await query('SELECT id FROM candidatures WHERE id=? AND user_id=?', [cid, req.user.userId]))[0];
    if (!owned) return res.status(403).json({ error: 'Accès refusé' });
    res.json(await query('SELECT * FROM echanges WHERE candidature_id=? ORDER BY id DESC', [cid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/candidatures/:id/echanges', auth, async (req, res) => {
  const cid = parseInt(req.params.id);
  try {
    const owned = (await query('SELECT id FROM candidatures WHERE id=? AND user_id=?', [cid, req.user.userId]))[0];
    if (!owned) return res.status(403).json({ error: 'Accès refusé' });
    const { type, contenu, date } = req.body;
    const result = await run(
      'INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
      [cid, type, contenu, date || new Date().toISOString().split('T')[0]]
    );
    const rows = await query('SELECT * FROM echanges WHERE id=?', [result.lastInsertRowid]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/echanges/:id', auth, async (req, res) => {
  const eid = parseInt(req.params.id);
  try {
    const echange = (await query(
      'SELECT e.id FROM echanges e JOIN candidatures c ON c.id=e.candidature_id WHERE e.id=? AND c.user_id=?',
      [eid, req.user.userId]
    ))[0];
    if (!echange) return res.status(403).json({ error: 'Accès refusé' });
    await run('DELETE FROM echanges WHERE id=?', [eid]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Backup / Restore ──

app.get('/api/backup', auth, async (req, res) => {
  try {
    const candidatures = await query('SELECT * FROM candidatures WHERE user_id=? ORDER BY id ASC', [req.user.userId]);
    const ids = candidatures.map(c => c.id);
    let echanges = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      echanges = await query(`SELECT * FROM echanges WHERE candidature_id IN (${placeholders}) ORDER BY id ASC`, ids);
    }
    res.json({ candidatures, echanges, exportedAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/restore', auth, async (req, res) => {
  const { candidatures = [], echanges = [] } = req.body;
  try {
    const existing = await query('SELECT id FROM candidatures WHERE user_id=?', [req.user.userId]);
    if (existing.length) {
      const ids = existing.map(c => c.id);
      const ph = ids.map(() => '?').join(',');
      await run(`DELETE FROM echanges WHERE candidature_id IN (${ph})`, ids);
    }
    await run('DELETE FROM candidatures WHERE user_id=?', [req.user.userId]);
    for (const c of candidatures) {
      await run(
        'INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags,salaire,secteur,taille,date_rappel,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [c.entreprise, c.poste || '', c.source || '', c.date_candidature || '', c.contact || '',
         c.statut || 'Postulé', c.notes || '', c.localisation || '', c.priorite || 0, c.score || 0,
         c.date_entretien || '', c.archived || 0, c.tags || '', c.salaire || '', c.secteur || '',
         c.taille || '', c.date_rappel || '', req.user.userId]
      );
    }
    const newRows = await query('SELECT id FROM candidatures WHERE user_id=? ORDER BY id ASC', [req.user.userId]);
    const newIds = newRows.map(r => r.id);
    const oldIds = candidatures.map(c => c.id);
    for (const e of echanges) {
      const idx = oldIds.indexOf(e.candidature_id);
      const newCid = idx >= 0 && newIds[idx] ? newIds[idx] : e.candidature_id;
      await run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
        [newCid, e.type, e.contenu, e.date]);
    }
    res.json({ success: true, candidatures: candidatures.length, echanges: echanges.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reset', auth, async (req, res) => {
  try {
    const existing = await query('SELECT id FROM candidatures WHERE user_id=?', [req.user.userId]);
    if (existing.length) {
      const ids = existing.map(c => c.id);
      const ph = ids.map(() => '?').join(',');
      await run(`DELETE FROM echanges WHERE candidature_id IN (${ph})`, ids);
    }
    await run('DELETE FROM candidatures WHERE user_id=?', [req.user.userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stats ──

app.get('/api/stats', auth, async (req, res) => {
  try {
    const uid = req.user.userId;
    const totalRows = await query('SELECT COUNT(*) as count FROM candidatures WHERE user_id=?', [uid]);
    const byStatut = await query('SELECT statut, COUNT(*) as count FROM candidatures WHERE user_id=? GROUP BY statut', [uid]);
    const recent = await query('SELECT * FROM candidatures WHERE user_id=? ORDER BY id DESC LIMIT 5', [uid]);
    res.json({ total: Number(totalRows[0].count), byStatut, recent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AI (Groq) ──

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
  const ctx = (candidatures || []).slice(0, 30).map(c =>
    `- ${c.entreprise} (${c.poste || '?'}) : ${c.statut}, ${c.localisation || ''}, ${c.date_candidature || ''}`
  ).join('\n') || '(aucune candidature)';
  try {
    const content = await callAI({
      system: `Tu es un coach spécialisé dans la recherche d'alternance en France. Tu connais les candidatures de l'utilisateur :\n${ctx}\n\nRéponds en français, sois concis et actionnable. Max 3 paragraphes.`,
      messages: (messages || []).slice(-10),
    });
    res.json({ content });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/parse', auth, async (req, res) => {
  const { text } = req.body;
  try {
    const raw = await callAI({
      system: 'Tu extrais des informations structurées depuis une offre d\'emploi. Réponds UNIQUEMENT avec un JSON valide, aucun autre texte. Format : {"entreprise":"","poste":"","localisation":"","source":"","salaire":"","secteur":"","notes":""}',
      messages: [{ role: 'user', content: (text || '').slice(0, 4000) }],
      max_tokens: 512,
    });
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    res.json(json);
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/cover-letter', auth, async (req, res) => {
  const { candidature, profil } = req.body;
  try {
    const letter = await callAI({
      system: 'Tu rédiges des lettres de motivation professionnelles pour des candidatures en alternance en France. Ton style : direct, enthousiaste, personnalisé. 3 paragraphes max.',
      messages: [{ role: 'user', content: `Rédige une lettre de motivation pour ce poste :\nEntreprise : ${candidature.entreprise}\nPoste : ${candidature.poste || 'alternance'}\nLocalisation : ${candidature.localisation || ''}\nSecteur : ${candidature.secteur || ''}\n\nProfil du candidat :\n${profil || 'Étudiant en alternance recherchant une entreprise'}` }],
      max_tokens: 1500,
    });
    res.json({ letter });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/interview', auth, async (req, res) => {
  const { messages, candidature } = req.body;
  try {
    const content = await callAI({
      system: `Tu joues le rôle d'un recruteur RH pour le poste de "${candidature?.poste || 'alternant'}" chez "${candidature?.entreprise || 'notre entreprise'}". Pose des questions d'entretien réalistes, une à la fois. Donne un feedback bref puis pose la suivante. Commence par te présenter. Réponds en français.`,
      messages: (messages || []).slice(-10),
      max_tokens: 512,
    });
    res.json({ content });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

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
  } catch (e) {
    res.status(503).json({ error: e.message.includes('aborted') ? 'Site inaccessible (timeout)' : e.message });
  }
});

// ── Partage ──

app.post('/api/share', auth, async (req, res) => {
  try {
    const rows = await query('SELECT token FROM shares WHERE user_id=? LIMIT 1', [req.user.userId]);
    if (rows[0]) return res.json({ token: rows[0].token });
    const token = crypto.randomBytes(16).toString('hex');
    await run('INSERT INTO shares (token,created_at,user_id) VALUES (?,?,?)',
      [token, new Date().toISOString(), req.user.userId]);
    res.json({ token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/share', auth, async (req, res) => {
  try {
    await run('DELETE FROM shares WHERE user_id=?', [req.user.userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SPA fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Initialise la DB puis démarre le serveur
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur sur http://localhost:${PORT}`);

    // Auto-ping toutes les 10 min pour empêcher Render free tier de s'endormir
    const selfUrl = process.env.RENDER_EXTERNAL_URL;
    if (selfUrl) {
      setInterval(() => fetch(`${selfUrl}/api/ping`).catch(() => {}), 10 * 60 * 1000);
      console.log(`🏓 Keep-alive activé → ${selfUrl}/api/ping`);
    }
  });
}).catch(err => {
  console.error('❌ Erreur initialisation DB:', err);
  process.exit(1);
});
