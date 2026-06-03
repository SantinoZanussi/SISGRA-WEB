const express = require('express');
const router = express.Router();
const c = require('../controllers/alertasController');
const { authMiddleware } = require('../middleware/auth');

router.get('/catalogo',   c.catalogo);
router.get('/log',        authMiddleware, c.listarLog);
// La API PRES consulta acá (POST) si hay plantillas/módulos vencidos.
router.post('/check',     c.check);

module.exports = router;
