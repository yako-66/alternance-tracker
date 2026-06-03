const cron = require('node-cron');
const { run } = require('./database');

// Mots-clés IT Sys & Réseaux pour le score de matching
const IT_KEYWORDS = [
  'systèmes', 'systemes', 'réseau', 'reseaux', 'réseau', 'reseau',
  'infrastructure', 'infra', 'cloud', 'azure', 'aws', 'gcp',
  'vmware', 'linux', 'windows server', 'cisco', 'firewall', 'vpn',
  'active directory', 'helpdesk', 'support n2', 'support n3',
  'virtualisation', 'virtualisation', 'itil', 'sécurité', 'securite',
  'supervision', 'monitoring', 'backup', 'sauvegarde', 'baas',
  'hyper-v', 'nutanix', 'veeam', 'zabbix', 'grafana', 'ansible',
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
          o.source, o.source_id.slice(0, 128), o.source_url || '',
          (o.description || '').slice(0, 5000), o.date_publi || '',
          o.salaire || '', o.secteur || '', o.tags || '', score,
        ]
      );
      saved++;
    } catch {}
  }
  return saved;
}

async function runScrapers() {
  console.log('🔍 Scraping démarré…');
  const report = {};

  // La Bonne Alternance (toujours actif, API ouverte)
  try {
    const { scrape } = require('./scrapers/bonnealternance');
    const offres = await scrape();
    report.bonne_alternance = await saveOffres(offres);
    console.log(`✅ La Bonne Alternance : ${report.bonne_alternance} nouvelles offres`);
  } catch (e) {
    report.bonne_alternance = 0;
    console.error('❌ LBA :', e.message);
  }

  // France Travail (optionnel — nécessite clés API)
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
  } else {
    console.log('ℹ️  France Travail ignoré (clés FRANCE_TRAVAIL_CLIENT_ID/SECRET absentes)');
  }

  // HelloWork (scraping HTML)
  try {
    const { scrape } = require('./scrapers/hellowork');
    const offres = await scrape();
    report.hellowork = await saveOffres(offres);
    console.log(`✅ HelloWork : ${report.hellowork} nouvelles offres`);
  } catch (e) {
    report.hellowork = 0;
    console.error('❌ HelloWork :', e.message);
  }

  const total = Object.values(report).reduce((a, b) => a + b, 0);
  console.log(`✅ Scraping terminé — ${total} nouvelles offres`);

  lastReport = report;
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
  // Premier scraping 15s après démarrage (laisse la DB s'initialiser)
  setTimeout(runAndRecord, 15000);
}

function getScrapeStatus() {
  return { lastScrapeAt, lastScrapeReport: lastReport };
}

module.exports = { startCron, runScrapers: runAndRecord, getScrapeStatus };
