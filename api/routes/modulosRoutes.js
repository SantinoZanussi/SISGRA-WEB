const express = require('express');
const router = express.Router();
const c = require('../controllers/modulosController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', c.listar);
router.get('/:id/usos', c.usos);
router.get('/:id', c.obtener);
router.post('/', authMiddleware, c.crear);
router.put('/:id', authMiddleware, c.actualizar);
router.delete('/:id', authMiddleware, c.eliminar);

module.exports = router;
