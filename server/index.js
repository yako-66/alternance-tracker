const express = require('express');
const cors = require('cors');
const path = require('path');
const basicAuth = require('express-basic-auth');
const { getDb, query, run, save } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

const APP_USER = process.env.APP_USER || 'yakup';
const APP_PASSWORD = process.env.APP_PASSWORD;

if (!APP_PASSWORD) {
  console.warn('⚠️  APP_PASSWORD non défini — authentification désactivée en local');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Route publique — accessible SANS auth
app.get('/api/public/:token', async (req, res) => {
  await getDb();
  const row = query('SELECT * FROM shares WHERE token=?', [req.params.token])[0];
  if (!row) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  const candidatures = query('SELECT * FROM candidatures ORDER BY id DESC', []);
  res.json({ candidatures });
});

if (APP_PASSWORD) {
  app.use(basicAuth({
    users: { [APP_USER]: APP_PASSWORD },
    challenge: true,
    realm: 'Alternance Tracker',
  }));
}

app.use(async (req, res, next) => { await getDb(); next(); });

app.get('/api/candidatures', (req, res) => {
  res.json(query('SELECT * FROM candidatures ORDER BY id DESC', []));
});

app.post('/api/candidatures', (req, res) => {
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation, priorite, score, date_entretien, archived, tags, salaire, secteur, taille, date_rappel } = req.body;
  const result = run(
    'INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags,salaire,secteur,taille,date_rappel) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [entreprise, poste||'', source||'', date_candidature||'', contact||'', statut||'Postulé', notes||'', localisation||'', priorite||0, score||0, date_entretien||'', archived||0, tags||'', salaire||'', secteur||'', taille||'', date_rappel||'']
  );
  res.json(query('SELECT * FROM candidatures WHERE id = ?', [result.lastInsertRowid])[0]);
});

app.put('/api/candidatures/:id', (req, res) => {
  const cid = parseInt(req.params.id);
  const current = query('SELECT * FROM candidatures WHERE id=?', [cid])[0];
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation, priorite, score, date_entretien, archived, tags, salaire, secteur, taille, date_rappel } = req.body;
  run(
    'UPDATE candidatures SET entreprise=?,poste=?,source=?,date_candidature=?,contact=?,statut=?,notes=?,localisation=?,priorite=?,score=?,date_entretien=?,archived=?,tags=?,salaire=?,secteur=?,taille=?,date_rappel=? WHERE id=?',
    [entreprise, poste||'', source||'', date_candidature||'', contact||'', statut, notes||'', localisation||'', priorite||0, score||0, date_entretien||'', archived||0, tags||'', salaire||'', secteur||'', taille||'', date_rappel||'', cid]
  );
  if (current && current.statut !== statut) {
    run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
      [cid, 'Changement de statut', `${current.statut} → ${statut}`, new Date().toISOString().split('T')[0]]
    );
  }
  res.json(query('SELECT * FROM candidatures WHERE id=?', [cid])[0]);
});

app.delete('/api/candidatures/:id', (req, res) => {
  run('DELETE FROM echanges WHERE candidature_id=?', [parseInt(req.params.id)]);
  run('DELETE FROM candidatures WHERE id=?', [parseInt(req.params.id)]);
  res.json({ success: true });
});

app.get('/api/candidatures/:id/echanges', (req, res) => {
  res.json(query('SELECT * FROM echanges WHERE candidature_id=? ORDER BY id DESC', [parseInt(req.params.id)]));
});

app.post('/api/candidatures/:id/echanges', (req, res) => {
  const { type, contenu, date } = req.body;
  const result = run(
    'INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
    [parseInt(req.params.id), type, contenu, date||new Date().toISOString().split('T')[0]]
  );
  res.json(query('SELECT * FROM echanges WHERE id=?', [result.lastInsertRowid])[0]);
});

app.delete('/api/echanges/:id', (req, res) => {
  run('DELETE FROM echanges WHERE id=?', [parseInt(req.params.id)]);
  res.json({ success: true });
});

app.get('/api/backup', (req, res) => {
  const candidatures = query('SELECT * FROM candidatures ORDER BY id ASC', []);
  const echanges = query('SELECT * FROM echanges ORDER BY id ASC', []);
  res.json({ candidatures, echanges, exportedAt: new Date().toISOString() });
});

app.post('/api/restore', (req, res) => {
  const { candidatures = [], echanges = [] } = req.body;
  run('DELETE FROM echanges', []);
  run('DELETE FROM candidatures', []);
  for (const c of candidatures) {
    run('INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags,salaire,secteur,taille,date_rappel) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [c.entreprise, c.poste||'', c.source||'', c.date_candidature||'', c.contact||'', c.statut||'Postulé', c.notes||'', c.localisation||'', c.priorite||0, c.score||0, c.date_entretien||'', c.archived||0, c.tags||'', c.salaire||'', c.secteur||'', c.taille||'', c.date_rappel||'']
    );
  }
  const newIds = query('SELECT id FROM candidatures ORDER BY id ASC', []).map(r => r.id);
  const oldIds = candidatures.map(c => c.id);
  for (const e of echanges) {
    const idx = oldIds.indexOf(e.candidature_id);
    const newCid = idx >= 0 && newIds[idx] ? newIds[idx] : e.candidature_id;
    run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
      [newCid, e.type, e.contenu, e.date]
    );
  }
  res.json({ success: true, candidatures: candidatures.length, echanges: echanges.length });
});

app.delete('/api/reset', (req, res) => {
  run('DELETE FROM echanges', []);
  run('DELETE FROM candidatures', []);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const total = query('SELECT COUNT(*) as count FROM candidatures')[0]?.count || 0;
  const byStatut = query('SELECT statut, COUNT(*) as count FROM candidatures GROUP BY statut');
  const recent = query('SELECT * FROM candidatures ORDER BY id DESC LIMIT 5');
  res.json({ total, byStatut, recent });
});

// ── AI routes (fetch natif — pas de SDK externe) ──
async function callClaude({ system, messages, max_tokens = 1024 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY non configuré');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens, system, messages }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

app.post('/api/ai/coach', async (req, res) => {
  const { messages, candidatures } = req.body;
  const ctx = (candidatures||[]).slice(0,30).map(c =>
    `- ${c.entreprise} (${c.poste||'?'}) : ${c.statut}, ${c.localisation||''}, ${c.date_candidature||''}`
  ).join('\n') || '(aucune candidature)';
  try {
    const content = await callClaude({
      system: `Tu es un coach spécialisé dans la recherche d'alternance en France. Tu connais les candidatures de l'utilisateur :\n${ctx}\n\nRéponds en français, sois concis et actionnable. Max 3 paragraphes.`,
      messages: (messages||[]).slice(-10),
    });
    res.json({ content });
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/parse', async (req, res) => {
  const { text } = req.body;
  try {
    const raw = await callClaude({
      system: 'Tu extrais des informations structurées depuis une offre d\'emploi. Réponds UNIQUEMENT avec un JSON valide, aucun autre texte. Format : {"entreprise":"","poste":"","localisation":"","source":"","salaire":"","secteur":"","notes":""}',
      messages: [{ role: 'user', content: (text||'').slice(0, 4000) }],
      max_tokens: 512,
    });
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    res.json(json);
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/cover-letter', async (req, res) => {
  const { candidature, profil } = req.body;
  try {
    const letter = await callClaude({
      system: 'Tu rédiges des lettres de motivation professionnelles pour des candidatures en alternance en France. Ton style : direct, enthousiaste, personnalisé. 3 paragraphes max.',
      messages: [{ role: 'user', content: `Rédige une lettre de motivation pour ce poste :\nEntreprise : ${candidature.entreprise}\nPoste : ${candidature.poste||'alternance'}\nLocalisation : ${candidature.localisation||''}\nSecteur : ${candidature.secteur||''}\n\nProfil du candidat :\n${profil || 'Étudiant en alternance recherchant une entreprise'}` }],
      max_tokens: 1500,
    });
    res.json({ letter });
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/interview', async (req, res) => {
  const { messages, candidature } = req.body;
  try {
    const content = await callClaude({
      system: `Tu joues le rôle d'un recruteur RH pour le poste de "${candidature?.poste||'alternant'}" chez "${candidature?.entreprise||'notre entreprise'}". Pose des questions d'entretien réalistes, une à la fois. Donne un feedback bref puis pose la suivante. Commence par te présenter. Réponds en français.`,
      messages: (messages||[]).slice(-10),
      max_tokens: 512,
    });
    res.json({ content });
  } catch(e) { res.status(503).json({ error: e.message }); }
});

// ── Share routes ──
const crypto = require('crypto');

app.post('/api/share', (req, res) => {
  let row = query('SELECT token FROM shares LIMIT 1', [])[0];
  if (!row) {
    const token = crypto.randomBytes(16).toString('hex');
    run('INSERT INTO shares (token, created_at) VALUES (?,?)', [token, new Date().toISOString()]);
    row = { token };
  }
  res.json({ token: row.token });
});

app.delete('/api/share', (req, res) => {
  run('DELETE FROM shares', []);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => console.log(`🚀 Serveur sur http://localhost:${PORT}`));
