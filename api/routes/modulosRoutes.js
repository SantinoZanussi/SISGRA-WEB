const express = require('express');
const router = express.Router();
const c = require('../controllers/modulosController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', c.listar);
router.get('/:type/variantes', c.listarVariantes);
router.post('/:type/variantes', authMiddleware, c.crearVariante);
router.put('/:type/variantes/:id', authMiddleware, c.actualizarVariante);
router.delete('/:type/variantes/:id', authMiddleware, c.eliminarVariante);

module.exports = router;
