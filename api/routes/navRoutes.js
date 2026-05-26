const express = require('express');
const router = express.Router();
const c = require('../controllers/navController');
const { authMiddleware } = require('../middleware/auth');

router.post('/page',          c.getPage);
router.get('/botones',        c.listarBotones);
router.post('/botones',       authMiddleware, c.crearBoton);
router.patch('/botones/:id',  authMiddleware, c.actualizarBoton);
router.delete('/botones/:id', authMiddleware, c.eliminarBoton);

module.exports = router;
