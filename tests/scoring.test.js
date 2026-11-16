// Lancer avec : node tests/scoring.test.js
const assert = require('assert');
const S = require('../js/scoring.js');
const cfg = S.POINTS_PAR_DEFAUT;
const pos = (res, id) => S.libellePosition(res.find(l => l.perso.id === id));
const score = (res, id) => res.find(l => l.perso.id === id).score;

// Table des points
assert.deepStrictEqual([1, 2, 3, 4].map(r => S.pointsPourRang(r, cfg)), [10, 6, 4, 2]);
assert.ok(Math.abs(S.pointsPourRang(5, cfg) - 1.6) < 1e-9);
assert.ok(Math.abs(S.pointsPourRang(6, cfg) - 1.28) < 1e-9);
assert.ok(Math.abs(S.pointsPourRang(7, cfg) - 1.024) < 1e-9);

// 30 persos + un emplacement vide (ignoré)
const persos = S.persosValides([
  ...Array.from({ length: 30 }, (_, i) => ({ id: 'p' + (i + 1), nom: 'Perso ' + (i + 1) })),
  { id: 'vide', nom: '' }
]);
assert.strictEqual(persos.length, 30);

// 6 votants fictifs
const votes = [
  { ranking: ['p1', 'p2', 'p3', 'p4', 'p5'] },
  { ranking: ['p2', 'p1', 'p3'] },
  { ranking: ['p3', 'p6'] },
  { ranking: ['p6', 'p3'] },
  { ranking: ['p7', 'inconnu'] },          // id inconnu ignoré
  { ranking: ['p8', 'p9', 'p10', 'p11', 'p12', 'p13'] }
];
const r = S.calculerClassement(persos, votes, cfg);
assert.strictEqual(score(r, 'p3'), 24);                 // 4 + 4 + 10 + 6
assert.strictEqual(pos(r, 'p3'), '1er');
// p1, p2, p6 : 16 pts, 1 top 1, 1 top 2, 2 votants, meilleur rang 1 → égalité parfaite
['p1', 'p2', 'p6'].forEach(id => assert.strictEqual(pos(r, id), 'ex æquo 2e'));
['p7', 'p8'].forEach(id => assert.strictEqual(pos(r, id), 'ex æquo 5e'));
assert.strictEqual(pos(r, 'p9'), '7e');                  // 6 pts
assert.ok(Math.abs(score(r, 'p13') - 1.28) < 1e-9);
assert.strictEqual(pos(r, 'p4'), 'ex æquo 9e');          // p4 et p11 : 2 pts, rang 4 chacun
assert.strictEqual(pos(r, 'p11'), 'ex æquo 9e');
// 17 persos sans vote, regroupés tout en bas
assert.ok(r.slice(-17).every(l => l.votants === 0 && pos(r, l.perso.id) === 'ex æquo 14e'));
assert.deepStrictEqual(r.find(l => l.perso.id === 'p3').recus, [
  { vote: 3, rang: 1 }, { vote: 4, rang: 2 }, { vote: 1, rang: 3 }, { vote: 2, rang: 3 }
]);

// Départage 2 et 3 : nombre de top 1 puis de top 2
const t = S.calculerClassement(persos, [
  { ranking: ['p1'] },                       // p1 : 10, un top 1
  { ranking: ['p2', 'p3'] }, { ranking: ['p9', 'p2'] }, { ranking: ['p9', 'p9', 'p3'] }
], { top: [10, 5, 5, 0], mult: 0 });
// p2 : 10 + 5 = 15, p3 : 5 + 5 = 10 ; p1 : 10 avec 1 top 1, p3 : 10 sans top 1 → p1 devant
assert.ok(t.findIndex(l => l.perso.id === 'p1') < t.findIndex(l => l.perso.id === 'p3'));

// Départage 4 (nombre de votants) et 5 (meilleur rang), avec un multiplicateur de 1
const flat = { top: [10, 6, 4, 2], mult: 1 };
const u = S.calculerClassement(persos, [
  { ranking: ['p20', 'p21', 'p22', 'p1'] },            // p1 rang 4 → 2
  { ranking: ['p20', 'p21', 'p22', 'p23', 'p1'] },     // p1 rang 5 → 2  (p1 : 4 pts, 2 votants)
  { ranking: ['p20', 'p21', 'p2'] },                   // p2 rang 3 → 4  (p2 : 4 pts, 1 votant)
  { ranking: ['p24', 'p25', 'p26', 'p3'] },            // p3 rang 4 → 2
  { ranking: ['p24', 'p25', 'p26', 'p27', 'p28', 'p4'] } // p4 rang 6 → 2
], flat);
const idx = id => u.findIndex(l => l.perso.id === id);
assert.ok(idx('p1') < idx('p2'), 'plus de votants passe devant');
assert.ok(idx('p3') < idx('p4'), 'meilleur rang passe devant');
// p3 et p23 : même score, mêmes tops, 1 votant, meilleur rang 4 → vraie égalité
assert.strictEqual(u.find(l => l.perso.id === 'p3').position, u.find(l => l.perso.id === 'p23').position);
assert.ok(u.find(l => l.perso.id === 'p3').exaequo);

// Un perso classé à 0 point reste au-dessus des persos jamais classés
const z = S.calculerClassement(persos, [{ ranking: ['p1', 'p2', 'p3', 'p4', 'p5'] }], { top: [10, 6, 4, 2], mult: 0 });
assert.strictEqual(z.findIndex(l => l.perso.id === 'p5'), 4);
assert.strictEqual(S.libellePosition(z[5]), 'ex æquo 6e');

console.log('OK : tous les tests du calcul passent');
