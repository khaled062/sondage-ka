// Calcul des points et du classement final (partagé par la page votant et l'admin).

const POINTS_PAR_DEFAUT = { top: [10, 6, 4, 2], mult: 0.8 };

// Points pour le rang r (1 = premier) : table pour 1 à 4, puis top[3] × mult^(r-4).
function pointsPourRang(r, cfg) {
  return r <= 4 ? cfg.top[r - 1] : cfg.top[3] * Math.pow(cfg.mult, r - 4);
}

// Persos jouables : on ignore les emplacements sans nom.
function persosValides(liste) {
  return liste.filter(p => p && p.id && p.nom && p.nom.trim());
}

// votes : [{ id, ranking: [idPerso, ...], created_at }]
// Renvoie les persos triés, chacun avec score, tops, votants, meilleur rang, rangs reçus et position.
function calculerClassement(persos, votes, cfg) {
  const lignes = new Map(persos.map(p => [p.id, {
    perso: p, score: 0, tops: [0, 0, 0], votants: 0, meilleur: Number.MAX_SAFE_INTEGER, recus: [] // pas Infinity : Infinity - Infinity = NaN casse le tri
  }]));

  votes.forEach((v, numero) => {
    const vus = new Set();
    (v.ranking || []).forEach((id, i) => {
      const l = lignes.get(id);
      if (!l || vus.has(id)) return; // perso retiré ou doublon : ignoré, sans décaler les autres
      vus.add(id);
      const rang = i + 1;
      l.score += pointsPourRang(rang, cfg);
      if (rang <= 3) l.tops[rang - 1]++;
      l.votants++;
      l.meilleur = Math.min(l.meilleur, rang);
      l.recus.push({ vote: numero + 1, rang });
    });
  });

  // Arrondi pour que 1.6 + 0.4 et 2.0 soient bien considérés égaux.
  const s = l => Math.round(l.score * 1e6);
  const comparer = (a, b) =>
    (b.votants > 0) - (a.votants > 0) || // persos sans vote tout en bas
    s(b) - s(a) ||
    b.tops[0] - a.tops[0] ||
    b.tops[1] - a.tops[1] ||
    b.votants - a.votants ||
    a.meilleur - b.meilleur;

  const tri = [...lignes.values()].sort((a, b) => comparer(a, b) || a.perso.nom.localeCompare(b.perso.nom, 'fr'));

  tri.forEach((l, i) => {
    const prec = tri[i - 1];
    l.position = prec && comparer(prec, l) === 0 ? prec.position : i + 1;
  });
  tri.forEach(l => {
    l.exaequo = tri.filter(x => x.position === l.position).length > 1;
    l.recus.sort((a, b) => a.rang - b.rang);
  });
  return tri;
}

function libellePosition(l) {
  const n = l.position === 1 ? '1er' : l.position + 'e';
  return l.exaequo ? 'ex æquo ' + n : n;
}

if (typeof module !== 'undefined') {
  module.exports = { POINTS_PAR_DEFAUT, pointsPourRang, persosValides, calculerClassement, libellePosition };
}
