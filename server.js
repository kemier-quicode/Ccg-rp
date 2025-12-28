// ================================
// CCG RP – Serveur Node.js + Express + SQLite
// ================================

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database('ccg.db');

// ---------- STYLE CCG ----------
const CCG_STYLE = `
<style>
  body { background:#0b0b0b; color:#e0e0e0; font-family: monospace; }
  h1,h2,h3 { color:#b30000; }
  a { color:#ff4d4d; }
  input, textarea, select, button {
    background:#111; color:#fff; border:1px solid #444; padding:5px;
  }
  button { cursor:pointer; }
  .card { border:1px solid #550000; padding:10px; margin:10px; background:#140000; }
  .warn { color:#ff3333; font-weight:bold; }
</style>
`;

// ---------- MIDDLEWARE ----------
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'ccg-secret-rp',
  resave: false,
  saveUninitialized: false
}));

function auth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function role(required) {
  return (req, res, next) => {
    const levels = ['visiteur', 'chercheur', 'senior', 'admin'];
    if (levels.indexOf(req.session.user.role) < levels.indexOf(required)) {
      return res.status(403).send('Accès refusé');
    }
    next();
  };
}

// ---------- DB INIT ----------
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS dossiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT,
  contenu TEXT,
  niveau TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS sujets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT,
  alias TEXT,
  type TEXT,
  rc INTEGER,
  kagune TEXT,
  statut TEXT,
  description TEXT,
  danger TEXT,
  notes TEXT
)
`).run();

// Compte admin par défaut
const admin = db.prepare('SELECT * FROM users WHERE username=?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)')
    .run('admin', hash, 'admin');
}

// ---------- ROUTES ----------

// Page d'accueil
app.get('/', (req, res) => {
  res.send(`
    <h1>Division Scientifique du CCG</h1>
    <p>Portail interne RP</p>
    ${req.session.user ? `<p>Connecté en tant que ${req.session.user.username} (${req.session.user.role})</p>` : ''}
    <a href="/login">Connexion</a> | <a href="/logout">Déconnexion</a>
    <ul>
      <li><a href="/archives">Archives publiques</a></li>
      <li><a href="/lab">Laboratoire</a></li>
      <li><a href="/direction">Direction</a></li>
    </ul>
  `);
});

// Login / Logout
app.get('/login', (req, res) => {
  res.send(`
    <h2>Connexion</h2>
    <form method="post">
      <input name="username" placeholder="Identifiant" />
      <input name="password" type="password" placeholder="Mot de passe" />
      <button>Entrer</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(req.body.username);
  if (!user || !bcrypt.compareSync(req.body.password, user.password)) {
    return res.send('Identifiants incorrects');
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Zones RP
app.get('/archives', (req, res) => {
  res.send('<h2>Archives publiques</h2><p>Dossiers accessibles à tous</p>');
});

app.get('/lab', auth, role('chercheur'), (req, res) => {
  res.send('<h2>Laboratoire</h2><p>Expériences, rapports, sujets ghoul</p>');
});

app.get('/direction', auth, role('admin'), (req, res) => {
  res.send('<h2>Direction Scientifique</h2><p>Projets classifiés SSS</p>');
});

// Dossiers classifiés
app.get('/dossiers', auth, role('chercheur'), (req, res) => {
  const niveaux = {
    visiteur: ['C'],
    chercheur: ['C','B'],
    senior: ['C','B','A'],
    admin: ['C','B','A','SSS']
  };
  const allowed = niveaux[req.session.user.role];
  const dossiers = db.prepare(`SELECT * FROM dossiers WHERE niveau IN (${allowed.map(()=>'?').join(',')})`).all(...allowed);

  res.send('<h2>Dossiers Classifiés</h2>' + dossiers.map(d => `
    <div style="border:1px solid #444;padding:10px;margin:10px;">
      <h3>[${d.niveau}] ${d.titre}</h3>
      <p>${d.contenu}</p>
    </div>
  `).join(''));
});

// Fiches sujets / ghouls
app.get('/sujets', auth, role('chercheur'), (req, res) => {
  const sujets = db.prepare('SELECT * FROM sujets').all();
  res.send(CCG_STYLE + '<h2>Base des sujets biologiques</h2>' + sujets.map(s => `
    <div class="card">
      <h3>${s.nom} — ${s.alias || 'Alias inconnu'}</h3>
      <p class="warn">MENACE : ${s.danger}</p>
      <p><strong>Type :</strong> ${s.type}</p>
      <p><strong>RC :</strong> ${s.rc}</p>
      <p><strong>Kagune :</strong> ${s.kagune}</p>
      <p><strong>Statut :</strong> ${s.statut}</p>
      <p>${s.description}</p>
      <em>Notes internes : ${s.notes || '---'}</em>
    </div>
  `).join(''));
});

// Admin – création utilisateur
app.get('/admin/create', auth, role('admin'), (req, res) => {
  res.send(`
    <h2>Créer un agent</h2>
    <form method="post">
      <input name="username" placeholder="Nom" />
      <input name="password" placeholder="Mot de passe" />
      <select name="role">
        <option>visiteur</option>
        <option>chercheur</option>
        <option>senior</option>
        <option>admin</option>
      </select>
      <button>Créer</button>
    </form>
  `);
});

app.post('/admin/create', auth, role('admin'), (req, res) => {
  const hash = bcrypt.hashSync(req.body.password, 10);
  db.prepare('INSERT INTO users (username,password,role) VALUES (?,?,?)')
    .run(req.body.username, hash, req.body.role);
  res.redirect('/');
});

// Admin – ajout contenu
app.get('/admin/add', auth, role('admin'), (req, res) => {
  res.send(`
    <h2>Ajout RP</h2>
    <h3>Dossier</h3>
    <form method="post" action="/admin/add-dossier">
      <input name="titre" placeholder="Titre" />
      <textarea name="contenu"></textarea>
      <select name="niveau"><option>C</option><option>B</option><option>A</option><option>SSS</option></select>
      <button>Créer</button>
    </form>
    <h3>Sujet / Ghoul</h3>
    <form method="post" action="/admin/add-sujet">
      <input name="nom" placeholder="Nom" />
      <input name="alias" placeholder="Alias" />
      <select name="type"><option>Ghoul</option><option>Sujet expérimental</option></select>
      <input name="rc" placeholder="Taux RC" />
      <input name="kagune" placeholder="Type de Kagune" />
      <input name="statut" placeholder="Statut (capturé, en fuite…)" />
      <textarea name="description" placeholder="Description détaillée"></textarea>
      <select name="danger"><option>Faible</option><option>Moyen</option><option>Élevé</option><option>Extrême</option></select>
      <textarea name="notes" placeholder="Notes scientifiques"></textarea>
      <button>Créer</button>
    </form>
  `);
});

app.post('/admin/add-dossier', auth, role('admin'), (req, res) => {
  db.prepare('INSERT INTO dossiers (titre,contenu,niveau) VALUES (?,?,?)')
    .run(req.body.titre, req.body.contenu, req.body.niveau);
  res.redirect('/dossiers');
});

app.post('/admin/add-sujet', auth, role('admin'), (req, res) => {
  db.prepare('INSERT INTO sujets (nom,alias,type,rc,kagune,statut,description,danger,notes) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(req.body.nom, req.body.alias, req.body.type, req.body.rc || 0, req.body.kagune, req.body.statut, req.body.description, req.body.danger, req.body.notes);
  res.redirect('/sujets');
});

// ---------- START SERVER ----------
app.listen(PORT, () => console.log(`CCG RP en ligne sur port ${PORT}`));
