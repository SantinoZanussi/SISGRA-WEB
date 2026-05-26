const express = require('express');
const router = express.Router();
const c = require('../controllers/webhookController');
const { authMiddleware } = require('../middleware/auth');

router.post('/pres',               c.recibirWebhook);
router.get('/cache',               authMiddleware, c.listarCache);
router.get('/cache/:id',           authMiddleware, c.obtenerEntrada);
router.patch('/cache/:id',         authMiddleware, c.editarEntrada);
router.post('/cache/:id/publicar', authMiddleware, c.publicarEntrada);
router.delete('/cache/:id',        authMiddleware, c.eliminarEntrada);

module.exports = router;
