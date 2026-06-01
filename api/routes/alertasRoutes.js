const express = require('express');
const router = express.Router();
const c = require('../controllers/alertasController');
const { authMiddleware } = require('../middleware/auth');

router.get('/catalogo',   c.catalogo);
router.get('/config',     authMiddleware, c.obtenerConfig);
router.get('/log',        authMiddleware, c.listarLog);
router.post('/disparar',  authMiddleware, c.disparar);
router.post('/check',     c.check);

module.exports = router;
