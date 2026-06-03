const cron = require('node-cron');
const { run, query } = require('./database');

const IT_KEYWORDS = [
  'systèmes', 'systemes', 'réseau', 'reseaux', 'réseau', 'reseau',
  'infrastructure', 'infra', 'cloud', 'azure', 'aws', 'gcp',
  'vmware', 'linux', 'windows server', 'cisco', 'firewall', 'vpn',
  'active directory', 'helpdesk', 'support n2', 'support n3',
  'virtualisation', 'itil', 'sécurité', 'securite',
  'supervision', 'monitoring', 'backup', 'sauvegarde',
  'hyper-v', 'nutanix', 'veeam', 'zabbix', 'ansible',
];

function scoreOffre({ titre = '', description = '' }) {
  const text = `${titre} ${description}`.toLowerCase();
  let score = 0;
  IT_KEYWORDS.forEach(kw => { if (text.includes(kw)) score += 7; });
  if (/(syst[eè]m|r[eé]seau|infra|cloud)/i.test(titre)) score += 20;
  return Math.min(score, 100);
}

async function saveOffres(offres) {
  let saved = 0;
  for (const o of offres) {
    if (!o.source_id || !o.titre) continue;
    const score = scoreOffre(o);
    try {
      await run(
        `INSERT OR IGNORE INTO offres
         (titre,entreprise,localisation,source,source_id,source_url,
          description,date_publi,salaire,secteur,tags,score_match)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          o.titre.slice(0, 255), o.entreprise || '', o.localisation || '',
          o.source, String(o.source_id).slice(0, 128), o.source_url || '',
          (o.description || '').slice(0, 5000), o.date_publi || '',
          o.salaire || '', o.secteur || '', o.tags || '', score,
        ]
      );
      saved++;
    } catch {}
  }
  return saved;
}

// Offres de démo quand la DB est vide (pas de clés API configurées)
const DEMO_OFFRES = [
  { titre:'Alternant Systèmes & Réseaux',       entreprise:'CAPGEMINI',        localisation:'Lyon',          source:'demo', source_id:'demo_1', source_url:'https://www.capgemini.com/fr-fr/carrieres/', description:'Rejoins notre équipe infra : administration Windows Server, Active Directory, supervision réseau Cisco.', date_publi: new Date().toISOString().split('T')[0], salaire:'~750€/mois', secteur:'Informatique', tags:'alternance,apprentissage' },
  { titre:'Alternant Administrateur Infra Cloud', entreprise:'SFR Business',    localisation:'Lyon',          source:'demo', source_id:'demo_2', source_url:'https://www.sfr.fr/recrutement/', description:'Mission : déploiement Azure/AWS, supervision infrastructure, support N2/N3.', date_publi: new Date().toISOString().split('T')[0], salaire:'~800€/mois', secteur:'Télécommunications', tags:'alternance,cloud' },
  { titre:'Alternant Technicien Sys & Réseaux',  entreprise:'ENEDIS',           localisation:'Lyon',          source:'demo', source_id:'demo_3', source_url:'https://recrutement.enedis.fr/', description:'Infra réseau interne, VMware, Windows Server, tickets helpdesk.', date_publi: new Date().toISOString().split('T')[0], salaire:'~720€/mois', secteur:'Énergie', tags:'alternance,apprentissage' },
  { titre:'Alternant Cloud & Virtualisation',    entreprise:'SNCF',             localisation:'Lyon',          source:'demo', source_id:'demo_4', source_url:'https://www.sncf.com/fr/groupe/recrutement', description:'Azure DevOps, Hyper-V, Ansible, supervision Zabbix. Équipe DSI 50 personnes.', date_publi: new Date().toISOString().split('T')[0], salaire:'~780€/mois', secteur:'Transport', tags:'alternance,cloud' },
  { titre:'Alternant Infra & Cybersécurité',    entreprise:'Crédit Agricole',   localisation:'Lyon',          source:'demo', source_id:'demo_5', source_url:'https://jobs.credit-agricole.fr/', description:'Firewall Palo Alto, VPN, SIEM, gestion des accès Active Directory. ITIL apprécié.', date_publi: new Date().toISOString().split('T')[0], salaire:'~800€/mois', secteur:'Banque', tags:'alternance,securite' },
  { titre:'Alternant Systèmes & Réseaux',       entreprise:'EDF',              localisation:'Lyon',          source:'demo', source_id:'demo_6', source_url:'https://recrutement.edf.fr/', description:'Déploiement postes, GLPI, réseau LAN/WAN, support utilisateurs.', date_publi: new Date().toISOString().split('T')[0], salaire:'~750€/mois', secteur:'Énergie', tags:'alternance,apprentissage' },
  { titre:'Alternant Administrateur Réseau',    entreprise:'XEFI',             localisation:'Lyon',          source:'demo', source_id:'demo_7', source_url:'https://www.xefi.com/recrutement/', description:'MSP — infogérance : Cisco, VMware, Windows Server, support clients PME.', date_publi: new Date().toISOString().split('T')[0], salaire:'~730€/mois', secteur:'Informatique', tags:'alternance,apprentissage' },
  { titre:'Alternant Infra IT',                 entreprise:'Groupe APICIL',    localisation:'Lyon',          source:'demo', source_id:'demo_8', source_url:'https://www.apicil.com/nous-rejoindre/', description:'DSI interne : administration serveurs, virtualisation, réseau, sauvegarde Veeam.', date_publi: new Date().toISOString().split('T')[0], salaire:'~750€/mois', secteur:'Assurance', tags:'alternance,apprentissage' },
  { titre:'Alternant Systèmes & Réseaux',       entreprise:'FRAMATOME',        localisation:'Lyon',          source:'demo', source_id:'demo_9', source_url:'https://www.framatome.com/fr/carrieres/', description:'Infrastructure industrielle : réseau OT/IT, sécurité, supervision, Linux/Windows.', date_publi: new Date().toISOString().split('T')[0], salaire:'~800€/mois', secteur:'Nucléaire', tags:'alternance,apprentissage' },
  { titre:'Alternant Cloud & DevOps',           entreprise:'METSYS',           localisation:'Lyon',          source:'demo', source_id:'demo_10', source_url:'https://www.metsys.fr/carrieres/', description:'Azure, M365, VMware, Active Directory, projets clients variés.', date_publi: new Date().toISOString().split('T')[0], salaire:'~760€/mois', secteur:'Informatique', tags:'alternance,cloud' },
  { titre:'Alternant Admin Sys & Réseaux',      entreprise:'Banque Populaire',  localisation:'Lyon',          source:'demo', source_id:'demo_11', source_url:'https://recrutement.banquepopulaire.fr/', description:'Infrastructure bancaire : réseau haute disponibilité, sécurité, supervision.', date_publi: new Date().toISOString().split('T')[0], salaire:'~780€/mois', secteur:'Banque', tags:'alternance,apprentissage' },
  { titre:'Alternant Technicien Réseaux',       entreprise:'ACTEMIUM / VINCI', localisation:'Saint-Étienne', source:'demo', source_id:'demo_12', source_url:'https://www.actemium.fr/carrieres/', description:'Câblage réseau, bornes WiFi, supervision, déploiement postes utilisateurs.', date_publi: new Date().toISOString().split('T')[0], salaire:'~730€/mois', secteur:'Industrie', tags:'alternance,apprentissage' },
  { titre:'Alternant Infra Cloud',              entreprise:'STEF',             localisation:'Saint-Étienne', source:'demo', source_id:'demo_13', source_url:'https://www.stef.com/fr/rejoignez-nous/', description:'Azure, Office 365, réseau multi-sites, support N2.', date_publi: new Date().toISOString().split('T')[0], salaire:'~750€/mois', secteur:'Logistique', tags:'alternance,cloud' },
];

async function seedDemoIfEmpty() {
  const rows = await query('SELECT COUNT(*) as c FROM offres');
  if (Number(rows[0].c) > 0) return;
  console.log('📋 DB vide — insertion des offres de démo…');
  await saveOffres(DEMO_OFFRES);
  console.log('✅ Offres de démo insérées (source: demo)');
}

async function runScrapers() {
  console.log('🔍 Scraping démarré…');
  const report = {};

  // La Bonne Alternance
  try {
    const { scrape } = require('./scrapers/bonnealternance');
    const offres = await scrape();
    report.bonne_alternance = await saveOffres(offres);
    console.log(`✅ LBA : ${report.bonne_alternance} nouvelles offres`);
  } catch (e) {
    report.bonne_alternance = 0;
    console.error('❌ LBA :', e.message);
  }

  // France Travail OAuth (optionnel)
  if (process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET) {
    try {
      const { scrape } = require('./scrapers/franceTravail');
      const offres = await scrape();
      report.france_travail = await saveOffres(offres);
      console.log(`✅ France Travail : ${report.france_travail} nouvelles offres`);
    } catch (e) {
      report.france_travail = 0;
      console.error('❌ France Travail :', e.message);
    }
  }

  // Adzuna (optionnel — nécessite ADZUNA_APP_ID + ADZUNA_APP_KEY)
  try {
    const { scrape } = require('./scrapers/adzuna');
    const offres = await scrape();
    report.adzuna = await saveOffres(offres);
    if (offres.length) console.log(`✅ Adzuna : ${report.adzuna} nouvelles offres`);
  } catch (e) {
    report.adzuna = 0;
    console.error('❌ Adzuna :', e.message);
  }

  const total = Object.values(report).reduce((a, b) => a + b, 0);
  console.log(`✅ Scraping terminé — ${total} nouvelles offres`);
  lastReport   = report;
  lastScrapeAt = new Date().toISOString();
  return report;
}

let lastReport   = null;
let lastScrapeAt = null;

async function runAndRecord() {
  try { return await runScrapers(); } catch (e) { console.error('Cron error:', e); }
}

function startCron() {
  const hours = Math.max(1, parseInt(process.env.SCRAPE_INTERVAL_HOURS || '6'));
  cron.schedule(`0 */${hours} * * *`, runAndRecord);
  console.log(`⏰ Scraping auto toutes les ${hours}h`);
  setTimeout(async () => {
    await seedDemoIfEmpty();   // données de démo si rien
    await runAndRecord();      // puis scraping réel
  }, 10000);
}

function getScrapeStatus() {
  return { lastScrapeAt, lastScrapeReport: lastReport };
}

module.exports = { startCron, runScrapers: runAndRecord, getScrapeStatus };
