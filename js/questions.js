// Boîte à questions anonyme (FAQ) : René accueille à la barre des témoins, on écrit, on envoie.
// Les visiteurs peuvent seulement envoyer ; seul l'admin lit (règles dans questions.sql).

const $ = id => document.getElementById(id);
const lire = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const db = SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Identifiant tiré au hasard et gardé dans ce navigateur : regroupe les questions d'un même appareil dans l'admin.
let navigateur = lire('faq_navigateur');
if (!navigateur) { navigateur = crypto.randomUUID(); ecrire('faq_navigateur', navigateur); }

// ---------- Éléments d'objection.lol (copiés dans le projet) ----------
const OL = '../assets/objection/';
const RENE = OL + 'Images/Characters/52/'; // Victor Kudo, à la barre des témoins
const POSES = { // [muet, parle]
  stand: ['Stand', 'Stand_Talk'],
  surpris: ['Surprised', 'Surprised_Talk'],
  content: ['Pumped', 'Pumped_Talk'],
  colere: ['Angry', 'Angry_Talk'],
  timide: ['Shy', 'Shy_Talk']
};
let sonCoupe = lire('sondage_son_coupe') === true; // même réglage que le sondage
const son = url => { const a = new Audio(url); a.volume = 0.5; return () => { if (sonCoupe) return; a.currentTime = 0; a.play().catch(() => {}); }; };
const blip = son(OL + 'Audio/blip.wav');
const criTakeThat = son(OL + 'Audio/Vocal/3/1.mp3');

// Musique « Maya Fey » d'objection.lol, en boucle, volume égalisé avec celles du sondage
const musique = new Audio(OL + 'Audio/Music/maya.ogg');
musique.loop = true;
musique.preload = 'auto';
musique.volume = 0.26;
musique.muted = sonCoupe;
// les navigateurs bloquent le son avant le premier geste : on (re)lance au premier clic ou touche
['pointerdown', 'keydown', 'touchstart'].forEach(t => document.addEventListener(t, () => { if (musique.paused) musique.play().catch(() => {}); }, true));

function majBoutonSon() {
  $('btn-son').textContent = sonCoupe ? '♪ Son : non' : '♪ Son : oui';
  $('btn-son').setAttribute('aria-pressed', !sonCoupe);
}
$('btn-son').onclick = () => {
  sonCoupe = !sonCoupe;
  ecrire('sondage_son_coupe', sonCoupe);
  musique.muted = sonCoupe;
  majBoutonSon();
};
majBoutonSon();

// ---------- Machine à écrire (même rythme que le sondage : 30 ms, pause de 300 ms à la ponctuation) ----------
const PONCTUATION = /[.,!?;:…]/;
const texte = $('texte');
function voir(nom) {
  const src = RENE + nom + '.gif';
  if ($('rene').getAttribute('src') !== src) $('rene').src = src;
}
function dire(phrase, pose = 'stand') {
  clearTimeout(texte._minuteur);
  const [muet, parle] = POSES[pose];
  texte.textContent = '';
  texte.classList.remove('fini');
  return new Promise(ok => {
    texte._finir = () => {
      clearTimeout(texte._minuteur);
      texte.textContent = phrase;
      texte.classList.add('fini');
      voir(muet);
      ok();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return texte._finir();
    voir(parle);
    let i = 0;
    const lettre = () => {
      const c = phrase[i++];
      texte.textContent = phrase.slice(0, i);
      if (i >= phrase.length) return texte._finir();
      if (c.trim() && i % 2) blip();
      const pause = (PONCTUATION.test(c) && /\s/.test(phrase[i])) || phrase[i] === '\n';
      texte._minuteur = setTimeout(lettre, pause ? 300 : 30);
    };
    lettre();
  });
}
// Clic sur la scène ou Entrée : finit la phrase en cours, sinon passe à la suivante.
let suite = null;
const avancer = () => {
  if (!texte.classList.contains('fini')) return texte._finir && texte._finir();
  if (suite) { const s = suite; suite = null; s(); }
};
document.querySelector('.scene').onclick = avancer;
document.addEventListener('keydown', e => { if (e.key === 'Enter' && document.activeElement !== $('question')) avancer(); });
const attendreClic = () => new Promise(ok => { suite = ok; });

// ---------- Déroulé ----------
// René : vigile du tribunal, vieux, aigri, rabat-joie, persuadé que « c'était mieux avant ».
// Il ne supporte pas Auxane. Chaque réplique est tirée au hasard (jamais deux fois de suite le même accueil).
const ACCUEILS = [
  [['colere', "Halte ! Sécurité. Qu'est-ce que tu fabriques ici ?"],
   ['stand', "Une question pour la FAQ ? Pff… De mon temps, on posait ses questions en face."],
   ['stand', "Bon. Écris-la en dessous, je la transmettrai au boss. Et que ça saute."]],
  [['surpris', "Oh ! Quelqu'un !"],
   ['content', "Ouf, c'est pas Auxane, le gros au chapeau moche. Celui-là, je peux pas le voir."],
   ['stand', "Bon, t'as une question pour la FAQ ? Écris-la, je la transmettrai au boss."]],
  [['colere', "Qui vient me déranger pendant ma ronde ?!"],
   ['stand', "Une question… Évidemment. Les jeunes, ça pose des questions au lieu de travailler."],
   ['stand', "Écris-la en dessous. Je la transmettrai au boss, sans dire de qui elle vient."]],
  [['stand', "Boîte à questions de KA. Pas de bruit, pas de bêtises, pas de chewing-gum."],
   ['colere', "Pas besoin de ton nom. Tu écris, je transmets au boss, et tu circules."]],
  [['colere', "Si t'es Auxane, demi-tour immédiatement. Je l'ai à l'œil, celui-là."],
   ['stand', "… Bon, t'as pas l'air d'être lui. Écris ta question, je la transmettrai au boss."]]
];
const MERCIS = [
  ['stand', "Reçu. Je la transmettrai au boss… quand j'aurai fini ma pause."],
  ['colere', "C'est noté. Le boss en fera ce qu'il veut, moi je m'en lave les mains."],
  ['stand', "Bien reçu. Encore une question de jeune, tiens."]
];
const SUITE = [
  ['stand', "Autre chose, ou on peut enfin en rester là ?"],
  ['colere', "C'est tout ? Dis-moi que c'est tout."]
];
const ENCORE = [
  ['colere', "Encore ?! Bon… vas-y, mais c'est la dernière."],
  ['stand', "Pff. Allez, écris. J'ai que ça à faire, apparemment."],
  ['surpris', "Encore une ?! De mon temps, on se contentait d'une seule."]
];
const FIN = [
  ['content', "Enfin ! Allez, du balai, et referme bien la porte en sortant."],
  ['stand', "Parfait. Circulez, y'a rien à voir."],
  ['content', "Bon débarras. Et si tu croises Auxane, dis-lui que je l'ai à l'œil."]
];
const auHasard = t => t[Math.floor(Math.random() * t.length)];
const direAuHasard = t => { const [pose, phrase] = auHasard(t); return dire(phrase, pose); };

async function accueil() {
  $('aide').hidden = false;
  let n = Math.floor(Math.random() * ACCUEILS.length);
  if (n === lire('faq_dernier_accueil')) n = (n + 1) % ACCUEILS.length;
  ecrire('faq_dernier_accueil', n);
  const repliques = ACCUEILS[n];
  for (const [i, [pose, phrase]] of repliques.entries()) {
    await dire(phrase, pose);
    if (i < repliques.length - 1) await attendreClic();
  }
  $('aide').hidden = true;
  // 1 fois sur 10, contrôle d'identité : Auxane est refoulé (il faut recharger la page pour réessayer)
  if (Math.random() < 0.1) {
    await dire("Attends… T'es pas Auxane, toi ?", 'colere');
    if (await choisir("Oui, c'est moi", 'Non')) {
      await dire("J'EN ÉTAIS SÛR ! DÉGAGE D'ICI, ET QUE JE TE REVOIE PLUS !", 'colere');
      return; // fin : pas de question possible
    }
    await dire("Hm. T'as de la chance. Écris ta question, et vite.", 'stand');
  }
  ouvrirFormulaire();
}

function ouvrirFormulaire() {
  $('choix').hidden = true;
  $('form').hidden = false;
  $('question').value = '';
  majCompteur();
  $('question').focus();
}
const majCompteur = () => { $('compteur').textContent = $('question').value.length + ' / 1000'; };
$('question').oninput = majCompteur;

let envoiEnCours = false;
$('form').onsubmit = async e => {
  e.preventDefault();
  const q = $('question').value.trim();
  if (!q || envoiEnCours) return;
  envoiEnCours = true;
  $('btn-envoyer').disabled = true;
  $('btn-envoyer').textContent = 'Envoi…';
  $('erreur').hidden = true;
  try {
    if (!db) throw new Error("Supabase n'est pas configuré (js/config.js).");
    const { error } = await db.from('questions').insert({ texte: q, navigateur });
    if (error) throw error;
    $('form').hidden = true;
    await takeThat();
    await direAuHasard(MERCIS);
    $('aide').hidden = false;
    await attendreClic();
    $('aide').hidden = true;
    await direAuHasard(SUITE);
    if (await choisir('Encore une question', "C'est tout pour le moment")) {
      await direAuHasard(ENCORE);
      ouvrirFormulaire();
    } else {
      await direAuHasard(FIN);
    }
  } catch (err) {
    $('erreur').textContent = "L'envoi n'a pas marché (" + (err.message || 'connexion') + "). Ta question est toujours là : réessaie.";
    $('erreur').hidden = false;
    dire("Hein ? Ta question ne m'est jamais arrivée. Ces machines modernes, j'vous jure… Réessaie.", 'surpris');
  } finally {
    envoiEnCours = false;
    $('btn-envoyer').disabled = false;
    $('btn-envoyer').textContent = 'Envoyer';
  }
};
$('choix').addEventListener('click', e => e.stopPropagation()); // un clic sur un choix n'avance pas le dialogue
// Affiche deux choix sur la scène et renvoie true pour le premier, false pour le second.
function choisir(premier, second) {
  $('btn-autre').textContent = premier;
  $('btn-fin').textContent = second;
  $('choix').hidden = false;
  $('btn-autre').focus();
  return new Promise(ok => {
    $('btn-autre').onclick = () => { $('choix').hidden = true; ok(true); };
    $('btn-fin').onclick = () => { $('choix').hidden = true; ok(false); };
  });
}

function takeThat() {
  $('take-that').hidden = false;
  criTakeThat();
  document.body.classList.add('secousse');
  return new Promise(ok => setTimeout(() => {
    $('take-that').hidden = true;
    document.body.classList.remove('secousse');
    ok();
  }, 950));
}

// ---------- Chargement : tout est prêt avant que René parle ----------
const IMAGES = [...new Set(Object.values(POSES).flat())].map(n => RENE + n + '.gif').concat([
  OL + 'Images/Backgrounds/Preset/%5BPW%5D%20Witness.jpg', OL + 'Images/Backgrounds/Preset_Desk/%5BPW%5D%20Witness.png',
  OL + 'Images/Bubbles/3.png']);
const gardees = [];
const imagePrete = src => new Promise(ok => { const i = new Image(); gardees.push(i); i.onload = i.onerror = ok; i.src = src; });
(async () => {
  await Promise.race([Promise.all(IMAGES.map(imagePrete)), new Promise(ok => setTimeout(ok, 20000))]);
  voir('Stand');
  $('ecran-chargement').hidden = true;
  $('ecran-scene').hidden = false;
  musique.play().catch(() => {});
  accueil();
})();
