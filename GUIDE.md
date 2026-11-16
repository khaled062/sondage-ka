# Guide : mettre le sondage en ligne

## 1. Ajouter tes personnages
1. Mets les images dans `assets/characters/`. Format conseillé : portrait (plus haut que large), png ou jpg.
2. Ouvre `characters.json` (avec le Bloc-notes) et remplace les 50 cartes provisoires :
   ```json
   { "id": "phoenix", "nom": "Phoenix", "image": "assets/characters/phoenix.png" },
   ```
   - `id` : simple, sans espace ni accent, et différent pour chaque perso.
   - **Un perso dont le `nom` est vide (`"nom": ""`) est ignoré** : tu peux laisser des emplacements vides.
   - Une image manquante affiche un cadre avec le nom à la place.
3. Le titre affiché en haut se change dans `js/config.js` (`TITRE_SONDAGE`).

## 1 bis. Ce que tu peux régler toi-même
| Quoi | Où |
|---|---|
| Textes de l'accueil (« Bienvenue sur le », « Sondage de popularité », « KA ») | `js/config.js` : `BIENVENUE`, `LOGO_HAUT`, `LOGO_BAS` |
| Titre de la barre du haut | `js/config.js` : `TITRE_SONDAGE` |
| Répliques et expressions du juge | `js/vote.js` : `REGLES` (expressions : `stand`, `positif`, `negatif`, `surpris`, `yeux`, `non`) |
| Musiques et leur volume (0 à 1, déjà égalisés entre eux) | `js/vote.js` : `MUSIQUES` |

D'où vient chaque élément : **tout est copié dans le projet**, le sondage ne dépend plus d'objection.lol.
- `assets/objection/` : juge et ses expressions, fonds, bulle « Take that! », cris, voix, marteau, cadres de preuve, police Trilogy, musiques Investigation ~ Core 2001 (vote) et Suspense2001 (« Es-tu sûr ? »), et les portes du tribunal (`portes.webp`).
- `assets/musique/` : la musique de l'écran titre et des règles (Ace Attorney Trilogy - Title Theme) et celle de la découverte des persos (Ichinichi no Hajimari).
- Sur le vrai site, les navigateurs empêchent la musique de démarrer toute seule : sur l'écran titre, le premier clic lance la musique, et le suivant ouvre les portes.
- Pour recopier ces éléments depuis objection.lol (par exemple pour en ajouter un), complète la liste dans `tests/copier-elements.js`, puis lance `node tests/copier-elements.js`.

Pense à envoyer tout le dossier `assets/` sur GitHub avec le reste. Les noms de fichiers avec espaces ou crochets sont normaux.

Sur iPhone et Mac (Safari) :
- les portes ne s'affichent pas, et l'accueil garde le fond de la salle d'audience ;
- la musique du vote (format .ogg) peut ne pas se lancer ;
- le volume peut être plus fort qu'ailleurs, mais le bouton « ♪ Son » coupe tout.

⚠️ Ces éléments viennent des jeux Ace Attorney (© Capcom), via objection.lol : garde le sondage entre amis.

## 2. Créer la base Supabase (gratuit)
1. Va sur **supabase.com** et crée un compte (bouton *Start your project*).
2. Clique sur **New project** : choisis un nom (ex. `sondage`), un mot de passe de base de données (garde-le de côté, il ne sert pas pour le site) et une région en Europe.
3. Attends 1 à 2 minutes que le projet soit prêt.
4. Dans le menu de gauche, ouvre **SQL Editor**, puis **New query**. Colle tout le contenu du fichier `supabase.sql` et clique sur **Run**. Le message attendu est « Success ».
5. **Important**, pour que personne d'autre ne puisse devenir admin : ouvre **Authentication**, puis **Sign In / Providers** (ou *Providers*), et **décoche « Allow new users to sign up »**. Enregistre.

## 3. Créer ton compte admin
1. Ouvre **Authentication**, puis **Users**, puis **Add user** et **Create new user**.
2. Saisis ton email et un mot de passe, et coche **Auto Confirm User**.
3. C'est avec cet email et ce mot de passe que tu te connecteras sur `admin.html`.

## 4. Brancher le site à Supabase
1. Ouvre **Project Settings** (roue dentée), puis **API** (ou *API Keys*).
2. Copie :
   - le **Project URL** (`https://xxxx.supabase.co`), qui se trouve aussi dans *Data API* ;
   - la clé **anon public** (ou **publishable**).
3. Colle-les dans `js/config.js` :
   ```js
   const SUPABASE_URL = "https://xxxx.supabase.co";
   const SUPABASE_ANON_KEY = "la clé copiée";
   ```
   ⚠️ Ne mets **jamais** la clé `service_role` / `secret`.

## 5. Mettre en ligne avec GitHub Pages (gratuit)
1. Crée un compte sur **github.com**.
2. En haut à droite, clique sur **+**, puis **New repository**. Donne-lui un nom (ex. `sondage`), coche **Public**, puis **Create repository**.
3. Sur la page du dépôt, clique sur **uploading an existing file** (ou *Add file*, puis *Upload files*).
4. Ouvre le dossier du sondage sur ton PC, **sélectionne tout son contenu** (`index.html`, `admin.html`, `characters.json`, et les dossiers `css`, `js`, `assets`…) et glisse-le dans la page. Clique ensuite sur **Commit changes**.
   Glisse bien le *contenu* du dossier, pas le dossier lui-même : `index.html` doit être à la racine.
5. Ouvre **Settings**, puis **Pages**. Dans *Branch*, choisis **main** et **/ (root)**, puis **Save**.
6. Attends 1 à 2 minutes et recharge : l'adresse s'affiche en haut, du type `https://ton-pseudo.github.io/sondage/`.
   - Lien pour tes amis : `https://ton-pseudo.github.io/sondage/`
   - Ton espace admin : `https://ton-pseudo.github.io/sondage/admin.html`

Pour modifier un fichier plus tard, renvoie-le avec *Add file*, puis *Upload files* : il remplace l'ancien. Le site se met à jour en 1 à 2 minutes.

## 6. Avant de lancer
- Fais un vote test toi-même, vérifie qu'il apparaît dans l'admin, puis supprime-le (bouton « Supprimer ce vote »).
  Pour revoter depuis le même navigateur pendant tes tests, ouvre une fenêtre de navigation privée.
- Le projet Supabase gratuit **se met en pause après environ une semaine sans activité**. Si c'est le cas, va sur supabase.com et clique sur *Restore*. Rien n'est perdu.
- Pour arrêter le sondage : bouton « Fermer le sondage » dans l'admin.

## Tester en local (facultatif)
Le site doit être ouvert via un petit serveur : un double-clic sur `index.html` ne charge pas `characters.json`.
Le test du calcul des scores se lance avec : `node tests/scoring.test.js`
