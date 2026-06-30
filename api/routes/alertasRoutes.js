const express = require('express');
const router = express.Router();
const c = require('../controllers/alertasController');
const { authMiddleware } = require('../middleware/auth');

router.get('/catalogo',   c.catalogo);
router.get('/log',        authMiddleware, c.listarLog);
// la API PRES consulta aca si hay vencimientos
router.post('/check',     c.check);

module.exports = router;
