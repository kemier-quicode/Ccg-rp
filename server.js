// server.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Exemple de route principale
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
