// Code partagé par index.html et admin.html.

const db = SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

document.querySelectorAll('[data-titre]').forEach(el => el.textContent = TITRE_SONDAGE);
document.title = TITRE_SONDAGE + (document.title ? ' · ' + document.title : '');

async function chargerPersos() {
  const rep = await fetch('characters.json', { cache: 'no-cache' });
  return persosValides(await rep.json());
}

// Remplace les <i data-lucide="..."> par les icônes (si la bibliothèque a pu se charger).
function icones() {
  if (window.lucide) lucide.createIcons();
}

// Si l'image manque, la classe "manquante" affiche à la place un cadre avec le nom.
function imageOuRemplacement(img, src) {
  img.onerror = () => img.classList.add('manquante');
  if (src) img.src = src; else img.classList.add('manquante');
}

function creerCarte(p) {
  const carte = document.createElement('div');
  carte.className = 'carte';
  carte.dataset.id = p.id;
  carte.innerHTML = `
    <button type="button" class="carte-cadre">
      <img alt="" loading="lazy">
      <span class="carte-vide"></span>
      <span class="rang" aria-hidden="true"></span>
    </button>
    <span class="carte-nom"></span>
    <button type="button" class="carte-loupe" aria-label="Agrandir"><i data-lucide="zoom-in"></i></button>`;
  carte.querySelector('.carte-nom').textContent = p.nom;
  carte.querySelector('.carte-vide').textContent = p.nom;
  carte.querySelector('.carte-cadre').setAttribute('aria-label', p.nom);
  imageOuRemplacement(carte.querySelector('img'), p.image);
  return carte;
}

// Mini-vignette (liste du classement, tableau admin).
function creerVignette(p) {
  const v = document.createElement('span');
  v.className = 'vignette';
  v.innerHTML = '<img alt=""><span class="carte-vide"></span>';
  v.querySelector('.carte-vide').textContent = p ? p.nom.slice(0, 2) : '?';
  imageOuRemplacement(v.querySelector('img'), p && p.image);
  return v;
}

function echapper(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}
