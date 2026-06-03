// La Bonne Alternance — API v3 (beta.gouv.fr)
// Endpoint stable depuis 2024 : /api/v3/jobs/search
const ROMES = 'M1801,M1802,M1803,M1805,I1401';

const LOCATIONS = [
  { name: 'Lyon',          lat: 45.7640, lon: 4.8357 },
  { name: 'Saint-Étienne', lat: 45.4397, lon: 4.3872 },
];

async function scrapeLocation({ lat, lon, name }) {
  // Essaie plusieurs variantes de l'endpoint
  const endpoints = [
    `https://labonnealternance.apprentissage.beta.gouv.fr/api/v3/jobs/search?romes=${ROMES}&latitude=${lat}&longitude=${lon}&radius=30&caller=alternance-aggregator`,
    `https://labonnealternance.apprentissage.beta.gouv.fr/api/v2/jobs/search?romes=${ROMES}&latitude=${lat}&longitude=${lon}&radius=30&caller=alternance-aggregator`,
    `https://labonnealternance.apprentissage.beta.gouv.fr/api/v1/jobs/jobs?romes=${ROMES}&latitude=${lat}&longitude=${lon}&radius=30&caller=alternance-aggregator`,
  ];

  for (const url of endpoints) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'alternance-aggregator/2.0' },
      });
      clearTimeout(tid);
      if (!res.ok) continue;
      const data = await res.json();

      const offres = [];
      // Format v1 : { peJobs: { results: [] }, matchas: { results: [] } }
      // Format v2/v3 : { jobs: [] } ou { results: [] } ou { offres: [] }
      const items = [
        ...(data?.peJobs?.results || []),
        ...(data?.matchas?.results || []),
        ...(data?.jobs || []),
        ...(data?.results || []),
        ...(data?.offres || []),
      ];

      for (const j of items) {
        const id = j.job?.id || j.id || j.ideq || j._id;
        const titre = j.title || j.intitule || j.poste || '';
        if (!id || !titre) continue;
        offres.push({
          titre,
          entreprise:   j.company?.name || j.entreprise?.nom || '',
          localisation: j.place?.city  || j.lieuTravail?.libelle || name,
          source:       'bonne_alternance',
          source_id:    `lba_${id}`,
          source_url:   j.url || `https://labonnealternance.apprentissage.beta.gouv.fr/`,
          description:  j.job?.description || j.description || '',
          date_publi:   (j.job?.creationDate || j.dateCreation || '').split('T')[0],
          salaire:      j.salaire?.libelle || '',
          secteur:      j.secteurActiviteLibelle || '',
          tags:         'alternance,apprentissage',
        });
      }

      console.log(`  LBA ${name} (${url.includes('v3') ? 'v3' : url.includes('v2') ? 'v2' : 'v1'}): ${offres.length} offres`);
      return offres;
    } catch (e) {
      clearTimeout(tid);
      // Tente le prochain endpoint
    }
  }

  console.log(`  LBA ${name}: aucun endpoint disponible`);
  return [];
}

async function scrape() {
  const all = [];
  for (const loc of LOCATIONS) {
    const offres = await scrapeLocation(loc);
    all.push(...offres);
  }
  return all;
}

module.exports = { scrape };
