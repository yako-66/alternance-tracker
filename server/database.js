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
    const companies = [
      ['SNCF','Alternant Infra/Cloud','Candidature directe','','','Postulé',''],
      ['XEFI','Alternant Systèmes & Réseaux','Candidature directe','','','Postulé',''],
      ['APTIS','Alternant Infra','Candidature directe','','','Postulé',''],
      ['SODIAAL','Alternant IT','Candidature directe','','','Postulé',''],
      ['APRIL','Alternant Systèmes','Candidature directe','','','Postulé',''],
      ['ENEDIS','Alternant Infra & Cloud','Candidature directe','','','Postulé',''],
      ['Groupe APICIL','Alternant IT','Candidature directe','','','Postulé',''],
      ['FRAMATOME','Alternant Systèmes & Réseaux','Candidature directe','','','Postulé',''],
      ['Early Makers','Alternant IT','Candidature directe','','','Postulé',''],
      ['Banque Populaire','Alternant Infra','Candidature directe','','','Postulé',''],
      ['Crédit Agricole','Alternant Cloud','Candidature directe','','','Postulé',''],
      ['EDF','Alternant Systèmes','Candidature directe','','','Postulé',''],
      ['ORT Lyon','Alternant IT','Candidature directe','','','Postulé',''],
      ['SFR','Alternant Infra','Candidature directe','','','Postulé',''],
      ['ALPTIS','Alternant Systèmes & Réseaux','Candidature directe','','','Postulé',''],
      ['CAPGEMINI','Alternant Cloud / Infra','Candidature directe','','','Postulé',''],
      ['STEF','Alternant IT','Candidature directe','','','Postulé',''],
      ['CERFRANCE','Alternant Systèmes','Candidature directe','','','Postulé',''],
      ['CLUB MED','Alternant Infra','Candidature directe','','','Postulé',''],
      ['FIDUCIAL','Alternant IT','Candidature directe','','','Postulé',''],
      ['LYNX','Alternant Systèmes & Réseaux','Cabinet recrutement','','','Postulé',''],
      ['METSYS','Alternant Cloud / Infra','Candidature directe','','','Postulé',''],
      ['GAC Software','Alternant IT','Candidature directe','','','Postulé',''],
      ['GUARANI','Alternant Systèmes','Candidature directe','','','Postulé',''],
      ['Genius Talent','Alternant Infra','Cabinet recrutement','','','Postulé',''],
      ['SAYCO','Alternant IT','Candidature directe','','','Postulé',''],
      ['Réseau Talents','Alternant Systèmes & Réseaux','Cabinet recrutement','','','Postulé',''],
      ['SILKHOM','Alternant Cloud / Infra','Cabinet recrutement','','','Postulé',''],
      ['IKIGAI','Alternant IT','Cabinet recrutement','','','Postulé',''],
      ['AQUISIT','Alternant Systèmes','Cabinet recrutement','','','Postulé',''],
      ['XBHOST','Alternant Infra & Cloud','Candidature directe','','','Postulé',''],
      ['SKILLIE','Alternant IT','Cabinet recrutement','','','Postulé',''],
      ['DIMEO ENERGIE','Alternant Systèmes & Réseaux','Candidature directe','','','Postulé',''],
      ['EDILIANS','Alternant Technicien Sys & Réseaux','IPI Lyon','20/05/2026','Mme Juen','En attente','Quincieux (69) — 29 pers DSI, missions N2/N3'],
      ['ACTEMIUM / VINCI','Alternant Administrateur IT','HelloWork','20/05/2026','','Postulé','Oullins (69) — VINCI Energies'],
      ['OPUS RS','Technicien Sys & Réseaux','LinkedIn (InMail)','20/05/2026','Yorick Georges','En attente de réponse','À confirmer : alternance ou CDI ?'],
    ];
    companies.forEach(c => {
      db.run(`INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes) VALUES (?,?,?,?,?,?,?)`, c);
    });
    save();
  }

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
  save();
  return { lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] };
}

module.exports = { getDb, query, run, save };
