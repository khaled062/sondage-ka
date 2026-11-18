// Espace admin : connexion, classement, graphiques, votes, exports.

const $ = id => document.getElementById(id);
let persos = [];
let parId = new Map();
let votes = [];          // triés du plus ancien au plus récent : Vote #1, #2…
let sondageOuvert = null;
let cfg = structuredClone(POINTS_PAR_DEFAUT);
let resultats = [];
const graphiques = {};

const fmt = (n, d = 2) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });
const dateFr = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const nomDe = id => parId.has(id) ? parId.get(id).nom : id + ' (retiré)';

function montrer(ecran) {
  document.querySelectorAll('.ecran').forEach(e => e.hidden = e.id !== 'ecran-' + ecran);
}
function erreur(el, texte) { el.textContent = texte; el.hidden = !texte; }

// ---------- Connexion ----------
async function demarrer() {
  try { persos = await chargerPersos(); } catch { persos = []; }
  parId = new Map(persos.map(p => [p.id, p]));
  remplirPoints();
  if (!db) {
    montrer('connexion');
    return erreur($('connexion-erreur'), "Supabase n'est pas encore configuré : remplis js/config.js.");
  }
  const { data } = await db.auth.getSession();
  if (data.session) entrer(); else montrer('connexion');
}

$('form-connexion').onsubmit = async e => {
  e.preventDefault();
  if (!db) return;
  $('btn-connexion').disabled = true;
  const { error } = await db.auth.signInWithPassword({ email: $('email').value.trim(), password: $('mdp').value });
  $('btn-connexion').disabled = false;
  if (error) return erreur($('connexion-erreur'), error.status === 400 ? 'Email ou mot de passe incorrect.' : 'Connexion impossible : ' + error.message);
  $('mdp').value = '';
  entrer();
};

$('btn-deconnexion').onclick = async () => { await db.auth.signOut(); location.reload(); };
$('btn-recharger').onclick = () => recharger();

async function entrer() {
  montrer('admin');
  await recharger();
}

async function recharger() {
  erreur($('admin-erreur'), '');
  const [v, s] = await Promise.all([
    db.from('votes').select('*').order('created_at'),
    db.from('settings').select('poll_open').eq('id', 1).single()
  ]);
  if (v.error || s.error) return erreur($('admin-erreur'), 'Chargement impossible : ' + (v.error || s.error).message);
  votes = v.data;
  sondageOuvert = s.data.poll_open;
  afficher();
  chargerQuestions();
}

// ---------- Boîte à questions ----------
// Profils : deux questions vont ensemble si elles viennent du même navigateur OU de la même connexion (empreinte d'IP).
function profils(qs) {
  const parent = qs.map((_, i) => i);
  const racine = i => parent[i] === i ? i : (parent[i] = racine(parent[i]));
  const vu = new Map();
  qs.forEach((q, i) => [q.navigateur && 'n' + q.navigateur, q.empreinte && 'e' + q.empreinte].filter(Boolean).forEach(cle => {
    if (vu.has(cle)) parent[racine(i)] = racine(vu.get(cle)); else vu.set(cle, i);
  }));
  const groupes = new Map(); // dans l'ordre de la 1re question de chaque profil
  qs.forEach((q, i) => { const r = racine(i); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(q); });
  return [...groupes.values()];
}
async function chargerQuestions() {
  const { data, error } = await db.from('questions').select('*').order('created_at');
  if (error) return $('questions').innerHTML = '<p class="erreur">Questions impossibles à charger : ' + echapper(error.message) + '</p>';
  if (!data.length) return $('questions').innerHTML = '<p class="consigne">Aucune question pour l\'instant.</p>';
  $('questions').replaceChildren(...profils(data).map((qs, n) => {
    const d = document.createElement('details');
    d.className = 'vote';
    d.open = true;
    d.innerHTML = `<summary><strong>Profil ${n + 1}</strong> <span>${qs.length} question${qs.length > 1 ? 's' : ''}</span></summary>`;
    qs.forEach(q => {
      const p = document.createElement('div');
      p.className = 'question-admin';
      p.innerHTML = `<span class="question-date">${dateFr(q.created_at)}</span><p></p>
        <button type="button" class="btn-petit danger"><i data-lucide="trash-2"></i> Supprimer</button>`;
      p.querySelector('p').textContent = q.texte;
      p.querySelector('button').onclick = async () => {
        if (!confirm('Supprimer cette question ? C\'est définitif.')) return;
        const { error } = await db.from('questions').delete().eq('id', q.id);
        if (error) return erreur($('admin-erreur'), 'Suppression impossible : ' + error.message);
        chargerQuestions();
      };
      d.append(p);
    });
    return d;
  }));
  icones();
}

// ---------- Ouvrir / fermer ----------
function majEtat() {
  $('etat').textContent = sondageOuvert ? 'Sondage ouvert' : 'Sondage fermé';
  $('etat').className = 'etat ' + (sondageOuvert ? 'ouvert' : 'ferme');
  $('btn-ouvrir').textContent = sondageOuvert ? 'Fermer le sondage' : 'Ouvrir le sondage';
}
$('btn-ouvrir').onclick = async () => {
  if (sondageOuvert && !confirm('Fermer le sondage ? Plus personne ne pourra voter.')) return;
  $('btn-ouvrir').disabled = true;
  const { error } = await db.from('settings').update({ poll_open: !sondageOuvert }).eq('id', 1);
  $('btn-ouvrir').disabled = false;
  if (error) return erreur($('admin-erreur'), 'Changement impossible : ' + error.message);
  sondageOuvert = !sondageOuvert;
  majEtat();
};

// ---------- Table des points ----------
function remplirPoints() {
  document.querySelectorAll('[data-rang]').forEach(i => i.value = cfg.top[i.dataset.rang]);
  $('mult').value = cfg.mult;
  majApercuPoints();
}
function majApercuPoints() {
  $('apercu-points').textContent = 'Aperçu : ' + Array.from({ length: 8 }, (_, i) => (i + 1) + (i ? 'e' : 'er') + ' = ' + fmt(pointsPourRang(i + 1, cfg))).join(' · ') + '…';
}
document.querySelector('.points').addEventListener('input', () => {
  const n = el => Math.max(0, parseFloat(el.value) || 0);
  document.querySelectorAll('[data-rang]').forEach(i => cfg.top[i.dataset.rang] = n(i));
  cfg.mult = n($('mult'));
  majApercuPoints();
  afficherResultats();
});
$('btn-defaut').onclick = () => { cfg = structuredClone(POINTS_PAR_DEFAUT); remplirPoints(); afficherResultats(); };

// ---------- Affichage ----------
function afficher() {
  majEtat();
  afficherResultats();
  afficherVotes();
}

function afficherResultats() {
  resultats = calculerClassement(persos, votes, cfg);
  afficherKpis();
  afficherTableau();
  afficherGraphiques();
}

function afficherKpis() {
  const classes = resultats.filter(l => l.votants > 0).length;
  const moyenne = votes.length ? votes.reduce((s, v) => s + v.ranking.length, 0) / votes.length : 0;
  $('kpis').innerHTML = [
    [votes.length, votes.length > 1 ? 'votants' : 'votant'],
    [classes + ' / ' + persos.length, 'persos classés au moins 1 fois'],
    [fmt(moyenne, 1), 'persos classés par vote (moyenne)']
  ].map(([n, t]) => `<div class="kpi"><strong>${n}</strong><span>${t}</span></div>`).join('');
}

function afficherTableau() {
  $('tableau').replaceChildren(...resultats.map(l => {
    const tr = document.createElement('tr');
    tr.className = l.votants ? '' : 'sans-vote';
    tr.dataset.id = l.perso.id;
    tr.tabIndex = 0;
    tr.innerHTML = `<td class="t-rang">${libellePosition(l)}</td><td class="t-perso"><span class="nom"></span></td>
      <td>${l.tops[0]}</td><td>${l.tops[1]}</td><td>${l.tops[2]}</td><td>${l.votants}</td><td class="t-score">${fmt(l.score)}</td>`;
    tr.querySelector('.nom').textContent = l.perso.nom;
    tr.querySelector('.t-perso').prepend(creerVignette(l.perso));
    return tr;
  }));
}

const ouvrirDetail = e => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr || (e.type === 'keydown' && e.key !== 'Enter')) return;
  const l = resultats.find(x => x.perso.id === tr.dataset.id);
  $('detail-nom').textContent = l.perso.nom;
  $('detail-corps').innerHTML = `<p><strong>${libellePosition(l)}</strong> · ${fmt(l.score)} pts · classé par ${l.votants} votant${l.votants > 1 ? 's' : ''}</p>` +
    (l.recus.length
      ? '<ul class="detail-liste">' + l.recus.map(r => `<li><span>Vote #${r.vote}</span><strong>${r.rang === 1 ? '1er' : r.rang + 'e'}</strong><span>${fmt(pointsPourRang(r.rang, cfg))} pts</span></li>`).join('') + '</ul>'
      : '<p class="consigne">Personne ne l\'a classé.</p>');
  $('detail-corps').prepend(creerVignette(l.perso));
  $('detail').showModal();
};
$('tableau').addEventListener('click', ouvrirDetail);
$('tableau').addEventListener('keydown', ouvrirDetail);
$('detail-fermer').onclick = () => $('detail').close();
$('detail').addEventListener('click', e => { if (e.target === $('detail')) $('detail').close(); });

// ---------- Graphiques ----------
if (window.Chart) {
  Chart.defaults.color = '#c9d6e3';
  Chart.defaults.borderColor = 'rgba(223, 230, 255, .12)';
  Chart.defaults.font.family = "'Trilogy', 'Trebuchet MS', Arial, sans-serif";
  Chart.defaults.font.weight = 600;
}
const COULEURS_RANGS = ['#f5a623', '#2b87c3', '#d7262b', '#8fa3b8', '#4a5568'];

function graphique(id, labels, datasets, empile) {
  if (!window.Chart) return;
  graphiques[id] && graphiques[id].destroy();
  $(id + '-boite').style.height = Math.max(160, labels.length * 28 + 70) + 'px';
  graphiques[id] = new Chart($(id), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      indexAxis: 'y', maintainAspectRatio: false, animation: { duration: 300 },
      scales: { x: { stacked: empile, beginAtZero: true }, y: { stacked: empile, ticks: { autoSkip: false } } },
      plugins: { legend: { display: datasets.length > 1, position: 'bottom' } }
    }
  });
}

function afficherGraphiques() {
  const classes = resultats.filter(l => l.votants > 0);
  const labels = classes.map(l => l.perso.nom);
  graphique('g-scores', labels, [{
    label: 'Score', data: classes.map(l => +l.score.toFixed(2)),
    backgroundColor: classes.map(l => l.position <= 3 ? COULEURS_RANGS[l.position - 1] : '#4a5568'), borderRadius: 4
  }], false);
  const tranches = [['1er', r => r === 1], ['2e', r => r === 2], ['3e', r => r === 3], ['4e–5e', r => r === 4 || r === 5], ['6e et +', r => r >= 6]];
  graphique('g-rangs', labels, tranches.map(([nom, test], i) => ({
    label: nom, data: classes.map(l => l.recus.filter(x => test(x.rang)).length), backgroundColor: COULEURS_RANGS[i]
  })), true);
}

// ---------- Votes individuels ----------
function afficherVotes() {
  if (!votes.length) return $('votes').innerHTML = '<p class="consigne">Aucun vote pour l\'instant.</p>';
  $('votes').replaceChildren(...votes.map((v, i) => {
    const d = document.createElement('details');
    d.className = 'vote';
    d.innerHTML = `<summary><strong>Vote #${i + 1}</strong> <span>${dateFr(v.created_at)} · ${v.ranking.length} perso${v.ranking.length > 1 ? 's' : ''}</span></summary>
      <ol></ol><button type="button" class="btn-petit danger"><i data-lucide="trash-2"></i> Supprimer ce vote</button>`;
    d.querySelector('ol').innerHTML = v.ranking.map(id => `<li>${echapper(nomDe(id))}</li>`).join('');
    d.querySelector('button').onclick = () => supprimer(v, i + 1);
    return d;
  }));
  icones();
}

async function supprimer(v, numero) {
  if (!confirm(`Supprimer le vote #${numero} (${dateFr(v.created_at)}) ?\nC'est définitif.`)) return;
  const { error } = await db.from('votes').delete().eq('id', v.id);
  if (error) return erreur($('admin-erreur'), 'Suppression impossible : ' + error.message);
  await recharger();
}

// ---------- Exports CSV (séparateur ; et virgule décimale pour Excel en français) ----------
function telecharger(nom, lignes) {
  const cellule = c => /[;"\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : String(c);
  const csv = '﻿' + lignes.map(l => l.map(cellule).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nom;
  a.click();
  URL.revokeObjectURL(a.href);
}
const nombre = n => n.toFixed(3).replace('.', ',');

$('btn-csv-resultats').onclick = () => telecharger('resultats.csv', [
  ['Rang', 'Personnage', 'Id', 'Top 1', 'Top 2', 'Top 3', 'Votants', 'Meilleur rang', 'Score'],
  ...resultats.map(l => [libellePosition(l), l.perso.nom, l.perso.id, ...l.tops, l.votants, l.votants ? l.meilleur : '', nombre(l.score)])
]);
$('btn-csv-votes').onclick = () => telecharger('votes.csv', [
  ['Vote', 'Date', 'Rang', 'Id perso', 'Personnage'],
  ...votes.flatMap((v, i) => v.ranking.map((id, r) => ['#' + (i + 1), dateFr(v.created_at), r + 1, id, nomDe(id)]))
]);

icones();
demarrer();
