// Copie dans assets/objection/ les éléments d'objection.lol (et les portes) utilisés par le sondage,
// en gardant les mêmes chemins. Lancer depuis le dossier du projet : node tests/copier-elements.js
const https = require('https');
const fs = require('fs');
const path = require('path');

const OL = 'https://objection.lol/';
const FICHIERS = [
  ...['Stand', 'Stand_Talk', 'Special_1', 'Special_2', 'Negative_Stand', 'Negative_Talk',
    'Surprised_Stand', 'Surprised_Talk', 'Closed_Eyes', 'Headshake'].map(n => `Images/Characters/10/${n}.gif`),
  'Images/gavel.webp',
  'Images/Bubbles/3.png',
  'Images/evidence container.png',
  'Images/UI/Chatbox/Trilogy/textbox.png',
  'Images/Backgrounds/Preset/[PW] Judge.jpg',
  'Images/Backgrounds/Preset/PW Courtroom.jpg',
  'Audio/blip.wav',
  'Audio/Vocal/3/1.mp3',
  'Audio/Vocal/1/10.mp3',
  'Audio/Music/search opening 2002.ogg',
  'Audio/Music/suspense.ogg',
  'Audio/Music/search core.ogg',
  'Audio/Sound/deskslam.mp3',
  'Fonts/Trilogy-body.woff2'
].map(p => [OL + encodeURI(p).replace(/\[/g, '%5B').replace(/\]/g, '%5D'), path.join('assets/objection', p)]);
FICHIERS.push(['https://file.garden/ZnpHRMcckCV0ABUB/Popups/GameOverDoor_AJT_16-9.webp', 'assets/objection/portes.webp']);

function telecharger(url, dest, essais = 3) {
  return new Promise((ok, ko) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, rep => {
      if (rep.statusCode !== 200) { rep.resume(); return ko(new Error('code ' + rep.statusCode)); }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const f = fs.createWriteStream(dest);
      rep.pipe(f);
      f.on('finish', () => f.close(() => ok(fs.statSync(dest).size)));
    }).on('error', ko);
  }).catch(e => essais > 1 ? new Promise(r => setTimeout(r, 1500)).then(() => telecharger(url, dest, essais - 1)) : Promise.reject(e));
}

(async () => {
  let erreurs = 0;
  for (const [url, dest] of FICHIERS) {
    try {
      const taille = await telecharger(url, dest);
      console.log('ok     ', dest, Math.round(taille / 1024) + ' Ko');
    } catch (e) {
      erreurs++;
      console.log('ÉCHEC  ', dest, '(' + e.message + ')');
    }
    await new Promise(r => setTimeout(r, 400)); // objection.lol limite le nombre de requêtes
  }
  console.log(erreurs ? `${erreurs} fichier(s) en échec : relance plus tard.` : 'Tout est copié.');
  process.exitCode = erreurs ? 1 : 0;
})();
