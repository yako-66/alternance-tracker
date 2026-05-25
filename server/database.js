const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'tracker.db');

let db;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS candidatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entreprise TEXT NOT NULL,
      poste TEXT,
      source TEXT,
      date_candidature TEXT,
      contact TEXT,
      statut TEXT DEFAULT 'Postulé',
      notes TEXT,
    localisation TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS echanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidature_id INTEGER,
      type TEXT,
      contenu TEXT,
      date TEXT,
      FOREIGN KEY(candidature_id) REFERENCES candidatures(id)
    );
  `);

  // Seed si vide
  const count = db.exec('SELECT COUNT(*) as c FROM candidatures')[0]?.values[0][0] || 0;
  if (count === 0) {
    // [entreprise, poste, source, date, contact, statut, notes, localisation]
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
    companies.forEach(c => {
      db.run(`INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation) VALUES (?,?,?,?,?,?,?,?)`, c);
    });
    save();
  }

  // Migrations : nouvelles colonnes
  try { db.run('ALTER TABLE candidatures ADD COLUMN priorite INTEGER DEFAULT 0'); save(); } catch(e) {}
  try { db.run('ALTER TABLE candidatures ADD COLUMN score INTEGER DEFAULT 0'); save(); } catch(e) {}
  try { db.run("ALTER TABLE candidatures ADD COLUMN date_entretien TEXT DEFAULT ''"); save(); } catch(e) {}
  try { db.run('ALTER TABLE candidatures ADD COLUMN archived INTEGER DEFAULT 0'); save(); } catch(e) {}
  try { db.run("ALTER TABLE candidatures ADD COLUMN tags TEXT DEFAULT ''"); save(); } catch(e) {}
  try { db.run("ALTER TABLE candidatures ADD COLUMN salaire TEXT DEFAULT ''"); save(); } catch(e) {}
  try { db.run("ALTER TABLE candidatures ADD COLUMN secteur TEXT DEFAULT ''"); save(); } catch(e) {}
  try { db.run("ALTER TABLE candidatures ADD COLUMN taille TEXT DEFAULT ''"); save(); } catch(e) {}
  try { db.run("ALTER TABLE candidatures ADD COLUMN date_rappel TEXT DEFAULT ''"); save(); } catch(e) {}
  try { db.run(`CREATE TABLE IF NOT EXISTS shares (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, created_at TEXT)`); save(); } catch(e) {}
  try { db.run(`CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE NOT NULL, profile TEXT, created_at TEXT)`); save(); } catch(e) {}
  try { db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`); save(); } catch(e) {}
  try { db.run('ALTER TABLE candidatures ADD COLUMN user_id INTEGER DEFAULT 1'); save(); } catch(e) {}
  try { db.run('ALTER TABLE shares ADD COLUMN user_id INTEGER DEFAULT 1'); save(); } catch(e) {}

  // Migration : renseigne localisation pour les entrées existantes qui l'ont vide
  const migrations = [
    ['SNCF','Lyon'],['XEFI','Lyon'],['APTIS','Lyon'],['SODIAAL','Lyon'],
    ['APRIL','Lyon'],['ENEDIS','Lyon'],['Groupe APICIL','Lyon'],['FRAMATOME','Lyon'],
    ['Early Makers','Lyon'],['Banque Populaire','Lyon'],['Crédit Agricole','Lyon'],
    ['EDF','Lyon'],['ORT Lyon','Lyon'],['SFR','Lyon'],['CAPGEMINI','Lyon'],
    ['STEF','Lyon'],['CERFRANCE','Lyon'],['FIDUCIAL','Lyon'],['LYNX','Lyon'],
    ['METSYS','Lyon'],['GAC Software','Lyon'],['GUARANI','Lyon'],
    ['Genius Talent','Lyon'],['SAYCO','Lyon'],['Réseau Talents','Lyon'],
    ['SILKHOM','Lyon'],['IKIGAI','Lyon'],['AQUISIT','Lyon'],['XBHOST','Lyon'],
    ['SKILLIE','Lyon'],['DIMEO ENERGIE','Lyon'],['ALPTIS','Rillieux-la-Pape'],
    ['CLUB MED','Paris'],['EDILIANS','Quincieux'],['ACTEMIUM / VINCI','Oullins'],
    ['OPUS RS','Lyon'],
  ];
  let migrated = 0;
  migrations.forEach(([entreprise, loc]) => {
    const res = db.exec(`SELECT id FROM candidatures WHERE entreprise='${entreprise.replace(/'/g,"''")}' AND (localisation IS NULL OR localisation='')`);
    if (res[0]?.values?.length) {
      db.run(`UPDATE candidatures SET localisation='${loc}' WHERE entreprise='${entreprise.replace(/'/g,"''")}'  AND (localisation IS NULL OR localisation='')`);
      migrated++;
    }
  });
  if (migrated > 0) save();

  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// Helper: exécute une requête et retourne les rows
function query(sql, params = []) {
  const result = db.exec(sql.replace(/\?/g, () => {
    const val = params.shift();
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    return `'${String(val).replace(/'/g, "''")}'`;
  }));
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

function run(sql, params = []) {
  const escaped = sql.replace(/\?/g, () => {
    const val = params.shift();
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    return `'${String(val).replace(/'/g, "''")}'`;
  });
  db.run(escaped);
  // Lire le rowid AVANT save() — db.export() remet last_insert_rowid à 0
  const lastInsertRowid = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
  save();
  return { lastInsertRowid };
}

module.exports = { getDb, query, run, save };
