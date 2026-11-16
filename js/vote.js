// Parcours du votant : règles → découverte → vote → validation.

const CLE_VOTE = 'sondage_a_vote';
const CLE_BROUILLON = 'sondage_brouillon';
const $ = id => document.getElementById(id);

const lire = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const ecrire = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let persos = [];
let parId = new Map();
let brouillon = { etape: 'regles', classement: [], id: null };
let modeVote = false;

// [expression du juge, texte] — le texte revient à la ligne tout seul ; 3 lignes maximum par réplique,
// sinon on continue dans la réplique suivante (\n seulement pour un retour voulu, comme la liste des points).
const REGLES = [
  ['positif', "Bienvenue au sondage de popularité de la série !"],
  ['stand', "Tu vas classer les personnages dans l'ordre que tu veux. Aucune limite de nombre !"],
  ['non', "Ceux que tu ne classes pas ne reçoivent aucun point."],
  ['yeux', "Voici les points :\n1er = 10 points\n2e = 6 points"],
  ['stand', "3e = 4 points\n4e = 2 points"],
  ['yeux', "Ensuite, chaque rang vaut 0,8 fois le précédent :"],
  ['stand', "5e = 1,6 points\n6e = 1,28 points\n7e = 1,02 points, et ainsi de suite…"],
  ['surpris', "L'ordre compte ! Ton 1er pèse bien plus lourd que les suivants."],
  ['stand', "D'abord, regarde TOUS les personnages. Le vote s'ouvrira une fois arrivé en bas du dossier."],
  ['negatif', "Ton vote est définitif : tu ne voteras qu'une seule fois. Il est anonyme, personne ne verra ton classement."]
];

// ---------- Utilitaires ----------
function montrer(ecran) {
  document.querySelectorAll('.ecran').forEach(e => e.hidden = e.id !== 'ecran-' + ecran);
  $('barre').hidden = ecran !== 'grille';
  window.scrollTo(0, 0);
}

function message(texte, pose) {
  montrer('message');
  machine($('message-texte'), texte, pose);
}

function sauver() { ecrire(CLE_BROUILLON, brouillon); }

// ---------- Éléments d'objection.lol, copiés dans le projet (tests/copier-elements.js) ----------
const OL = 'assets/objection/';
const JUGE = OL + 'Images/Characters/10/';
// expression : [muet, parle, animation avant, durée en ms]
const POSES = {
  stand: ['Stand', 'Stand_Talk'],
  positif: ['Stand', 'Stand_Talk', 'Special_2', 650],
  negatif: ['Negative_Stand', 'Negative_Talk', 'Special_1', 700],
  surpris: ['Surprised_Stand', 'Surprised_Talk'],
  yeux: ['Closed_Eyes', 'Closed_Eyes'],
  non: ['Headshake', 'Headshake']
};
const son = url => { const a = new Audio(url); a.volume = 0.5; return () => { if (sonCoupe) return; a.currentTime = 0; a.play().catch(() => {}); }; };
const blip = son(OL + 'Audio/blip.wav');                 // voix « Male »
const criTakeThat = son(OL + 'Audio/Vocal/3/1.mp3');     // « Take that! » de Phoenix
const sonMarteau = son(OL + 'Audio/Vocal/1/10.mp3');     // triple coup de marteau du juge
const sonPorte = son(OL + 'Audio/Sound/deskslam.mp3');   // « Deskslam » du jeu : choc des portes qui se ferment

document.querySelectorAll('.scene').forEach(s => {
  const img = new Image();
  img.className = 'scene-perso';
  img.alt = '';
  img.src = JUGE + 'Stand.gif';
  s.prepend(img);
  s.querySelector('.scene-nom').textContent = 'Juge';
});
const sprite = el => el.closest('.scene').querySelector('.scene-perso');

// ---------- Musiques de fond (volume doux, fondu enchaîné d'une seconde) ----------
// Volumes égalisés d'après la puissance mesurée de chaque fichier (titre -18 dB, autres -15 dB).
const MUSIQUES = {
  titre: { url: 'assets/musique/ecran-titre.mp3', volume: 0.28 },                 // « Ace Attorney Trilogy - Title Theme »
  avantVote: { url: 'assets/musique/ichinichi-no-hajimari.mp3', volume: 0.2 },
  vote: { url: OL + 'Audio/Music/search%20core.ogg', volume: 0.21 }, // « Investigation ~ Core 2001 »
  suspense: { url: OL + 'Audio/Music/suspense.ogg', volume: 0.21 } // « Suspense2001 », pour « Es-tu sûr ? »
};
let piste = null, pisteNom = null;
let sonCoupe = lire('sondage_son_coupe') === true;
function fondu(a, cible, ms, fin) {
  const depart = a.volume, t0 = performance.now();
  const pas = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = depart + (cible - depart) * k;
    if (k < 1) requestAnimationFrame(pas); else if (fin) fin();
  };
  requestAnimationFrame(pas);
}
function musique(nom) {
  if (nom === pisteNom) return;
  const ancienne = piste;
  if (ancienne) fondu(ancienne, 0, 1000, () => ancienne.pause());
  pisteNom = nom;
  piste = null;
  if (!nom) return;
  const a = new Audio(MUSIQUES[nom].url);
  a.loop = true;
  a.volume = 0;
  a.muted = sonCoupe;
  a.play().catch(() => { a.bloquee = true; }); // navigateur : pas de son avant un premier clic
  fondu(a, MUSIQUES[nom].volume, 1000);
  piste = a;
}
function majBoutonSon() {
  $('btn-son').textContent = sonCoupe ? '♪ Son : non' : '♪ Son : oui';
  $('btn-son').setAttribute('aria-pressed', !sonCoupe);
}
$('btn-son').onclick = () => {
  sonCoupe = !sonCoupe;
  ecrire('sondage_son_coupe', sonCoupe);
  if (piste) piste.muted = sonCoupe;
  majBoutonSon();
};
majBoutonSon();

// Machine à écrire avec la voix ; pause de 300 ms après chaque ponctuation.
// Comme sur objection.lol, le juge garde l'animation « parle » pendant toute la réplique
// (pauses comprises) et ne repasse en « muet » qu'à la fin : on ne relance jamais un GIF
// pour rien, sinon son clignement des yeux repart de zéro et le rythme devient bizarre.
const PONCTUATION = /[.,!?;:…]/;
function machine(el, texte, pose = 'stand') {
  clearTimeout(el._avant);
  clearTimeout(el._minuteur);
  const [muet, parle, avant, duree] = POSES[pose];
  const voir = nom => {
    const src = JUGE + nom + '.gif';
    if (sprite(el).getAttribute('src') !== src) sprite(el).src = src;
  };
  el.textContent = '';
  el.classList.remove('fini');
  el._finir = () => {
    clearTimeout(el._avant);
    clearTimeout(el._minuteur);
    el.textContent = texte;
    el.classList.add('fini');
    voir(muet);
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return el._finir();
  let i = 0;
  const lettre = () => {
    const c = texte[i++];
    el.textContent = texte.slice(0, i);
    if (i >= texte.length) return el._finir();
    if (c.trim() && i % 2 && !sonCoupe) blip();
    // pause après une ponctuation, et à chaque retour à la ligne (entre les rangs des points)
    const pause = (PONCTUATION.test(c) && /\s/.test(texte[i])) || texte[i] === '\n';
    el._minuteur = setTimeout(lettre, pause ? 300 : 30);
  };
  const taper = () => { voir(parle); lettre(); };
  if (avant) { voir(avant); el._avant = setTimeout(taper, duree); } else taper();
}
const enCours = el => !el.classList.contains('fini');

// ---------- Portes du tribunal (animation fournie, lue une seule fois, sans boucle) ----------
// Le fichier contient 7 images de fermeture puis l'image « fermée » ; on les décode
// pour les rejouer à l'endroit (fermeture) ou à l'envers (ouverture).
const PORTES_URL = 'assets/objection/portes.webp'; // copie de l'animation fournie (file.garden)
const chargementPortes = (async () => {
  if (!('ImageDecoder' in window)) return null; // shortcut: navigateurs sans ImageDecoder (Safari) = pas de portes
  const rep = await fetch(PORTES_URL);
  const dec = new ImageDecoder({ data: rep.body, type: 'image/webp' });
  await dec.completed;
  const images = [];
  for (let i = 0; i < dec.tracks.selectedTrack.frameCount; i++) {
    const { image } = await dec.decode({ frameIndex: i });
    images.push(await createImageBitmap(image, { resizeWidth: 1280, resizeHeight: 720 })); // plus léger sur mobile
    image.close();
  }
  return images;
})().catch(() => null);

function dessinerPorte(image) {
  const c = $('portes'), x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(image, 0, 0, c.width, c.height);
}
// sens : 'ferme' (finit portes fermées, affichées) ou 'ouvre' (finit portes cachées).
async function portes(sens) {
  const images = await chargementPortes;
  if (!images) return false;
  const suite = sens === 'ouvre' ? [...images].reverse() : images;
  $('portes').hidden = false;
  for (const image of suite) {
    dessinerPorte(image);
    if (sens === 'ferme' && image === images[images.length - 1]) sonPorte(); // les deux battants se rejoignent
    await new Promise(ok => setTimeout(ok, 40)); // 40 ms par image, comme dans le fichier
  }
  if (sens === 'ouvre') $('portes').hidden = true;
  return true;
}
const attendreFinDuTexte = el => new Promise(ok => {
  const t = setInterval(() => { if (!enCours(el)) { clearInterval(t); setTimeout(ok, 1200); } }, 100);
});

// Le juge hoche la tête une fois (« Special_2 », 650 ms) puis reprend sa pose normale.
function hocherLaTete(el) {
  const img = sprite(el);
  img.src = '';                         // relance l'animation depuis le début
  img.src = JUGE + 'Special_2.gif';
  return new Promise(ok => setTimeout(() => { img.src = JUGE + 'Stand.gif'; ok(); }, 650));
}

// Fin du vote : le juge frappe trois fois le marteau.
const MARTEAU = OL + 'Images/gavel.webp';
new Image().src = MARTEAU; // préchargé pour qu'il s'affiche sans délai
function marteau(el) {
  const scene = el.closest('.scene');
  el.textContent = '';
  scene.classList.add('marteau'); // plein écran, sans boîte de dialogue, comme dans le jeu
  sprite(el).src = MARTEAU;
  sonMarteau();
  return new Promise(ok => setTimeout(() => { scene.classList.remove('marteau'); ok(); }, 1600));
}
// ne fait rien si la phrase est déjà finie (sinon un clic remettrait la pose « muet » par-dessus une animation)
const finirMachine = el => enCours(el) && el._finir && el._finir();

const normaliser = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const pluriel = n => n + (n > 1 ? ' personnages classés' : ' personnage classé');

// ---------- Démarrage ----------
async function demarrer() {
  if (lire(CLE_VOTE)) return message("Tu as déjà voté.\nMerci pour ta participation !", 'positif');
  try {
    persos = await chargerPersos();
  } catch {
    return message("Impossible de charger les personnages.\nRecharge la page.", 'negatif');
  }
  parId = new Map(persos.map(p => [p.id, p]));

  if (db) {
    const { data, error } = await db.from('settings').select('poll_open').eq('id', 1).maybeSingle();
    if (!error && data && !data.poll_open) return message("Le sondage est terminé.\nMerci à tous !", 'yeux');
  }

  construireGrille();
  const b = lire(CLE_BROUILLON);
  if (b && b.etape === 'vote') brouillon = { ...b, classement: (b.classement || []).filter(id => parId.has(id)) };
  // Écran d'accueil : un clic est obligatoire (il autorise aussi le navigateur à jouer la musique).
  $('intro-texte').textContent = BIENVENUE;
  // trois copies superposées : contour noir, contour blanc, lettres en dégradé bleu
  [['logo-haut', LOGO_HAUT], ['logo-bas', LOGO_BAS]].forEach(([id, t]) => {
    $(id).replaceChildren(...['noir', 'blanc', 'bleu'].map(c => {
      const s = document.createElement('span');
      s.className = 'logo-' + c;
      s.textContent = t;
      if (c !== 'bleu') s.setAttribute('aria-hidden', 'true');
      return s;
    }));
  });
  montrer('intro');
  $('intro').focus();
  musique('titre');
  // Portes fermées derrière le texte d'accueil dès qu'elles sont prêtes.
  chargementPortes.then(images => {
    if (!images || $('ecran-intro').hidden) return;
    dessinerPorte(images[images.length - 1]);
    $('portes').hidden = false;
    document.body.classList.add('avec-portes');
  });
}

// Clic : les portes du procès s'ouvrent (animation à l'envers) sur la suite.
$('intro').onclick = () => {
  // Si le navigateur a bloqué la musique titre, ce premier clic la lance seulement ;
  // le clic suivant ouvre les portes.
  if (pisteNom === 'titre' && piste && piste.bloquee) {
    piste.bloquee = false;
    piste.play().catch(() => {});
    return;
  }
  if (brouillon.etape === 'vote') ouvrirVote(); else ouvrirRegles();
  document.body.classList.remove('avec-portes');
  if (!$('portes').hidden) portes('ouvre');
};

// ---------- Règles ----------
let page = 0;
function ouvrirRegles(depuisLaFin) {
  page = depuisLaFin ? REGLES.length - 1 : 0;
  musique('titre'); // la musique titre continue pendant les explications du juge
  montrer('accueil');
  afficherRegle();
}
function afficherRegle() {
  machine($('regles-texte'), REGLES[page][1], REGLES[page][0]);
  $('regles-page').textContent = (page + 1) + ' / ' + REGLES.length;
  $('regles-prec').disabled = page === 0;
  $('regles-suiv').textContent = page === REGLES.length - 1 ? 'Commencer' : 'Suivant ►';
}
// Clic : finit la phrase en cours, puis passe à la suivante.
function suivant() {
  if (enCours($('regles-texte'))) return finirMachine($('regles-texte'));
  if (page < REGLES.length - 1) { page++; afficherRegle(); } else ouvrirDecouverte();
}
document.querySelector('#ecran-accueil .scene').onclick = suivant;
$('regles-suiv').onclick = suivant;
$('regles-passer').onclick = () => finirMachine($('regles-texte'));
$('regles-prec').onclick = () => { if (page > 0) { page--; afficherRegle(); } };

// ---------- Grille ----------
function construireGrille() {
  const grille = $('grille');
  grille.replaceChildren(...persos.map(creerCarte));
  icones();
  if (grille.lastElementChild) observateurFin.observe(grille.lastElementChild);
}

$('grille').addEventListener('click', e => {
  const carte = e.target.closest('.carte');
  if (!carte) return;
  const p = parId.get(carte.dataset.id);
  if (!modeVote || e.target.closest('.carte-loupe')) return zoomer(p);
  if (e.target.closest('.carte-cadre')) basculer(p.id);
});

function zoomer(p) {
  const img = $('zoom-img');
  img.classList.remove('manquante');
  img.removeAttribute('src');
  imageOuRemplacement(img, p.image);
  $('zoom-vide').textContent = p.nom;
  $('zoom-nom').textContent = p.nom;
  $('zoom').showModal();
}
$('zoom-fermer').onclick = () => $('zoom').close();
$('zoom').addEventListener('click', e => { if (e.target === $('zoom')) $('zoom').close(); });

// Recherche : surligne les cartes trouvées et va à la première (Entrée = suivante).
let trouvees = [], indexTrouvee = 0;
$('recherche').addEventListener('input', () => {
  const q = normaliser($('recherche').value);
  document.querySelectorAll('.carte').forEach(c => c.classList.remove('trouve'));
  trouvees = q ? [...document.querySelectorAll('.carte')].filter(c => normaliser(parId.get(c.dataset.id).nom).includes(q)) : [];
  trouvees.forEach(c => c.classList.add('trouve'));
  $('recherche-info').textContent = q ? (trouvees.length ? trouvees.length + ' trouvé' + (trouvees.length > 1 ? 's' : '') : 'aucun') : '';
  indexTrouvee = 0;
  allerA(trouvees[0]);
});
$('recherche').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !trouvees.length) return;
  e.preventDefault();
  indexTrouvee = (indexTrouvee + 1) % trouvees.length;
  allerA(trouvees[indexTrouvee]);
});
function allerA(carte) {
  if (!carte) return;
  carte.scrollIntoView({ behavior: 'smooth', block: 'center' });
  carte.classList.remove('flash');
  void carte.offsetWidth;
  carte.classList.add('flash');
}

// ---------- Étape 1 : découverte ----------
let toutVu = false;
function ouvrirDecouverte() {
  modeVote = false;
  musique('avantVote');
  $('ecran-grille').className = 'ecran mode-decouverte';
  $('etape').textContent = 'Étape 1 · Découverte';
  $('consigne').textContent = "Découvre tous les personnages. Touche une carte pour l'agrandir. Le bouton pour voter apparaîtra quand tu seras arrivé en bas du dossier.";
  $('btn-arriere').textContent = '◄ Règles';
  $('panneau').hidden = true;
  $('barre-vu').hidden = false;
  majBoutonVu();
  montrer('grille');
}

// « J'ai tout vu » reste grisé tant que la dernière rangée de cartes n'est pas apparue
// (marge : un quart de la dernière carte visible au-dessus de la barre du bas suffit).
function majBoutonVu() {
  $('btn-vu').disabled = !toutVu;
  $('btn-vu').textContent = toutVu ? "J'ai tout vu, je commence à voter" : "Descends jusqu'en bas du dossier…";
}
const observateurFin = new IntersectionObserver(entrees => {
  if (entrees.some(e => e.isIntersecting) && !modeVote && !$('ecran-grille').hidden) { toutVu = true; majBoutonVu(); }
}, { rootMargin: '0px 0px -90px 0px', threshold: 0.25 });

// On peut toujours revenir en arrière tant que le vote n'est pas validé.
$('btn-arriere').onclick = () => modeVote ? ouvrirDecouverte() : ouvrirRegles(true);

$('btn-vu').onclick = ouvrirVote;

// ---------- Étape 2 : vote ----------
function ouvrirVote() {
  modeVote = true;
  toutVu = true;
  musique('vote');
  $('btn-arriere').textContent = '◄ Persos';
  $('ecran-grille').className = 'ecran mode-vote';
  $('etape').textContent = 'Étape 2 · Vote';
  $('consigne').textContent = "Touche les cartes dans l'ordre de ta préférence : la 1re touchée est ta n°1. Retouche une carte pour la retirer. La loupe sert à agrandir.";
  $('barre-vu').hidden = true;
  $('panneau').hidden = false;
  brouillon.etape = 'vote';
  if (!brouillon.id) brouillon.id = crypto.randomUUID(); // même id à chaque essai = jamais deux votes
  sauver();
  majClassement();
  montrer('grille');
}

function basculer(id) {
  const i = brouillon.classement.indexOf(id);
  if (i >= 0) brouillon.classement.splice(i, 1); // les suivants remontent d'un rang tout seuls
  else brouillon.classement.push(id);
  sauver();
  majClassement(i >= 0 ? null : id);
}

function majClassement(nouveau) {
  const c = brouillon.classement;
  document.querySelectorAll('#grille .carte').forEach(carte => {
    const r = c.indexOf(carte.dataset.id) + 1;
    carte.classList.toggle('classee', r > 0);
    carte.querySelector('.rang').textContent = r || '';
    if (carte.dataset.id === nouveau) {
      carte.classList.remove('impact');
      void carte.offsetWidth; // relance l'animation
      carte.classList.add('impact');
    }
  });

  $('liste').replaceChildren(...c.map((id, i) => {
    const li = document.createElement('li');
    li.dataset.id = id;
    li.innerHTML = `<span class="poignee" aria-hidden="true"><i data-lucide="grip-vertical"></i></span><span class="num">${i + 1}</span><span class="nom"></span><button type="button" class="retirer" aria-label="Retirer"><i data-lucide="x"></i></button>`;
    li.querySelector('.poignee').after(creerVignette(parId.get(id)));
    li.querySelector('.nom').textContent = parId.get(id).nom;
    return li;
  }));
  icones();
  $('liste-vide').hidden = c.length > 0;
  $('compteur').textContent = pluriel(c.length);
  $('btn-voter').disabled = c.length === 0;
}

$('liste').addEventListener('click', e => {
  const li = e.target.closest('li');
  if (li && e.target.closest('.retirer')) basculer(li.dataset.id);
});

if (window.Sortable) {
  Sortable.create($('liste'), {
    handle: '.poignee', animation: 150, ghostClass: 'fantome', chosenClass: 'choisi',
    onEnd() {
      brouillon.classement = [...$('liste').children].map(li => li.dataset.id);
      sauver();
      majClassement();
    }
  });
}

$('panneau-tete').onclick = () => {
  const ouvert = $('panneau').classList.toggle('ouvert');
  $('panneau-tete').setAttribute('aria-expanded', ouvert);
};

// ---------- Validation ----------
const fmt = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

$('btn-voter').onclick = () => {
  const c = brouillon.classement;
  if (!c.length) return;
  $('recap').replaceChildren(...c.map((id, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="num">${i + 1}</span><span class="nom"></span><span class="pts">${fmt(pointsPourRang(i + 1, POINTS_PAR_DEFAUT))} pts</span>`;
    li.querySelector('.num').after(creerVignette(parId.get(id)));
    li.querySelector('.nom').textContent = parId.get(id).nom;
    return li;
  }));
  $('recap-compte').textContent = pluriel(c.length) + ' (les autres reçoivent 0 point).';
  $('confirm-erreur').hidden = true;
  $('btn-valider').textContent = 'Oui, je suis sûr';
  $('choix').hidden = true;
  montrer('confirm');
  musique('suspense');
  machine($('confirm-texte'), "Es-tu sûr ? Le vote est définitif, tu ne pourras plus le modifier.", 'surpris');
  // les choix apparaissent sur la scène quand le juge a fini de parler
  const attente = setInterval(() => {
    if (enCours($('confirm-texte'))) return;
    clearInterval(attente);
    $('choix').hidden = false;
    $('btn-valider').focus();
  }, 80);
};
document.querySelector('#ecran-confirm .scene').onclick = () => finirMachine($('confirm-texte'));
document.querySelector('#ecran-message .scene').onclick = () => finirMachine($('message-texte'));

// Entrée fait parler le juge comme un clic sur le dialogue
// (sauf sur un bouton ou un champ, qui gardent leur comportement normal).
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.closest('button, input, textarea, a, dialog')) return;
  if (!$('ecran-accueil').hidden) { e.preventDefault(); suivant(); }
  else if (!$('ecran-confirm').hidden) { e.preventDefault(); finirMachine($('confirm-texte')); }
  else if (!$('ecran-message').hidden) { e.preventDefault(); finirMachine($('message-texte')); }
});
// Un clic sur un choix ne doit pas aussi compter comme un clic sur la scène (qui finit la phrase).
$('choix').addEventListener('click', e => e.stopPropagation());

// « Non » : le juge rassure d'abord, puis on revient au vote (le classement est gardé).
$('btn-retour').onclick = async () => {
  $('choix').hidden = true;
  machine($('confirm-texte'), "Ce n'est pas grave. Prends tout ton temps pour réfléchir !", 'positif');
  await attendreFinDuTexte($('confirm-texte'));
  if (!$('ecran-confirm').hidden) ouvrirVote();
};

let envoiEnCours = false;
$('btn-valider').onclick = async () => {
  if (envoiEnCours) return; // double clic : un seul envoi
  envoiEnCours = true;
  const boutons = [$('btn-valider'), $('btn-retour')];
  boutons.forEach(b => b.disabled = true);
  $('btn-valider').textContent = 'Envoi…';
  $('btn-retour').hidden = true;
  $('confirm-erreur').hidden = true;

  // Le juge hoche la tête (animation « Positive » du jeu) pendant que le vote part.
  const hochement = hocherLaTete($('confirm-texte'));
  try {
    // Mode test : sur ton PC (localhost) sans Supabase, le vote n'est envoyé nulle part
    // mais la fin se joue quand même. En ligne, jamais : l'erreur s'affiche.
    const modeTest = !db && ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!db && !modeTest) throw { message: "Supabase n'est pas encore configuré (js/config.js)." };
    if (!modeTest) {
      const { error } = await db.from('votes').insert({ id: brouillon.id, ranking: brouillon.classement });
      // 23505 = ce vote est déjà arrivé (envoi répété) : il est bien enregistré une seule fois.
      if (error && error.code !== '23505') throw error;
    }
    if (modeTest) console.info('[mode test] vote non envoyé :', brouillon.classement);
    else ecrire(CLE_VOTE, true); // en test, on peut revoter après rechargement
    ecrire(CLE_BROUILLON, null);
    await hochement;
    musique(null); // la musique s'efface pendant la bulle
    await takeThat();
    montrer('message');
    await marteau($('message-texte'));
    machine($('message-texte'), "Le vote est levé !", 'positif');
    await attendreFinDuTexte($('message-texte'));
    // Les portes se ferment, puis le remerciement s'affiche dessus.
    if (await portes('ferme')) {
      // le remerciement n'arrive qu'une fois les portes bien fermées (et le choc passé)
      await new Promise(ok => setTimeout(ok, 900));
      $('portes-texte').hidden = false;
    } else {
      machine($('message-texte'), "Merci pour ton vote !\nTon classement a bien été enregistré.", 'positif');
    }
  } catch (err) {
    console.error(err);
    $('confirm-erreur').textContent = err && err.code === '42501'
      ? "Le sondage vient d'être fermé : ton vote n'a pas pu être enregistré."
      : !db ? err.message
      : "Ton vote n'a pas pu être envoyé (problème de connexion ?). Ton classement est gardé : réessaie.";
    $('confirm-erreur').hidden = false;
    $('btn-valider').textContent = "Oui, réessayer l'envoi";
    $('btn-retour').hidden = false;
    boutons.forEach(b => b.disabled = false);
  } finally {
    envoiEnCours = false;
  }
};

function takeThat() {
  $('take-that').hidden = false;
  criTakeThat();
  document.body.classList.add('secousse');
  return new Promise(ok => setTimeout(() => {
    $('take-that').hidden = true;
    document.body.classList.remove('secousse');
    ok();
  }, 950)); // durée d'une bulle sur objection.lol
}

icones();
demarrer();
