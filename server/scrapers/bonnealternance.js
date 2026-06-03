// API publique La Bonne Alternance — pas d'auth requise
const ROMES = 'M1801,M1802,M1803,M1805,I1401';

const LOCATIONS = [
  { name: 'Lyon',          lat: 45.7640, lon: 4.8357 },
  { name: 'Saint-Étienne', lat: 45.4397, lon: 4.3872 },
];

async function scrapeLocation({ lat, lon, name }) {
  const url = new URL('https://labonnealternance.apprentissage.beta.gouv.fr/api/v1/jobs/jobs');
  url.searchParams.set('romes', ROMES);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('radius', '30');
  url.searchParams.set('caller', 'alternance-aggregator');

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'alternance-aggregator/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const offres = [];

    for (const j of (data?.peJobs?.results || [])) {
      if (!j.job?.id) continue;
      offres.push({
        titre:       j.title || 'Offre d\'alternance',
        entreprise:  j.company?.name || '',
        localisation: j.place?.city || name,
        source:      'bonne_alternance',
        source_id:   `pe_${j.job.id}`,
        source_url:  j.url || '',
        description: j.job?.description || '',
        date_publi:  (j.job?.creationDate || '').split('T')[0],
        salaire:     '',
        secteur:     '',
        tags:        'alternance,apprentissage',
      });
    }

    for (const m of (data?.matchas?.results || [])) {
      if (!m.job?.id) continue;
      offres.push({
        titre:       m.title || 'Offre d\'alternance',
        entreprise:  m.company?.name || '',
        localisation: m.place?.city || name,
        source:      'bonne_alternance',
        source_id:   `matcha_${m.job.id}`,
        source_url:  `https://labonnealternance.apprentissage.beta.gouv.fr/recherche-apprentissage`,
        description: m.job?.description || '',
        date_publi:  (m.job?.creationDate || '').split('T')[0],
        salaire:     '',
        secteur:     '',
        tags:        'alternance,cfa',
      });
    }

    return offres;
  } finally {
    clearTimeout(tid);
  }
}

async function scrape() {
  const all = [];
  for (const loc of LOCATIONS) {
    try {
      const offres = await scrapeLocation(loc);
      all.push(...offres);
      console.log(`  LBA ${loc.name}: ${offres.length} offres`);
    } catch (e) {
      console.error(`  LBA ${loc.name}: ${e.message}`);
    }
  }
  return all;
}

module.exports = { scrape };
