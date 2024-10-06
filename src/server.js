const express = require('express');
const cors = require('cors');
const path = require('path');
const consultas = require('../api/index');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rota da API
app.post('/api', consultas);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Rota para a página HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
