const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./server/tracker.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function getDb() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS candidatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      entreprise TEXT NOT NULL,
      poste TEXT DEFAULT '',
      source TEXT DEFAULT '',
      date_candidature TEXT DEFAULT '',
      contact TEXT DEFAULT '',
      statut TEXT DEFAULT 'Postulé',
      notes TEXT DEFAULT '',
      localisation TEXT DEFAULT '',
      priorite INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      date_entretien TEXT DEFAULT '',
      archived INTEGER DEFAULT 0,
      tags TEXT DEFAULT '',
      salaire TEXT DEFAULT '',
      secteur TEXT DEFAULT '',
      taille TEXT DEFAULT '',
      date_rappel TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS echanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidature_id INTEGER,
      type TEXT,
      contenu TEXT,
      date TEXT,
      FOREIGN KEY(candidature_id) REFERENCES candidatures(id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT,
      user_id INTEGER DEFAULT 1
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      profile TEXT,
      created_at TEXT
    )
  `);

  // Seed initial si DB vide
  const r = await client.execute('SELECT COUNT(*) as c FROM candidatures');
  if (Number(r.rows[0].c) === 0) {
    const companies = [
      ['SNCF','Alternant Infra/Cloud','Candidature directe','','','Postulé','','Lyon'],
      ['XEFI','Alternant Systèmes & Réseaux','Candidature directe','','','Postulé','','Lyon'],
      ['APTIS','Alternant Infra','Candidature directe','','','Postulé','','Lyon'],
      ['SODIAAL','Alternant IT','Candidature directe','','','Postulé','','Lyon'],
      ['APRIL','Alternant Systèmes','Candidature directe','','','Postulé','','Lyon'],
      ['ENEDIS','Alternant Infra & Cloud','Candidature directe','','','Postulé','','Lyon'],
      ['Groupe APICIL','Alternant IT','Candidature directe','','','Postulé','','Lyon'],
      ['FRAMATOME','Alternant Systèmes & Réseaux','Candidature directe','','','Postulé','','Lyon'],
      ['Early Makers','Alternant IT','Candidature directe','','','Postulé','','Lyon'],
      ['Banque Populaire','Alternant Infra','Candidature directe','','','Postulé','','Lyon'],
      ['Crédit Agricole','Alternant Cloud','Candidature directe','','','Postulé','','Lyon'],
      ['EDF','Alternant Systèmes','Candidature directe','','','Postulé','','Lyon'],
      ['ORT Lyon','Alternant IT','Candidature directe','','','Postulé','','Lyon'],
      ['SFR','Alternant Infra','Candidature directe','','','Postulé','','Lyon'],
      ['ALPTIS','Alternant Systèmes & Réseaux','Candidature directe','','','Postulé','','Rillieux-la-Pape'],
      ['CAPGEMINI','Alternant Cloud / Infra','Candidature directe','','','Postulé','','Lyon'],
      ['STEF','Alternant IT','Candidature directe','','','Postulé','','Lyon'],
      ['CERFRANCE','Alternant Systèmes','Candidature directe','','','Postulé','','Lyon'],
      ['CLUB MED','Alternant Infra','Candidature directe','','','Postulé','','Paris'],
      ['FIDUCIAL','Alternant IT','Candidature directe','','','Postulé','','Lyon'],
      ['LYNX','Alternant Systèmes & Réseaux','Cabinet recrutement','','','Postulé','','Lyon'],
      ['METSYS','Alternant Cloud / Infra','Candidature directe','','','Postulé','','Lyon'],
      ['GAC Software','Alternant IT','Candidature directe','','','Postulé','','Lyon'],
      ['GUARANI','Alternant Systèmes','Candidature directe','','','Postulé','','Lyon'],
      ['Genius Talent','Alternant Infra','Cabinet recrutement','','','Postulé','','Lyon'],
      ['SAYCO','Alternant IT','Candidature directe','','','Postulé','','Lyon'],
      ['Réseau Talents','Alternant Systèmes & Réseaux','Cabinet recrutement','','','Postulé','','Lyon'],
      ['SILKHOM','Alternant Cloud / Infra','Cabinet recrutement','','','Postulé','','Lyon'],
      ['IKIGAI','Alternant IT','Cabinet recrutement','','','Postulé','','Lyon'],
      ['AQUISIT','Alternant Systèmes','Cabinet recrutement','','','Postulé','','Lyon'],
      ['XBHOST','Alternant Infra & Cloud','Candidature directe','','','Postulé','','Lyon'],
      ['SKILLIE','Alternant IT','Cabinet recrutement','','','Postulé','','Lyon'],
      ['DIMEO ENERGIE','Alternant Systèmes & Réseaux','Candidature directe','','','Postulé','','Lyon'],
      ['EDILIANS','Alternant Technicien Sys & Réseaux','IPI Lyon','20/05/2026','Mme Juen','En attente','Quincieux (69) — 29 pers DSI, missions N2/N3','Quincieux'],
      ['ACTEMIUM / VINCI','Alternant Administrateur IT','HelloWork','20/05/2026','','Postulé','Oullins (69) — VINCI Energies','Oullins'],
      ['OPUS RS','Technicien Sys & Réseaux','LinkedIn (InMail)','20/05/2026','Yorick Georges','En attente de réponse','À confirmer : alternance ou CDI ?','Lyon'],
    ];
    for (const c of companies) {
      await client.execute({
        sql: 'INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation) VALUES (?,?,?,?,?,?,?,?)',
        args: c,
      });
    }
    console.log(`✅ ${companies.length} candidatures de démo insérées`);
  }

  return client;
}

async function query(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows.map(row => ({ ...row }));
}

async function run(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return { lastInsertRowid: Number(result.lastInsertRowid) };
}

module.exports = { getDb, query, run };
